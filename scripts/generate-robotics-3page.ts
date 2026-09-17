import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface ProposalMetadata {
  company: string;
  title: string;
  client: string;
  currency: string;
  issueDate: string;
  validity: string;
  deliveryDate: string;
  project: string;
}

interface TableRow {
  index: number;
  description: string;
  qty: number | string;
  unitPrice: number;
  total: number;
}

interface PageConfig {
  headerSectionTitle: string;
  items: TableRow[];
  pageIndex: number;
  totalPages: number;
  showGrandTotal?: boolean;
  subtotalAmount?: number;
  grandTotalAmount?: number;
  footerNote?: string;
}

async function create3PageProposalPdf(
  metadata: ProposalMetadata,
  pages: PageConfig[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.1, 0.12, 0.15);
  const mutedColor = rgb(0.45, 0.48, 0.52);
  const accentColor = rgb(0.1, 0.35, 0.75); // Deep Cobalt
  const brandRed = rgb(0.85, 0.1, 0.15);

  for (const pageCfg of pages) {
    const page = doc.addPage([612, 792]); // Standard US Letter (8.5 x 11 in)
    const { width, height } = page.getSize();

    let y = height - 48;

    // 1. Header Branding
    page.drawText(metadata.company, {
      x: 50,
      y,
      size: 13,
      font: fontBold,
      color: accentColor,
    });
    y -= 17;

    // 2. Proposal Title & Pagination
    page.drawText(`${metadata.title} (Page ${pageCfg.pageIndex} of ${pageCfg.totalPages})`, {
      x: 50,
      y,
      size: 10.5,
      font: fontBold,
      color: primaryColor,
    });
    y -= 17;

    // 3. Metadata Lines
    page.drawText(`Client: ${metadata.client} Currency: ${metadata.currency}`, {
      x: 50,
      y,
      size: 8.5,
      font: fontRegular,
      color: mutedColor,
    });
    y -= 13;

    page.drawText(`Date of Issue: ${metadata.issueDate} Validity: ${metadata.validity}`, {
      x: 50,
      y,
      size: 8.5,
      font: fontRegular,
      color: mutedColor,
    });
    y -= 13;

    page.drawText(`Delivery Date: ${metadata.deliveryDate} Project: ${metadata.project}`, {
      x: 50,
      y,
      size: 8.5,
      font: fontRegular,
      color: mutedColor,
    });
    y -= 20;

    // 4. Section Header
    if (pageCfg.headerSectionTitle) {
      page.drawText(pageCfg.headerSectionTitle, {
        x: 50,
        y,
        size: 9.5,
        font: fontBold,
        color: accentColor,
      });
      y -= 15;
    }

    // 5. Table Header
    const headerText = "# Description Qty Unit Price ($) Total ($)";
    page.drawText(headerText, {
      x: 50,
      y,
      size: 8.5,
      font: fontBold,
      color: primaryColor,
    });
    y -= 6;

    // Table Divider Line
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: rgb(0.8, 0.82, 0.85),
    });
    y -= 15;

    // 6. Table Rows
    for (const row of pageCfg.items) {
      const idxStr = `${row.index} `;
      const priceFormatted = row.unitPrice.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const totalFormatted = row.total.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

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

    // 7. Page Continuation Note (if not last page)
    if (pageCfg.pageIndex < pageCfg.totalPages) {
      y -= 14;
      page.drawText(`Continued on Page ${pageCfg.pageIndex + 1} for Next System Sections...`, {
        x: 50,
        y,
        size: 8,
        font: fontRegular,
        color: mutedColor,
      });
    }

    // 8. Grand Total Block (on Page 3)
    if (pageCfg.showGrandTotal && pageCfg.grandTotalAmount !== undefined) {
      y -= 16;
      const subtotalFormatted = (pageCfg.subtotalAmount ?? pageCfg.grandTotalAmount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const grandTotalFormatted = pageCfg.grandTotalAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      page.drawText(`Subtotal: $${subtotalFormatted}`, {
        x: 50,
        y,
        size: 9,
        font: fontRegular,
        color: primaryColor,
      });
      y -= 15;

      page.drawText(`Grand Total (${metadata.currency}): $${grandTotalFormatted}`, {
        x: 50,
        y,
        size: 11,
        font: fontBold,
        color: accentColor,
      });
      y -= 22;
    }

    // 9. Footer Terms
    if (pageCfg.footerNote) {
      page.drawText(pageCfg.footerNote, {
        x: 50,
        y,
        size: 7.5,
        font: fontRegular,
        color: mutedColor,
      });
      y -= 14;
    }

    // 10. Signature Block at bottom
    page.drawText(`Authorized Officer: _______________________ Date: ${metadata.issueDate}`, {
      x: 50,
      y: 40,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    });
  }

  return doc.save();
}

async function main() {
  const outDir = path.join(process.cwd(), "public", "samples");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log("Generating 3-page commercial proposals (Document A & Document B)...");

  // =========================================================================
  // DOCUMENT A: Baseline Original Proposal (3 Full Pages, 10 Items, 100% Clean Math)
  // =========================================================================
  const docAPages: PageConfig[] = [
    {
      pageIndex: 1,
      totalPages: 3,
      headerSectionTitle: "SECTION 1: MOBILE ROBOTICS & ARTICULATED MANIPULATION",
      items: [
        { index: 1, description: "Nexus Heavy-Payload Mobile Robot AGV-500", qty: 4, unitPrice: 12500.0, total: 50000.0 },
        { index: 2, description: "KUKA 6-Axis High-Speed Robotic Articulated Arm", qty: 2, unitPrice: 18200.0, total: 36400.0 },
        { index: 3, description: "Pneumatic End-Effector Vacuum Gripper Assembly", qty: 6, unitPrice: 1450.0, total: 8700.0 },
      ],
    },
    {
      pageIndex: 2,
      totalPages: 3,
      headerSectionTitle: "SECTION 2: COMPUTER VISION, TELEMETRY & INDUSTRIAL NETWORKING",
      items: [
        { index: 4, description: "Cognex In-Sight 3D Industrial Vision Scanner", qty: 4, unitPrice: 4800.0, total: 19200.0 },
        { index: 5, description: "Siemens Industrial Edge Computing Server IPC527G", qty: 2, unitPrice: 6500.0, total: 13000.0 },
        { index: 6, description: "Cisco Catalyst Industrial Ethernet Rugged Switch IE-3400", qty: 3, unitPrice: 2100.0, total: 6300.0 },
        { index: 7, description: "High-Density Optical LiDAR Navigation Sensor 360", qty: 8, unitPrice: 950.0, total: 7600.0 },
      ],
    },
    {
      pageIndex: 3,
      totalPages: 3,
      headerSectionTitle: "SECTION 3: MACHINE SAFETY GUARDING & COMMISSIONING SERVICES",
      items: [
        { index: 8, description: "Troax Modular Industrial Machine Safety Guarding 20m", qty: 1, unitPrice: 8500.0, total: 8500.0 },
        { index: 9, description: "On-Site System Integration & Robot Calibration Service", qty: 1, unitPrice: 14200.0, total: 14200.0 },
        { index: 10, description: "24/7 Priority Emergency Maintenance SLA (12 Months)", qty: 1, unitPrice: 6000.0, total: 6000.0 },
      ],
      showGrandTotal: true,
      subtotalAmount: 169900.0,
      grandTotalAmount: 169900.0,
      footerNote: "COMMERCIAL CONDITIONS: Net 30 payment schedule. Deliverables backed by 24-month OEM warranty.",
    },
  ];

  const docAPdf = await create3PageProposalPdf(
    {
      company: "NEXUS INDUSTRIAL ROBOTICS CORP.",
      title: "COMMERCIAL PROPOSAL / OFFER #NIR-2026-550",
      client: "Global Fulfilment Logistics GmbH",
      currency: "USD ($)",
      issueDate: "November 01, 2026",
      validity: "30 Calendar Days",
      deliveryDate: "December 15, 2026",
      project: "Automated Sorting & AGV Warehouse Overhaul",
    },
    docAPages
  );

  const docAPath = path.join(outDir, "offer_robotics_3page_docA.pdf");
  fs.writeFileSync(docAPath, docAPdf);
  console.log(`[OK] Saved Document A (Original 3-Page): ${docAPath} (${docAPdf.length} bytes)`);

  // =========================================================================
  // DOCUMENT B: Revised Proposal (3 Full Pages, 9 Items, Intentional Variations + Math Error)
  // =========================================================================
  const docBPages: PageConfig[] = [
    {
      pageIndex: 1,
      totalPages: 3,
      headerSectionTitle: "SECTION 1: MOBILE ROBOTICS & ARTICULATED MANIPULATION",
      items: [
        // Item 1: Identical & mathematically correct
        { index: 1, description: "Nexus Heavy-Payload Mobile Robot AGV-500", qty: 4, unitPrice: 12500.0, total: 50000.0 },
        // Item 2: Renamed & Price change ($18,200 -> $19,500), math is CORRECT (2 * 19,500 = 39,000)
        { index: 2, description: "KUKA 6-Axis High-Speed Robotic Articulated Arm (Gen 3)", qty: 2, unitPrice: 19500.0, total: 39000.0 },
        // Item 3: Qty change (6 -> 8), math is CORRECT (8 * 1,450 = 11,600)
        { index: 3, description: "Pneumatic End-Effector Vacuum Gripper Assembly", qty: 8, unitPrice: 1450.0, total: 11600.0 },
      ],
    },
    {
      pageIndex: 2,
      totalPages: 3,
      headerSectionTitle: "SECTION 2: COMPUTER VISION, TELEMETRY & INDUSTRIAL NETWORKING",
      items: [
        // Item 4: Identical & mathematically correct
        { index: 4, description: "Cognex In-Sight 3D Industrial Vision Scanner", qty: 4, unitPrice: 4800.0, total: 19200.0 },
        // Item 5 (Siemens Server): OMITTED completely (Scope reduction)
        // Item 5 (was 6): Identical & correct
        { index: 5, description: "Cisco Catalyst Industrial Ethernet Rugged Switch IE-3400", qty: 3, unitPrice: 2100.0, total: 6300.0 },
        // Item 6 (was 7): Identical & correct
        { index: 6, description: "High-Density Optical LiDAR Navigation Sensor 360", qty: 8, unitPrice: 950.0, total: 7600.0 },
      ],
    },
    {
      pageIndex: 3,
      totalPages: 3,
      headerSectionTitle: "SECTION 3: MACHINE SAFETY GUARDING & COMMISSIONING SERVICES",
      items: [
        // Item 7 (was 8): Identical & correct
        { index: 7, description: "Troax Modular Industrial Machine Safety Guarding 20m", qty: 1, unitPrice: 8500.0, total: 8500.0 },
        // Item 8 (was 9): Identical & correct
        { index: 8, description: "On-Site System Integration & Robot Calibration Service", qty: 1, unitPrice: 14200.0, total: 14200.0 },
        // Item 9 (was 10): INTENTIONAL ARITHMETIC DISCREPANCY:
        // 1 * $6,000.00 = $6,000.00, but stated as $4,800.00 (understated by $1,200.00!)
        { index: 9, description: "24/7 Priority Emergency Maintenance SLA (12 Months)", qty: 1, unitPrice: 6000.0, total: 4800.0 },
      ],
      showGrandTotal: true,
      subtotalAmount: 161200.0,
      // Stated sum of lines: 50,000 + 39,000 + 11,600 + 19,200 + 6,300 + 7,600 + 8,500 + 14,200 + 4,800 = 161,200.00
      grandTotalAmount: 161200.0,
      footerNote: "REVISED CONDITIONS: Revision 1 supersedes quotation #NIR-2026-550. Terms subject to revised deployment schedule.",
    },
  ];

  const docBPdf = await create3PageProposalPdf(
    {
      company: "NEXUS INDUSTRIAL ROBOTICS CORP.",
      title: "COMMERCIAL PROPOSAL / OFFER #NIR-2026-550-REV1",
      client: "Global Fulfilment Logistics GmbH",
      currency: "USD ($)",
      issueDate: "November 12, 2026",
      validity: "30 Calendar Days",
      deliveryDate: "January 20, 2027", // Postponed from December 15, 2026 to January 20, 2027
      project: "Automated Sorting & AGV Warehouse Overhaul (Revision 1)",
    },
    docBPages
  );

  const docBPath = path.join(outDir, "offer_robotics_3page_docB.pdf");
  fs.writeFileSync(docBPath, docBPdf);
  console.log(`[OK] Saved Document B (Revised 3-Page): ${docBPath} (${docBPdf.length} bytes)`);

  console.log("\nSummary of files created:");
  console.log(`  1. Document A: ${docAPath}`);
  console.log(`  2. Document B: ${docBPath}`);
}

main().catch((e) => {
  console.error("Error generating 3-page proposals:", e);
  process.exit(1);
});
