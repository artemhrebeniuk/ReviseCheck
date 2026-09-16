import Decimal from "decimal.js";

/**
 * Normalizes multi-line and irregular whitespace characters into single space tokens.
 *
 * @param str - Raw input string to clean
 * @returns Cleaned string trimmed of leading and trailing whitespace
 */
export function cleanText(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Canonicalizes item names for deterministic identity matching.
 * Performs lowercase conversion, strips non-alphanumeric punctuation,
 * and collapses internal whitespace.
 *
 * @param name - Raw item description or name from proposal
 * @returns Normalized alphanumeric token string for lexical comparison
 */
export function normalizeItemName(name: string): string {
  return cleanText(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses raw numeric or currency string inputs into standard floating-point numbers.
 * Safely handles currency symbols ($ € £), ISO codes (USD, EUR, GBP, RUB),
 * thousands separators (commas), and placeholder terms (TBD, N/A).
 *
 * @param val - Raw value from document text extraction
 * @returns Parsed number, or null if the value is uncommitted or indeterminate
 */
export function parseNumericValue(val: string | number | undefined): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return val;

  // Clean string: remove $, €, USD, EUR, commas, spaces
  const cleaned = val
    .replace(/[$€£]/g, "")
    .replace(/USD|EUR|GBP|RUB/gi, "")
    .replace(/,/g, "")
    .trim();

  if (cleaned === "" || cleaned.toLowerCase() === "tbd" || cleaned.toLowerCase() === "n/a") {
    return null;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Formats numeric monetary amounts into standard human-readable currency representation.
 *
 * @param amount - Numeric amount or string representation
 * @param currency - Currency code or symbol (e.g., 'USD', 'EUR', '$', '€')
 * @returns Formatted currency string with two fractional digits
 */
export function formatCurrency(amount: number | string | undefined, currency: string = "USD"): string {
  if (amount === undefined || amount === null) return "N/A";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "N/A";

  const isNegative = num < 0;
  const absFormatted = Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sign = isNegative ? "-" : "";

  if (currency === "USD" || currency === "$") {
    return `${sign}$${absFormatted}`;
  }
  if (currency === "EUR" || currency === "€") {
    return `${sign}€${absFormatted}`;
  }
  return `${sign}${currency} ${absFormatted}`;
}

/**
 * Extracts and standardizes delivery or contract dates from unstructured text strings.
 * Supports textual month formats ('October 15, 2026') as well as ISO and dotted formats.
 *
 * @param dateStr - Raw line or string containing date information
 * @returns Extracted date string, or null if no valid date pattern is matched
 */
export function parseDate(dateStr: string): string | null {
  const cleaned = cleanText(dateStr);
  const match = cleaned.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}/i
  );
  return match ? match[0] : null;
}

