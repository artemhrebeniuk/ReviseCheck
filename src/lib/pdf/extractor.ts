import {
  BoundingBox,
  CanonicalLineItem,
  ExtractedDocument,
  SourceLocation,
} from "../types";
import { normalizeItemName, parseNumericValue, parseDate } from "../engine/normalizer";

interface RawToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface RawLine {
  page: number;
  lineNumber: number;
  y: number;
  tokens: RawToken[];
  text: string;
  bbox: BoundingBox;
}

/**
 * Ingests a text-based commercial offer PDF, performs DOM spatial token extraction via PDF.js,
 * converts bottom-left origin coordinates to standard top-left web viewport coordinates,
 * clusters tokens into logical document lines, and extracts canonical line items, metadata,
 * and dual source bounding boxes [x, y, width, height].
 *
 * @param pdfBuffer - Raw PDF binary data (Uint8Array, ArrayBuffer, or Buffer)
 * @returns Extracted document representation containing canonical line items, raw text, and page metrics
 */
export async function extractPdfDocument(
  pdfBuffer: Uint8Array | ArrayBuffer | Buffer
): Promise<ExtractedDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const totalPages = doc.numPages;

  const allLines: RawLine[] = [];
  let currentLineNumber = 1;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const rawTokens: RawToken[] = [];
    for (const item of textContent.items as Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
    }>) {
      if (!item.str || item.str.trim().length === 0) continue;

      const tx = item.transform[4];
      const ty = item.transform[5];
      const h = item.height || 10;
      // Convert bottom-left origin to top-left origin
      const y = viewport.height - ty - h;

      rawTokens.push({
        text: item.str,
        x: tx,
        y,
        width: item.width,
        height: h,
        page: pageNum,
      });
    }

    // Sort tokens by Y ascending (top to bottom), then X ascending (left to right)
    rawTokens.sort((a, b) => a.y - b.y || a.x - b.x);

    // Group tokens into lines (threshold 6pt)
    const pageLines: RawLine[] = [];
    for (const token of rawTokens) {
      let line = pageLines.find((l) => Math.abs(l.y - token.y) < 6);
      if (!line) {
        line = {
          page: pageNum,
          lineNumber: currentLineNumber++,
          y: token.y,
          tokens: [],
          text: "",
          bbox: { x: token.x, y: token.y, width: token.width, height: token.height },
        };
        pageLines.push(line);
      }
      line.tokens.push(token);
    }

    // Sort tokens within line by X
    pageLines.sort((a, b) => a.y - b.y);
    for (const line of pageLines) {
      line.tokens.sort((a, b) => a.x - b.x);
      line.text = line.tokens.map((t) => t.text).join(" ").trim();

      const minX = Math.min(...line.tokens.map((t) => t.x));
      const minY = Math.min(...line.tokens.map((t) => t.y));
      const maxX = Math.max(...line.tokens.map((t) => t.x + t.width));
      const maxY = Math.max(...line.tokens.map((t) => t.y + t.height));

      line.bbox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };

      allLines.push(line);
    }
  }

  // Extract Metadata: Title, Currency, Dates, Grand Total
  let title = "Commercial Offer";
  let currency = "USD";
  let issueDate: string | undefined;
  let deliveryDate: string | undefined;
  let statedGrandTotal: number | undefined;

  for (const line of allLines) {
    const text = line.text;

    /** Identify the title or offer number from the text. */
    if (text.includes("OFFER") || text.includes("PROPOSAL")) {
      title = text;
    }

    // Detect Currency
    if (text.includes("Currency:") || text.includes("Base Currency:")) {
      if (text.includes("EUR")) currency = "EUR";
      else if (text.includes("GBP")) currency = "GBP";
      else if (text.includes("RUB")) currency = "RUB";
      else currency = "USD";
    }

    // Detect Dates
    if (text.includes("Date of Issue:") || text.includes("Issue Date:")) {
      const match = text.match(/(?:Issue(?:\s+Date)?:?\s*)([A-Za-z0-9,\s]+?)(?:Validity|Proposal|$)/i);
      if (match) {
        const raw = match[1].trim();
        issueDate = parseDate(raw) || raw;
      }
    }
    if (text.includes("Delivery Date:")) {
      const match = text.match(/Delivery Date:\s*(.+)$/i);
      if (match) {
        const raw = match[1].trim();
        deliveryDate = parseDate(raw) || raw;
      }
    }

    // Detect Grand Total
    if (text.includes("Grand Total") || text.includes("Total Amount")) {
      const parts = text.split(/\s+/);
      const last = parts[parts.length - 1];
      const parsed = parseNumericValue(last);
      if (parsed !== null) {
        statedGrandTotal = parsed;
      }
    }
  }

  // Extract Table Items
  const items: CanonicalLineItem[] = [];
  let inTable = false;
  let itemRowIndex = 0;
  let lastPage = 0;

  for (const line of allLines) {
    const text = line.text;

    // Reset table boundary on each new page
    if (line.page !== lastPage) {
      inTable = false;
      lastPage = line.page;
    }

    // Skip document headers, section banners and pagination text
    if (
      /COMMERCIAL PROPOSAL|OFFICIAL PROPOSAL|ENTERPRISE PROPOSAL|REVISED PROPOSAL|SECTION \d+|MODULE [A-Z0-9]+|Continued on Page|TERMS & CONDITIONS|Authorized Signature|Date of Issue|Date:|Validity:|Currency:/i.test(
        text
      )
    ) {
      inTable = false;
      continue;
    }

    // Table Header Detection
    if (
      /(?:Description|Item|Specification|Scope).*Qty.*Total|ITEM DESCRIPTION.*QUANTITY|#\s+.*(?:Item|Description|Scope)/i.test(
        text
      )
    ) {
      inTable = true;
      continue;
    }

    // Table Footer Detection
    if (
      inTable &&
      /Subtotal|Grand Total|Total Amount|Total Items|Total Proposed|Total Revised|Stated Total|Payment Terms|Authorized/i.test(
        text
      )
    ) {
      inTable = false;
      continue;
    }

    if (inTable) {
      const parts = text.split(/\s+/);
      if (parts.length >= 4) {
        const totalStr = parts[parts.length - 1];
        const priceStr = parts[parts.length - 2];
        const qtyStr = parts[parts.length - 3];

        let descParts = parts.slice(0, parts.length - 3);
        if (/^\d+$/.test(descParts[0])) {
          descParts = descParts.slice(1);
        }
        
        // Handle cases where qty had a unit like "40 hrs" or "1 Lot"
        let qty = parseNumericValue(qtyStr) ?? 1;
        let unitPrice = parseNumericValue(priceStr) ?? 0;
        let statedTotal = parseNumericValue(totalStr) ?? (qty * unitPrice);

        // If qtyStr was a unit like "hrs" or "Lot" and descParts has the trailing number:
        if (isNaN(Number(qtyStr)) && descParts.length > 0) {
          const lastDescToken = descParts[descParts.length - 1];
          const parsedQty = parseNumericValue(lastDescToken);
          if (parsedQty !== null) {
            qty = parsedQty;
            descParts = descParts.slice(0, descParts.length - 1);
          }
        }

        const description = descParts.join(" ").trim();
        if (/^Total\b/i.test(description) || description.length < 2) {
          continue;
        }
        const calculatedTotal = Math.round(qty * unitPrice * 100) / 100;
        const hasArithmeticError = priceStr.toUpperCase() !== "TBD" && Math.abs(calculatedTotal - statedTotal) > 0.01;
        const arithmeticDiscrepancy = hasArithmeticError
          ? Math.round((statedTotal - calculatedTotal) * 100) / 100
          : 0;

        const location: SourceLocation = {
          page: line.page,
          lineNumber: line.lineNumber,
          textSnippet: text,
          bbox: {
            x: Math.max(30, line.bbox.x - 5),
            y: line.bbox.y - 2,
            width: Math.min(540, line.bbox.width + 10),
            height: line.bbox.height + 4,
          },
        };

        items.push({
          id: `item-${line.page}-${itemRowIndex++}`,
          rowIndex: itemRowIndex,
          name: description,
          normalizedName: normalizeItemName(description),
          qty,
          unitPrice,
          statedTotal,
          calculatedTotal,
          hasArithmeticError,
          arithmeticDiscrepancy,
          deliveryDate,
          rawText: text,
          location,
        });
      }
    }
  }

  // Deterministic sum of items
  const calculatedGrandTotal =
    Math.round(items.reduce((acc, it) => acc + it.statedTotal, 0) * 100) / 100;

  const hasGrandTotalDiscrepancy =
    statedGrandTotal !== undefined &&
    Math.abs(statedGrandTotal - calculatedGrandTotal) > 0.01;

  const grandTotalDiscrepancy = hasGrandTotalDiscrepancy
    ? Math.round(((statedGrandTotal ?? 0) - calculatedGrandTotal) * 100) / 100
    : 0;

  return {
    title,
    currency,
    date: issueDate,
    deliveryDate,
    items,
    statedGrandTotal,
    calculatedGrandTotal,
    hasGrandTotalDiscrepancy,
    grandTotalDiscrepancy,
    rawLines: allLines.map((l) => ({
      page: l.page,
      lineNumber: l.lineNumber,
      text: l.text,
      bbox: l.bbox,
    })),
    totalPages,
  };
}
