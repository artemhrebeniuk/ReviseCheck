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

export function auditDocumentArithmetic(
  items: CanonicalLineItem[],
  statedGrandTotal?: number,
  currency: string = "USD",
  docTitle: string = "Document",
  docLocationFallback?: SourceLocation
): ArithmeticAuditResult {
  const lineErrors: ArithmeticAuditResult["lineErrors"] = [];
  let calculatedSum = new Decimal(0);

  for (const item of items) {
    const qty = new Decimal(item.qty);
    const unitPrice = new Decimal(item.unitPrice);
    const statedTotal = new Decimal(item.statedTotal);

    const calculatedLineTotal = qty.times(unitPrice);
    calculatedSum = calculatedSum.plus(statedTotal);

    const diff = statedTotal.minus(calculatedLineTotal);
    if (diff.abs().greaterThan(0.01)) {
      const calcNum = calculatedLineTotal.toNumber();
      const statedNum = statedTotal.toNumber();
      const discNum = diff.toNumber();

      const commercialDiff: CommercialDiff = {
        id: `arith-err-${item.id}`,
        type: "ARITHMETIC_ERROR",
        severity: "CRITICAL",
        category: "AUDIT_RISK",
        title: `Arithmetic Discrepancy in Line Item: "${item.name}"`,
        description: `Line item math does not reconcile: ${item.qty} × ${formatCurrency(
          item.unitPrice,
          currency
        )} equals ${formatCurrency(calcNum, currency)}, but source states ${formatCurrency(
          statedNum,
          currency
        )}. Understated by ${formatCurrency(Math.abs(discNum), currency)}.`,
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
    const sumDiff = stated.minus(calculatedSum);

    if (sumDiff.abs().greaterThan(0.01)) {
      hasGrandTotalDiscrepancy = true;
      grandTotalDiscrepancy = sumDiff.toNumber();

      grandTotalDiff = {
        id: `arith-err-grand-total`,
        type: "ARITHMETIC_ERROR",
        severity: "CRITICAL",
        category: "AUDIT_RISK",
        title: `Grand Total Arithmetic Mismatch in ${docTitle}`,
        description: `The sum of line items (${formatCurrency(
          calculatedSum.toNumber(),
          currency
        )}) does not match the stated Grand Total (${formatCurrency(
          statedGrandTotal,
          currency
        )}). Discrepancy of ${formatCurrency(Math.abs(grandTotalDiscrepancy), currency)}.`,
        originalValue: formatCurrency(calculatedSum.toNumber(), currency),
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
