// Types for the invoice description writer module.
// Field names follow the pack's Data model. Nothing here is a client-facing string.

// ---------- Enumerations ----------

export type ServiceType = "single" | "multi";
export type InvoiceType = "service" | "utility";
export type ExtractionStatus = "read" | "failed";
export type InvoiceStatus = "ready" | "manual" | "routed" | "used" | "corrected";
export type SuggestionTier = "strong" | "weak" | "none";
export type FeedbackOutcome = "used" | "corrected";
export type TemplateId = "service" | "utility";
export type ExtractionSource = "canned" | "live" | "unavailable";

/** The 12 fictional GL codes fixed by the recorded decision (markers.json allow-lists them). */
export const GL_CODES = ["6110", "6120", "6310", "6320", "6420", "6510", "6520", "7010", "7110", "7210", "7310", "7410"] as const;
export type GlCode = (typeof GL_CODES)[number];

/** Description field length limit from the recorded decision; the service segment is truncated first. */
export const DESCRIPTION_MAX_LENGTH = 250;

/** Suggestion tier thresholds from the recorded decision. Share math is integer: count * 100 >= STRONG_SHARE_PERCENT * total. */
export const STRONG_MIN_COUNT = 5;
export const STRONG_SHARE_PERCENT = 70;

// ---------- Seed records (packs/invoice-description-writer/seed/seed.json) ----------

export interface Vendor {
  vendor_id: string; // V-01 shape, V-01 to V-14
  name: string;
  service_type: ServiceType;
  default_gl: string | null; // one of GL_CODES or null
}

export interface Invoice {
  invoice_id: string; // INV-3007 shape
  vendor_id: string;
  property_code: string; // two letters, e.g. PR
  unit_label: string | null; // e.g. PR-12
  invoice_number: string; // the vendor's own number, e.g. CR-88213
  invoice_date: string; // YYYY-MM-DD
  amount: number; // dollars with at most two decimals; display only, no arithmetic in this pack
  due_date: string; // YYYY-MM-DD
  service_from: string | null; // YYYY-MM-DD
  service_to: string | null; // YYYY-MM-DD
  account_number: string | null; // 10 digits starting 99 (suite marker rule)
  meter_number: string | null; // M9 plus eight digits (suite marker rule)
  invoice_type: InvoiceType;
  pdf_path: string; // public URL path, /demo/invoice-description-writer/<invoice_id>.pdf
  preview_path: string; // public URL path, /demo/invoice-description-writer/<invoice_id>.svg (same document drawn as SVG for the Workbench preview)
  service_short: string | null; // two to five plain words for the work, as printed on the invoice; null when the reader cannot find it
  scripted: boolean; // true for the seven records the acceptance checks name; scripted records always serve canned extraction
  extraction_status: ExtractionStatus; // expected outcome of Receive invoices; the ingest recomputes it and the two must agree
  status: InvoiceStatus; // expected outcome of Receive invoices (ready, manual, or routed); the ingest recomputes it
}

export interface CodingHistory {
  vendor_id: string;
  gl_code: string;
  gl_name: string;
  count: number;
  last_used: string; // YYYY-MM-DD
}

export interface GlAccount {
  gl_code: string;
  gl_name: string;
}

export interface Seed {
  vendors: Vendor[];
  gl_accounts: GlAccount[];
  coding_history: CodingHistory[];
  invoices: Invoice[]; // the day's folder, 30 records, in inbox order
}

// ---------- Model step output (packs/invoice-description-writer/seed/canned/<invoice_id>.json) ----------

/** What extract_invoice returns, canned or live. null means not on the invoice. */
export interface ExtractionFields {
  vendor_name: string | null;
  property_hint: string | null;
  unit_hint: string | null;
  service_short: string | null;
  service_from: string | null;
  service_to: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: number | null;
  due_date: string | null;
  account_number: string | null;
  meter_number: string | null;
}

/** Field keys of ExtractionFields, used for the per-field read markers and the manual-entry card. */
export type ExtractionFieldKey = keyof ExtractionFields;

/** Result of running the checks on an extraction. */
export interface Extraction {
  invoice_id: string;
  source: ExtractionSource;
  fields: ExtractionFields; // all null when source is unavailable
  status: ExtractionStatus;
  /** Field keys the reader could not find (null values). Listed on the manual-entry card when status is failed. */
  missing: ExtractionFieldKey[];
  /** Plain-language reasons the checks failed (empty when status is read). */
  reasons: string[];
  /** Seed vendor the vendor_name resolved to, or null for an unseen vendor. */
  resolved_vendor_id: string | null;
}

// ---------- Derived records ----------

export interface Description {
  invoice_id: string;
  text: string;
  template_id: TemplateId;
  missing_fields: string[]; // pack field names that rendered as a stated gap, e.g. service_from, service_to, unit_label, account_number, meter_number
  truncated: boolean; // true when the 250 character limit trimmed the service segment
}

export interface SuggestionAlternative {
  gl_code: string;
  gl_name: string;
  count: number;
  last_used: string;
}

export interface GlSuggestion {
  invoice_id: string;
  gl_code: string | null;
  gl_name: string | null;
  basis_count: number;
  basis_total: number;
  tier: SuggestionTier;
  /** Other codes in the vendor's history, most used first. Listed on the GL card when the tier is weak. */
  alternatives: SuggestionAlternative[];
}

export interface Feedback {
  invoice_id: string;
  outcome: FeedbackOutcome;
  corrected_gl: string | null;
  /** 1-based order the feedback was recorded in this session. No clock, so a reset and a replay produce identical records. */
  at: number;
}

// ---------- Store (packs/invoice-description-writer/store.ts) ----------

export interface Store extends Seed {
  /** False after reset; true after Receive invoices. The Inbox is empty until it is true. */
  received: boolean;
  extractions: Record<string, Extraction>; // by invoice_id, filled by Receive invoices
  descriptions: Record<string, Description>; // by invoice_id, only for ready, used, and corrected invoices
  suggestions: Record<string, GlSuggestion>; // by invoice_id, only for ready, used, and corrected invoices
  feedback: Feedback[]; // cleared on reset
}

// ---------- Route payloads (app/api/industrial-ap/invoice-description-writer/*) ----------

export interface InboxSummary {
  received: number;
  ready: number;
  manual: number;
  routed: number;
}

export interface InboxItem {
  invoice_id: string;
  vendor_id: string | null; // resolved vendor, null when unseen or not read
  vendor_name: string | null; // as read from the invoice; null when not read
  property_code: string | null; // as read; null when not read
  invoice_number: string | null; // as read; null when not read
  amount: number | null; // as read; null when not read
  status: InvoiceStatus;
  /** Exactly "utility, handled by the capture pipeline" for routed rows, null otherwise. */
  note: string | null;
}

/** GET inbox and POST receive both return this. */
export interface InboxPayload {
  received: boolean;
  summary: InboxSummary;
  items: InboxItem[];
}

export interface FieldReading {
  key: ExtractionFieldKey;
  label: string; // plain label, e.g. "Vendor", "Service dates"
  value: string | null; // display value, null when not on the invoice
  read: boolean; // true renders "read from PDF", false renders "not on invoice"
}

/** GET workbench?id=<invoice_id> and POST feedback both return this. */
export interface WorkbenchPayload {
  invoice: {
    invoice_id: string;
    invoice_type: InvoiceType;
    status: InvoiceStatus;
    pdf_path: string;
    preview_path: string;
  };
  vendor: { vendor_id: string; name: string } | null; // resolved vendor; null when unseen or not read
  vendor_name_as_read: string | null;
  extraction: Extraction | null; // null for routed invoices (nothing is read for them)
  fields: FieldReading[]; // one per ExtractionFields key, in a fixed display order; empty for routed invoices
  description: Description | null; // null for manual and routed invoices
  template: string | null; // the template line to show faintly beneath the description; null when description is null
  suggestion: GlSuggestion | null; // null for manual and routed invoices
  /** Plain labels of the fields the reader could not find; non-empty only for manual invoices. */
  manual_entry: string[];
  /** Exactly "utility, handled by the capture pipeline" for routed invoices, null otherwise. */
  routed_note: string | null;
  feedback: Feedback | null; // the latest feedback recorded for this invoice this session
  gl_accounts: GlAccount[]; // for the correction picker
  prev_id: string | null; // previous invoice in inbox order
  next_id: string | null; // next invoice in inbox order
  position: number; // 1-based position in the inbox
  total: number; // inbox length
}

export interface FeedbackRequest {
  invoice_id: string;
  outcome: FeedbackOutcome;
  corrected_gl?: string; // required when outcome is corrected; must be one of GL_CODES
}

export interface VendorHistoryRow {
  gl_code: string;
  gl_name: string;
  count: number;
  last_used: string;
}

export interface SessionLine {
  invoice_id: string;
  outcome: FeedbackOutcome;
  gl_code: string; // the code used as is, or the corrected code
  gl_name: string;
  /** Plain sentence for the "recorded this session" line, e.g. "Recorded this session: INV-3030 corrected to 6520 Plumbing capital." */
  text: string;
}

/** GET vendors returns { vendors: VendorSummary[] } for the picker. */
export interface VendorSummary {
  vendor_id: string;
  name: string;
  service_type: ServiceType;
  default_gl: string | null;
  history_rows: number;
}

/** GET vendor-history?vendor_id=<id> */
export interface VendorHistoryPayload {
  vendor: Vendor;
  rows: VendorHistoryRow[]; // most used first
  total: number; // sum of counts
  session: SessionLine[]; // feedback recorded this session for this vendor, in order
}

export interface SchemeTemplate {
  template_id: TemplateId;
  label: string; // "Service vendor" or "Utility"
  template: string; // the template line with placeholders
  segments: { placeholder: string; when_missing: string | null }[]; // what each placeholder renders when absent
  example: { invoice_id: string; text: string }; // rendered from a seed record with the pure template function
}

/** GET scheme */
export interface SchemePayload {
  max_length: number;
  templates: SchemeTemplate[];
}

// ---------- Extensions by the logic-builder (appended; nothing above is renamed) ----------

/** Every ExtractionFields key in declaration order; missing lists and the empty reading use it. */
export const EXTRACTION_FIELD_KEYS: ExtractionFieldKey[] = [
  "vendor_name",
  "property_hint",
  "unit_hint",
  "service_short",
  "service_from",
  "service_to",
  "invoice_number",
  "invoice_date",
  "amount",
  "due_date",
  "account_number",
  "meter_number",
];
