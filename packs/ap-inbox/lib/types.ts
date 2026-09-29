import type { ParcelRecord, Resolution } from "@/packs/property-owner-lookup/lib/types";

// Types for the invoice intake and capture pack. Field names follow the pack's data
// model. Money is integer cents everywhere in the seed and the store; the canned
// extractions carry amounts as printed on the document and lib code converts them.
// Identifier shapes (declared as rules in markers.json):
//   items I-0001 upward (I-9001 upward for documents added during the demo)
//   vendors V-001 upward, entities E-001 (operating) and E-101 upward (holding)
//   parcels P-10100 to P-12099, system property codes SP-20001 upward
//   utility accounts 5520-118 shape, tracker cards T-8812 shape
//   ledger accounts 9xxx-xxxx, cash accounts 1xxx-xxxx

export type { ParcelRecord, Resolution };

export type Source = "email" | "trackerApproved" | "utilityPortal" | "mailScan";
export const SOURCES: readonly Source[] = ["email", "trackerApproved", "utilityPortal", "mailScan"];
export const SOURCE_LABELS: Record<Source, string> = {
  email: "Email",
  trackerApproved: "Monday.com approved",
  utilityPortal: "Utility portal",
  mailScan: "Mail scan",
};

/** Item states are stored as the words the screens show. */
export type ItemState = "New" | "Drafted" | "Needs attention" | "Submitted" | "Approved" | "Paid" | "Skipped";
export const ITEM_STATES: readonly ItemState[] = ["New", "Drafted", "Needs attention", "Submitted", "Approved", "Paid", "Skipped"];

export interface InboxItem {
  itemId: string;
  source: Source;
  receivedAt: string; // ISO timestamp, e.g. "2026-08-31T08:12:00Z"
  fileName: string; // file under public/demo/ap-inbox/
  documentKind: "pdf" | "svg";
  trackerCardRef: string | null; // tracker items only
  noticeText: string | null; // utility items only: the bill-ready notice that triggered the item
  state: ItemState;
  scripted: boolean; // seeded items serve their canned extraction
  returnNote: string | null; // set when the approver returns the invoice
}

export type DraftField =
  | "payee"
  | "invoiceNumber"
  | "expenseType"
  | "invoiceDate"
  | "postMonth"
  | "cashAccount"
  | "notes"
  | "entity"
  | "amount"
  | "glAccount"
  | "property";
export const DRAFT_FIELDS: readonly DraftField[] = [
  "payee",
  "invoiceNumber",
  "expenseType",
  "invoiceDate",
  "postMonth",
  "cashAccount",
  "notes",
  "entity",
  "amount",
  "glAccount",
  "property",
];
/** The ten fields keyed by hand today; property is optional and is not counted. */
export const REQUIRED_FIELDS: readonly DraftField[] = DRAFT_FIELDS.filter((f) => f !== "property");
export const FIELD_LABELS: Record<DraftField, string> = {
  payee: "Payee",
  invoiceNumber: "Invoice number",
  expenseType: "Expense type",
  invoiceDate: "Invoice date",
  postMonth: "Post month",
  cashAccount: "Cash account",
  notes: "Notes",
  entity: "Entity",
  amount: "Amount",
  glAccount: "Ledger account",
  property: "Property",
};

export type FieldSource = "Read from document" | "Vendor history" | "Resolved from property" | "Default" | "You";

/** Confidence bands for the colour on each field. Below CONFIRM the field must be confirmed before Submit. */
export const CONFIDENCE = { HIGH: 0.85, CONFIRM: 0.6 } as const;

export type ResolutionMethod = "parcel" | "address" | "utilityAccount";
export const METHOD_LABELS: Record<ResolutionMethod, string> = { parcel: "parcel", address: "address", utilityAccount: "utility account" };

export interface PropertyResolution {
  parcelId: string;
  address: string; // one line: "45 Hillcrest Dr Unit 2, Peoria, IL 61604"
  owner: string; // holding company name
  entityCode: string;
  cashAccount: string;
  method: ResolutionMethod;
  confidence: number;
}

export type SplitMethod = "stated" | "equal";

export interface SplitLine {
  lineNumber: number; // 1 upward
  address: string; // as read from the document
  parcelId: string | null; // null when the address did not resolve
  owner: string | null;
  entityCode: string | null;
  cashAccount: string | null;
  amount: number | null; // integer cents
  glAccount: string | null;
  splitMethod: SplitMethod;
  systemPropertyExists: boolean; // false flags "not in property list"; Create property sets it true
  chargeType: string | null; // statement lines: "electric", "gas", "locks and securing"
  description: string | null;
}

export interface VendorHistoryEntry {
  date: string; // YYYY-MM-DD
  invoiceNumber: string;
  amount: number; // integer cents
  glAccount: string;
  cashAccount: string;
  entityCode: string;
  chargeType: string | null; // set when the vendor bills by charge type
}

export interface Vendor {
  vendorId: string;
  name: string;
  aliases: string[];
  lastGlAccount: string | null;
  lastCashAccount: string | null;
  lastEntityCode: string | null;
  history: VendorHistoryEntry[]; // most recent first, up to five
  createdInDemo: boolean;
}

export interface VendorCandidate {
  vendorId: string;
  name: string;
  score: number; // two decimals
}

export interface SystemProperty {
  propertyCode: string;
  parcelId: string;
  address: string; // one line, as PropertyResolution.address
  createdInDemo: boolean;
}

export interface UtilityAccount {
  providerName: string;
  accountNumber: string;
  parcelId: string | null; // null for the two unmapped accounts
  serviceAddress: string | null;
}

export interface Entity {
  entityCode: string;
  name: string;
  cashAccount: string;
  kind: "holding" | "operating";
}

export interface LedgerAccount {
  glAccount: string; // starts with 9
  name: string; // "Repairs and maintenance"
}

export interface TrackerCard {
  cardRef: string;
  parcelId: string;
  createdInDemo: boolean;
}

export type TrackerReason = "captured" | "submitted" | "paid";

export interface TrackerUpdate {
  updateId: string;
  cardRef: string;
  parcelId: string;
  itemId: string;
  source: Source;
  message: string;
  createdAt: string;
  reason: TrackerReason;
  newCard: boolean; // the card did not exist before this invoice arrived
}

export type ExceptionKind =
  | "unknown_vendor"
  | "ambiguous_owner"
  | "unknown_utility_account"
  | "unreadable_amount"
  | "possible_duplicate"
  | "lines_not_summing"
  | "sent_by_specialist";

export interface ExceptionCandidate {
  id: string; // vendorId or parcelId
  label: string;
  detail: string;
  score: number | null;
}

/** Titles are the exact words the checks name: "Unknown vendor", "Ambiguous owner, 2 candidates",
 *  "Unknown utility account 5520-118", "Amount unreadable", "Possible duplicate of 4471", "Lines do not sum". */
export interface DraftException {
  kind: ExceptionKind;
  title: string;
  detail: string;
  candidates: ExceptionCandidate[];
  duplicateOf: VendorHistoryEntry | null; // possible_duplicate only
  resolved: boolean;
  resolution: string | null; // plain words for what was done
}

export interface SumCheck {
  linesTotal: number; // integer cents
  invoiceTotal: number; // integer cents
  ok: boolean;
}

export interface LedgerChoice {
  glAccount: string;
  name: string;
  date: string; // the history entry that used it
  invoiceNumber: string;
}

export interface InvoiceDraft {
  itemId: string;
  payee: string | null;
  invoiceNumber: string | null;
  expenseType: "expense";
  invoiceDate: string | null;
  postMonth: string;
  cashAccount: string | null;
  notes: string | null;
  entity: string | null; // entity code
  amount: number | null; // integer cents
  glAccount: string | null;
  property: string | null; // one-line address, null for office items
  fieldSources: Record<DraftField, FieldSource | null>;
  fieldConfidence: Record<DraftField, number | null>;
  vendorMatch: { vendorId: string; score: number } | null;
  vendorCandidates: VendorCandidate[]; // the three closest names when unmatched
  propertyResolution: PropertyResolution | null;
  mode: "single" | "splitter";
  lines: SplitLine[]; // splitter mode only
  sumCheck: SumCheck | null; // splitter mode only
  exceptions: DraftException[];
  ledgerChoices: LedgerChoice[] | null; // set when the last three history entries disagree; glAccount stays empty until chosen
  confirmed: DraftField[]; // low-confidence fields the specialist confirmed
  readFailed: boolean; // "Could not read this document, enter fields by hand"
  extraction: Extraction | null;
  submittedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface Readiness {
  canSubmit: boolean;
  reasons: string[]; // plain words, empty when canSubmit
}

// Model output. One canned file per scripted item at packs/ap-inbox/seed/canned/<itemId>.json.

export type ExtractionKind = "invoice" | "list" | "statement";

export interface ExtractedLine {
  description: string;
  address: string | null;
  amount: string | null; // as printed, "60.00"; null when the document gives no per-item price
  chargeType: string | null;
}

export interface Extraction {
  kind: ExtractionKind;
  payee: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null; // YYYY-MM-DD
  totalAmount: string | null; // as printed, "6,988.40"; null when unreadable
  serviceAddressLines: string[]; // property or service address lines as printed
  parcelRefs: string[]; // parcel ids printed on the document
  utilityAccountNumber: string | null;
  lineItems: ExtractedLine[];
  confidence: { payee: number; invoiceNumber: number; invoiceDate: number; totalAmount: number; address: number };
  notesHint: string | null; // short charge description for the notes template
}

// Import file: the 15-column layout. Property goes in the description as "address, charge".

export const IMPORT_COLUMNS = [
  "Entity",
  "Vendor code",
  "Payee",
  "Invoice number",
  "Invoice date",
  "Post month",
  "Due date",
  "Expense type",
  "Cash account",
  "Ledger account",
  "Amount",
  "Description",
  "Notes",
  "Line",
  "Reference",
] as const;

export interface ImportRow {
  entity: string;
  vendorCode: string;
  payee: string;
  invoiceNumber: string;
  invoiceDate: string;
  postMonth: string;
  dueDate: string;
  expenseType: string;
  cashAccount: string;
  glAccount: string;
  amount: string; // dollars with two decimals, "480.00"
  description: string; // "address, charge"
  notes: string;
  line: string; // "1", "2", ...
  reference: string; // itemId
}

export interface PaidBatch {
  batchId: string;
  paidAt: string;
  itemIds: string[];
  invoiceCount: number;
  lineCount: number;
  totalAmount: number; // integer cents
}

export interface UploadedDocument {
  itemId: string;
  fileName: string;
  mimeType: string;
  base64: string | null; // sent to the reader when a key is present
}

// Seed and store.

export interface Seed {
  demoDate: string; // "2026-09-03", the payment Thursday
  postMonth: string; // "2026-09"
  weekStart: string; // first arrival day
  weekEnd: string; // last arrival day
  items: InboxItem[]; // 26, all state "New"
  vendors: Vendor[];
  entities: Entity[];
  ledgerAccounts: LedgerAccount[];
  systemProperties: SystemProperty[];
  utilityAccounts: UtilityAccount[];
  trackerCards: TrackerCard[];
}

export interface Store extends Seed {
  clock: number; // logical minutes since demoDate 09:00; every event advances it
  drafts: Record<string, InvoiceDraft>;
  trackerUpdates: TrackerUpdate[];
  batches: PaidBatch[];
  uploads: Record<string, UploadedDocument>;
  nextCardNumber: number;
  nextItemNumber: number;
  nextVendorNumber: number;
  nextPropertyNumber: number;
  nextUpdateNumber: number;
}

// Route payloads the screens fetch.

export interface InboxRow {
  item: InboxItem;
  sourceLabel: string;
  vendorGuess: string | null;
  amount: number | null;
  propertyGuess: string | null;
  state: ItemState;
  exceptionTitles: string[];
  lineCount: number;
  canSubmit: boolean;
}

export interface InboxView {
  demoDate: string;
  postMonth: string;
  items: InboxRow[];
  counters: Record<ItemState, number>;
  total: number;
  readyToSubmit: number;
}

export interface ItemView {
  item: InboxItem;
  draft: InvoiceDraft;
  documentUrl: string;
  vendor: Vendor | null;
  readiness: Readiness;
  ledgerAccounts: LedgerAccount[];
  entities: Entity[];
}

export interface ExceptionCard {
  itemId: string;
  source: Source;
  sourceLabel: string;
  vendorGuess: string | null;
  amount: number | null;
  propertyGuess: string | null;
  exception: DraftException;
  documentUrl: string;
  state: ItemState;
}

export interface ExceptionsView {
  cards: ExceptionCard[];
  open: number;
}

export interface ApprovalRow {
  itemId: string;
  source: Source;
  sourceLabel: string;
  payee: string;
  invoiceNumber: string;
  amount: number;
  entity: string;
  glAccount: string;
  property: string | null;
  lineCount: number;
  submittedAt: string;
}

export interface ApprovalsView {
  invoices: ApprovalRow[];
}

export interface ReadyRow {
  itemId: string;
  payee: string;
  invoiceNumber: string;
  amount: number;
  lineCount: number;
  property: string | null;
  state: ItemState;
}

export interface ReadyView {
  invoices: ReadyRow[];
  invoiceCount: number;
  lineCount: number;
  totalAmount: number; // integer cents
  columns: readonly string[];
  rows: ImportRow[];
  fileName: string;
  paid: boolean;
  batch: PaidBatch | null;
}

export interface TrackerCardGroup {
  cardRef: string;
  parcelId: string;
  address: string;
  newCard: boolean;
  itemIds: string[];
  cameByEmailNotInTrackerBefore: boolean;
  updates: TrackerUpdate[];
}

export interface TrackerView {
  cards: TrackerCardGroup[];
  updateCount: number;
  emailNewCount: number;
}

export interface ArchiveDocument {
  itemId: string;
  fileName: string;
  receivedAt: string;
  source: Source;
  sourceLabel: string;
  documentUrl: string;
  state: ItemState;
  payee: string | null;
}

export interface ArchiveWeek {
  weekStart: string;
  label: string;
  documents: ArchiveDocument[];
}

export interface ArchiveView {
  weeks: ArchiveWeek[];
}

export interface ParcelLookupView {
  query: string;
  result: Resolution;
  systemProperty: SystemProperty | null;
  entity: Entity | null;
}

export interface ResetResult {
  ok: true;
  items: number;
  states: Record<ItemState, number>;
}
