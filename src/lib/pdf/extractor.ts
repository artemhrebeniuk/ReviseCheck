import {
  BoundingBox,
  CanonicalLineItem,
  ExtractedDocument,
  SourceLocation,
} from "../types";
import {
  normalizeItemName,
  parseNumericValue,
  parseDate,
  parseDiscountToken,
} from "../engine/normalizer";

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
  pdfBuffer: Uint8Array | ArrayBuffer | Buffer,
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
  // Support up to 15 pages per document (scope defined as up to 3 pages in brief)
  const maxPagesToProcess = Math.min(totalPages, 15);

  const allLines: RawLine[] = [];
  let currentLineNumber = 1;

  for (let pageNum = 1; pageNum <= maxPagesToProcess; pageNum++) {
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
          bbox: {
            x: token.x,
            y: token.y,
            width: token.width,
            height: token.height,
          },
        };
        pageLines.push(line);
      }
      line.tokens.push(token);
    }

    // Sort tokens within line by X
    pageLines.sort((a, b) => a.y - b.y);
    for (const line of pageLines) {
      line.tokens.sort((a, b) => a.x - b.x);
      line.text = line.tokens
        .map((t) => t.text)
        .join(" ")
        .trim();

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
  let subtotal: number | undefined;
  let discountAmount: number | undefined;
  let discountPercent: number | null = null;
  let taxAmount: number | undefined;
  let taxPercent: number | null = null;
  let shippingAmount: number | undefined;
  let deliveryTerms: string | undefined;
  let validityDays: number | undefined;

  for (const line of allLines) {
    const text = line.text;

    /** Identify the title or offer number from the text. */
    if (text.includes("OFFER") || text.includes("PROPOSAL")) {
      title = text;
    }

    // Detect Currency (ISO Codes & Flexible Statements e.g. "Currency: USD", "All prices quoted in CAD")
    const currMatch = text.match(
      /(?:Currency|All\s+prices\s+quoted\s+in|Base\s+Currency)\s*[:]?\s*([A-Z]{3})/i,
    );
    if (currMatch) {
      const code = currMatch[1].toUpperCase();
      if (
        /^(USD|EUR|GBP|RUB|CAD|AUD|CHF|JPY|CNY|SGD|NZD|SEK|NOK|PLN|UAH)$/.test(
          code,
        )
      ) {
        currency = code;
      }
    } else if (text.includes("Currency:") || text.includes("Base Currency:")) {
      if (text.includes("EUR")) currency = "EUR";
      else if (text.includes("GBP")) currency = "GBP";
      else if (text.includes("RUB")) currency = "RUB";
      else if (text.includes("CAD")) currency = "CAD";
      else if (text.includes("AUD")) currency = "AUD";
      else if (text.includes("CHF")) currency = "CHF";
      else if (text.includes("JPY")) currency = "JPY";
      else if (text.includes("CNY")) currency = "CNY";
      else if (text.includes("USD")) currency = "USD";
    }

    // Detect Dates
    if (
      text.includes("Date of Issue:") ||
      text.includes("Issue Date:") ||
      /Proposal Date/i.test(text)
    ) {
      const match = text.match(
        /(?:Issue(?:\s+Date)?:?\s*)([A-Za-z0-9,\s]+?)(?:Validity|Proposal|$)/i,
      );
      if (match) {
        const raw = match[1].trim();
        issueDate = parseDate(raw) || raw;
      } else {
        const parsedDate = parseDate(text);
        if (parsedDate && !issueDate) issueDate = parsedDate;
      }
    }

    if (/Delivery\s*(?:Date|Timeline|Schedule)?\s*:/i.test(text)) {
      const parsedDelivery = parseDate(text);
      if (parsedDelivery && !deliveryDate) deliveryDate = parsedDelivery;
    }

    // Detect Stated Grand Total — handles many variants:
    //   "Grand Total: $57,900.00"
    //   "Grand Total (USD): $57,900.00"
    //   "Grand Total (USD ($)): $59,400.00"
    //   "Total Amount EUR: 54,000.00"
    const gtKeyword =
      /(?:Grand Total|Total Amount|Total Proposed|Total Revised|Total Contract Value)/i.test(
        text,
      );
    if (gtKeyword) {
      // Strategy 1: lazy match to first currency-prefixed number after the keyword
      const m1 = text.match(
        /(?:Grand Total|Total Amount|Total Proposed|Total Revised|Total Contract Value).*?([$€£][0-9,]+(?:\.[0-9]{2})?)/i,
      );
      if (m1) {
        const parsed = parseNumericValue(m1[1]);
        if (parsed !== null && parsed > 1) statedGrandTotal = parsed;
      } else {
        // Strategy 2: number after last colon or dollar sign on the line
        const m2 = text.match(/([$€£][0-9,]+(?:\.[0-9]{2})?)(?:\s*)$/);
        if (m2) {
          const parsed = parseNumericValue(m2[1]);
          if (parsed !== null && parsed > 1) statedGrandTotal = parsed;
        }
      }
    }

    // Detect Subtotal
    if (/Subtotal/i.test(text)) {
      const subMatch = text.match(
        /Subtotal\s*[:$]?\s*([$€£]?[0-9,]+(?:\.[0-9]{2})?)/i,
      );
      if (subMatch) {
        const parsed = parseNumericValue(subMatch[1]);
        if (parsed !== null) subtotal = parsed;
      } else {
        const parts = text.split(/\s+/);
        const last = parts[parts.length - 1];
        const parsed = parseNumericValue(last);
        if (parsed !== null) subtotal = parsed;
      }
    }

    // Detect Discount or Rebate
    if (/(?:Discount|Rebate)/i.test(text)) {
      const pct = text.match(/(\d+(?:\.\d+)?)%/);
      if (pct) {
        discountPercent = parseFloat(pct[1]);
      }
      const discMatch = text.match(
        /(?:Discount|Rebate)\s*[:$]?\s*([$€£]?[0-9,]+(?:\.[0-9]{2})?)/i,
      );
      const targetStr = discMatch ? discMatch[1] : text.split(/\s+/).pop()!;
      const parsed = parseDiscountToken(
        targetStr,
        subtotal ?? statedGrandTotal ?? 0,
      );
      if (parsed !== null && parsed !== 0) {
        discountAmount = Math.abs(parsed);
      } else if (pct) {
        const base = subtotal ?? statedGrandTotal ?? 0;
        discountAmount =
          Math.round(base * (parseFloat(pct[1]) / 100) * 100) / 100;
      }
    }

    // Detect Tax / VAT
    if (
      /(?:VAT|Tax|Sales Tax)/i.test(text) &&
      !/terms|validity|condition/i.test(text)
    ) {
      const pct = text.match(/(\d+(?:\.\d+)?)%/);
      if (pct) {
        taxPercent = parseFloat(pct[1]);
      }
      const vatMatch = text.match(
        /(?:VAT|Tax|Sales Tax)\s*[:$]?\s*([$€£]?[0-9,]+(?:\.[0-9]{2})?)/i,
      );
      const targetStr = vatMatch ? vatMatch[1] : text.split(/\s+/).pop()!;
      const parsed = parseNumericValue(targetStr);
      if (parsed !== null && parsed !== 0) {
        taxAmount = Math.abs(parsed);
      }
    }

    // Detect Shipping / Freight
    if (/(?:Shipping|Freight|Delivery Fee)/i.test(text)) {
      const parts = text.split(/\s+/);
      const last = parts[parts.length - 1];
      const parsed = parseNumericValue(last);
      if (parsed !== null && parsed !== 0) {
        shippingAmount = Math.abs(parsed);
      }
    }

    // Detect Delivery Terms / Incoterms
    const incotermsMatch = text.match(
      /\b(DDP|EXW|FOB|CIF|DAP|CIP|CPT|FCA|FAS|DPU)\b/i,
    );
    if (incotermsMatch && !deliveryTerms) {
      deliveryTerms = incotermsMatch[1].toUpperCase();
    }

    // Detect Proposal Validity
    const valMatch = text.match(/Validity\s*:\s*(\d+)\s*Days?/i);
    if (valMatch && !validityDays) {
      validityDays = parseInt(valMatch[1], 10);
    }
  }

  // Dynamic currency symbol detection if no explicit header was matched
  let eurCount = 0;
  let usdCount = 0;
  let gbpCount = 0;
  let rubCount = 0;

  for (const line of allLines) {
    if (/€|\bEUR\b/.test(line.text)) eurCount++;
    if (/\$|\bUSD\b/.test(line.text)) usdCount++;
    if (/£|\bGBP\b/.test(line.text)) gbpCount++;
    if (/₽|\bRUB\b/.test(line.text)) rubCount++;
  }

  const hasExplicitCurrencyHeader = allLines.some((l) =>
    /Currency\s*:/i.test(l.text),
  );
  if (!hasExplicitCurrencyHeader) {
    if (eurCount > usdCount && eurCount > gbpCount && eurCount > rubCount) {
      currency = "EUR";
    } else if (
      gbpCount > usdCount &&
      gbpCount > eurCount &&
      gbpCount > rubCount
    ) {
      currency = "GBP";
    } else if (
      rubCount > usdCount &&
      rubCount > eurCount &&
      rubCount > gbpCount
    ) {
      currency = "RUB";
    } else if (usdCount > 0) {
      currency = "USD";
    }
  }

  // Extract Table Items
  const items: CanonicalLineItem[] = [];
  let inTable = false;
  let columnOrder: "standard" | "price_before_qty" | "qty_first" = "standard";
  let itemRowIndex = 0;
  let lastPage = 0;

  let pendingDescPrefix = "";

  for (const line of allLines) {
    const text = line.text;

    // Track page transitions: allow table to continue across pages unless an explicit section boundary is hit
    if (line.page !== lastPage) {
      lastPage = line.page;
    }

    // Skip document headers, section banners, running headers and pagination text
    if (
      /COMMERCIAL PROPOSAL|OFFICIAL PROPOSAL|ENTERPRISE PROPOSAL|REVISED PROPOSAL|PROPOSAL #|^\s*(?:SECTION|TIER)\s+\d+\b|MODULE [A-Z0-9]+|TERMS & CONDITIONS|Authorized Signature|Date of Issue|Date:|Validity:|Currency:|Page \d+ of \d+/i.test(
        text,
      )
    ) {
      // Only genuine contractual closing sections terminate the line-item table.
      // Running header metadata (Date of Issue, Validity) on page 2 or 3 must NOT terminate inTable.
      if (
        /TERMS & CONDITIONS|Authorized Signature|Sign-off|Acceptance of Proposal/i.test(
          text,
        )
      ) {
        inTable = false;
        pendingDescPrefix = "";
      }
      continue;
    }

    // Skip pagination footer continuation lines
    if (/Continued on Page/i.test(text)) {
      continue;
    }

    // Table Header Detection
    if (
      /(?:Description|Item|Specification|Scope|Deliverable|Component|Service|Product|BOM|Work\s*Package|Task).*?(?:Total|Amount|Price|Rate|Fee|Cost|Ext)|ITEM DESCRIPTION.*QUANTITY|#\s+.*(?:Item|Description|Scope|Deliverable)/i.test(
        text,
      )
    ) {
      inTable = true;
      pendingDescPrefix = "";
      if (/^(?:#\s+)?(?:Qty|Quantity)/i.test(text.trim())) {
        columnOrder = "qty_first";
      } else if (/(?:Unit\s*Price|Rate|Price).*?(?:Qty|Quantity)/i.test(text)) {
        columnOrder = "price_before_qty";
      } else {
        columnOrder = "standard";
      }
      continue;
    }

    // Table Footer Detection
    if (
      inTable &&
      /Subtotal|Grand Total|Total Amount|Total Items|Total Proposed|Total Revised|Stated Total|Payment Terms|Authorized/i.test(
        text,
      )
    ) {
      inTable = false;
      pendingDescPrefix = "";
      continue;
    }

    if (inTable) {
      let cleanTokens = text.split(/\s+/).filter((t) => t !== "@" && t !== "=");
      // Strip cosmetic trailing words like 'net', 'gross', 'ea', 'each', 'vat', 'incl', 'excl'
      while (
        cleanTokens.length > 3 &&
        /^(?:net|gross|ea|each|mo|month|yr|year|lot|pcs|units|vat|tax|incl|excl)$/i.test(
          cleanTokens[cleanTokens.length - 1],
        )
      ) {
        cleanTokens.pop();
      }

      if (cleanTokens.length >= 4) {
        const totalStr = cleanTokens[cleanTokens.length - 1];
        let rawPriceCandidate = cleanTokens[cleanTokens.length - 2];
        let rawQtyCandidate = cleanTokens[cleanTokens.length - 3];

        // Check for line-item discount or extra tax columns before total:
        // e.g. [Description | Qty | Rate | 10% | Total] or [Description | Qty | Rate | 10% Disc | Total]
        if (cleanTokens.length >= 5) {
          const tokPenultimate = cleanTokens[cleanTokens.length - 2];
          const tokAntepenultimate = cleanTokens[cleanTokens.length - 3];

          if (
            /^[-−]?\d+(?:\.\d+)?%$/i.test(tokPenultimate) ||
            /^(?:disc|rebate|discount)$/i.test(tokPenultimate)
          ) {
            rawPriceCandidate = cleanTokens[cleanTokens.length - 3];
            rawQtyCandidate = cleanTokens[cleanTokens.length - 4];
          } else if (
            /^(?:disc|rebate|discount)$/i.test(tokPenultimate) &&
            /^[-−]?\d+(?:\.\d+)?%$/i.test(tokAntepenultimate)
          ) {
            rawPriceCandidate = cleanTokens[cleanTokens.length - 4];
            rawQtyCandidate = cleanTokens[cleanTokens.length - 5];
          }
        }

        // Architectural Context: Dynamic Column Order Handling
        // Some vendor accounting layouts invert column ordering: [Description | Rate | Qty | Total]
        // If detected via table header or currency symbols ($3,000.00 vs 5), swap candidates
        // to prevent misclassifying $3,000 as quantity and 5 as unit price.
        if (columnOrder === "price_before_qty") {
          rawPriceCandidate = cleanTokens[cleanTokens.length - 3];
          rawQtyCandidate = cleanTokens[cleanTokens.length - 2];
        } else {
          // Heuristic Fallback: If token -3 has a currency symbol ($ € £) and token -2 does not,
          // token -3 is unambiguously the Unit Rate and token -2 is the Quantity.
          const tok3HasCurr = /[$€£]/.test(cleanTokens[cleanTokens.length - 3]);
          const tok2HasCurr = /[$€£]/.test(cleanTokens[cleanTokens.length - 2]);
          if (tok3HasCurr && !tok2HasCurr) {
            rawPriceCandidate = cleanTokens[cleanTokens.length - 3];
            rawQtyCandidate = cleanTokens[cleanTokens.length - 2];
          }
        }

        const rawPrice = parseNumericValue(rawPriceCandidate);
        const rawTotal = parseNumericValue(totalStr);

        // Require at least a valid price or total (or explicit TBD) to prevent sentence text from parsing as a line item
        if (
          rawPrice === null &&
          rawPriceCandidate.toUpperCase() !== "TBD" &&
          rawTotal === null
        ) {
          if (
            !/Terms|Validity|Condition|Subtotal|Total|Signature/i.test(text)
          ) {
            // Architectural Context (Multiline Sub-row Poisoning Prevention):
            // In technical quotes, a specification or warranty note often sits directly below a row:
            // e.g. "Dell PowerEdge R750" followed by "Includes 3-year 24/7 mission-critical warranty".
            // If treated as an independent row, it would either create a phantom item or poison the next item.
            // Attaching it as a specification suffix to the preceding item preserves semantic fidelity.
            if (
              items.length > 0 &&
              /^(?:includes|including|warranty|support|with|for|specification|licen|tier|sla|sn|pn|-|\*|\()/i.test(
                text.trim(),
              )
            ) {
              const lastItem = items[items.length - 1];
              lastItem.name = `${lastItem.name} (${text.trim()})`;
              lastItem.normalizedName = normalizeItemName(lastItem.name);
            } else {
              pendingDescPrefix =
                (pendingDescPrefix ? pendingDescPrefix + " " : "") +
                text.trim();
            }
          }
          continue;
        }

        let descParts = cleanTokens.slice(0, cleanTokens.length - 3);
        if (/^\d+$/.test(descParts[0])) {
          descParts = descParts.slice(1);
        }

        let qty = parseNumericValue(rawQtyCandidate) ?? 1;
        let unitPrice = rawPrice ?? 0;
        let statedTotal = rawTotal ?? qty * unitPrice;

        // If rawQtyCandidate is a unit of measure token (e.g. "hrs", "Lot", "pcs", "m")
        // and the last token in descParts is the actual numeric quantity (e.g. "40" in "40 hrs"):
        const lastDescToken =
          descParts.length > 0 ? descParts[descParts.length - 1] : null;
        const trailingQtyInDesc = lastDescToken
          ? parseNumericValue(lastDescToken)
          : null;

        if (
          parseNumericValue(rawQtyCandidate) === null &&
          trailingQtyInDesc !== null
        ) {
          qty = trailingQtyInDesc;
          descParts = descParts.slice(0, descParts.length - 1);
        } else if (
          parseNumericValue(rawQtyCandidate) === null &&
          cleanTokens.length >= 4
        ) {
          // Check transposed layout [Qty | Description | Price | Total]
          if (
            /^\d+$/.test(cleanTokens[0]) &&
            parseNumericValue(cleanTokens[1]) !== null
          ) {
            qty = parseNumericValue(cleanTokens[1])!;
            descParts = cleanTokens.slice(2, cleanTokens.length - 2);
          } else if (
            parseNumericValue(cleanTokens[0]) !== null &&
            !/^[1-9]\d?$/.test(cleanTokens[0])
          ) {
            qty = parseNumericValue(cleanTokens[0])!;
            descParts = cleanTokens.slice(1, cleanTokens.length - 2);
          } else {
            descParts.push(rawQtyCandidate);
          }
        }

        let description = descParts.join(" ").trim();
        if (pendingDescPrefix) {
          description = `${pendingDescPrefix} ${description}`.trim();
          pendingDescPrefix = "";
        }

        if (/^Total\b/i.test(description) || description.length < 2) {
          continue;
        }
        const calculatedTotal = Math.round(qty * unitPrice * 100) / 100;
        const hasArithmeticError =
          rawPriceCandidate.toUpperCase() !== "TBD" &&
          Math.abs(calculatedTotal - statedTotal) > 0.01;
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

        itemRowIndex++;
        items.push({
          id: `item-${line.page}-${itemRowIndex}`,
          name: description,
          normalizedName: normalizeItemName(description),
          rowIndex: itemRowIndex,
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

  // Deterministic sum of items (reconciled with discounts/taxes/shipping if present)
  const itemsSum =
    Math.round(items.reduce((acc, it) => acc + it.statedTotal, 0) * 100) / 100;

  if (discountPercent !== null && (!discountAmount || discountAmount === 0)) {
    const base = subtotal ?? itemsSum;
    discountAmount = Math.round(base * (discountPercent / 100) * 100) / 100;
  }

  if (taxPercent !== null && (!taxAmount || taxAmount === 0)) {
    const taxableBase = (subtotal ?? itemsSum) - (discountAmount ?? 0);
    taxAmount = Math.round(taxableBase * (taxPercent / 100) * 100) / 100;
  }

  // Architectural Context (Tax-Inclusive / Gross Invoices):
  // In many European and B2C proposals, line items are already gross (tax-inclusive), while
  // the footer displays a informational note: e.g. "Includes 20% VAT: $2,866.67".
  // If we naively added VAT to itemsSum, we would double-count the tax and falsely reject a valid proposal.
  // We reconcile this by checking if statedGrandTotal already equals itemsSum without tax added.
  const isTaxAlreadyIncluded =
    taxAmount !== undefined &&
    statedGrandTotal !== undefined &&
    Math.abs(
      statedGrandTotal -
        (itemsSum - (discountAmount ?? 0) + (shippingAmount ?? 0)),
    ) < 0.05;

  const taxInclusive =
    isTaxAlreadyIncluded ||
    /(?:VAT|Tax)\s*(?:Included|Inclusive)|Gross|Inclusive of (?:VAT|Tax)/i.test(
      allLines.map((l) => l.text).join(" "),
    );

  let expectedGrandTotal = itemsSum;
  if (discountAmount) expectedGrandTotal -= discountAmount;
  if (taxAmount && !taxInclusive) expectedGrandTotal += taxAmount;
  if (shippingAmount) expectedGrandTotal += shippingAmount;
  expectedGrandTotal = Math.round(expectedGrandTotal * 100) / 100;

  const calculatedGrandTotal = itemsSum;

  const hasGrandTotalDiscrepancy =
    statedGrandTotal !== undefined &&
    Math.abs(statedGrandTotal - expectedGrandTotal) > 0.01;

  const grandTotalDiscrepancy = hasGrandTotalDiscrepancy
    ? Math.round(((statedGrandTotal ?? 0) - expectedGrandTotal) * 100) / 100
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
    subtotal,
    discountAmount,
    taxAmount,
    taxInclusive,
    shippingAmount,
    deliveryTerms,
    validityDays,
    rawLines: allLines.map((l) => ({
      page: l.page,
      lineNumber: l.lineNumber,
      text: l.text,
      bbox: l.bbox,
    })),
    totalPages,
  };
}
