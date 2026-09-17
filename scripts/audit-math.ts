import fs from "fs";
import path from "path";
import Decimal from "decimal.js";
import { extractPdfDocument } from "../src/lib/pdf/extractor";
import { compareCommercialOffers } from "../src/lib/engine/diff";
import type { CanonicalLineItem, ExtractedDocument } from "../src/lib/types";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

const samplesDir = path.join(process.cwd(), "public", "samples");

const PRESETS = [
  { name: "Suite 1: Standard Enterprise",      origFile: "offer_original.pdf",                  revFile: "offer_revised_v1.pdf" },
  { name: "Suite 2: Formatting Only",          origFile: "offer_original.pdf",                  revFile: "offer_formatting_only.pdf" },
  { name: "Suite 3: Ambiguous",                origFile: "offer_original.pdf",                  revFile: "offer_ambiguous.pdf" },
  { name: "Suite 4: Clean Approval",           origFile: "offer_original.pdf",                  revFile: "offer_clean_approval.pdf" },
  { name: "Suite 5: 3-Page Hyperscale",        origFile: "offer_3page_original.pdf",            revFile: "offer_3page_revised.pdf" },
  { name: "Suite 6: Cloud Migration",          origFile: "offer_cloud_migration_orig.pdf",      revFile: "offer_cloud_migration_rev.pdf" },
  { name: "Suite 7: Arithmetic Inflation",     origFile: "offer_arithmetic_inflation_orig.pdf", revFile: "offer_arithmetic_inflation_rev.pdf" },
  { name: "Suite 8: Milestone Schedule",       origFile: "offer_milestone_schedule_orig.pdf",   revFile: "offer_milestone_schedule_rev.pdf" },
];

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null) return "N/A";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function auditDoc(doc: ExtractedDocument, label: string): { issues: string[]; statedSum: number } {
  const issues: string[] = [];
  let statedSum = 0;

  for (const item of doc.items) {
    statedSum += item.statedTotal ?? 0;

    // Check if qty * unitPrice == calculatedTotal (engine already computes this)
    if (item.hasArithmeticError) {
      issues.push(
        `  [MATH ERROR in ${label}] "${item.name}" — ${item.qty} × ${fmt(item.unitPrice)} = ${fmt(item.calculatedTotal)}, ` +
        `stated: ${fmt(item.statedTotal)}, discrepancy: ${fmt(item.arithmeticDiscrepancy)}`
      );
    }
  }

  // Check sum of statedTotals vs statedGrandTotal
  if (doc.statedGrandTotal !== undefined && doc.statedGrandTotal !== null) {
    const diff = Math.abs(statedSum - doc.statedGrandTotal);
    if (diff > 0.01) {
      issues.push(
        `  [GRAND TOTAL MISMATCH in ${label}] Sum of line totals: ${fmt(statedSum)}, Stated Grand Total: ${fmt(doc.statedGrandTotal)}, Difference: ${fmt(statedSum - doc.statedGrandTotal)}`
      );
    }
  }

  return { issues, statedSum };
}

async function main() {
  console.log("\n================================================================");
  console.log("  REVISECHECK — DEEP MATH AUDIT: All 8 Benchmark Suites");
  console.log("================================================================");

  let totalSystemIssues = 0;
  let totalIntentionalErrors = 0;

  for (const preset of PRESETS) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`${preset.name}`);
    console.log(`----------------------------------------------------------------`);

    const origBuf = fs.readFileSync(path.join(samplesDir, preset.origFile));
    const revBuf  = fs.readFileSync(path.join(samplesDir, preset.revFile));

    const docOrig = await extractPdfDocument(origBuf);
    const docRev  = await extractPdfDocument(revBuf);
    const report  = compareCommercialOffers(docOrig, docRev);

    // ── Doc A ────────────────────────────────────────────────────────────
    const { issues: origIssues, statedSum: origStatedSum } = auditDoc(docOrig, "Doc A");
    console.log(`\n  Doc A: ${docOrig.title}`);
    console.log(`    Items extracted: ${docOrig.items.length}  |  Pages: ${docOrig.totalPages}`);
    console.log(`    Sum of line totals: ${fmt(origStatedSum)}`);
    console.log(`    Stated Grand Total: ${fmt(docOrig.statedGrandTotal ?? null)}`);
    console.log(`    Engine calcGrandTotal: ${fmt(docOrig.calculatedGrandTotal)}`);
    if (origIssues.length === 0) {
      console.log("    Math: CLEAN");
    } else {
      origIssues.forEach(i => console.log(i));
    }
    // Doc A should never have intentional math errors — count any as system issues
    totalSystemIssues += origIssues.length;

    // ── Doc B ────────────────────────────────────────────────────────────
    const { issues: revIssues, statedSum: revStatedSum } = auditDoc(docRev, "Doc B");
    console.log(`\n  Doc B: ${docRev.title}`);
    console.log(`    Items extracted: ${docRev.items.length}  |  Pages: ${docRev.totalPages}`);
    console.log(`    Sum of line totals: ${fmt(revStatedSum)}`);
    console.log(`    Stated Grand Total: ${fmt(docRev.statedGrandTotal ?? null)}`);
    console.log(`    Engine calcGrandTotal: ${fmt(docRev.calculatedGrandTotal)}`);

    // Arithmetic errors in Doc B: are they correctly detected by the engine?
    const arithDiffs = report.diffs.filter(d => d.type === "ARITHMETIC_ERROR");
    const engineDetectedArith = arithDiffs.length;

    if (revIssues.length === 0) {
      console.log("    Math: CLEAN");
    } else {
      // In test data, Doc B math errors are intentional — verify engine catches them
      revIssues.forEach(i => console.log(i));
      totalIntentionalErrors += revIssues.length;
      if (engineDetectedArith === 0) {
        console.log(`    [!!! ENGINE MISSED] ${revIssues.length} math error(s) in Doc B but engine reported ZERO arithmetic errors!`);
        totalSystemIssues += revIssues.length;
      } else {
        console.log(`    Engine detected: ${engineDetectedArith} arithmetic error(s) — CORRECT`);
      }
    }

    // ── Net Financial Delta ───────────────────────────────────────────────
    const statedOrigTotal = report.statedOriginalTotal;
    const statedRevTotal  = report.statedRevisedTotal;
    const correctDelta    = statedOrigTotal !== 0 && statedRevTotal !== 0
      ? statedRevTotal - statedOrigTotal
      : null;
    const reportedDelta   = report.netFinancialDelta;

    console.log(`\n  Financial Reconciliation:`);
    console.log(`    Stated Original (Doc A):  ${fmt(statedOrigTotal)}`);
    console.log(`    Stated Revised  (Doc B):  ${fmt(statedRevTotal)}`);
    console.log(`    Net Delta (Reported):      ${fmt(reportedDelta)}`);
    if (correctDelta !== null) {
      const deltaErr = Math.abs(reportedDelta - correctDelta);
      if (deltaErr > 0.01) {
        console.log(`    [!] DELTA WRONG: Correct delta = ${fmt(correctDelta)}, Reported = ${fmt(reportedDelta)}`);
        totalSystemIssues++;
      } else {
        console.log(`    Delta: CORRECT`);
      }
    } else {
      console.log(`    Delta: cannot verify (missing grand totals)`);
    }

    // ── Arithmetic Errors in Report ───────────────────────────────────────
    console.log(`\n  Arithmetic Errors in Report (${arithDiffs.length}):`);
    for (const e of arithDiffs) {
      console.log(`    • ${e.title} — ${e.description}`);
    }

    // ── Verdict ───────────────────────────────────────────────────────────
    console.log(`\n  Verdict: ${report.verdict} — "${report.verdictTitle}"`);
    console.log(`  Changes: ${report.substantiveChangesCount} substantive, ${report.formattingChangesCount} formatting`);
    console.log(`  Key Risks (${report.keyRisks.length}):`);
    report.keyRisks.forEach(r => console.log(`    • ${r}`));
  }

  console.log("\n================================================================");
  console.log(`MATH AUDIT DONE`);
  console.log(`  Intentional math errors in test data: ${totalIntentionalErrors}`);
  console.log(`  System-level issues (bugs): ${totalSystemIssues}`);
  console.log("================================================================\n");

  if (totalSystemIssues > 0) process.exit(1);
}

main().catch(err => {
  console.error("Audit failed:", err);
  process.exit(1);
});
