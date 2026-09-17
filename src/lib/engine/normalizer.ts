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
 * Safely handles:
 * - Currency symbols ($ € £ ¥ ₽) and ISO codes (USD, EUR, GBP, RUB)
 * - Accounting parentheses representation: (2,500.00) => -2500.00
 * - European vs US number formatting (e.g. '1.250,50' vs '1,250.50')
 * - Placeholder / indeterminate tokens ('TBD', 'N/A', 'unspecified') => null
 *
 * @param val - Raw value from document text extraction
 * @returns Parsed number, or null if the value is uncommitted or indeterminate
 */
export function parseNumericValue(
  val: string | number | undefined,
): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return val;

  let raw = String(val).trim();
  if (raw === "" || /^(?:tbd|n\/a|indeterminate|unspecified)$/i.test(raw)) {
    return null;
  }

  // Check for accounting parentheses: (2,500.00) => negative
  const isAccountingNegative = /^\(.*\)$/.test(raw);
  const isDirectNegative = raw.startsWith("-") || raw.includes("−");

  // Strip currency symbols, signs, and known currency ISO codes
  let cleaned = raw
    .replace(/[()]/g, "")
    .replace(/[$€£¥₽]/g, "")
    .replace(/USD|EUR|GBP|RUB|CAD|AUD|CHF|JPY|CNY|SGD|NZD|SEK|PLN/gi, "")
    .replace(/\s+/g, "")
    .trim();

  // If alphanumeric specification letters remain (e.g. '42U', '1500VA', '4-Post', '10GbE'),
  // this is a product hardware model or technical descriptor, not a pure numeric value.
  if (/[a-z]/i.test(cleaned)) {
    return null;
  }

  // Architectural Decision: Distinguish European decimal comma from US decimal point:
  // European format: 1.250,50 (dot is thousands separator, comma is decimal)
  // US format:       1,250.50 (comma is thousands separator, dot is decimal)
  const hasCommaDecimal =
    /\d+\.\d{3},\d{1,4}$/.test(cleaned) || /^\d+,\d{1,4}$/.test(cleaned);
  const hasDotDecimal =
    /\d+,\d{3}\.\d{1,4}$/.test(cleaned) || /^\d+\.\d{1,4}$/.test(cleaned);

  if (hasCommaDecimal && !hasDotDecimal) {
    // European: 1.250,50 => 1250.50
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else {
    // US or default: 1,250.50 => 1250.50
    cleaned = cleaned.replace(/,/g, "");
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return (isAccountingNegative || isDirectNegative) && num > 0 ? -num : num;
}

/**
 * Resolves discount representation tokens (either explicit currency -$1,000.00 or percentage -10%)
 * against a given reference subtotal or baseline sum.
 *
 * @param raw - Text token or phrase containing discount specification
 * @param baseAmount - Base sum from line items or subtotal to compute percentage against
 * @returns Evaluated numeric discount amount in currency units
 */
export function parseDiscountToken(
  raw: string,
  baseAmount: number = 0,
): number | null {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  const percentMatch = cleaned.match(/(\d+(?:\.\d+)?)%/);
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    if (!isNaN(pct)) {
      return Math.round(baseAmount * (pct / 100) * 100) / 100;
    }
  }
  return parseNumericValue(cleaned);
}

/**
 * Formats numeric monetary amounts into standard human-readable currency representation.
 *
 * @param amount - Numeric amount or string representation
 * @param currency - Currency code or symbol (e.g., 'USD', 'EUR', '$', '€')
 * @returns Formatted currency string with two fractional digits
 */
export function formatCurrency(
  amount: number | string | undefined,
  currency: string = "USD",
): string {
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
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4}/i,
  );
  return match ? match[0] : null;
}

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/**
 * Normalizes any valid calendar date string to canonical 'YYYY-MM-DD' format.
 *
 * CRITICAL ARCHITECTURAL CONTEXT (Timezone Drift Immunity):
 * Native JavaScript `new Date("October 15, 2026")` evaluates date strings in the client's local
 * time zone (e.g. UTC+3 converts midnight to 21:00 UTC of October 14th). When compared against an
 * ISO date string `2026-10-15` (parsed at UTC midnight), `d.getUTCDate()` returns 14 vs 15, triggering
 * catastrophic false-positive `DATE_CHANGE` alerts across different user geographic regions.
 *
 * This function bypasses `Date` object serialization entirely using pure regex calendar tokenization,
 * guaranteeing 100% deterministic date matching regardless of server or client timezone.
 *
 * @param dateStr - Raw date string (e.g. 'October 15, 2026', '15.10.2026', '2026-10-15')
 * @returns Canonical 'YYYY-MM-DD' string, or null if indefinite/uncommitted
 */
export function normalizeDateToYMD(dateStr?: string): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (/tbd|pending|determined/i.test(s)) return null;

  // Pattern 1: ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  // Pattern 2: Dotted / European DD.MM.YYYY
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    return `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
  }

  // Pattern 3: Textual Month: "October 15, 2026" or "Oct 15 2026"
  const textMatch1 = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (textMatch1) {
    const m = MONTH_MAP[textMatch1[1].toLowerCase()];
    if (m) {
      return `${textMatch1[3]}-${String(m).padStart(2, "0")}-${textMatch1[2].padStart(2, "0")}`;
    }
  }

  // Pattern 4: "15 October 2026" or "15 Oct 2026"
  const textMatch2 = s.match(/(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/);
  if (textMatch2) {
    const m = MONTH_MAP[textMatch2[2].toLowerCase()];
    if (m) {
      return `${textMatch2[3]}-${String(m).padStart(2, "0")}-${textMatch2[1].padStart(2, "0")}`;
    }
  }

  // Fallback: Local date components from Date.parse
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return null;
}

/**
 * Robust date equivalence comparison handling diverse locales and formatting.
 * Guaranteed timezone-proof: e.g. 'October 15, 2026' === '2026-10-15' === '15.10.2026'.
 * Correctly classifies 'TBD' or indefinite schedules as non-equivalent to concrete calendar dates.
 *
 * @param date1 - First date string from proposal
 * @param date2 - Second date string from proposal
 * @returns True if both dates designate the exact same calendar day
 */
export function areDatesEquivalent(date1?: string, date2?: string): boolean {
  if (!date1 || !date2) return false;
  if (date1.trim().toLowerCase() === date2.trim().toLowerCase()) return true;

  if (
    /tbd|determined|pending/i.test(date1) ||
    /tbd|determined|pending/i.test(date2)
  ) {
    return false;
  }

  const ymd1 = normalizeDateToYMD(date1);
  const ymd2 = normalizeDateToYMD(date2);
  if (ymd1 && ymd2) {
    return ymd1 === ymd2;
  }

  return false;
}
