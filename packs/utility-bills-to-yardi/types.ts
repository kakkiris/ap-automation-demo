export type ServiceType = "electric" | "water";
export type MeterKind = "unit" | "house" | "shared";
export type Holder = "landlord" | "tenant";
export type Occupancy = "occupied" | "vacant";
export type WhoPays = "owner" | "tenant";
export type PayerSource = "seller_workbook" | "verified" | "system";
export type BillStatus = "unarrived" | "arrived" | "matched" | "surfaced" | "unmapped" | "blocked" | "exported";
export type ArrivalRoute = "emailed" | "downloaded";
export type DeliveryRoute = "emails" | "download";
export type BillingStatus = "current" | "behind";

export interface Property {
  id: string;
  code: string;
  name: string;
  street: string;
  city: string;
  unit_count: number;
  acquisition_date: string;
  water_provider: string;
  bank_gl: string;
  recently_acquired: boolean;
}

export interface Unit {
  id: string;
  property_id: string;
  label: string;
  address: string;
  square_feet: number;
  tenant: string | null;
  move_in: string | null;
  move_out: string | null;
  previous_move_out: string | null;
  occupancy: Record<string, Occupancy>;
  tenant_history: Record<string, string | null>;
  who_pays: WhoPays;
  payer_source: PayerSource;
}

export interface Meter {
  id: string;
  property_id: string;
  service_type: ServiceType;
  kind: MeterKind;
  unit_id: string | null;
  units_served: string[];
  provider: string;
  location_note: string | null;
  meter_number: string | null;
  notes: string[];
}

export interface Account {
  account_number: string;
  provider: string;
  meter_id: string;
  holder: Holder;
  holder_name: string | null;
  active_from: string;
  active_to: string | null;
}

export interface BillFields {
  provider: string;
  account_number: string;
  service_address: string;
  service_start: string;
  service_end: string;
  amount: number;
  meter_as_printed: string | null;
}

export interface Bill extends BillFields {
  id: string;
  arrival_month: string;
  arrival_route: ArrivalRoute;
  status: BillStatus;
  property_id: string;
  meter_id: string | null;
  description: string | null;
  invoice_number: string | null;
  exception_id: string | null;
  duplicate_of: string | null;
}

export type GlName =
  | "Electricity non-recoverable"
  | "Electricity recoverable"
  | "Water recoverable"
  | "Sewer recoverable"
  | "Stormwater"
  | "Garbage recoverable"
  | "Utility deposits"
  | "Tenant charges";

export interface LedgerLine {
  id: string;
  payee_code: string;
  payee_name: string;
  description: string;
  control_number: string;
  property_code: string;
  property_id: string;
  invoice_date: string;
  payment_method: string;
  post_month: string;
  gl_code: string;
  gl_name: GlName;
  invoice_number: string;
  amount: number;
  due_date: string;
  unpaid_amount: number;
  payment_number: string;
  payment_date: string;
  confirmed_account: string | null;
}

export type MatchKind = "exact" | "partial" | "needs_confirmation" | "confirmed" | "unplaced";

export interface LineMatch {
  line: LedgerLine;
  kind: MatchKind;
  account_number: string | null;
  candidates: string[];
}

export interface Provider {
  name: string;
  service_type: ServiceType;
  delivery_route: DeliveryRoute;
  billing_status: BillingStatus;
  vendor_code: string;
  phone_label: string;
}

export type ExceptionType = "unmapped" | "meter_differs" | "duplicate" | "unusual_amount" | "ambiguous_import";

export interface Exception {
  id: string;
  type: ExceptionType;
  month: string;
  bill_id: string | null;
  meter_id: string | null;
  account_number: string | null;
  property_id: string;
  suggestion: { meter_id: string | null; reason: string } | null;
  details: Record<string, string | number | null>;
  status: "open" | "resolved" | "skipped";
  resolution: string | null;
}

export interface RunReport {
  month: string;
  received: { emailed: number; downloaded: number };
  fields_read: number;
  matched: number;
  surfaced: number;
  unmapped: number;
  meter_differs: number;
  duplicates: number;
  unusual: number;
  upload_rows: number;
  files: { name: string; rows: number }[];
  exported: boolean;
  imported: boolean;
}

export type Mechanism = "bills" | "exceptions" | "provider_import" | "site_visit" | "yardi_import" | "confirm_matches";

export interface DemoEvent {
  id: string;
  month: string;
  mechanism: Mechanism;
  kind: "account_added" | "meter_number_filled" | "payer_verified" | "lines_created" | "account_confirmed";
  count: number;
  note: string;
}

export interface MonthCounts {
  month: string;
  unpaid: number;
  bill_back: number;
  transfer_needed: number;
  not_yet_billed: number;
  unmapped: number;
  no_account: number;
  blank_meters: number;
  matched_lines: number;
  exact_lines: number;
}

export interface BillBackRow {
  id: string;
  month: string;
  property_id: string;
  unit_id: string;
  tenant: string;
  account_number: string;
  months: number;
  amount: number;
  gl_name: "Tenant charges";
}

export interface TransferDraft {
  id: string;
  month: string;
  meter_id: string;
  unit_id: string | null;
  kind: "tenant_letter" | "provider_request";
  text: string;
  covered_from: string | null;
  transfer_by: string;
}

export interface CallNote {
  id: string;
  month: string;
  account_number: string;
  provider: string;
  note: string;
}

export interface SiteChecklist {
  property_id: string;
  month: string;
  items: { meter_id: string; unit_label: string | null; location_note: string | null; what_to_photograph: string }[];
}

export interface Discrepancy {
  id: string;
  category: "Occupancy" | "Lease From" | "Lease To" | "Tenant name" | "Missing on property tab" | "Missing in Rent Roll";
  property_id: string;
  unit_label: string;
  tracker_value: string;
  rent_roll_value: string;
}

export interface ProviderAccountRow {
  account_number: string;
  service_address: string;
  meter_number: string | null;
}

export interface SiteVisitRow {
  meter_id: string;
  meter_number: string | null;
  who_pays_found: WhoPays | null;
}

export interface Seed {
  demo_month: string;
  months: string[];
  properties: Property[];
  units: Unit[];
  meters: Meter[];
  accounts: Account[];
  bills: Bill[];
  ledger_lines: LedgerLine[];
  providers: Provider[];
  discrepancies: Discrepancy[];
  discrepancies_cleared: Record<string, boolean>;
  provider_account_list: ProviderAccountRow[];
  site_visit_results: SiteVisitRow[];
  exceptions: Exception[];
  scripted: Record<string, string>;
}

export interface Store extends Seed {
  runs: Record<string, RunReport>;
  events: DemoEvent[];
  bill_backs: BillBackRow[];
  transfer_drafts: TransferDraft[];
  call_notes: CallNote[];
  checklists: SiteChecklist[];
  verify_items: { id: string; month: string; meter_id: string; property_id: string; reason: string }[];
  done_actions: string[];
  snapshots: Record<string, MonthCounts>;
  provider_import_done: boolean;
  site_visit_done: boolean;
  operator_steps: Record<string, boolean>;
  undo: string | null;
  undo_label: string | null;
}

export type CellStatus =
  | "paid"
  | "unpaid"
  | "not_yet_billed"
  | "tenant_held"
  | "bill_back"
  | "transfer_needed"
  | "manual_split"
  | "no_account";

export interface Cell {
  meter_id: string;
  month: string;
  status: CellStatus;
  account_number: string | null;
  line_ids: string[];
  match_kind: MatchKind | null;
  amount: number | null;
  months_since_move_in: number | null;
  running_total: number | null;
}

export interface RowFlags {
  no_account_history: boolean;
  meter_differs: boolean;
  check_payer: boolean;
  payer_carried_over: boolean;
  transfer_needed: boolean;
  manual_split: { units: { id: string; label: string; square_feet: number }[]; basis: string } | null;
}

export interface GridRow {
  meter: Meter;
  unit: Unit | null;
  flags: RowFlags;
  cells: Cell[];
}

export interface SiteCounts {
  unpaid: number;
  bill_back: number;
  transfer_needed: number;
  not_yet_billed: number;
  unmapped: number;
  no_account: number;
}

export interface SiteSummary {
  property: Property;
  counts: SiteCounts;
}
