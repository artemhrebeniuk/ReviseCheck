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
  qty: number;
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

async function createDenseProposalPdf(
  metadata: ProposalMetadata,
  pages: PageConfig[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.08, 0.1, 0.14);
  const mutedColor = rgb(0.42, 0.45, 0.5);
  const accentColor = rgb(0.12, 0.35, 0.72); // Deep Indigo-Cobalt

  for (const pageCfg of pages) {
    const page = doc.addPage([612, 792]); // Standard US Letter (8.5 x 11 inches)
    const { width, height } = page.getSize();

    let y = height - 42;

    // Header Branding
    page.drawText(metadata.company, {
      x: 45,
      y,
      size: 11.5,
      font: fontBold,
      color: accentColor,
    });
    y -= 15;

    // Proposal Title
    page.drawText(`${metadata.title} (Page ${pageCfg.pageIndex} of ${pageCfg.totalPages})`, {
      x: 45,
      y,
      size: 10,
      font: fontBold,
      color: primaryColor,
    });
    y -= 14;

    // Metadata line 1
    page.drawText(`Client: ${metadata.client}   |   Currency: ${metadata.currency}   |   Issue Date: ${metadata.issueDate}`, {
      x: 45,
      y,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    });
    y -= 12;

    // Metadata line 2
    page.drawText(`Delivery Timeline: ${metadata.deliveryDate}   |   Validity: ${metadata.validity}   |   Project: ${metadata.project}`, {
      x: 45,
      y,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    });
    y -= 17;

    // Section title
    if (pageCfg.headerSectionTitle) {
      page.drawText(pageCfg.headerSectionTitle, {
        x: 45,
        y,
        size: 9,
        font: fontBold,
        color: accentColor,
      });
      y -= 13;
    }

    // Table Header
    const headerText = "# Description Qty Unit Price ($) Total ($)";
    page.drawText(headerText, {
      x: 45,
      y,
      size: 8,
      font: fontBold,
      color: primaryColor,
    });
    y -= 5;

    // Table Header Separator
    page.drawLine({
      start: { x: 45, y },
      end: { x: width - 45, y },
      thickness: 1,
      color: rgb(0.78, 0.81, 0.86),
    });
    y -= 14;

    // Table Rows (Densely spaced at 15pt line spacing to pack ~24 rows cleanly)
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
        x: 45,
        y,
        size: 7.8,
        font: fontRegular,
        color: primaryColor,
      });
      y -= 15.2;
    }

    // Continuation cue
    if (pageCfg.pageIndex < pageCfg.totalPages) {
      y -= 8;
      page.drawText(`--- Continues on Page ${pageCfg.pageIndex + 1} with Next Systems Breakdown ---`, {
        x: 45,
        y,
        size: 7.5,
        font: fontRegular,
        color: mutedColor,
      });
    }

    // Grand Total Block on Page 3
    if (pageCfg.showGrandTotal && pageCfg.grandTotalAmount !== undefined) {
      y -= 10;
      const subtotalFormatted = (pageCfg.subtotalAmount ?? pageCfg.grandTotalAmount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const grandTotalFormatted = pageCfg.grandTotalAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      page.drawText(`Subtotal: $${subtotalFormatted}`, {
        x: 45,
        y,
        size: 8.5,
        font: fontRegular,
        color: primaryColor,
      });
      y -= 14;

      page.drawText(`Grand Total (${metadata.currency}): $${grandTotalFormatted}`, {
        x: 45,
        y,
        size: 10.5,
        font: fontBold,
        color: accentColor,
      });
      y -= 18;
    }

    // Footer Terms
    if (pageCfg.footerNote) {
      page.drawText(pageCfg.footerNote, {
        x: 45,
        y,
        size: 7,
        font: fontRegular,
        color: mutedColor,
      });
      y -= 12;
    }

    // Bottom Signatures
    page.drawText(`Authorized Executive: _______________________ Date: ${metadata.issueDate}`, {
      x: 45,
      y: 28,
      size: 7.5,
      font: fontRegular,
      color: mutedColor,
    });
  }

  return doc.save();
}

async function main() {
  const outDir = path.join(process.cwd(), "public", "samples");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log("Building dense 3-page commercial proposals (Document A & Document B)...");

  // =========================================================================
  // DOCUMENT A: 60 ITEMS (22 on Page 1, 22 on Page 2, 16 on Page 3) - 100% SOUND MATH
  // =========================================================================
  const docA_p1_items: TableRow[] = [
    { index: 1,  description: "Autonomous Mobile Robot AMR-1000 Heavy Chassis", qty: 4,  unitPrice: 14500.0, total: 58000.0 },
    { index: 2,  description: "High-Speed Autonomous Towing AGV-500", qty: 8,  unitPrice: 11200.0, total: 89600.0 },
    { index: 3,  description: "Automated Hydraulic Pallet Jack 2.5 Ton", qty: 4,  unitPrice: 3800.0,  total: 15200.0 },
    { index: 4,  description: "Inductive Floor Magnetic Charging Dock 48V", qty: 6,  unitPrice: 2400.0,  total: 14400.0 },
    { index: 5,  description: "Motorized Powered Roller Conveyor Section 3m", qty: 12, unitPrice: 1650.0,  total: 19800.0 },
    { index: 6,  description: "Belt Conveyor Variable Frequency Drive 5.5kW", qty: 4,  unitPrice: 2900.0,  total: 11600.0 },
    { index: 7,  description: "Right-Angle Pop-Up Roller Diverter Unit", qty: 6,  unitPrice: 3400.0,  total: 20400.0 },
    { index: 8,  description: "Gravity Spiral Incline Chute Assembly 4m", qty: 2,  unitPrice: 6200.0,  total: 12400.0 },
    { index: 9,  description: "KUKA 6-Axis High-Speed Industrial Arm KR-210", qty: 2,  unitPrice: 18200.0, total: 36400.0 },
    { index: 10, description: "Fanuc M-20iD High-Payload Handling Robot", qty: 2,  unitPrice: 21000.0, total: 42000.0 },
    { index: 11, description: "Heavy-Duty Floor Pedestal Robot Mount 1.2m", qty: 4,  unitPrice: 1150.0,  total: 4600.0 },
    { index: 12, description: "Pneumatic Dual-Zone Vacuum Gripper Assembly", qty: 6,  unitPrice: 1850.0,  total: 11100.0 },
    { index: 13, description: "Magnetic Sheet Metal Destacking Gripper Tool", qty: 2,  unitPrice: 2100.0,  total: 4200.0 },
    { index: 14, description: "Bionic Soft-Touch Compliant Gripper Finger Unit", qty: 4,  unitPrice: 1400.0,  total: 5600.0 },
    { index: 15, description: "Festo High-Speed Valve Manifold System 24V", qty: 8,  unitPrice: 850.0,   total: 6800.0 },
    { index: 16, description: "Compressed Air Refrigerated Dryer 500L min", qty: 1,  unitPrice: 5800.0,  total: 5800.0 },
    { index: 17, description: "Automated Case Forming Carton Erector Unit", qty: 2,  unitPrice: 9400.0,  total: 18800.0 },
    { index: 18, description: "High-Speed Top and Bottom Carton Tape Sealer", qty: 2,  unitPrice: 4500.0,  total: 9000.0 },
    { index: 19, description: "Automatic Pallet Stretch Wrapper Turntable", qty: 2,  unitPrice: 7800.0,  total: 15600.0 },
    { index: 20, description: "Pneumatic Carton Pusher Sorter Mechanism", qty: 8,  unitPrice: 1250.0,  total: 10000.0 },
    { index: 21, description: "Industrial In-Line Checkweigher Scale 60kg", qty: 3,  unitPrice: 4900.0,  total: 14700.0 },
    { index: 22, description: "Dynamic Overhead Parcel Dimensioner Scanner", qty: 2,  unitPrice: 6800.0,  total: 13600.0 },
  ];

  const docA_p2_items: TableRow[] = [
    { index: 23, description: "Cognex In-Sight 3D Industrial Vision Scanner", qty: 6,  unitPrice: 5200.0, total: 31200.0 },
    { index: 24, description: "Keyence SR-2000 Ultra-Wide Barcode Reader", qty: 12, unitPrice: 1450.0, total: 17400.0 },
    { index: 25, description: "SICK MicroScan3 Core Safety Laser Scanner", qty: 8,  unitPrice: 1800.0, total: 14400.0 },
    { index: 26, description: "OMRON Laser Time-of-Flight Ranging Sensor", qty: 16, unitPrice: 450.0,  total: 7200.0 },
    { index: 27, description: "Basler High-Resolution Area Scan Camera 12MP", qty: 6,  unitPrice: 1950.0, total: 11700.0 },
    { index: 28, description: "Siemens Industrial Edge Computing Server IPC527G", qty: 4,  unitPrice: 6500.0, total: 26000.0 },
    { index: 29, description: "Advantech Rugged Fanless Controller UNO-2484G", qty: 6,  unitPrice: 2200.0, total: 13200.0 },
    { index: 30, description: "Cisco Catalyst Industrial Ethernet Switch IE-3400", qty: 6,  unitPrice: 2100.0, total: 12600.0 },
    { index: 31, description: "Moxa Industrial Wireless Access Point AWK-3131A", qty: 8,  unitPrice: 950.0,  total: 7600.0 },
    { index: 32, description: "Hirschmann Multi-Mode SFP Fiber Transceiver", qty: 16, unitPrice: 220.0,  total: 3520.0 },
    { index: 33, description: "APC Smart-UPS RT 5000VA Online 230V Rack", qty: 4,  unitPrice: 3400.0, total: 13600.0 },
    { index: 34, description: "Rittal TS8 Industrial Sealed Server Enclosure 42U", qty: 2,  unitPrice: 2800.0, total: 5600.0 },
    { index: 35, description: "Belden Industrial Cat6A Shielded Cable 100m", qty: 10, unitPrice: 240.0,  total: 2400.0 },
    { index: 36, description: "Murrelektronik Distributed Fieldbus IO Block", qty: 12, unitPrice: 650.0,  total: 7800.0 },
    { index: 37, description: "Turck Inductive Proximity Sensor M18 Flush", qty: 40, unitPrice: 65.0,   total: 2600.0 },
    { index: 38, description: "Telemecanique Safety Emergency Pull-Wire Switch", qty: 10, unitPrice: 320.0,  total: 3200.0 },
    { index: 39, description: "Pilz PNOZ Multi-Channel Safety Controller", qty: 6,  unitPrice: 880.0,  total: 5280.0 },
    { index: 40, description: "Werma Industrial LED Signal Beacon Tower 24V", qty: 8,  unitPrice: 280.0,  total: 2240.0 },
    { index: 41, description: "Pepperl+Fuchs High-Precision Ultrasonic Sensor", qty: 8,  unitPrice: 420.0,  total: 3360.0 },
    { index: 42, description: "Wago Remote IO EtherCAT Bus Coupler Head", qty: 6,  unitPrice: 580.0,  total: 3480.0 },
    { index: 43, description: "Phoenix Contact Surge Protection Device DIN-Rail", qty: 14, unitPrice: 190.0,  total: 2660.0 },
    { index: 44, description: "Weidmuller Industrial Power Supply 24V 40A", qty: 6,  unitPrice: 620.0,  total: 3720.0 },
  ];

  const docA_p3_items: TableRow[] = [
    { index: 45, description: "Troax Modular Machine Safety Perimeter Guard 50m", qty: 1,  unitPrice: 14500.0, total: 14500.0 },
    { index: 46, description: "Interlocked Safety Access Gate with RFID Lock", qty: 4,  unitPrice: 1750.0,  total: 7000.0 },
    { index: 47, description: "Safety Optical Light Curtain Resolution 14mm", qty: 4,  unitPrice: 2300.0,  total: 9200.0 },
    { index: 48, description: "Anti-Collision Rubber Bumper Strip Profile 10m", qty: 6,  unitPrice: 650.0,   total: 3900.0 },
    { index: 49, description: "Heavy-Duty Steel Impact Protection Bollard 1m", qty: 20, unitPrice: 180.0,   total: 3600.0 },
    { index: 50, description: "Flexible Energy Chain Cable Carrier Track 15m", qty: 8,  unitPrice: 450.0,   total: 3600.0 },
    { index: 51, description: "Stainless Steel Floor Cable Tray Channel 30m", qty: 1,  unitPrice: 6800.0,  total: 6800.0 },
    { index: 52, description: "Automated AMR Fleet Battery Swap Station 48V", qty: 2,  unitPrice: 18500.0, total: 37000.0 },
    { index: 53, description: "Warehouse Floor Magnetic Navigation Tape 500m", qty: 4,  unitPrice: 850.0,   total: 3400.0 },
    { index: 54, description: "Master Electrical Power Distribution Cabinet", qty: 2,  unitPrice: 9200.0,  total: 18400.0 },
    { index: 55, description: "Floor Anchor Studs and Leveling Shim Plates Lot", qty: 1,  unitPrice: 2400.0,  total: 2400.0 },
    { index: 56, description: "Mechanical and Electrical Turnkey Installation", qty: 1,  unitPrice: 32000.0, total: 32000.0 },
    { index: 57, description: "On-Site Kinematic Calibration and Testing Service", qty: 1,  unitPrice: 18500.0, total: 18500.0 },
    { index: 58, description: "Warehouse Control System WCS Software License", qty: 1,  unitPrice: 24000.0, total: 24000.0 },
    { index: 59, description: "Operator Safety and System Maintenance Training", qty: 1,  unitPrice: 7500.0,  total: 7500.0 },
    { index: 60, description: "24/7 Priority Emergency Maintenance SLA (1 Year)", qty: 1,  unitPrice: 16000.0, total: 16000.0 },
  ];

  // Calculate Document A Totals
  const sumA_p1 = docA_p1_items.reduce((s, it) => s + it.total, 0);
  const sumA_p2 = docA_p2_items.reduce((s, it) => s + it.total, 0);
  const sumA_p3 = docA_p3_items.reduce((s, it) => s + it.total, 0);
  const grandTotalA = sumA_p1 + sumA_p2 + sumA_p3;

  const docAPages: PageConfig[] = [
    {
      pageIndex: 1,
      totalPages: 3,
      headerSectionTitle: "SECTION 1: AUTONOMOUS MOBILE ROBOTS, CONVEYORS & SORTATION HARDWARE",
      items: docA_p1_items,
    },
    {
      pageIndex: 2,
      totalPages: 3,
      headerSectionTitle: "SECTION 2: INDUSTRIAL VISION, SENSORS, NETWORKING & COMPUTING",
      items: docA_p2_items,
    },
    {
      pageIndex: 3,
      totalPages: 3,
      headerSectionTitle: "SECTION 3: MACHINE SAFETY, PHYSICAL GUARDS, INSTALLATION & MAINTENANCE SLA",
      items: docA_p3_items,
      showGrandTotal: true,
      subtotalAmount: grandTotalA,
      grandTotalAmount: grandTotalA,
      footerNote: "COMMERCIAL TERMS: Net 30 payment schedule. Deliverables backed by 24-month OEM warranty.",
    },
  ];

  const docAPdf = await createDenseProposalPdf(
    {
      company: "NEXUS INDUSTRIAL ROBOTICS CORP.",
      title: "COMMERCIAL PROPOSAL / OFFER #NIR-2026-990",
      client: "Global Fulfilment Logistics GmbH",
      currency: "USD ($)",
      issueDate: "November 01, 2026",
      validity: "30 Calendar Days",
      deliveryDate: "December 15, 2026",
      project: "Autonomous Sorting & AGV Warehouse Overhaul",
    },
    docAPages
  );

  const docAPath = path.join(outDir, "offer_dense_3page_docA.pdf");
  fs.writeFileSync(docAPath, docAPdf);
  console.log(`[OK] Saved Document A: ${docAPath} (${docAPdf.length} bytes, 60 items across 3 full pages)`);

  // =========================================================================
  // DOCUMENT B: 59 ITEMS (DENSELY PACKED) WITH INTENTIONAL COMMERCIAL ALTERATIONS + 2 MATH ERRORS
  // =========================================================================
  // Page 1: 22 items
  // Alterations on Page 1:
  // - Item 2 (AGV-500): Qty increased from 8 to 10 ($89,600 -> $112,000) (SOUND MATH)
  // - Item 9 (KUKA Arm): Renamed to "KR-210 (Cybertech Edition)" & Price increased from $18,200 to $19,500 ($36,400 -> $39,000) (SOUND MATH)
  const docB_p1_items: TableRow[] = [
    { index: 1,  description: "Autonomous Mobile Robot AMR-1000 Heavy Chassis", qty: 4,  unitPrice: 14500.0, total: 58000.0 },
    { index: 2,  description: "High-Speed Autonomous Towing AGV-500", qty: 10, unitPrice: 11200.0, total: 112000.0 }, // Qty 8 -> 10 (+ $22,400)
    { index: 3,  description: "Automated Hydraulic Pallet Jack 2.5 Ton", qty: 4,  unitPrice: 3800.0,  total: 15200.0 },
    { index: 4,  description: "Inductive Floor Magnetic Charging Dock 48V", qty: 6,  unitPrice: 2400.0,  total: 14400.0 },
    { index: 5,  description: "Motorized Powered Roller Conveyor Section 3m", qty: 12, unitPrice: 1650.0,  total: 19800.0 },
    { index: 6,  description: "Belt Conveyor Variable Frequency Drive 5.5kW", qty: 4,  unitPrice: 2900.0,  total: 11600.0 },
    { index: 7,  description: "Right-Angle Pop-Up Roller Diverter Unit", qty: 6,  unitPrice: 3400.0,  total: 20400.0 },
    { index: 8,  description: "Gravity Spiral Incline Chute Assembly 4m", qty: 2,  unitPrice: 6200.0,  total: 12400.0 },
    { index: 9,  description: "KUKA 6-Axis High-Speed Industrial Arm KR-210 (Cybertech Edition)", qty: 2, unitPrice: 19500.0, total: 39000.0 }, // Renamed & Price $18,200 -> $19,500 (+ $2,600)
    { index: 10, description: "Fanuc M-20iD High-Payload Handling Robot", qty: 2,  unitPrice: 21000.0, total: 42000.0 },
    { index: 11, description: "Heavy-Duty Floor Pedestal Robot Mount 1.2m", qty: 4,  unitPrice: 1150.0,  total: 4600.0 },
    { index: 12, description: "Pneumatic Dual-Zone Vacuum Gripper Assembly", qty: 6,  unitPrice: 1850.0,  total: 11100.0 },
    { index: 13, description: "Magnetic Sheet Metal Destacking Gripper Tool", qty: 2,  unitPrice: 2100.0,  total: 4200.0 },
    { index: 14, description: "Bionic Soft-Touch Compliant Gripper Finger Unit", qty: 4,  unitPrice: 1400.0,  total: 5600.0 },
    { index: 15, description: "Festo High-Speed Valve Manifold System 24V", qty: 8,  unitPrice: 850.0,   total: 6800.0 },
    { index: 16, description: "Compressed Air Refrigerated Dryer 500L min", qty: 1,  unitPrice: 5800.0,  total: 5800.0 },
    { index: 17, description: "Automated Case Forming Carton Erector Unit", qty: 2,  unitPrice: 9400.0,  total: 18800.0 },
    { index: 18, description: "High-Speed Top and Bottom Carton Tape Sealer", qty: 2,  unitPrice: 4500.0,  total: 9000.0 },
    { index: 19, description: "Automatic Pallet Stretch Wrapper Turntable", qty: 2,  unitPrice: 7800.0,  total: 15600.0 },
    { index: 20, description: "Pneumatic Carton Pusher Sorter Mechanism", qty: 8,  unitPrice: 1250.0,  total: 10000.0 },
    { index: 21, description: "Industrial In-Line Checkweigher Scale 60kg", qty: 3,  unitPrice: 4900.0,  total: 14700.0 },
    { index: 22, description: "Dynamic Overhead Parcel Dimensioner Scanner", qty: 2,  unitPrice: 6800.0,  total: 13600.0 },
  ];

  // Page 2: 21 items (Item 28 Siemens Edge Server OMITTED completely, Item 31 has INTENTIONAL MATH ERROR)
  const docB_p2_items: TableRow[] = [
    { index: 23, description: "Cognex In-Sight 3D Industrial Vision Scanner", qty: 6,  unitPrice: 5200.0, total: 31200.0 },
    { index: 24, description: "Keyence SR-2000 Ultra-Wide Barcode Reader", qty: 12, unitPrice: 1450.0, total: 17400.0 },
    { index: 25, description: "SICK MicroScan3 Core Safety Laser Scanner", qty: 8,  unitPrice: 1800.0, total: 14400.0 },
    { index: 26, description: "OMRON Laser Time-of-Flight Ranging Sensor", qty: 16, unitPrice: 450.0,  total: 7200.0 },
    { index: 27, description: "Basler High-Resolution Area Scan Camera 12MP", qty: 6,  unitPrice: 1950.0, total: 11700.0 },
    // Item 28: Siemens Edge Server ($26,000.00) OMITTED from revision! (Scope Reduction)
    { index: 28, description: "Advantech Rugged Fanless Controller UNO-2484G", qty: 6,  unitPrice: 2200.0, total: 13200.0 },
    { index: 29, description: "Cisco Catalyst Industrial Ethernet Switch IE-3400", qty: 6,  unitPrice: 2100.0, total: 12600.0 },
    // INTENTIONAL MATH ERROR #1:
    // 8 * 950.00 = 7,600.00, but stated as 6,100.00! (Understated by $1,500.00)
    { index: 30, description: "Moxa Industrial Wireless Access Point AWK-3131A", qty: 8,  unitPrice: 950.0,  total: 6100.0 },
    { index: 31, description: "Hirschmann Multi-Mode SFP Fiber Transceiver", qty: 16, unitPrice: 220.0,  total: 3520.0 },
    { index: 32, description: "APC Smart-UPS RT 5000VA Online 230V Rack", qty: 4,  unitPrice: 3400.0, total: 13600.0 },
    { index: 33, description: "Rittal TS8 Industrial Sealed Server Enclosure 42U", qty: 2,  unitPrice: 2800.0, total: 5600.0 },
    { index: 34, description: "Belden Industrial Cat6A Shielded Cable 100m", qty: 10, unitPrice: 240.0,  total: 2400.0 },
    { index: 35, description: "Murrelektronik Distributed Fieldbus IO Block", qty: 12, unitPrice: 650.0,  total: 7800.0 },
    { index: 36, description: "Turck Inductive Proximity Sensor M18 Flush", qty: 40, unitPrice: 65.0,   total: 2600.0 },
    { index: 37, description: "Telemecanique Safety Emergency Pull-Wire Switch", qty: 10, unitPrice: 320.0,  total: 3200.0 },
    { index: 38, description: "Pilz PNOZ Multi-Channel Safety Controller", qty: 6,  unitPrice: 880.0,  total: 5280.0 },
    { index: 39, description: "Werma Industrial LED Signal Beacon Tower 24V", qty: 8,  unitPrice: 280.0,  total: 2240.0 },
    { index: 40, description: "Pepperl+Fuchs High-Precision Ultrasonic Sensor", qty: 8,  unitPrice: 420.0,  total: 3360.0 },
    { index: 41, description: "Wago Remote IO EtherCAT Bus Coupler Head", qty: 6,  unitPrice: 580.0,  total: 3480.0 },
    { index: 42, description: "Phoenix Contact Surge Protection Device DIN-Rail", qty: 14, unitPrice: 190.0,  total: 2660.0 },
    { index: 43, description: "Weidmuller Industrial Power Supply 24V 40A", qty: 6,  unitPrice: 620.0,  total: 3720.0 },
  ];

  // Page 3: 16 items (Item 60 has INTENTIONAL MATH ERROR #2)
  const docB_p3_items: TableRow[] = [
    { index: 44, description: "Troax Modular Machine Safety Perimeter Guard 50m", qty: 1,  unitPrice: 14500.0, total: 14500.0 },
    { index: 45, description: "Interlocked Safety Access Gate with RFID Lock", qty: 4,  unitPrice: 1750.0,  total: 7000.0 },
    { index: 46, description: "Safety Optical Light Curtain Resolution 14mm", qty: 4,  unitPrice: 2300.0,  total: 9200.0 },
    { index: 47, description: "Anti-Collision Rubber Bumper Strip Profile 10m", qty: 6,  unitPrice: 650.0,   total: 3900.0 },
    { index: 48, description: "Heavy-Duty Steel Impact Protection Bollard 1m", qty: 20, unitPrice: 180.0,   total: 3600.0 },
    { index: 49, description: "Flexible Energy Chain Cable Carrier Track 15m", qty: 8,  unitPrice: 450.0,   total: 3600.0 },
    { index: 50, description: "Stainless Steel Floor Cable Tray Channel 30m", qty: 1,  unitPrice: 6800.0,  total: 6800.0 },
    { index: 51, description: "Automated AMR Fleet Battery Swap Station 48V", qty: 2,  unitPrice: 18500.0, total: 37000.0 },
    { index: 52, description: "Warehouse Floor Magnetic Navigation Tape 500m", qty: 4,  unitPrice: 850.0,   total: 3400.0 },
    { index: 53, description: "Master Electrical Power Distribution Cabinet", qty: 2,  unitPrice: 9200.0,  total: 18400.0 },
    { index: 54, description: "Floor Anchor Studs and Leveling Shim Plates Lot", qty: 1,  unitPrice: 2400.0,  total: 2400.0 },
    { index: 55, description: "Mechanical and Electrical Turnkey Installation", qty: 1,  unitPrice: 32000.0, total: 32000.0 },
    { index: 56, description: "On-Site Kinematic Calibration and Testing Service", qty: 1,  unitPrice: 18500.0, total: 18500.0 },
    { index: 57, description: "Warehouse Control System WCS Software License", qty: 1,  unitPrice: 24000.0, total: 24000.0 },
    { index: 58, description: "Operator Safety and System Maintenance Training", qty: 1,  unitPrice: 7500.0,  total: 7500.0 },
    // INTENTIONAL MATH ERROR #2:
    // 1 * 16,000.00 = 16,000.00, but stated as 13,500.00! (Understated by $2,500.00)
    { index: 59, description: "24/7 Priority Emergency Maintenance SLA (1 Year)", qty: 1,  unitPrice: 16000.0, total: 13500.0 },
  ];

  // Calculate Document B Totals
  const sumB_p1 = docB_p1_items.reduce((s, it) => s + it.total, 0);
  const sumB_p2 = docB_p2_items.reduce((s, it) => s + it.total, 0);
  const sumB_p3 = docB_p3_items.reduce((s, it) => s + it.total, 0);
  // Stated grand total equals the sum of stated lines:
  const statedGrandTotalB = sumB_p1 + sumB_p2 + sumB_p3;

  const docBPages: PageConfig[] = [
    {
      pageIndex: 1,
      totalPages: 3,
      headerSectionTitle: "SECTION 1: AUTONOMOUS MOBILE ROBOTS, CONVEYORS & SORTATION HARDWARE",
      items: docB_p1_items,
    },
    {
      pageIndex: 2,
      totalPages: 3,
      headerSectionTitle: "SECTION 2: INDUSTRIAL VISION, SENSORS, NETWORKING & COMPUTING",
      items: docB_p2_items,
    },
    {
      pageIndex: 3,
      totalPages: 3,
      headerSectionTitle: "SECTION 3: MACHINE SAFETY, PHYSICAL GUARDS, INSTALLATION & MAINTENANCE SLA",
      items: docB_p3_items,
      showGrandTotal: true,
      subtotalAmount: statedGrandTotalB,
      grandTotalAmount: statedGrandTotalB,
      footerNote: "REVISED CONDITIONS: Revision 1 supersedes quotation #NIR-2026-990. Terms subject to revised deployment schedule.",
    },
  ];

  const docBPdf = await createDenseProposalPdf(
    {
      company: "NEXUS INDUSTRIAL ROBOTICS CORP.",
      title: "REVISED COMMERCIAL PROPOSAL / OFFER #NIR-2026-990-REV1",
      client: "Global Fulfilment Logistics GmbH",
      currency: "USD ($)",
      issueDate: "November 12, 2026",
      validity: "30 Calendar Days",
      deliveryDate: "January 25, 2027", // Postponed from December 15, 2026
      project: "Autonomous Sorting & AGV Warehouse Overhaul (Revision 1)",
    },
    docBPages
  );

  const docBPath = path.join(outDir, "offer_dense_3page_docB.pdf");
  fs.writeFileSync(docBPath, docBPdf);
  console.log(`[OK] Saved Document B: ${docBPath} (${docBPdf.length} bytes, 59 items across 3 full pages)`);

  console.log("\nDensely Packed Proposals Generated Successfully!");
  console.log(`  Doc A: ${docAPath}`);
  console.log(`  Doc B: ${docBPath}`);
}

main().catch((e) => {
  console.error("Failed to generate dense proposals:", e);
  process.exit(1);
});
