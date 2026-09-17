import {
  AuditReport,
  AuditVerdict,
  CanonicalLineItem,
  CommercialDiff,
  ExtractedDocument,
  SourceLocation,
  TelemetryData,
} from "../types";
import {
  formatCurrency,
  areDatesEquivalent,
  normalizeDateToYMD,
} from "./normalizer";
import { matchLineItems, matchLineItemsAsync, MatchingResult } from "./matcher";
import { auditDocumentArithmetic } from "./arithmetic";

/**
 * Enterprise Commercial Differential Engine
 *
 * Compares two extracted commercial offers and synthesizes a deterministic
 * audit report. Enforces strict zero-hallucination math, isolates formatting changes
 * from substantive business alterations, and links every finding to exact dual-source coordinates.
 *
 * @param doc1 - Reference original document with verified canonical items and bounding boxes.
 * @param doc2 - Candidate revised document with verified canonical items and bounding boxes.
 * @param matchingResult - Multi-tier entity alignment result pairing original and revised items.
 * @param startTime - Epoch timestamp at audit initiation for telemetry calculation.
 * @param telemetryOverride - Optional telemetry metrics (latency, token usage, cost).
 * @returns Fully reconciled AuditReport ready for executive decision-making.
 */
function buildReportFromMatching(
  doc1: ExtractedDocument,
  doc2: ExtractedDocument,
  matchingResult: MatchingResult,
  startTime: number,
  telemetryOverride?: Partial<TelemetryData>,
): AuditReport {
  const diffs: CommercialDiff[] = [];
  const keyRisks: string[] = [];
  const clarificationQuestions: string[] = [];

  // ARCHITECTURAL DECISION: Dedicated Document Scope Anchor
  // The challenge specification requires: "Every change must reference both source locations."
  // When an item is deleted from Document B (SCOPE_REMOVED) or newly introduced (SCOPE_ADDED),
  // physical text for that item strictly does NOT exist in the opposite document.
  // Naive prototypes fell back to `doc.items[0]` (e.g. Dell Server), causing the UI to highlight
  // a completely unrelated line item in the opposite canvas when reviewing an omitted item.
  // By pointing to a dedicated Scope Anchor on the proposal title/header, we maintain 100% valid
  // dual-source coordinates while visually signaling that the omission applies to the proposal scope as a whole.
  const findHeaderLine = (doc: ExtractedDocument): SourceLocation => {
    const titleLine =
      doc.rawLines?.find((l) =>
        /COMMERCIAL\s+PROPOSAL|OFFICIAL\s+PROPOSAL|REVISED\s+PROPOSAL|PROPOSAL\s+#/i.test(
          l.text,
        ),
      ) ??
      doc.rawLines?.find((l) => /PROPOSAL|OFFER/i.test(l.text)) ??
      doc.rawLines?.[0];

    if (titleLine) {
      return {
        page: titleLine.page,
        lineNumber: titleLine.lineNumber,
        textSnippet: `${titleLine.text} (Document Scope Anchor)`,
        bbox: {
          x: Math.max(30, titleLine.bbox.x),
          y: titleLine.bbox.y,
          width: Math.min(540, Math.max(200, titleLine.bbox.width)),
          height: Math.max(20, titleLine.bbox.height),
        },
      };
    }
    return {
      page: 1,
      lineNumber: 1,
      textSnippet: `${doc.title || "Commercial Proposal"} (Document Scope Anchor)`,
      bbox: { x: 40, y: 40, width: 500, height: 24 },
    };
  };

  const findDeliveryDateLine = (doc: ExtractedDocument): SourceLocation => {
    const deliveryLine = doc.rawLines?.find((l) =>
      /Delivery\s*(?:Date|Timeline|Schedule)?\s*:/i.test(l.text),
    );
    if (deliveryLine) {
      return {
        page: deliveryLine.page,
        lineNumber: deliveryLine.lineNumber,
        textSnippet: deliveryLine.text,
        bbox: {
          x: Math.max(30, deliveryLine.bbox.x),
          y: deliveryLine.bbox.y,
          width: Math.min(540, Math.max(220, deliveryLine.bbox.width)),
          height: Math.max(16, deliveryLine.bbox.height),
        },
      };
    }
    return findHeaderLine(doc);
  };

  const findCurrencyLine = (doc: ExtractedDocument): SourceLocation => {
    const currLine = doc.rawLines?.find((l) => /Currency\s*:/i.test(l.text));
    if (currLine) {
      return {
        page: currLine.page,
        lineNumber: currLine.lineNumber,
        textSnippet: currLine.text,
        bbox: {
          x: Math.max(30, currLine.bbox.x),
          y: currLine.bbox.y,
          width: Math.min(540, Math.max(200, currLine.bbox.width)),
          height: Math.max(16, currLine.bbox.height),
        },
      };
    }
    return findHeaderLine(doc);
  };

  const findGrandTotalLine = (doc: ExtractedDocument): SourceLocation => {
    // Search rawLines in reverse (bottom up) for the Grand Total or Total line with digits
    const totalLine =
      [...(doc.rawLines || [])]
        .reverse()
        .find(
          (l) =>
            /Grand\s+Total|Stated\s+(?:Grand\s+)?Total|Total\s*(?:\(USD\)|\(EUR\)|\(\$\)|\:|\s)/i.test(
              l.text,
            ) && /\d/.test(l.text),
        ) ??
      [...(doc.rawLines || [])]
        .reverse()
        .find((l) => /Total/i.test(l.text) && /\d/.test(l.text));

    if (totalLine) {
      return {
        page: totalLine.page,
        lineNumber: totalLine.lineNumber,
        textSnippet: totalLine.text,
        bbox: {
          x: Math.max(30, totalLine.bbox.x),
          y: totalLine.bbox.y,
          width: Math.min(540, Math.max(180, totalLine.bbox.width)),
          height: Math.max(16, totalLine.bbox.height),
        },
      };
    }
    return findHeaderLine(doc);
  };

  const doc1HeaderLoc: SourceLocation = findHeaderLine(doc1);
  const doc2HeaderLoc: SourceLocation = findHeaderLine(doc2);
  const doc1TotalLoc: SourceLocation = findGrandTotalLine(doc1);
  const doc2TotalLoc: SourceLocation = findGrandTotalLine(doc2);

  // 1. Currency Mismatch Check
  if (doc1.currency && doc2.currency && doc1.currency !== doc2.currency) {
    diffs.push({
      id: "currency-mismatch",
      type: "FORMATTING_ONLY",
      severity: "CRITICAL",
      category: "AUDIT_RISK",
      title: "Currency Conflict Between Proposals",
      description: `Original offer is in ${doc1.currency}, whereas revised offer is in ${doc2.currency}. Direct mathematical comparison is invalid without forex consensus.`,
      originalValue: doc1.currency,
      revisedValue: doc2.currency,
      confidence: 1.0,
      isConfirmed: true,
      isSubstantive: true,
      originalLocation: findCurrencyLine(doc1),
      revisedLocation: findCurrencyLine(doc2),
    });
    keyRisks.push(`Currency changed from ${doc1.currency} to ${doc2.currency}`);
    clarificationQuestions.push(
      `Please confirm the agreed base currency: Original is in ${doc1.currency} and Revised is in ${doc2.currency}.`,
    );
  }

  // 2. Delivery Date Comparison
  if (doc1.deliveryDate && doc2.deliveryDate) {
    if (!areDatesEquivalent(doc1.deliveryDate, doc2.deliveryDate)) {
      const isVague =
        doc2.deliveryDate.toLowerCase().includes("tbd") ||
        doc2.deliveryDate.toLowerCase().includes("determined");

      diffs.push({
        id: "delivery-date-change",
        type: "DATE_CHANGE",
        severity: isVague ? "CRITICAL" : "WARNING",
        category: "SCHEDULE",
        title: isVague
          ? "Uncertain / Unspecified Delivery Timeline"
          : "Delivery Schedule Postponed / Altered",
        description: `Delivery date shifted from "${doc1.deliveryDate}" to "${doc2.deliveryDate}".`,
        originalValue: doc1.deliveryDate,
        revisedValue: doc2.deliveryDate,
        delta: isVague ? "Indefinite" : "Schedule altered",
        confidence: 1.0,
        isConfirmed: true,
        isSubstantive: true,
        originalLocation: findDeliveryDateLine(doc1),
        revisedLocation: findDeliveryDateLine(doc2),
      });

      if (isVague) {
        keyRisks.push(
          `Revised delivery date is uncommitted: "${doc2.deliveryDate}"`,
        );
        clarificationQuestions.push(
          `What is the concrete deadline for completion? The revised offer lists "${doc2.deliveryDate}".`,
        );
      } else {
        keyRisks.push(
          `Delivery date changed from ${doc1.deliveryDate} to ${doc2.deliveryDate}`,
        );
      }
    }
  }

  // Temporal Paradox Guardrail: Delivery date cannot precede proposal issue date
  if (doc2.date && doc2.deliveryDate) {
    const issueYMD = normalizeDateToYMD(doc2.date);
    const deliveryYMD = normalizeDateToYMD(doc2.deliveryDate);
    if (issueYMD && deliveryYMD && deliveryYMD < issueYMD) {
      diffs.push({
        id: "temporal-inconsistency-date",
        type: "DATE_CHANGE",
        severity: "CRITICAL",
        category: "AUDIT_RISK",
        title: "Temporal Inconsistency: Delivery Precedes Proposal Date",
        description: `Contractual anomaly: Revised delivery date (${doc2.deliveryDate}) is set prior to the proposal issue date (${doc2.date}). Retroactive milestone schedule is legally unexecutable.`,
        originalValue: doc2.date,
        revisedValue: doc2.deliveryDate,
        delta: "Retroactive Date Conflict",
        confidence: 1.0,
        isConfirmed: true,
        isSubstantive: true,
        originalLocation: doc1HeaderLoc,
        revisedLocation: doc2HeaderLoc,
      });
      keyRisks.push(
        `Revised delivery date (${doc2.deliveryDate}) precedes proposal issue date (${doc2.date}).`,
      );
      clarificationQuestions.push(
        `Delivery date (${doc2.deliveryDate}) is earlier than issue date (${doc2.date}). Please provide an amended, feasible delivery schedule.`,
      );
    }
  }

  // Incoterms Commercial Terms Comparison
  if (
    doc1.deliveryTerms &&
    doc2.deliveryTerms &&
    doc1.deliveryTerms !== doc2.deliveryTerms
  ) {
    diffs.push({
      id: `incoterms-shift-${doc1.deliveryTerms}-${doc2.deliveryTerms}`,
      type: "SCOPE_ADDED",
      severity: "CRITICAL",
      category: "SCOPE",
      title: `Incoterms Reallocation: ${doc1.deliveryTerms} -> ${doc2.deliveryTerms}`,
      description: `Delivery freight & risk allocation shifted from ${doc1.deliveryTerms} to ${doc2.deliveryTerms}. Buyer logistics, customs or freight responsibility modified.`,
      originalValue: doc1.deliveryTerms,
      revisedValue: doc2.deliveryTerms,
      delta: "Incoterms Shift",
      confidence: 1.0,
      isConfirmed: true,
      isSubstantive: true,
      originalLocation: doc1HeaderLoc,
      revisedLocation: doc2HeaderLoc,
    });
    keyRisks.push(
      `Incoterms shifted from ${doc1.deliveryTerms} to ${doc2.deliveryTerms}`,
    );
  }

  // 3. Process Confirmed Matched Pairs
  for (const pair of matchingResult.matchedPairs) {
    const o = pair.originalItem;
    const r = pair.revisedItem;

    // Check Renamed Item
    if (o.normalizedName !== r.normalizedName) {
      diffs.push({
        id: `renamed-${o.id}-${r.id}`,
        type: "RENAMED_ITEM",
        severity: "INFO",
        category: "SCOPE",
        title: `Nomenclature / Item Renamed: "${o.name}" -> "${r.name}"`,
        description: `Correlated via ${pair.matchReason} (Confidence: ${Math.round(
          pair.confidence * 100,
        )}%). Scope corresponds to same underlying deliverable.`,
        originalValue: o.name,
        revisedValue: r.name,
        confidence: pair.confidence,
        isConfirmed: true,
        isSubstantive: true,
        originalLocation: o.location,
        revisedLocation: r.location,
      });
    }

    // Check Reordered Rows
    if (o.rowIndex !== r.rowIndex) {
      diffs.push({
        id: `reordered-${o.id}-${r.id}`,
        type: "REORDERED",
        severity: "INFO",
        category: "FORMATTING",
        title: `Row Reordered: "${r.name}"`,
        description: `Moved from row position #${o.rowIndex} in original proposal to row position #${r.rowIndex} in revised proposal. Commercial terms unchanged.`,
        originalValue: `Row #${o.rowIndex}`,
        revisedValue: `Row #${r.rowIndex}`,
        confidence: 1.0,
        isConfirmed: true,
        isSubstantive: false,
        originalLocation: o.location,
        revisedLocation: r.location,
      });
    }

    // Check Quantity Change
    if (o.qty !== r.qty) {
      const deltaQty = r.qty - o.qty;
      const deltaFormatted = deltaQty > 0 ? `+${deltaQty}` : `${deltaQty}`;
      const isTotalIdentical = Math.abs(o.statedTotal - r.statedTotal) < 0.05;

      // Architectural Decision: Unit of Measure (UoM) Conversion Sensitivity
      // When a vendor converts billing metrics (e.g. 40 hours @ $150/h -> 5 working days @ $1,300/day):
      // Ratio ~ 8 (1 day = 8 hours).
      // If the net total or effective rate is identical, downgrade severity to INFO.
      // If the vendor sneaked in a rate escalation (e.g. +8.3%), retain WARNING severity
      // and explicitly log the escalation in keyRisks so buyers are protected.
      const ratio =
        o.qty > 0 && r.qty > 0 ? Math.max(o.qty / r.qty, r.qty / o.qty) : 1;
      const isHourToDayConversion =
        (Math.abs(ratio - 8) < 0.8 ||
          (/hour|hrs/i.test(o.name + o.rawText) &&
            /day|days/i.test(r.name + r.rawText))) &&
        r.unitPrice / (o.unitPrice * 8) >= 0.75 &&
        r.unitPrice / (o.unitPrice * 8) <= 1.35;

      const isRateExact =
        isHourToDayConversion && Math.abs(r.unitPrice - o.unitPrice * 8) < 0.05;
      const isUomIdentical = isTotalIdentical || isRateExact;
      const isUomConversion = isTotalIdentical || isHourToDayConversion;

      diffs.push({
        id: `qty-change-${o.id}-${r.id}`,
        type: "QTY_CHANGE",
        severity: isUomConversion ? "INFO" : "WARNING",
        category: "SCOPE",
        title: isUomConversion
          ? `Unit of Measure / Quantity Restatement for "${r.name}"`
          : `Quantity Adjusted for "${r.name}"`,
        description: isHourToDayConversion
          ? `Billing basis converted between hours and working days (${o.qty} vs ${r.qty} units) with proportionate rate adjustment.`
          : isTotalIdentical
            ? `Quantity restated from ${o.qty} to ${r.qty} units with equivalent net total (Unit of Measure conversion, e.g. hours to days).`
            : `Quantity changed from ${o.qty} to ${r.qty} units (${deltaFormatted}).`,
        originalValue: o.qty,
        revisedValue: r.qty,
        delta: deltaFormatted,
        confidence: 1.0,
        isConfirmed: true,
        isSubstantive: true,
        originalLocation: o.location,
        revisedLocation: r.location,
      });
    }

    // Check Unit Price Change
    if (Math.abs(o.unitPrice - r.unitPrice) > 0.01) {
      const deltaPrice = r.unitPrice - o.unitPrice;
      const pct = Math.round((deltaPrice / o.unitPrice) * 100);
      const isIncrease = deltaPrice > 0;
      const isTotalIdentical = Math.abs(o.statedTotal - r.statedTotal) < 0.05;

      const ratio =
        o.qty > 0 && r.qty > 0 ? Math.max(o.qty / r.qty, r.qty / o.qty) : 1;
      const isHourToDayConversion =
        (Math.abs(ratio - 8) < 0.8 ||
          (/hour|hrs/i.test(o.name + o.rawText) &&
            /day|days/i.test(r.name + r.rawText))) &&
        r.unitPrice / (o.unitPrice * 8) >= 0.75 &&
        r.unitPrice / (o.unitPrice * 8) <= 1.35;

      const isRateExact =
        isHourToDayConversion && Math.abs(r.unitPrice - o.unitPrice * 8) < 0.05;
      const isUomIdentical = isTotalIdentical || isRateExact;
      const isUomConversion = isTotalIdentical || isHourToDayConversion;

      diffs.push({
        id: `price-change-${o.id}-${r.id}`,
        type: "PRICE_CHANGE",
        severity: isUomIdentical ? "INFO" : isIncrease ? "WARNING" : "INFO",
        category: "PRICING",
        title: isUomConversion
          ? `Unit Price Rate Adjusted for "${r.name}" (${isIncrease ? "Rate Escalation" : "Offsetting UoM conversion"})`
          : `Unit Price ${isIncrease ? "Increased" : "Decreased"} for "${r.name}"`,
        description: isHourToDayConversion
          ? `Unit rate adjusted between hours and working days (${formatCurrency(o.unitPrice, doc1.currency)}/h vs ${formatCurrency(r.unitPrice, doc2.currency)}/day).`
          : isTotalIdentical
            ? `Unit rate re-expressed from ${formatCurrency(o.unitPrice, doc1.currency)} to ${formatCurrency(r.unitPrice, doc2.currency)} due to unit conversion; net total remains equivalent.`
            : `Unit price modified from ${formatCurrency(
                o.unitPrice,
                doc1.currency,
              )} to ${formatCurrency(r.unitPrice, doc2.currency)} (${
                isIncrease ? `+${pct}%` : `${pct}%`
              }).`,
        originalValue: formatCurrency(o.unitPrice, doc1.currency),
        revisedValue: formatCurrency(r.unitPrice, doc2.currency),
        delta: `${isIncrease ? "+" : ""}${formatCurrency(deltaPrice, doc2.currency)} (${pct}%)`,
        confidence: 1.0,
        isConfirmed: true,
        isSubstantive: true,
        originalLocation: o.location,
        revisedLocation: r.location,
      });

      if (!isUomIdentical) {
        if (isHourToDayConversion && isIncrease) {
          const effectiveEscalationPct = Math.round(
            (r.unitPrice / (o.unitPrice * 8) - 1) * 100,
          );
          keyRisks.push(
            `Unit of measure restatement on "${r.name}" includes hidden +${effectiveEscalationPct}% rate escalation (${formatCurrency(o.unitPrice, doc1.currency)}/h vs ${formatCurrency(r.unitPrice, doc2.currency)}/day)`,
          );
        } else if (isIncrease) {
          keyRisks.push(
            `Unit price on "${r.name}" changed by +${formatCurrency(
              deltaPrice,
              doc2.currency,
            )}`,
          );
        }
      }
    }

    // Check Stated Total Change when Qty and UnitPrice are identical (e.g. corrected baseline calculation or lump-sum adjustment)
    if (
      o.qty === r.qty &&
      Math.abs(o.unitPrice - r.unitPrice) <= 0.01 &&
      Math.abs(o.statedTotal - r.statedTotal) > 0.01
    ) {
      const deltaTotal = r.statedTotal - o.statedTotal;
      const isIncrease = deltaTotal > 0;
      const isDoc1Error = o.hasArithmeticError;
      const isDoc2Error = r.hasArithmeticError;

      diffs.push({
        id: `total-reconciled-${o.id}-${r.id}`,
        type: "PRICE_CHANGE",
        severity: isDoc2Error ? "WARNING" : "INFO",
        category: "PRICING",
        title:
          isDoc1Error && !isDoc2Error
            ? `Corrected Calculation for "${r.name}"`
            : `Line Total ${isIncrease ? "Increased" : "Decreased"} for "${r.name}"`,
        description:
          isDoc1Error && !isDoc2Error
            ? `Baseline reference contained an arithmetic discrepancy (${formatCurrency(o.statedTotal, doc1.currency)}). Corrected to ${formatCurrency(r.statedTotal, doc2.currency)} in candidate proposal.`
            : `Stated line total shifted from ${formatCurrency(o.statedTotal, doc1.currency)} to ${formatCurrency(r.statedTotal, doc2.currency)} (${isIncrease ? "+" : ""}${formatCurrency(deltaTotal, doc2.currency)}).`,
        originalValue: formatCurrency(o.statedTotal, doc1.currency),
        revisedValue: formatCurrency(r.statedTotal, doc2.currency),
        delta: `${isIncrease ? "+" : ""}${formatCurrency(deltaTotal, doc2.currency)}`,
        confidence: 1.0,
        isConfirmed: true,
        isSubstantive: true,
        originalLocation: o.location,
        revisedLocation: r.location,
      });
    }
  }

  // 4. Process Scope Removed
  for (const removed of matchingResult.unmatchedOriginalItems) {
    diffs.push({
      id: `removed-${removed.id}`,
      type: "SCOPE_REMOVED",
      severity: "WARNING",
      category: "SCOPE",
      title: `Line Item Omitted / Removed: "${removed.name}"`,
      description: `Previously included in original proposal with quantity ${removed.qty} @ ${formatCurrency(
        removed.unitPrice,
        doc1.currency,
      )} (${formatCurrency(removed.statedTotal, doc1.currency)}). Completely omitted in revision.`,
      originalValue: `${removed.qty} × ${formatCurrency(removed.unitPrice, doc1.currency)}`,
      revisedValue: "Omitted",
      delta: `-${formatCurrency(removed.statedTotal, doc1.currency)}`,
      confidence: 1.0,
      isConfirmed: true,
      isSubstantive: true,
      originalLocation: removed.location,
      revisedLocation: doc2HeaderLoc,
    });
    keyRisks.push(
      `Scope reduction: "${removed.name}" was removed from the proposal`,
    );
  }

  // 5. Process Scope Added
  for (const added of matchingResult.unmatchedRevisedItems) {
    diffs.push({
      id: `added-${added.id}`,
      type: "SCOPE_ADDED",
      severity: "INFO",
      category: "SCOPE",
      title: `New Deliverable / Scope Added: "${added.name}"`,
      description: `Newly introduced item with quantity ${added.qty} @ ${formatCurrency(
        added.unitPrice,
        doc2.currency,
      )} (${formatCurrency(added.statedTotal, doc2.currency)}).`,
      originalValue: "Not in original",
      revisedValue: `${added.qty} × ${formatCurrency(added.unitPrice, doc2.currency)}`,
      delta: `+${formatCurrency(added.statedTotal, doc2.currency)}`,
      confidence: 1.0,
      isConfirmed: true,
      isSubstantive: true,
      originalLocation: doc1HeaderLoc,
      revisedLocation: added.location,
    });
  }

  // 6. Process Uncertain Matches
  for (const unc of matchingResult.uncertainMatches) {
    diffs.push({
      id: `uncertain-${unc.originalItem.id}-${unc.revisedItem.id}`,
      type: "RENAMED_ITEM",
      severity: "WARNING",
      category: "AUDIT_RISK",
      title: `Uncertain Item Correlation: "${unc.originalItem.name}" ⟷ "${unc.revisedItem.name}"`,
      description: `Candidate correlation identified with modest confidence (${Math.round(
        unc.confidence * 100,
      )}%). Requires executive confirmation to ascertain if these items represent the identical scope.`,
      originalValue: unc.originalItem.name,
      revisedValue: unc.revisedItem.name,
      confidence: unc.confidence,
      isConfirmed: false,
      isSubstantive: true,
      originalLocation: unc.originalItem.location,
      revisedLocation: unc.revisedItem.location,
    });
    clarificationQuestions.push(
      `Is "${unc.originalItem.name}" intended to be replaced by "${unc.revisedItem.name}"?`,
    );
  }

  // 7. Deterministic Arithmetic Audit (both documents)
  const revArithAudit = auditDocumentArithmetic(
    doc2.items,
    doc2.statedGrandTotal,
    doc2.currency,
    "Revised Proposal",
    doc2TotalLoc,
    {
      discountAmount: doc2.discountAmount,
      taxAmount: doc2.taxAmount,
      taxInclusive: doc2.taxInclusive,
      shippingAmount: doc2.shippingAmount,
    },
  );

  for (const err of revArithAudit.lineErrors) {
    const matchedOriginal = matchingResult.matchedPairs.find(
      (p) => p.revisedItem.id === err.item.id,
    )?.originalItem;

    err.diff.originalLocation = matchedOriginal?.location ?? doc1HeaderLoc;
    diffs.push(err.diff);
    keyRisks.push(
      `Mathematical discrepancy in revised offer: ${err.diff.description}`,
    );
  }

  if (revArithAudit.grandTotalAudit.diff) {
    revArithAudit.grandTotalAudit.diff.originalLocation = doc1TotalLoc;
    diffs.push(revArithAudit.grandTotalAudit.diff);
    keyRisks.push(revArithAudit.grandTotalAudit.diff.description);
  }

  // 8. Document-level financial totals & Net delta
  const statedOrigTotal = doc1.statedGrandTotal ?? doc1.calculatedGrandTotal;
  const statedRevTotal = doc2.statedGrandTotal ?? doc2.calculatedGrandTotal;
  const netFinancialDelta =
    Math.round((statedRevTotal - statedOrigTotal) * 100) / 100;

  // 9. Substantive vs Formatting Count
  const substantiveDiffs = diffs.filter((d) => d.isSubstantive);
  const formattingDiffs = diffs.filter((d) => !d.isSubstantive);
  const arithmeticErrorsCount = diffs.filter(
    (d) => d.type === "ARITHMETIC_ERROR",
  ).length;
  const uncertainMatchesCount = matchingResult.uncertainMatches.length;
  const hasCurrencyMismatch =
    doc1.currency && doc2.currency && doc1.currency !== doc2.currency;

  // 10. Determine Executive Verdict
  let verdict: AuditVerdict = "APPROVE";
  let verdictTitle = "Offer Ready for Approval";
  let summary = "";

  if (doc1.items.length === 0 && doc2.items.length === 0) {
    verdict = "NEEDS_CLARIFICATION";
    verdictTitle = "DECLINE TO CONCLUDE: No Commercial Line Items Detected";
    summary =
      "The engine could not extract text-based commercial table rows from the uploaded PDF documents. This may be a scanned or image-only PDF without an OCR text layer, or an unformatted document layout. Please ensure documents contain selectable vector text.";
    keyRisks.push(
      "Zero digital text-based line items detected (possible scanned image or missing OCR text layer).",
    );
    clarificationQuestions.push(
      "Are the uploaded PDFs scanned images without an OCR text layer? ReviseCheck requires selectable vector text.",
    );
  } else if (doc1.items.length > 0 && doc2.items.length === 0) {
    verdict = "NEEDS_CLARIFICATION";
    verdictTitle =
      "DECLINE TO CONCLUDE: Missing Line Items in Revised Document";
    summary =
      "Zero extractable commercial table rows were detected in the revised document (Document B). Please verify Document B is a valid text-based proposal and not a blank or scanned page.";
    keyRisks.push(
      "Zero extractable line items in Document B (possible scanned image or empty document).",
    );
    clarificationQuestions.push(
      "Document B contains 0 extractable table rows. Is Document B a scanned image or corrupted PDF?",
    );
  } else if (
    doc1.items.length >= 3 &&
    doc2.items.length >= 3 &&
    matchingResult.matchedPairs.length === 0 &&
    matchingResult.uncertainMatches.length === 0
  ) {
    // Red Team Guardrail: Zero-Overlap Blindness Prevention
    // If both documents have multiple items but share strictly zero matching deliverables,
    // the user uploaded completely unrelated files (e.g. IT infrastructure vs Office Furniture).
    verdict = "NEEDS_CLARIFICATION";
    verdictTitle =
      "DECLINE TO CONCLUDE: Disjoint Proposals Detected (0% Overlap)";
    summary =
      "The uploaded documents share 0% common deliverables or scope items. Comparison aborted to prevent misleading differential reporting between unrelated commercial agreements.";
    keyRisks.push(
      "Zero scope overlap: Document A and Document B contain completely disjoint deliverables.",
    );
    clarificationQuestions.push(
      "Do Document A and Document B belong to the same procurement tender? Zero common items were found.",
    );
  } else if (
    hasCurrencyMismatch ||
    uncertainMatchesCount > 0 ||
    clarificationQuestions.length > 0
  ) {
    verdict = "NEEDS_CLARIFICATION";
    verdictTitle =
      "DECLINE TO CONCLUDE: Clarification Required Before Approval";
    summary = `Critical ambiguities, currency discordance (${doc1.currency} vs ${doc2.currency}), or uncommitted delivery milestones preclude automatic approval. Clarification required.`;
  } else if (arithmeticErrorsCount > 0) {
    verdict = "REJECT";
    verdictTitle = "REJECT / HOLD: Arithmetic Discrepancies in Source";
    const pluralDisc =
      arithmeticErrorsCount === 1 ? "discrepancy" : "discrepancies";
    summary = `The revised proposal contains ${arithmeticErrorsCount} intentional or erroneous mathematical ${pluralDisc} in the vendor's numbers. Do not sign without written reconciliation.`;
  } else if (substantiveDiffs.length === 0) {
    verdict = "APPROVE";
    verdictTitle = "APPROVED: Presentation & Formatting Update Only";
    summary = `No substantive commercial, pricing, or scope changes detected. All line items, quantities, rates, totals, and delivery schedules are 100% identical. Safe to approve.`;
  } else {
    verdict = "APPROVE";
    if (netFinancialDelta > 0.01) {
      verdictTitle = "REVIEW & APPROVE: Price Increase Verified";
      summary = `Verified ${substantiveDiffs.length} substantive commercial changes with a net price increase of +${formatCurrency(
        netFinancialDelta,
        doc2.currency,
      )}. Arithmetic is 100% sound. Review price increase before executive approval.`;
    } else if (netFinancialDelta < -0.01) {
      verdictTitle = "READY TO APPROVE: Cost Savings Verified";
      summary = `Verified ${substantiveDiffs.length} substantive commercial changes with net cost savings of ${formatCurrency(
        netFinancialDelta,
        doc2.currency,
      )}. Arithmetic is 100% sound.`;
    } else {
      verdictTitle = "READY TO APPROVE: Commercial Variations Verified";
      summary = `Verified ${substantiveDiffs.length} substantive commercial changes. Arithmetic is 100% sound. Net financial variance is neutral ($0.00).`;
    }
  }

  const durationMs = Date.now() - startTime;
  const isAiUsed = (matchingResult.aiTokensUsed ?? 0) > 0;
  const telemetry: TelemetryData = {
    latencyMs: telemetryOverride?.latencyMs ?? Math.max(18, durationMs),
    costUSD: telemetryOverride?.costUSD ?? matchingResult.aiCostUSD ?? 0,
    tokensUsed:
      telemetryOverride?.tokensUsed ?? matchingResult.aiTokensUsed ?? 0,
    method:
      telemetryOverride?.method ?? (isAiUsed ? "hybrid-ai" : "deterministic"),
    sourceReferencesValidCount: diffs.filter(
      (d) => d.originalLocation && d.revisedLocation,
    ).length,
  };

  return {
    verdict,
    verdictTitle,
    summary,
    keyRisks,
    netFinancialDelta,
    statedOriginalTotal: statedOrigTotal,
    statedRevisedTotal: statedRevTotal,
    calculatedOriginalTotal: doc1.calculatedGrandTotal,
    calculatedRevisedTotal: doc2.calculatedGrandTotal,
    hasArithmeticErrors: arithmeticErrorsCount > 0,
    arithmeticErrorsCount,
    substantiveChangesCount: substantiveDiffs.length,
    formattingChangesCount: formattingDiffs.length,
    uncertainMatchesCount,
    diffs,
    telemetry,
    clarificationQuestions:
      clarificationQuestions.length > 0 ? clarificationQuestions : undefined,
    doc1Currency: doc1.currency,
    doc2Currency: doc2.currency,
    doc1Summary: {
      title: doc1.title,
      totalItems: doc1.items.length,
      date: doc1.date,
      deliveryDate: doc1.deliveryDate,
    },
    doc2Summary: {
      title: doc2.title,
      totalItems: doc2.items.length,
      date: doc2.date,
      deliveryDate: doc2.deliveryDate,
    },
  };
}

export function compareCommercialOffers(
  doc1: ExtractedDocument,
  doc2: ExtractedDocument,
  telemetryOverride?: Partial<TelemetryData>,
): AuditReport {
  const startTime = Date.now();
  const matchingResult = matchLineItems(doc1.items, doc2.items);
  return buildReportFromMatching(
    doc1,
    doc2,
    matchingResult,
    startTime,
    telemetryOverride,
  );
}

export async function compareCommercialOffersAsync(
  doc1: ExtractedDocument,
  doc2: ExtractedDocument,
  togetherApiKey?: string,
  telemetryOverride?: Partial<TelemetryData>,
): Promise<AuditReport> {
  const startTime = Date.now();
  const matchingResult = await matchLineItemsAsync(
    doc1.items,
    doc2.items,
    togetherApiKey,
  );
  return buildReportFromMatching(
    doc1,
    doc2,
    matchingResult,
    startTime,
    telemetryOverride,
  );
}
