// Shared shapes for the vendor master one-way sync pack.
// Field names follow the pack's Data model. Session state (runs, delta, tasks, decisions)
// lives in the store and is dropped by resetStore().

export type VendorStatus = "active" | "inactive";
export type SyncMode = "assisted" | "automatic";
export type AvidSource = "seed" | "synced";
export type DeltaAction = "create" | "stage" | "hold" | "skip_inactive" | "skip_exact";
export type Decision = "none" | "link" | "create" | "later";
export type InvoiceFlag = "known" | "first_seen" | "yardi_only" | "near_match";

/** Reasons shown on screen for a near match. Use these exact strings, nothing else. */
export const MATCH_REASONS = {
  sameNormalizedName: "same normalized name",
  similarName: "similar name",
  sameAddress: "same address",
  differentAddress: "different address",
  suffixDifference: "suffix difference",
  sameTaxLast4: "same tax id last four",
  differentTaxLast4: "different tax id last four",
} as const;
export type MatchReason = (typeof MATCH_REASONS)[keyof typeof MATCH_REASONS];

/** Plain labels for each invoice flag, shown next to the raw flag value. */
export const FLAG_LABELS: Record<InvoiceFlag, string> = {
  known: "known",
  first_seen: "first-seen",
  yardi_only: "in Yardi only, syncs tonight",
  near_match: "near match",
};

/** Plain labels for each delta action, shown next to the raw action value. */
export const ACTION_LABELS: Record<DeltaAction, string> = {
  create: "created in Avid",
  stage: "staged for import",
  hold: "held for a decision",
  skip_inactive: "skipped, inactive",
  skip_exact: "skipped, already in Avid",
};

/** The fixed line at the bottom of Sync run. Never reworded. */
export const SCOPE_LINE = "This sync moves vendor names one way. Coding and reclasses are out of scope.";

// Records from the pack's Data model.

export interface YardiVendor {
  yardi_vendor_id: string; // V-Y-0117 shape
  name: string;
  address_line: string;
  status: VendorStatus;
  created_at: string; // YYYY-MM-DD
  tax_id_last4: string; // four digits, fake, demo-only, used only as a match reason
}

export interface AvidVendor {
  avid_vendor_id: string; // V-A-0088 shape
  name: string;
  address_line: string;
  created_at: string; // YYYY-MM-DD
  source: AvidSource;
  /** Demo-only extension so the Tidewater pair can show a tax digit reason. Null when unknown. */
  tax_id_last4: string | null;
}

export interface SyncRunCounts {
  compared: number;
  skipped_exact: number;
  staged_or_created: number;
  held: number;
  skipped_inactive: number;
}

export interface SyncRun {
  run_id: string; // R-001, R-002, ...
  run_at: string; // demo clock, never the wall clock
  mode: SyncMode;
  counts: SyncRunCounts;
}

export interface DeltaItem {
  run_id: string;
  yardi_vendor_id: string;
  action: DeltaAction;
  reason: string;
  avid_vendor_id: string | null; // set when created or linked
}

export interface MatchCandidate {
  yardi_vendor_id: string;
  avid_vendor_id: string;
  score: number; // token overlap, 0 to 1, two decimals
  reasons: MatchReason[];
  decision: Decision;
}

export interface ImportRow {
  run_id: string;
  name: string;
  address_line: string;
}

export interface Task {
  task_id: string; // T-001 shape
  run_id: string;
  text: string;
  done: boolean;
}

export interface IncomingInvoice {
  invoice_id: string; // INV-5004 shape
  payee_name: string;
  amount: number; // dollars with two decimals, display only, no arithmetic
  received_at: string; // YYYY-MM-DD
  matched_yardi_vendor_id: string | null;
  matched_avid_vendor_id: string | null;
  flag: InvoiceFlag;
  days_in_queue: number;
}

// Seed and store.

export interface Seed {
  /** The demo's today. Front door days_in_queue and the nightly run clock hang off it. */
  demo_date: string; // 2026-09-01
  /** Next numbers for ids minted at run time: V-Y-0125 and V-A-0113 come first. */
  next_yardi_number: number;
  next_avid_number: number;
  yardi_vendors: YardiVendor[];
  avid_vendors: AvidVendor[];
  /** The near matches present at boot, computed with lib/normalize.ts, decision "none". */
  match_candidates: MatchCandidate[];
  /** The day's arrivals. Flags here are the expected outcome; the receive route recomputes them. */
  incoming_invoices: IncomingInvoice[];
}

export interface Store extends Seed {
  mode: SyncMode;
  sync_runs: SyncRun[];
  delta_items: DeltaItem[];
  import_rows: ImportRow[];
  tasks: Task[];
  /** True once "Receive invoices" has been pressed this session. */
  invoices_received: boolean;
  /** Counters for ids minted at run time: R-001 and T-001 come first. Reset with the store. */
  next_run_number: number;
  next_task_number: number;
}

// Route payloads the ui fetches.

export interface StatePayload {
  mode: SyncMode;
  demo_date: string;
  yardi_count: number;
  yardi_active_count: number;
  avid_count: number;
  /** Active Yardi vendors the sync would create in Avid right now (no exact match, not held). */
  gap: number;
  /** Near-match pairs still waiting for a decision. */
  held: number;
  last_run_id: string | null;
}

export interface MastersPayload extends StatePayload {
  yardi: YardiVendor[];
  avid: AvidVendor[];
}

export interface CreateVendorBody {
  name: string;
  address_line: string;
  status: VendorStatus;
}

export interface CreateVendorPayload extends MastersPayload {
  created: YardiVendor;
}

export interface ModeBody {
  mode: SyncMode;
}

/** A delta item joined to its vendor for display. */
export interface DeltaRow extends DeltaItem {
  name: string;
  address_line: string;
  status: VendorStatus;
  avid_name: string | null;
}

export interface RunPayload {
  mode: SyncMode;
  run: SyncRun | null; // the latest run, or null before the first
  delta: DeltaRow[];
  tasks: Task[];
  import_row_count: number;
  import_file_name: string | null;
  scope_line: string;
}

export interface TaskDoneBody {
  task_id: string;
  done: boolean;
}

export interface PairView {
  candidate: MatchCandidate;
  yardi: YardiVendor;
  avid: AvidVendor;
  yardi_normalized: string;
  avid_normalized: string;
}

export interface NearMatchesPayload {
  mode: SyncMode;
  held: PairView[]; // decision none or later
  decided: PairView[]; // decision link or create
}

export interface DecideBody {
  yardi_vendor_id: string;
  avid_vendor_id: string;
  decision: "link" | "create" | "later";
}

export interface InvoiceRow extends IncomingInvoice {
  matched_yardi_name: string | null;
  matched_avid_name: string | null;
  flag_label: string;
}

export interface FrontDoorPayload {
  demo_date: string;
  received: boolean;
  invoices: InvoiceRow[];
}
