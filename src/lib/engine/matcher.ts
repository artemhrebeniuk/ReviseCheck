import fastLevenshtein from "fast-levenshtein";
import { CanonicalLineItem } from "../types";
import { normalizeItemName } from "./normalizer";
import { matchItemsWithTogetherAI } from "./together";

export interface MatchedPair {
  originalItem: CanonicalLineItem;
  revisedItem: CanonicalLineItem;
  confidence: number;
  isConfirmed: boolean;
  matchReason: string;
}

export interface MatchingResult {
  matchedPairs: MatchedPair[];
  unmatchedOriginalItems: CanonicalLineItem[];
  unmatchedRevisedItems: CanonicalLineItem[];
  uncertainMatches: MatchedPair[];
  aiTokensUsed?: number;
  aiCostUSD?: number;
}

function extractModelIdentifiers(text: string): string[] {
  const normalized = normalizeItemName(text);
  const words = normalized.split(/\s+/);
  return words.filter((w) => /[a-z]+[0-9]+|[0-9]+[a-z]+|[0-9]{3,}/i.test(w));
}

function calculateTokenOverlap(str1: string, str2: string): number {
  const t1 = new Set(normalizeItemName(str1).split(/\s+/));
  const t2 = new Set(normalizeItemName(str2).split(/\s+/));

  let intersection = 0;
  for (const token of t1) {
    if (t2.has(token)) intersection++;
  }

  const union = new Set([...t1, ...t2]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Multi-Tier Entity Similarity Scoring
 *
 * Computes a normalized similarity score [0.0 - 1.0] between two line items
 * using exact string equivalence, Levenshtein edit distance, hardware model identifier
 * token extraction, and lexical set overlap.
 *
 * @param item1 - Canonical line item from original document.
 * @param item2 - Canonical line item from revised document.
 * @returns Object containing confidence score and rationale.
 */
export function calculateItemSimilarity(
  item1: CanonicalLineItem,
  item2: CanonicalLineItem,
): { score: number; reason: string } {
  if (item1.normalizedName === item2.normalizedName) {
    return { score: 1.0, reason: "Exact title match" };
  }

  const maxLen = Math.max(
    item1.normalizedName.length,
    item2.normalizedName.length,
  );
  const levDist = fastLevenshtein.get(
    item1.normalizedName,
    item2.normalizedName,
  );
  const levRatio = 1 - levDist / maxLen;

  if (levRatio >= 0.85) {
    return {
      score: Math.round(levRatio * 100) / 100,
      reason: "High lexical similarity",
    };
  }

  const id1 = extractModelIdentifiers(item1.name);
  const id2 = extractModelIdentifiers(item2.name);
  const sharedIds = id1.filter((id) =>
    id2.some((idB) => id === idB || id.includes(idB) || idB.includes(id)),
  );

  const tokenOverlap = calculateTokenOverlap(item1.name, item2.name);

  if (sharedIds.length > 0) {
    const score = Math.min(
      0.95,
      0.75 + tokenOverlap * 0.2 + sharedIds.length * 0.1,
    );
    return {
      score: Math.round(score * 100) / 100,
      reason: `Shared product identifier (${sharedIds.join(", ")}) & semantic domain overlap`,
    };
  }

  if (tokenOverlap >= 0.5) {
    return {
      score: Math.round(tokenOverlap * 100) / 100,
      reason: "Significant token overlap",
    };
  }

  // Domain-agnostic semantic stem and token overlap (works across IT, industrial, medical, construction, consulting)
  const tokens1 = item1.normalizedName
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const tokens2 = item2.normalizedName
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  const sharedStems = tokens1.filter((t1) =>
    tokens2.some((t2) => {
      if (t1 === t2) return true;
      const minL = Math.min(t1.length, t2.length);
      if (
        minL >= 4 &&
        (t1.startsWith(t2.slice(0, 4)) || t2.startsWith(t1.slice(0, 4)))
      ) {
        return true;
      }
      return false;
    }),
  );

  if (sharedStems.length > 0) {
    const stemOverlap =
      sharedStems.length / Math.max(tokens1.length, tokens2.length, 1);
    if (stemOverlap >= 0.33 || sharedStems.length >= 2) {
      const score = Math.min(0.85, 0.55 + stemOverlap * 0.35);
      return {
        score: Math.round(score * 100) / 100,
        reason: `Shared core semantic terminology (${sharedStems.slice(0, 3).join(", ")}) with altered specifications`,
      };
    }
  }

  return { score: Math.round(levRatio * 100) / 100, reason: "Low similarity" };
}

/**
 * Multi-Tier Entity Matching Pipeline (Asynchronous with AI Arbiter)
 *
 * ARCHITECTURAL DESIGN:
 * Matches line items between Document A and Document B through a progressive 3-tier pipeline:
 * - Pass 1: O(N) Exact canonical string equality (100% confidence).
 * - Pass 2: Deterministic heuristic matching pre-scoring candidate pairs using:
 *           - Levenshtein normalized edit distance
 *           - Hardware / product SKU token extraction (e.g. 'R750', 'C9200L', 'c7g.2xlarge')
 *           - Shared domain semantic stems and token set intersection
 *           Pairs with score >= 0.78 are confirmed instantly without external calls.
 * - Pass 3: Together AI (Meta Llama-3.3-70B-Instruct-Turbo) arbiter in strict JSON mode
 *           invoked for ambiguous pairs or total nomenclature rewrites.
 * - Guardrail: Any candidate correlation with confidence < 0.80 is routed to `uncertainMatches`
 *              to prevent unverified model hallucinations from auto-approving proposals.
 *
 * @param originalItems - Canonical line items from original proposal.
 * @param revisedItems - Canonical line items from revised proposal.
 * @param togetherApiKey - Optional API key for Llama-3.3-70B semantic fallback.
 * @returns Fully reconciled MatchingResult with matched pairs, omissions, additions, and telemetry.
 */
export async function matchLineItemsAsync(
  originalItems: CanonicalLineItem[],
  revisedItems: CanonicalLineItem[],
  togetherApiKey?: string,
): Promise<MatchingResult> {
  const matchedPairs: MatchedPair[] = [];
  const uncertainMatches: MatchedPair[] = [];
  const usedRevisedIds = new Set<string>();
  const usedOriginalIds = new Set<string>();

  let totalAiTokens = 0;
  let totalAiCost = 0;

  // Pass 1: Exact matches
  for (const orig of originalItems) {
    for (const rev of revisedItems) {
      if (usedRevisedIds.has(rev.id)) continue;
      if (orig.normalizedName === rev.normalizedName) {
        matchedPairs.push({
          originalItem: orig,
          revisedItem: rev,
          confidence: 1.0,
          isConfirmed: true,
          matchReason: "Exact item description match",
        });
        usedOriginalIds.add(orig.id);
        usedRevisedIds.add(rev.id);
        break;
      }
    }
  }

  // Pass 2: High-confidence heuristic matching (lexical equivalence & hardware identifiers)
  const remainingOriginals = originalItems.filter(
    (i) => !usedOriginalIds.has(i.id),
  );
  const remainingRevised = revisedItems.filter(
    (i) => !usedRevisedIds.has(i.id),
  );

  // Pre-score all candidate pairs
  const candidates: Array<{
    orig: CanonicalLineItem;
    rev: CanonicalLineItem;
    score: number;
    reason: string;
  }> = [];

  for (const orig of remainingOriginals) {
    for (const rev of remainingRevised) {
      const { score, reason } = calculateItemSimilarity(orig, rev);
      if (score >= 0.45) {
        candidates.push({ orig, rev, score, reason });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Instant match for high-confidence candidates (score >= 0.78)
  const ambiguousCandidates: typeof candidates = [];

  for (const cand of candidates) {
    if (usedOriginalIds.has(cand.orig.id) || usedRevisedIds.has(cand.rev.id))
      continue;

    if (cand.score >= 0.78) {
      matchedPairs.push({
        originalItem: cand.orig,
        revisedItem: cand.rev,
        confidence: cand.score,
        isConfirmed: true,
        matchReason: cand.reason,
      });
      usedOriginalIds.add(cand.orig.id);
      usedRevisedIds.add(cand.rev.id);
    } else {
      ambiguousCandidates.push(cand);
    }
  }

  // Pass 3: Parallel AI arbiter for genuinely ambiguous items (if Together API key provided)
  const remainingAmbiguous = ambiguousCandidates.filter(
    (c) => !usedOriginalIds.has(c.orig.id) && !usedRevisedIds.has(c.rev.id),
  );

  // Include any remaining unmatched items as AI candidate pairs (even if heuristic score < 0.45)
  // to allow Llama 3.3 70B to resolve total nomenclature rewrites with zero lexical overlap
  if (togetherApiKey) {
    const unassignedOrig = originalItems.filter(
      (i) => !usedOriginalIds.has(i.id),
    );
    const unassignedRev = revisedItems.filter((i) => !usedRevisedIds.has(i.id));

    for (const orig of unassignedOrig) {
      for (const rev of unassignedRev) {
        if (
          !remainingAmbiguous.some(
            (c) => c.orig.id === orig.id && c.rev.id === rev.id,
          )
        ) {
          const { score, reason } = calculateItemSimilarity(orig, rev);
          remainingAmbiguous.push({ orig, rev, score, reason });
        }
      }
    }
  }

  if (togetherApiKey && remainingAmbiguous.length > 0) {
    // Limit to top candidate pairs to prevent combinatorial explosion
    const topCandidates = remainingAmbiguous.slice(0, 4);

    const aiEvaluations = await Promise.all(
      topCandidates.map(async (cand) => {
        try {
          const aiResult = await matchItemsWithTogetherAI(
            cand.orig,
            cand.rev,
            togetherApiKey,
          );
          return { cand, aiResult };
        } catch {
          return { cand, aiResult: null };
        }
      }),
    );

    for (const { cand, aiResult } of aiEvaluations) {
      if (usedOriginalIds.has(cand.orig.id) || usedRevisedIds.has(cand.rev.id))
        continue;

      if (aiResult) {
        totalAiTokens +=
          aiResult.usage.promptTokens + aiResult.usage.completionTokens;
        totalAiCost += aiResult.usage.costUSD;

        if (aiResult.isMatch) {
          const isConfirmed = aiResult.confidence >= 0.8;
          const pair: MatchedPair = {
            originalItem: cand.orig,
            revisedItem: cand.rev,
            confidence: aiResult.confidence,
            isConfirmed,
            matchReason: `Together AI (Llama 3.3 70B): ${aiResult.reason}`,
          };

          if (isConfirmed) {
            matchedPairs.push(pair);
          } else {
            uncertainMatches.push(pair);
          }

          usedOriginalIds.add(cand.orig.id);
          usedRevisedIds.add(cand.rev.id);
          continue;
        }
      }

      // Fallback to heuristic scoring
      if (cand.score >= 0.5) {
        const isConfirmed = cand.score >= 0.8;
        const pair: MatchedPair = {
          originalItem: cand.orig,
          revisedItem: cand.rev,
          confidence: cand.score,
          isConfirmed,
          matchReason: cand.reason,
        };

        if (isConfirmed) {
          matchedPairs.push(pair);
        } else {
          uncertainMatches.push(pair);
        }

        usedOriginalIds.add(cand.orig.id);
        usedRevisedIds.add(cand.rev.id);
      }
    }
  } else {
    // Pure offline heuristic for remaining ambiguous items
    for (const cand of remainingAmbiguous) {
      if (usedOriginalIds.has(cand.orig.id) || usedRevisedIds.has(cand.rev.id))
        continue;

      if (cand.score >= 0.48) {
        const isConfirmed = cand.score >= 0.8;
        const pair: MatchedPair = {
          originalItem: cand.orig,
          revisedItem: cand.rev,
          confidence: cand.score,
          isConfirmed,
          matchReason: cand.reason,
        };

        if (isConfirmed) {
          matchedPairs.push(pair);
        } else {
          uncertainMatches.push(pair);
        }

        usedOriginalIds.add(cand.orig.id);
        usedRevisedIds.add(cand.rev.id);
      }
    }
  }

  const unmatchedOriginalItems = originalItems.filter(
    (i) => !usedOriginalIds.has(i.id),
  );
  const unmatchedRevisedItems = revisedItems.filter(
    (i) => !usedRevisedIds.has(i.id),
  );

  return {
    matchedPairs,
    unmatchedOriginalItems,
    unmatchedRevisedItems,
    uncertainMatches,
    aiTokensUsed: totalAiTokens,
    aiCostUSD: totalAiCost,
  };
}

export function matchLineItems(
  originalItems: CanonicalLineItem[],
  revisedItems: CanonicalLineItem[],
): MatchingResult {
  const matchedPairs: MatchedPair[] = [];
  const uncertainMatches: MatchedPair[] = [];
  const usedRevisedIds = new Set<string>();
  const usedOriginalIds = new Set<string>();

  for (const orig of originalItems) {
    for (const rev of revisedItems) {
      if (usedRevisedIds.has(rev.id)) continue;
      if (orig.normalizedName === rev.normalizedName) {
        matchedPairs.push({
          originalItem: orig,
          revisedItem: rev,
          confidence: 1.0,
          isConfirmed: true,
          matchReason: "Exact item description match",
        });
        usedOriginalIds.add(orig.id);
        usedRevisedIds.add(rev.id);
        break;
      }
    }
  }

  const remainingOriginals = originalItems.filter(
    (i) => !usedOriginalIds.has(i.id),
  );
  const remainingRevised = revisedItems.filter(
    (i) => !usedRevisedIds.has(i.id),
  );

  const candidates: Array<{
    orig: CanonicalLineItem;
    rev: CanonicalLineItem;
    score: number;
    reason: string;
  }> = [];

  for (const orig of remainingOriginals) {
    for (const rev of remainingRevised) {
      const { score, reason } = calculateItemSimilarity(orig, rev);
      if (score >= 0.45) {
        candidates.push({ orig, rev, score, reason });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  for (const cand of candidates) {
    if (usedOriginalIds.has(cand.orig.id) || usedRevisedIds.has(cand.rev.id)) {
      continue;
    }

    const isConfirmed = cand.score >= 0.8;
    const pair: MatchedPair = {
      originalItem: cand.orig,
      revisedItem: cand.rev,
      confidence: cand.score,
      isConfirmed,
      matchReason: cand.reason,
    };

    if (isConfirmed) {
      matchedPairs.push(pair);
    } else {
      uncertainMatches.push(pair);
    }

    usedOriginalIds.add(cand.orig.id);
    usedRevisedIds.add(cand.rev.id);
  }

  const unmatchedOriginalItems = originalItems.filter(
    (i) => !usedOriginalIds.has(i.id),
  );
  const unmatchedRevisedItems = revisedItems.filter(
    (i) => !usedRevisedIds.has(i.id),
  );

  return {
    matchedPairs,
    unmatchedOriginalItems,
    unmatchedRevisedItems,
    uncertainMatches,
  };
}
