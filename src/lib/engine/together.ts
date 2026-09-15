import { CanonicalLineItem } from "../types";

export interface TogetherSemanticMatchResult {
  isMatch: boolean;
  confidence: number;
  reason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    costUSD: number;
  };
}

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY || "";
const DEFAULT_MODEL =
  process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo";

// $1.04 per 1M tokens for Llama-3.3-70B-Instruct-Turbo
const PRICE_PER_MILLION_TOKENS = 1.04;

/**
 * Executes semantic identity resolution between two candidate line items using Together AI
 * running meta-llama/Llama-3.3-70B-Instruct-Turbo in structured JSON mode.
 *
 * This function serves as the tier-5 arbiter in the entity matching pipeline when
 * deterministic lexical similarity (Levenshtein, token matching) is ambiguous.
 *
 * @param originalItem - Line item from original commercial proposal
 * @param revisedItem - Line item from revised commercial proposal
 * @param apiKey - Together AI API authorization key
 * @param modelName - Inference model identifier (defaults to Llama 3.3 70B Turbo)
 * @returns Semantic match decision, confidence score, rationale, and token accounting metadata
 */
export async function matchItemsWithTogetherAI(
  originalItem: CanonicalLineItem,
  revisedItem: CanonicalLineItem,
  apiKey: string = TOGETHER_API_KEY,
  modelName: string = DEFAULT_MODEL
): Promise<TogetherSemanticMatchResult | null> {
  if (!apiKey) return null;

  try {
    const prompt = `You are an expert commercial contract auditor comparing two proposals.
Original Item: "${originalItem.name}" (Qty: ${originalItem.qty}, Unit Price: ${originalItem.unitPrice})
Revised Item: "${revisedItem.name}" (Qty: ${revisedItem.qty}, Unit Price: ${revisedItem.unitPrice})

Determine if the Revised Item corresponds to the same scope/deliverable as the Original Item despite renaming, abbreviation, or minor specification changes.

Return ONLY a valid JSON object matching this schema:
{
  "isMatch": boolean,
  "confidence": number between 0.0 and 1.0,
  "reason": "concise 1-sentence technical explanation"
}`;

    const res = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: "You are a precise commercial contract auditor. Always output pure valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 150,
      }),
    });

    if (!res.ok) {
      console.warn("Together AI request failed:", await res.text());
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    const promptTokens = data.usage?.prompt_tokens || 100;
    const completionTokens = data.usage?.completion_tokens || 50;
    const totalTokens = promptTokens + completionTokens;
    const costUSD = (totalTokens / 1_000_000) * PRICE_PER_MILLION_TOKENS;

    return {
      isMatch: Boolean(parsed.isMatch),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
      reason: parsed.reason || "Semantic correspondence identified by AI",
      usage: {
        promptTokens,
        completionTokens,
        costUSD: Math.round(costUSD * 100_000) / 100_000,
      },
    };
  } catch (err) {
    console.error("Together AI semantic matching error:", err);
    return null;
  }
}
