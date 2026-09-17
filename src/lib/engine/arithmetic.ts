import Decimal from "decimal.js";
import { CanonicalLineItem, CommercialDiff, SourceLocation } from "../types";
import { formatCurrency } from "./normalizer";

export interface ArithmeticAuditResult {
  lineErrors: Array<{
    item: CanonicalLineItem;
    calculatedTotal: number;
    statedTotal: number;
    discrepancy: number;
    diff: CommercialDiff;
  }>;
  grandTotalAudit: {
    hasDiscrepancy: boolean;
    statedGrandTotal?: number;
    calculatedSum: number;
    discrepancy: number;
    diff?: CommercialDiff;
  };
}

/**
 * Deterministic Arithmetic Audit Engine (Arbitrary-Precision Decimal.js)
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. Zero Hallucination: Mathematical verification is strictly separated from LLMs.
 *    No language model is ever permitted to compute, verify, or round numbers.
 * 2. IEEE-754 Elimination: JavaScript standard `Number` types drift on floating-point
 *    operations (e.g. 0.1 + 0.2 = 0.30000000000000004). All computations use `Decimal.js`
 *    with arbitrary precision to guarantee exact cent-level reconciliation.
 * 3. Non-Destructive Auditing: If a vendor's document states an erroneous sum,
 *    we never silently replace it. Both the stated value and calculated value are preserved,
 *    flagging the discrepancy as a CRITICAL risk and blocking approval.
 * 4. Tax/Discount Reconciliation: Reconciles line items with discounts, shipping,
 *    and tax-inclusive (Gross) or tax-exclusive (Net) VAT regimes.
 *
 * @param items - Extracted canonical line items.
 * @param statedGrandTotal - Stated document grand total from PDF text.
 * @param currency - Document currency code.
 * @param docTitle - Label for document context in reports.
 * @param docLocationFallback - Bounding box fallback for grand total discrepancies.
 * @param adjustments - Discounts, taxes, tax-inclusive flag, and shipping fees.
 * @returns Reconciled arithmetic audit result with line errors and grand total discrepancies.
 */
export function auditDocumentArithmetic(
  items: CanonicalLineItem[],
  statedGrandTotal?: number,
  currency: string = "USD",
  docTitle: string = "Document",
  docLocationFallback?: SourceLocation,
  adjustments?: {
    discountAmount?: number;
    taxAmount?: number;
    taxInclusive?: boolean;
    shippingAmount?: number;
  },
): ArithmeticAuditResult {
  const lineErrors: ArithmeticAuditResult["lineErrors"] = [];
  let calculatedSum = new Decimal(0);

  for (const item of items) {
    const qty = new Decimal(item.qty);
    const unitPrice = new Decimal(item.unitPrice);
    const statedTotal = new Decimal(item.statedTotal);

    // If unit price is indeterminate or zero (e.g. "TBD" rate or lump-sum deliverable),
    // and statedTotal > 0, treat stated total as valid lump-sum rather than 0 * 0 = 0 error
    if (
      item.unitPrice === 0 &&
      item.statedTotal > 0 &&
      !item.hasArithmeticError
    ) {
      calculatedSum = calculatedSum.plus(statedTotal);
      continue;
    }

    const calculatedLineTotal = qty.times(unitPrice);
    calculatedSum = calculatedSum.plus(calculatedLineTotal);

    const diff = statedTotal.minus(calculatedLineTotal);
    if (diff.abs().greaterThan(0.01)) {
      const calcNum = calculatedLineTotal.toNumber();
      const statedNum = statedTotal.toNumber();
      const discNum = diff.toNumber();
      const isUnderstated = discNum < 0;
      const discWord = isUnderstated ? "Understated" : "Overstated";

      const commercialDiff: CommercialDiff = {
        id: `arith-err-${item.id}`,
        type: "ARITHMETIC_ERROR",
        severity: "CRITICAL",
        category: "AUDIT_RISK",
        title: `Arithmetic Discrepancy in Line Item: "${item.name}"`,
        description: `Line item math does not reconcile: ${item.qty} × ${formatCurrency(
          item.unitPrice,
          currency,
        )} equals ${formatCurrency(calcNum, currency)}, but source states ${formatCurrency(
          statedNum,
          currency,
        )}. ${discWord} by ${formatCurrency(Math.abs(discNum), currency)}.`,
        originalValue: formatCurrency(calcNum, currency),
        revisedValue: formatCurrency(statedNum, currency),
        delta: formatCurrency(discNum, currency),
        confidence: 1.0,
        isConfirmed: true,
        isSubstantive: true,
        revisedLocation: item.location,
      };

      lineErrors.push({
        item,
        calculatedTotal: calcNum,
        statedTotal: statedNum,
        discrepancy: discNum,
        diff: commercialDiff,
      });
    }
  }

  let grandTotalDiff: CommercialDiff | undefined;
  let hasGrandTotalDiscrepancy = false;
  let grandTotalDiscrepancy = 0;

  if (statedGrandTotal !== undefined) {
    const stated = new Decimal(statedGrandTotal);
    let expectedSum = calculatedSum;
    if (adjustments?.discountAmount) {
      expectedSum = expectedSum.minus(new Decimal(adjustments.discountAmount));
    }
    if (adjustments?.taxAmount && !adjustments?.taxInclusive) {
      expectedSum = expectedSum.plus(new Decimal(adjustments.taxAmount));
    }
    if (adjustments?.shippingAmount) {
      expectedSum = expectedSum.plus(new Decimal(adjustments.shippingAmount));
    }

    const sumDiff = stated.minus(expectedSum);

    if (sumDiff.abs().greaterThan(0.01)) {
      hasGrandTotalDiscrepancy = true;
      grandTotalDiscrepancy = sumDiff.toNumber();

      const adjNote =
        adjustments?.taxAmount || adjustments?.discountAmount
          ? " (reconciled with discounts/taxes)"
          : "";

      const statedLinesSum = items.reduce(
        (acc, it) => acc.plus(new Decimal(it.statedTotal)),
        new Decimal(0),
      );
      const unallocatedMargin = stated.minus(statedLinesSum).toNumber();
      const hasLineErrors = items.some((it) => it.hasArithmeticError);

      let descriptionText = `The sum of line items (${formatCurrency(
        expectedSum.toNumber(),
        currency,
      )})${adjNote} does not match the stated Grand Total (${formatCurrency(
        statedGrandTotal,
        currency,
      )}). Discrepancy of ${formatCurrency(Math.abs(grandTotalDiscrepancy), currency)}.`;

      if (hasLineErrors && Math.abs(unallocatedMargin) > 0.01) {
        descriptionText = `Stated Grand Total (${formatCurrency(
          statedGrandTotal,
          currency,
        )}) contains +${formatCurrency(
          Math.abs(unallocatedMargin),
          currency,
        )} unallocated inflation over stated line items (${formatCurrency(
          statedLinesSum.toNumber(),
          currency,
        )}), totaling ${formatCurrency(
          Math.abs(grandTotalDiscrepancy),
          currency,
        )} net arithmetic variance against calculated sum (${formatCurrency(
          expectedSum.toNumber(),
          currency,
        )}).`;
      }

      grandTotalDiff = {
        id: `arith-err-grand-total`,
        type: "ARITHMETIC_ERROR",
        severity: "CRITICAL",
        category: "AUDIT_RISK",
        title: `Grand Total Arithmetic Mismatch in ${docTitle}`,
        description: descriptionText,
        originalValue: formatCurrency(expectedSum.toNumber(), currency),
        revisedValue: formatCurrency(statedGrandTotal, currency),
        delta: formatCurrency(grandTotalDiscrepancy, currency),
        confidence: 1.0,
        isConfirmed: true,
        isSubstantive: true,
        revisedLocation: docLocationFallback,
      };
    }
  }

  return {
    lineErrors,
    grandTotalAudit: {
      hasDiscrepancy: hasGrandTotalDiscrepancy,
      statedGrandTotal,
      calculatedSum: calculatedSum.toNumber(),
      discrepancy: grandTotalDiscrepancy,
      diff: grandTotalDiff,
    },
  };
}
