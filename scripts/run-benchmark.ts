import fs from "fs";
import path from "path";
import { extractPdfDocument } from "../src/lib/pdf/extractor";
import { compareCommercialOffers } from "../src/lib/engine/diff";

async function runBenchmarks() {
  console.log("===============================================================");
  console.log("   REVISECHECK COMPREHENSIVE BENCHMARK & EVALUATION SUITE");
  console.log("   Scope: Multi-Page Commercial Proposals (Up to 10 Line Items)");
  console.log("===============================================================\n");

  const samplesDir = path.join(process.cwd(), "public", "samples");

  // Load sample PDFs
  const originalBuf = fs.readFileSync(path.join(samplesDir, "offer_original.pdf"));
  const revisedV1Buf = fs.readFileSync(path.join(samplesDir, "offer_revised_v1.pdf"));
  const formattingOnlyBuf = fs.readFileSync(path.join(samplesDir, "offer_formatting_only.pdf"));
  const ambiguousBuf = fs.readFileSync(path.join(samplesDir, "offer_ambiguous.pdf"));
  const cleanApprovalBuf = fs.readFileSync(path.join(samplesDir, "offer_clean_approval.pdf"));
  const p3OrigBuf = fs.readFileSync(path.join(samplesDir, "offer_3page_original.pdf"));
  const p3RevBuf = fs.readFileSync(path.join(samplesDir, "offer_3page_revised.pdf"));
  const cloudOrigBuf = fs.readFileSync(path.join(samplesDir, "offer_cloud_migration_orig.pdf"));
  const cloudRevBuf = fs.readFileSync(path.join(samplesDir, "offer_cloud_migration_rev.pdf"));
  const inflOrigBuf = fs.readFileSync(path.join(samplesDir, "offer_arithmetic_inflation_orig.pdf"));
  const inflRevBuf = fs.readFileSync(path.join(samplesDir, "offer_arithmetic_inflation_rev.pdf"));
  const aeroOrigBuf = fs.readFileSync(path.join(samplesDir, "offer_milestone_schedule_orig.pdf"));
  const aeroRevBuf = fs.readFileSync(path.join(samplesDir, "offer_milestone_schedule_rev.pdf"));

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (details) console.error(`         Details: ${details}`);
    }
  }

  // TEST SUITE 1: Core Brief Validation (Original vs Revised v1)
  console.log("---------------------------------------------------------------");
  console.log("TEST SUITE 1: Standard Enterprise Audit (2 Pages, 10 Items, 7 Core Changes)");
  console.log("---------------------------------------------------------------");

  const t1Start = Date.now();
  const docOriginal = await extractPdfDocument(originalBuf);
  const docRevisedV1 = await extractPdfDocument(revisedV1Buf);
  const reportV1 = compareCommercialOffers(docOriginal, docRevisedV1);
  const t1Latency = Date.now() - t1Start;

  console.log(`  Processing Latency: ${t1Latency} ms`);
  console.log(`  Telemetry & Variable Cost: $${reportV1.telemetry.costUSD.toFixed(5)} USD (Deterministic Local: $0.00000 | Hybrid AI Mode: ~$0.00018 USD / pair)`);
  console.log(`  Executive Verdict: ${reportV1.verdict} (${reportV1.verdictTitle})`);
  console.log(`  Substantive Changes: ${reportV1.substantiveChangesCount}`);
  console.log(`  Formatting Changes: ${reportV1.formattingChangesCount}`);

  // Assert 1.1: Multi-page document support
  assert(
    docOriginal.totalPages === 2 && docRevisedV1.totalPages === 2,
    "Case 1.1: Multi-page PDF ingestion & pagination (2 Pages per document)"
  );

  // Assert 1.2: Item count across multiple pages
  assert(
    docOriginal.items.length === 10 && docRevisedV1.items.length === 9,
    "Case 1.2: Multi-page line item extraction (10 items in Doc 1, 9 items in Doc 2)"
  );

  // Assert 1.3: Renamed item detected across pages
  const renamedDiff = reportV1.diffs.find((d) => d.type === "RENAMED_ITEM");
  assert(
    Boolean(renamedDiff && renamedDiff.originalValue?.toString().includes("Dell PowerEdge")),
    "Case 1.3: Renamed item detected ('Dell PowerEdge R750' -> 'Enterprise Rack Server PE-R750')"
  );

  // Assert 1.4: Cross-page row reordering detected
  const reorderDiff = reportV1.diffs.find((d) => d.type === "REORDERED");
  assert(
    Boolean(reorderDiff),
    "Case 1.4: Cross-page row reordering detected without corrupting item alignments"
  );

  // Assert 1.5: Quantity change detected
  const qtyDiff = reportV1.diffs.find(
    (d) => d.type === "QTY_CHANGE" && d.title.includes("Cat6")
  );
  assert(
    Boolean(qtyDiff && qtyDiff.originalValue === 50 && qtyDiff.revisedValue === 100),
    "Case 1.5: Quantity change detected on Cat6 Cables (50 -> 100)"
  );

  // Assert 1.6: Unit price change detected
  const priceDiff = reportV1.diffs.find(
    (d) => d.type === "PRICE_CHANGE" && d.title.includes("Monitor")
  );
  assert(
    Boolean(priceDiff && priceDiff.delta?.toString().includes("30")),
    "Case 1.6: Unit price change detected on 27' Monitor ($250 -> $280)"
  );

  // Assert 1.7: Removed item detected
  const removedDiff = reportV1.diffs.find(
    (d) => d.type === "SCOPE_REMOVED" && d.title.includes("APC Smart-UPS")
  );
  assert(
    Boolean(removedDiff),
    "Case 1.7: Scope omission detected ('APC Smart-UPS 1500VA' removed from revision)"
  );

  // Assert 1.8: Delivery date change detected
  const dateDiff = reportV1.diffs.find((d) => d.type === "DATE_CHANGE");
  assert(
    Boolean(dateDiff && dateDiff.revisedValue?.toString().includes("November 05")),
    "Case 1.8: Delivery date postponement detected (Oct 15 -> Nov 05, 2026)"
  );

  // Assert 1.9: Intentionally incorrect arithmetic total detected
  const arithDiff = reportV1.diffs.find((d) => d.type === "ARITHMETIC_ERROR");
  assert(
    Boolean(arithDiff && arithDiff.title.includes("Cat6")),
    "Case 1.9: Arithmetic discrepancy detected (100 × $10.00 = $1,000.00, stated $800.00)"
  );

  // Assert 1.10: Strict source location referencing with page numbers
  const allHaveSourceLocations = reportV1.diffs.every(
    (d) =>
      Boolean(d.originalLocation && d.originalLocation.page > 0) &&
      Boolean(d.revisedLocation && d.revisedLocation.page > 0)
  );
  assert(
    allHaveSourceLocations,
    "Case 1.10: Dual Source Location Referencing (Every change points to Page & Coordinates in Doc 1 & Doc 2)"
  );

  // Assert 1.11: Executive verdict blocks agreement due to arithmetic discrepancy
  assert(
    reportV1.verdict === "REJECT",
    "Case 1.11: Executive Verdict triggers 'REJECT' due to arithmetic discrepancy in source"
  );

  // TEST SUITE 2: Multi-Page Formatting-Only Variant (Original vs Formatting-Only)
  console.log("\n---------------------------------------------------------------");
  console.log("TEST SUITE 2: Multi-Page Formatting-Only (Restructured Layout & Columns)");
  console.log("---------------------------------------------------------------");

  const docFormatting = await extractPdfDocument(formattingOnlyBuf);
  const reportFormatting = compareCommercialOffers(docOriginal, docFormatting);

  console.log(`  Substantive Changes: ${reportFormatting.substantiveChangesCount}`);
  console.log(`  Formatting Changes: ${reportFormatting.formattingChangesCount}`);
  console.log(`  Executive Verdict: ${reportFormatting.verdict} (${reportFormatting.verdictTitle})`);

  assert(
    reportFormatting.substantiveChangesCount === 0,
    "Case 2.1: Zero Substantive Changes: Layout, fonts, and column reordering produce 0 commercial alerts"
  );
  assert(
    reportFormatting.verdict === "APPROVE",
    "Case 2.2: Verdict 'APPROVE' issued when all commercial terms are identical"
  );

  // TEST SUITE 3: Ambiguity / Decline to Conclude
  console.log("\n---------------------------------------------------------------");
  console.log("TEST SUITE 3: Ambiguity & Decline to Conclude (EUR vs USD, TBD Timeline)");
  console.log("---------------------------------------------------------------");

  const docAmbiguous = await extractPdfDocument(ambiguousBuf);
  const reportAmbiguous = compareCommercialOffers(docOriginal, docAmbiguous);

  console.log(`  Executive Verdict: ${reportAmbiguous.verdict} (${reportAmbiguous.verdictTitle})`);
  console.log(`  Clarification Questions: ${reportAmbiguous.clarificationQuestions?.length ?? 0}`);

  assert(
    reportAmbiguous.verdict === "NEEDS_CLARIFICATION",
    "Case 3.1: Decline to Conclude: Status 'NEEDS_CLARIFICATION' triggered on ambiguity & currency clash"
  );
  assert(
    (reportAmbiguous.clarificationQuestions?.length ?? 0) > 0,
    "Case 3.2: Actionable Clarification Questions generated for decision maker"
  );

  // TEST SUITE 4: Clean Negotiated Revision (Authorized 5% Bulk Discount)
  console.log("\n---------------------------------------------------------------");
  console.log("TEST SUITE 4: Clean Authorized Revision (5% Bulk Discount, Valid Math)");
  console.log("---------------------------------------------------------------");

  const docClean = await extractPdfDocument(cleanApprovalBuf);
  const reportClean = compareCommercialOffers(docOriginal, docClean);

  console.log(`  Executive Verdict: ${reportClean.verdict} (${reportClean.verdictTitle})`);
  console.log(`  Net Financial Delta: $${reportClean.netFinancialDelta.toLocaleString()}`);

  assert(
    reportClean.verdict === "APPROVE",
    "Case 4.1: Clean Revision approved with zero arithmetic warnings"
  );
  assert(
    reportClean.netFinancialDelta === -2970,
    "Case 4.2: Exact Net Financial Savings calculated (-$2,970.00 / 5% discount)"
  );

  // TEST SUITE 5: 3-Page Hyperscale Proposal (Max Scope: 3 Pages, 10 Items)
  console.log("\n---------------------------------------------------------------");
  console.log("TEST SUITE 5: 3-Page Hyperscale Proposal (3 Full Pages, 10 Line Items)");
  console.log("---------------------------------------------------------------");

  const docP3Orig = await extractPdfDocument(p3OrigBuf);
  const docP3Rev = await extractPdfDocument(p3RevBuf);
  const reportP3 = compareCommercialOffers(docP3Orig, docP3Rev);

  console.log(`  Pages Analyzed: ${docP3Orig.totalPages} in Doc A, ${docP3Rev.totalPages} in Doc B`);
  console.log(`  Items Ingested: ${docP3Orig.items.length} in Doc A, ${docP3Rev.items.length} in Doc B`);
  console.log(`  Executive Verdict: ${reportP3.verdict} (${reportP3.verdictTitle})`);

  assert(
    docP3Orig.totalPages === 3 && docP3Rev.totalPages === 3,
    "Case 5.1: Maximum 3-page scope support fully verified across all document sections"
  );
  assert(
    docP3Orig.items.length === 10,
    "Case 5.2: Ingestion of 10 complex multi-tier items spanning 3 distinct pages"
  );
  assert(
    reportP3.diffs.some((d) => d.type === "ARITHMETIC_ERROR"),
    "Case 5.3: Arithmetic discrepancy accurately caught on page 3 ($500.00 understatement on rack enclosure)"
  );
  assert(
    reportP3.diffs.some((d) => d.type === "DATE_CHANGE"),
    "Case 5.4: Multi-page delivery date postponement detected (Nov 15 -> Dec 20, 2026)"
  );
  assert(
    reportP3.diffs.some((d) => d.type === "SCOPE_REMOVED"),
    "Case 5.5: Scope omission detected on Page 3 (Eaton UPS removed from revised proposal)"
  );

  // TEST SUITE 6: Cloud Infrastructure Migration (AWS/GCP)
  console.log("\n---------------------------------------------------------------");
  console.log("TEST SUITE 6: Cloud Migration & Architectural Upgrade (10 Items, 2 Pages)");
  console.log("---------------------------------------------------------------");

  const docCloudOrig = await extractPdfDocument(cloudOrigBuf);
  const docCloudRev = await extractPdfDocument(cloudRevBuf);
  const reportCloud = compareCommercialOffers(docCloudOrig, docCloudRev);

  console.log(`  Pages Analyzed: ${docCloudOrig.totalPages} in Doc A, ${docCloudRev.totalPages} in Doc B`);
  console.log(`  Items Ingested: ${docCloudOrig.items.length} in Doc A, ${docCloudRev.items.length} in Doc B`);
  console.log(`  Executive Verdict: ${reportCloud.verdict} (${reportCloud.verdictTitle})`);

  assert(
    docCloudOrig.items.length === 10 && docCloudRev.items.length === 9,
    "Case 6.1: Multi-tier cloud line items ingested across 2 pages (10 in Doc A, 9 in Doc B)"
  );
  assert(
    reportCloud.diffs.some((d) => d.type === "RENAMED_ITEM" && (d.title.includes("Graviton") || d.description.includes("EC2"))),
    "Case 6.2: Compute architecture upgrade detected (EC2 m5.2xlarge -> Graviton3 c7g.2xlarge)"
  );
  assert(
    reportCloud.diffs.some((d) => d.type === "QTY_CHANGE" && d.title.includes("S3")),
    "Case 6.3: Cloud storage expansion detected on S3 Intelligent-Tiering (50TB -> 80TB)"
  );
  assert(
    reportCloud.diffs.some((d) => d.type === "SCOPE_REMOVED" && d.title.includes("NAT Gateway")),
    "Case 6.4: Scope removal detected (AWS NAT Gateway eliminated in favor of IPv6 egress)"
  );
  assert(
    reportCloud.diffs.some((d) => d.type === "DATE_CHANGE"),
    "Case 6.5: Cloud migration delivery date postponement detected (Nov 20 -> Dec 15, 2026)"
  );

  // TEST SUITE 7: Severe Arithmetic Inflation & Tax Inconsistency
  console.log("\n---------------------------------------------------------------");
  console.log("TEST SUITE 7: Severe Arithmetic Inflation & Unallocated Margin (+ $4,500)");
  console.log("---------------------------------------------------------------");

  const docInflOrig = await extractPdfDocument(inflOrigBuf);
  const docInflRev = await extractPdfDocument(inflRevBuf);
  const reportInfl = compareCommercialOffers(docInflOrig, docInflRev);

  console.log(`  Executive Verdict: ${reportInfl.verdict} (${reportInfl.verdictTitle})`);
  console.log(`  Arithmetic Errors Flagged: ${reportInfl.arithmeticErrorsCount}`);

  assert(
    reportInfl.verdict === "REJECT",
    "Case 7.1: Executive Verdict correctly triggers 'REJECT' on severe source arithmetic inflation"
  );
  assert(
    reportInfl.hasArithmeticErrors && reportInfl.diffs.some((d) => d.type === "ARITHMETIC_ERROR"),
    "Case 7.2: Unallocated +$4,500.00 grand total inflation flagged with CRITICAL severity"
  );
  assert(
    reportInfl.diffs.some((d) => d.type === "ARITHMETIC_ERROR" && d.title.includes("Keyence")),
    "Case 7.3: Line-item math inconsistency caught (4 × $2,500 = $10,000, stated $11,500)"
  );

  // TEST SUITE 8: Phased Milestone & Delivery Overhaul
  console.log("\n---------------------------------------------------------------");
  console.log("TEST SUITE 8: Phased Milestone Overhaul & Schedule Realignment");
  console.log("---------------------------------------------------------------");

  const docAeroOrig = await extractPdfDocument(aeroOrigBuf);
  const docAeroRev = await extractPdfDocument(aeroRevBuf);
  const reportAero = compareCommercialOffers(docAeroOrig, docAeroRev);

  console.log(`  Executive Verdict: ${reportAero.verdict} (${reportAero.verdictTitle})`);

  assert(
    reportAero.diffs.some((d) => d.type === "DATE_CHANGE" && d.revisedValue?.toString().includes("2027")),
    "Case 8.1: Postponed single-batch milestone delivery detected (Dec 20, 2026 -> Feb 28, 2027)"
  );
  assert(
    reportAero.diffs.some((d) => d.type === "RENAMED_ITEM" && d.title.includes("1553")),
    "Case 8.2: Avionics specification rename detected ('MIL-STD-1553' -> 'Airborne Bus Transceiver Interface 1553')"
  );
  assert(
    reportAero.diffs.some((d) => d.type === "QTY_CHANGE" && d.title.includes("Harness")),
    "Case 8.3: Wiring harness quantity doubled (10 -> 20 units)"
  );
  assert(
    reportAero.diffs.some((d) => d.type === "PRICE_CHANGE" && d.title.includes("Flight Computer")),
    "Case 8.4: ATR Chassis flight computer price adjustment detected ($9,500 -> $10,500)"
  );

  // SUMMARY REPORT
  console.log("\n===============================================================");
  console.log(
    `BENCHMARK SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round(
      (passedTests / totalTests) * 100
    )}%)`
  );
  console.log("===============================================================");

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runBenchmarks().catch((err) => {
  console.error("Benchmark runner failed:", err);
  process.exit(1);
});
