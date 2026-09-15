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
  item2: CanonicalLineItem
): { score: number; reason: string } {
  if (item1.normalizedName === item2.normalizedName) {
    return { score: 1.0, reason: "Exact title match" };
  }

  const maxLen = Math.max(item1.normalizedName.length, item2.normalizedName.length);
  const levDist = fastLevenshtein.get(item1.normalizedName, item2.normalizedName);
  const levRatio = 1 - levDist / maxLen;

  if (levRatio >= 0.85) {
    return { score: Math.round(levRatio * 100) / 100, reason: "High lexical similarity" };
  }

  const id1 = extractModelIdentifiers(item1.name);
  const id2 = extractModelIdentifiers(item2.name);
  const sharedIds = id1.filter((id) =>
    id2.some((idB) => id === idB || id.includes(idB) || idB.includes(id))
  );

  const tokenOverlap = calculateTokenOverlap(item1.name, item2.name);

  if (sharedIds.length > 0) {
    const score = Math.min(0.95, 0.75 + tokenOverlap * 0.2 + sharedIds.length * 0.1);
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

  const categories = ["server", "switch", "monitor", "ups", "cable", "workstation", "service"];
  const n1 = item1.normalizedName;
  const n2 = item2.normalizedName;
  const sharedCategory = categories.find((c) => n1.includes(c) && n2.includes(c));

  if (sharedCategory) {
    const score = 0.55 + tokenOverlap * 0.3;
    return {
      score: Math.round(score * 100) / 100,
      reason: `Same product category (${sharedCategory}) with altered specifications`,
    };
  }

  return { score: Math.round(levRatio * 100) / 100, reason: "Low similarity" };
}

export async function matchLineItemsAsync(
  originalItems: CanonicalLineItem[],
  revisedItems: CanonicalLineItem[],
  togetherApiKey?: string
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

  // Pass 2: Candidates for AI / Semantic matching
  const remainingOriginals = originalItems.filter((i) => !usedOriginalIds.has(i.id));
  const remainingRevised = revisedItems.filter((i) => !usedRevisedIds.has(i.id));

  for (const orig of remainingOriginals) {
    for (const rev of remainingRevised) {
      if (usedOriginalIds.has(orig.id) || usedRevisedIds.has(rev.id)) continue;

      // Try Together AI if API key is provided
      const aiResult = await matchItemsWithTogetherAI(orig, rev, togetherApiKey);
      if (aiResult) {
        totalAiTokens += aiResult.usage.promptTokens + aiResult.usage.completionTokens;
        totalAiCost += aiResult.usage.costUSD;

        if (aiResult.isMatch) {
          const isConfirmed = aiResult.confidence >= 0.8;
          const pair: MatchedPair = {
            originalItem: orig,
            revisedItem: rev,
            confidence: aiResult.confidence,
            isConfirmed,
            matchReason: `Together AI (Llama 3.3 70B): ${aiResult.reason}`,
          };

          if (isConfirmed) {
            matchedPairs.push(pair);
          } else {
            uncertainMatches.push(pair);
          }

          usedOriginalIds.add(orig.id);
          usedRevisedIds.add(rev.id);
          continue;
        }
      }

      // Fallback to local heuristic scoring if AI did not match or offline
      const { score, reason } = calculateItemSimilarity(orig, rev);
      if (score >= 0.5) {
        const isConfirmed = score >= 0.8;
        const pair: MatchedPair = {
          originalItem: orig,
          revisedItem: rev,
          confidence: score,
          isConfirmed,
          matchReason: reason,
        };

        if (isConfirmed) {
          matchedPairs.push(pair);
        } else {
          uncertainMatches.push(pair);
        }

        usedOriginalIds.add(orig.id);
        usedRevisedIds.add(rev.id);
      }
    }
  }

  const unmatchedOriginalItems = originalItems.filter((i) => !usedOriginalIds.has(i.id));
  const unmatchedRevisedItems = revisedItems.filter((i) => !usedRevisedIds.has(i.id));

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
  revisedItems: CanonicalLineItem[]
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

  const remainingOriginals = originalItems.filter((i) => !usedOriginalIds.has(i.id));
  const remainingRevised = revisedItems.filter((i) => !usedRevisedIds.has(i.id));

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

  const unmatchedOriginalItems = originalItems.filter((i) => !usedOriginalIds.has(i.id));
  const unmatchedRevisedItems = revisedItems.filter((i) => !usedRevisedIds.has(i.id));

  return {
    matchedPairs,
    unmatchedOriginalItems,
    unmatchedRevisedItems,
    uncertainMatches,
  };
}
