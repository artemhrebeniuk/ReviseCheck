export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SourceLocation = {
  page: number;
  lineNumber: number;
  textSnippet: string;
  bbox: BoundingBox;
};

export type CanonicalLineItem = {
  id: string;
  rowIndex: number;
  name: string;
  normalizedName: string;
  sku?: string;
  qty: number;
  unitPrice: number;
  statedTotal: number;
  calculatedTotal: number;
  hasArithmeticError: boolean;
  arithmeticDiscrepancy?: number;
  deliveryDate?: string;
  rawText: string;
  location: SourceLocation;
};

export type DiffType =
  | "SCOPE_ADDED"
  | "SCOPE_REMOVED"
  | "RENAMED_ITEM"
  | "REORDERED"
  | "QTY_CHANGE"
  | "PRICE_CHANGE"
  | "DATE_CHANGE"
  | "ARITHMETIC_ERROR"
  | "FORMATTING_ONLY";

export type DiffSeverity = "CRITICAL" | "WARNING" | "INFO";

export type DiffCategory =
  "SCOPE" | "PRICING" | "SCHEDULE" | "AUDIT_RISK" | "FORMATTING";

export type CommercialDiff = {
  id: string;
  type: DiffType;
  severity: DiffSeverity;
  category: DiffCategory;
  title: string;
  description: string;
  originalValue?: string | number;
  revisedValue?: string | number;
  delta?: string | number;
  confidence: number;
  isConfirmed: boolean;
  isSubstantive: boolean;
  originalLocation?: SourceLocation;
  revisedLocation?: SourceLocation;
};

export type AuditVerdict = "APPROVE" | "REJECT" | "NEEDS_CLARIFICATION";

export type ExtractedDocument = {
  title: string;
  currency: string;
  date?: string;
  deliveryDate?: string;
  items: CanonicalLineItem[];
  statedGrandTotal?: number;
  calculatedGrandTotal: number;
  hasGrandTotalDiscrepancy: boolean;
  grandTotalDiscrepancy?: number;
  rawLines: Array<{
    page: number;
    lineNumber: number;
    text: string;
    bbox: BoundingBox;
  }>;
  totalPages: number;
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  taxInclusive?: boolean;
  shippingAmount?: number;
  deliveryTerms?: string;
  validityDays?: number;
};

export type TelemetryData = {
  latencyMs: number;
  costUSD: number;
  tokensUsed: number;
  method: "deterministic" | "hybrid-ai" | "offline-heuristic";
  sourceReferencesValidCount: number;
};

export type AuditReport = {
  verdict: AuditVerdict;
  verdictTitle: string;
  summary: string;
  keyRisks: string[];
  netFinancialDelta: number;
  statedOriginalTotal: number;
  statedRevisedTotal: number;
  calculatedOriginalTotal: number;
  calculatedRevisedTotal: number;
  hasArithmeticErrors: boolean;
  arithmeticErrorsCount: number;
  substantiveChangesCount: number;
  formattingChangesCount: number;
  uncertainMatchesCount: number;
  diffs: CommercialDiff[];
  telemetry: TelemetryData;
  clarificationQuestions?: string[];
  doc1Currency?: string;
  doc2Currency?: string;
  doc1Summary?: {
    title: string;
    totalItems: number;
    date?: string;
    deliveryDate?: string;
  };
  doc2Summary?: {
    title: string;
    totalItems: number;
    date?: string;
    deliveryDate?: string;
  };
};
