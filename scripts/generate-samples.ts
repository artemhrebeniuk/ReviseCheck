import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Synthetic Commercial Offer PDF Generator for ReviseCheck
 * Programmatically builds vector PDF proposals using pdf-lib with exact layouts,
 * coordinates, fonts, tables, and intentional commercial/arithmetic variations.
 */

interface ProposalMetadata {
  title: string;
  client: string;
  currency: string;
  issueDate: string;
  validity: string;
  deliveryDate: string;
  project: string;
}

interface TableRow {
  index?: number;
  description: string;
  qty: number | string;
  unitPrice: number | string;
  total: number | string;
}

interface PageConfig {
  headerSectionTitle?: string;
  items: TableRow[];
  pageIndex: number;
  totalPages: number;
  showGrandTotal?: boolean;
  grandTotalAmount?: number | string;
  footerNote?: string;
}

async function createProposalPdf(
  metadata: ProposalMetadata,
  pages: PageConfig[],
  fontStyle: "helvetica" | "courier" = "helvetica"
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  const fontRegular = await doc.embedFont(
    fontStyle === "courier" ? StandardFonts.Courier : StandardFonts.Helvetica
  );
  const fontBold = await doc.embedFont(
    fontStyle === "courier" ? StandardFonts.CourierBold : StandardFonts.HelveticaBold
  );

  const primaryColor = rgb(0.1, 0.1, 0.1);
  const mutedColor = rgb(0.4, 0.4, 0.4);
  const accentColor = rgb(0.15, 0.35, 0.75);

  for (const pageCfg of pages) {
    const page = doc.addPage([612, 792]); // Standard US Letter (8.5 x 11 inches)
    const { width, height } = page.getSize();

    let y = height - 50;

    // Header Branding
    page.drawText("TECHSPHERE SOLUTIONS INC.", {
      x: 50,
      y,
      size: 14,
      font: fontBold,
      color: accentColor,
    });
    y -= 18;

    // Proposal Title
    page.drawText(`${metadata.title} (Page ${pageCfg.pageIndex} of ${pageCfg.totalPages})`, {
      x: 50,
      y,
      size: 11,
      font: fontBold,
      color: primaryColor,
    });
    y -= 18;

    // Metadata line 1
    page.drawText(`Client: ${metadata.client} Currency: ${metadata.currency}`, {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
      color: mutedColor,
    });
    y -= 14;

    // Metadata line 2
    page.drawText(`Date of Issue: ${metadata.issueDate} Validity: ${metadata.validity}`, {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
      color: mutedColor,
    });
    y -= 14;

    // Metadata line 3 (Delivery date)
    page.drawText(`Delivery Date: ${metadata.deliveryDate} Project: ${metadata.project}`, {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
      color: mutedColor,
    });
    y -= 22;

    // Section title
    if (pageCfg.headerSectionTitle) {
      page.drawText(pageCfg.headerSectionTitle, {
        x: 50,
        y,
        size: 10,
        font: fontBold,
        color: accentColor,
      });
      y -= 16;
    }

    // Table Header
    const headerText = fontStyle === "courier"
      ? "ITEM DESCRIPTION QUANTITY UNIT RATE LINE TOTAL"
      : "# Description Qty Unit Price ($) Total ($)";
    page.drawText(headerText, {
      x: 50,
      y,
      size: 9,
      font: fontBold,
      color: primaryColor,
    });
    y -= 6;

    // Table Header Separator
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 14;

    // Table Rows
    for (const row of pageCfg.items) {
      const idxStr = row.index !== undefined ? `${row.index} ` : "";
      const priceFormatted = typeof row.unitPrice === "number" ? row.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : row.unitPrice;
      const totalFormatted = typeof row.total === "number" ? row.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : row.total;
      
      const rowLine = `${idxStr}${row.description} ${row.qty} ${priceFormatted} ${totalFormatted}`;

      page.drawText(rowLine, {
        x: 50,
        y,
        size: 8.5,
        font: fontRegular,
        color: primaryColor,
      });
      y -= 18;
    }

    if (pageCfg.pageIndex < pageCfg.totalPages && !pageCfg.showGrandTotal) {
      y -= 10;
      page.drawText("Continued on Page 2 for Peripherals, Services, and Grand Totals...", {
        x: 50,
        y,
        size: 8.5,
        font: fontRegular,
        color: mutedColor,
      });
    }

    // Grand Total Block
    if (pageCfg.showGrandTotal && pageCfg.grandTotalAmount !== undefined) {
      y -= 10;
      const totalFormatted = typeof pageCfg.grandTotalAmount === "number" 
        ? `$${pageCfg.grandTotalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
        : `${pageCfg.grandTotalAmount}`;
      
      page.drawText(`Subtotal: ${totalFormatted}`, {
        x: 50,
        y,
        size: 9,
        font: fontRegular,
        color: primaryColor,
      });
      y -= 16;

      page.drawText(`Grand Total (${metadata.currency}): ${totalFormatted}`, {
        x: 50,
        y,
        size: 11,
        font: fontBold,
        color: accentColor,
      });
      y -= 24;
    }

    // Footer
    if (pageCfg.footerNote) {
      page.drawText(pageCfg.footerNote, {
        x: 50,
        y,
        size: 8,
        font: fontRegular,
        color: mutedColor,
      });
      y -= 14;
    }

    // Signatures
    page.drawText(`Authorized Representative: _______________________ Date: ${metadata.issueDate}`, {
      x: 50,
      y: 40,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    });
  }

  return doc.save();
}

export async function generateAllSyntheticSamples(targetDir?: string) {
  const outDir = targetDir || path.join(process.cwd(), "public", "samples");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[ReviseCheck] Generating synthetic test proposal PDFs into: ${outDir}`);

  // 1. Offer_Original.pdf (Baseline 2-Page Enterprise IT Quote)
  const origPdf = await createProposalPdf(
    {
      title: "COMMERCIAL PROPOSAL / OFFER #TS-2026-881",
      client: "Apex Enterprise Systems Ltd.",
      currency: "USD ($)",
      issueDate: "October 01, 2026",
      validity: "30 Calendar Days",
      deliveryDate: "October 15, 2026",
      project: "Tier-2 Data Center Expansion",
    },
    [
      {
        pageIndex: 1,
        totalPages: 2,
        headerSectionTitle: "SECTION 1: CORE INFRASTRUCTURE HARDWARE",
        items: [
          { index: 1, description: "Dell PowerEdge Server R750", qty: 2, unitPrice: 4500.0, total: 9000.0 },
          { index: 2, description: "Cisco Catalyst 9200L 48-Port Switch", qty: 4, unitPrice: 1800.0, total: 7200.0 },
          { index: 3, description: "Fortinet FortiGate 100F Next-Gen Firewall", qty: 2, unitPrice: 3100.0, total: 6200.0 },
          { index: 4, description: "Synology Enterprise Storage Array 48TB", qty: 1, unitPrice: 5800.0, total: 5800.0 },
          { index: 5, description: "Dell UltraSharp 27 4K Monitor", qty: 10, unitPrice: 250.0, total: 2500.0 },
        ],
      },
      {
        pageIndex: 2,
        totalPages: 2,
        headerSectionTitle: "SECTION 2: WORKSTATIONS, DEPLOYMENT & SUPPORT SERVICES",
        items: [
          { index: 6, description: "APC Smart-UPS 1500VA LCD 230V", qty: 3, unitPrice: 700.0, total: 2100.0 },
          { index: 7, description: "Cat6 Shielded Patch Cable 5m", qty: 50, unitPrice: 10.0, total: 500.0 },
          { index: 8, description: "Lenovo ThinkPad P16 Gen 2 Workstation", qty: 5, unitPrice: 3200.0, total: 16000.0 },
          { index: 9, description: "Enterprise Deployment & Installation Service", qty: 1, unitPrice: 7900.0, total: 7900.0 },
          { index: 10, description: "24/7 Mission-Critical SLA Support (1 Year)", qty: 1, unitPrice: 2200.0, total: 2200.0 },
        ],
        showGrandTotal: true,
        grandTotalAmount: 59400.0,
        footerNote: "TERMS & CONDITIONS: Net 30 payment schedule. Deliverables subject to standard manufacturer warranties.",
      },
    ]
  );
  fs.writeFileSync(path.join(outDir, "offer_original.pdf"), origPdf);
  console.log("  [OK] Generated: offer_original.pdf (Baseline 2-page proposal, $59,400.00)");

  // 2. Offer_Revised_v1.pdf (Core Brief 7 Variations + Intentional Math Discrepancy)
  const revPdf = await createProposalPdf(
    {
      title: "COMMERCIAL PROPOSAL / OFFER #TS-2026-881-REV1",
      client: "Apex Enterprise Systems Ltd.",
      currency: "USD",
      issueDate: "October 08, 2026",
      validity: "30 Calendar Days (Revision 1)",
      deliveryDate: "November 05, 2026", // Shifted delivery date
      project: "Tier-2 Data Center Expansion",
    },
    [
      {
        pageIndex: 1,
        totalPages: 2,
        headerSectionTitle: "SECTION 1: CORE INFRASTRUCTURE HARDWARE",
        items: [
          { index: 1, description: "Enterprise Rack Server PE-R750 (Gen15)", qty: 2, unitPrice: 4500.0, total: 9000.0 }, // Renamed item
          { index: 2, description: "Lenovo ThinkPad P16 Gen 2 Workstation", qty: 5, unitPrice: 3200.0, total: 16000.0 }, // Reordered row
          { index: 3, description: "Fortinet FortiGate 100F Next-Gen Firewall", qty: 2, unitPrice: 3100.0, total: 6200.0 },
          { index: 4, description: "Synology Enterprise Storage Array 48TB", qty: 1, unitPrice: 5800.0, total: 5800.0 },
          { index: 5, description: "Dell UltraSharp 27 4K Monitor", qty: 10, unitPrice: 280.0, total: 2800.0 }, // Price changed ($250 -> $280)
        ],
      },
      {
        pageIndex: 2,
        totalPages: 2,
        headerSectionTitle: "SECTION 2: NETWORK CABLING, SERVICES & ARITHMETIC RECONCILIATION",
        items: [
          // APC Smart-UPS removed completely!
          { index: 6, description: "Cisco Catalyst 9200L 48-Port Switch", qty: 4, unitPrice: 1800.0, total: 7200.0 },
          { index: 7, description: "Cat6 Shielded Patch Cable 5m", qty: 100, unitPrice: 10.0, total: 800.0 }, // Qty 100 and INTENTIONAL MATH ERROR (100 * 10 = 1,000, stated 800)
          { index: 8, description: "Enterprise Deployment & Installation Service", qty: 1, unitPrice: 7900.0, total: 7900.0 },
          { index: 9, description: "24/7 Mission-Critical SLA Support (1 Year)", qty: 1, unitPrice: 2200.0, total: 2200.0 },
        ],
        showGrandTotal: true,
        grandTotalAmount: 57900.0,
        footerNote: "TERMS & CONDITIONS: Net 30 payment schedule. Revision 1 overrides previous quotation.",
      },
    ]
  );
  fs.writeFileSync(path.join(outDir, "offer_revised_v1.pdf"), revPdf);
  console.log("  [OK] Generated: offer_revised_v1.pdf (Core revision with 7 variations & vendor math error)");

  // 3. Offer_FormattingOnly.pdf (Zero-False-Positive Test in Courier Font)
  const formatPdf = await createProposalPdf(
    {
      title: "COMMERCIAL PROPOSAL / OFFER #TS-2026-881",
      client: "Apex Enterprise Systems Ltd.",
      currency: "USD ($)",
      issueDate: "October 01, 2026",
      validity: "30 Calendar Days",
      deliveryDate: "October 15, 2026",
      project: "Tier-2 Data Center Expansion",
    },
    [
      {
        pageIndex: 1,
        totalPages: 2,
        headerSectionTitle: "SECTION 1: CORE INFRASTRUCTURE HARDWARE",
        items: [
          { index: 1, description: "Dell PowerEdge Server R750", qty: 2, unitPrice: 4500.0, total: 9000.0 },
          { index: 2, description: "Cisco Catalyst 9200L 48-Port Switch", qty: 4, unitPrice: 1800.0, total: 7200.0 },
          { index: 3, description: "Fortinet FortiGate 100F Next-Gen Firewall", qty: 2, unitPrice: 3100.0, total: 6200.0 },
          { index: 4, description: "Synology Enterprise Storage Array 48TB", qty: 1, unitPrice: 5800.0, total: 5800.0 },
          { index: 5, description: "Dell UltraSharp 27 4K Monitor", qty: 10, unitPrice: 250.0, total: 2500.0 },
        ],
      },
      {
        pageIndex: 2,
        totalPages: 2,
        headerSectionTitle: "SECTION 2: WORKSTATIONS, DEPLOYMENT & SUPPORT SERVICES",
        items: [
          { index: 6, description: "APC Smart-UPS 1500VA LCD 230V", qty: 3, unitPrice: 700.0, total: 2100.0 },
          { index: 7, description: "Cat6 Shielded Patch Cable 5m", qty: 50, unitPrice: 10.0, total: 500.0 },
          { index: 8, description: "Lenovo ThinkPad P16 Gen 2 Workstation", qty: 5, unitPrice: 3200.0, total: 16000.0 },
          { index: 9, description: "Enterprise Deployment & Installation Service", qty: 1, unitPrice: 7900.0, total: 7900.0 },
          { index: 10, description: "24/7 Mission-Critical SLA Support (1 Year)", qty: 1, unitPrice: 2200.0, total: 2200.0 },
        ],
        showGrandTotal: true,
        grandTotalAmount: 59400.0,
        footerNote: "TERMS & CONDITIONS: Net 30 payment schedule. Deliverables subject to standard manufacturer warranties.",
      },
    ],
    "courier" // Courier font variation
  );
  fs.writeFileSync(path.join(outDir, "offer_formatting_only.pdf"), formatPdf);
  console.log("  [OK] Generated: offer_formatting_only.pdf (Pure formatting mutation, Courier typeface)");

  console.log("[ReviseCheck] Synthetic generation complete.\n");
}

// Execute when run directly via CLI
if (process.argv[1]?.includes("generate-samples")) {
  generateAllSyntheticSamples().catch((err) => {
    console.error("Failed to generate samples:", err);
    process.exit(1);
  });
}
