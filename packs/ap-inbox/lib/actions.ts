import { loadParcels, parcelById, resolveParcel } from "@/packs/property-owner-lookup/lib";
import type { ApprovalsView, DraftField, InboxItem, InboxView, InvoiceDraft, ItemView, PaidBatch, ReadyView, Store, Vendor } from "./types";
import { DRAFT_FIELDS } from "./types";
import { dollarsToCents } from "./money";
import { matchVendor as matchVendorName } from "./vendors";
import { ledgerForChargeType, vendorDefaults } from "./defaults";
import { sumCheck } from "./split";
import { findDuplicate } from "./duplicates";
import { fmtCents } from "./money";
import { stamp } from "./clock";
import { readDocument } from "./model";
import { addException, applyResolution, buildDraft, draftState, entityForOwner, hasUnresolved, oneLineAddress, resolutionFor, resolveException, setSource, vendorOf } from "./draft";
import { readiness } from "./readiness";
import { postCaptured, postPaid, postSubmitted } from "./tracker";
import { approvalsView, draftTotal, inboxView, itemView, readyView } from "./views";
import { importRowsFor } from "./importfile";

// Every state change as a function over the store. Each returns the view the screen
// needs so the ui never guesses. Failures throw ActionError with plain words.

export class ActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function itemOf(store: Store, itemId: string): InboxItem {
  const item = store.items.find((i) => i.itemId === itemId);
  if (!item) throw new ActionError("Item not found", 404);
  return item;
}

function draftOf(store: Store, itemId: string): InvoiceDraft {
  const draft = store.drafts[itemId];
  if (!draft) throw new ActionError("This item has not been drafted yet. Open this week's arrivals first.", 409);
  return draft;
}

function view(store: Store, itemId: string): ItemView {
  const v = itemView(store, itemId);
  if (!v) throw new ActionError("Item not found", 404);
  return v;
}

/** Recompute Drafted or Needs attention; never touches later states. */
function refreshState(item: InboxItem, draft: InvoiceDraft): void {
  if (item.state === "Drafted" || item.state === "Needs attention" || item.state === "New") item.state = draftState(draft);
}

async function draftItem(store: Store, item: InboxItem, bytesBase64?: string): Promise<InvoiceDraft> {
  const extraction = await readDocument(item, store, bytesBase64);
  const draft = buildDraft(item, extraction, store);
  store.drafts[item.itemId] = draft;
  item.state = draftState(draft);
  postCaptured(store, item, draft);
  return draft;
}

/** Draft every New item: the week's arrivals land in the inbox with a draft behind each. */
export async function arrive(store: Store): Promise<InboxView> {
  for (const item of [...store.items].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
    if (item.state === "New") await draftItem(store, item);
  }
  return inboxView(store);
}

/** Draft one item if it is still New, for a review screen opened before the inbox. */
export async function ensureDrafted(store: Store, itemId: string): Promise<ItemView> {
  const item = itemOf(store, itemId);
  if (!store.drafts[itemId]) await draftItem(store, item);
  return view(store, itemId);
}

function recomputeSum(draft: InvoiceDraft): void {
  if (draft.mode !== "splitter") return;
  draft.sumCheck = draft.amount !== null ? sumCheck(draft.lines, draft.amount) : { linesTotal: draft.lines.reduce((a, l) => a + (l.amount ?? 0), 0), invoiceTotal: 0, ok: false };
}

export function setField(store: Store, itemId: string, field: string, value: string | null): ItemView {
  const draft = draftOf(store, itemId);
  if (!DRAFT_FIELDS.includes(field as DraftField)) throw new ActionError("That field is not on the draft");
  const f = field as DraftField;
  const text = (value ?? "").trim();
  if (f === "expenseType") return view(store, itemId);
  if (f === "amount") {
    const cents = text ? dollarsToCents(text) : null;
    if (text && cents === null) throw new ActionError("Enter the amount as dollars and cents, like 175.00");
    draft.amount = cents;
    recomputeSum(draft);
  } else if (f === "postMonth") {
    if (!/^\d{4}-\d{2}$/.test(text)) throw new ActionError("Enter the post month as YYYY-MM");
    draft.postMonth = text;
  } else {
    draft[f] = text || null;
  }
  setSource(draft, f, "You", 1);
  if (!draft.confirmed.includes(f)) draft.confirmed.push(f);
  return view(store, itemId);
}

export function confirmField(store: Store, itemId: string, field: string): ItemView {
  const draft = draftOf(store, itemId);
  if (!DRAFT_FIELDS.includes(field as DraftField)) throw new ActionError("That field is not on the draft");
  if (!draft.confirmed.includes(field as DraftField)) draft.confirmed.push(field as DraftField);
  return view(store, itemId);
}

export function chooseLedger(store: Store, itemId: string, glAccount: string): ItemView {
  const draft = draftOf(store, itemId);
  const account = store.ledgerAccounts.find((l) => l.glAccount === glAccount);
  if (!account) throw new ActionError("Pick a ledger account from the chart");
  draft.glAccount = account.glAccount;
  setSource(draft, "glAccount", "You", 1);
  return view(store, itemId);
}

export function setMode(store: Store, itemId: string, mode: "single" | "splitter"): ItemView {
  const draft = draftOf(store, itemId);
  if (draft.mode === mode) return view(store, itemId);
  const vendor = vendorOf(store, draft);
  if (mode === "splitter") {
    if (draft.lines.length === 0) {
      const parcel = draft.propertyResolution ? parcelById(draft.propertyResolution.parcelId) : undefined;
      const entity = parcel ? entityForOwner(store, parcel.holdingCompany) : null;
      draft.lines = [
        {
          lineNumber: 1,
          address: draft.propertyResolution?.address ?? draft.property ?? "",
          parcelId: parcel?.parcelId ?? null,
          owner: parcel?.holdingCompany ?? null,
          entityCode: entity?.entityCode ?? null,
          cashAccount: entity?.cashAccount ?? null,
          amount: draft.amount,
          glAccount: draft.glAccount,
          splitMethod: "stated",
          systemPropertyExists: parcel ? store.systemProperties.some((sp) => sp.parcelId === parcel.parcelId) : false,
          chargeType: null,
          description: null,
        },
      ];
    }
    draft.mode = "splitter";
    draft.entity = null;
    setSource(draft, "entity", null, null);
    draft.cashAccount = null;
    setSource(draft, "cashAccount", null, null);
    draft.property = `${draft.lines.length} properties`;
    setSource(draft, "property", "Read from document", draft.extraction?.confidence.address ?? 1);
    recomputeSum(draft);
  } else {
    draft.mode = "single";
    draft.sumCheck = null;
    if (draft.propertyResolution) {
      applyResolution(draft, draft.propertyResolution);
    } else {
      const defaults = vendorDefaults(vendor, store.ledgerAccounts);
      draft.property = null;
      setSource(draft, "property", null, null);
      draft.entity = defaults.entityCode;
      setSource(draft, "entity", defaults.entityCode ? "Vendor history" : null, defaults.entityCode ? 0.9 : null);
      draft.cashAccount = defaults.cashAccount;
      setSource(draft, "cashAccount", defaults.cashAccount ? "Vendor history" : null, defaults.cashAccount ? 0.9 : null);
    }
  }
  return view(store, itemId);
}

export function setLineAmount(store: Store, itemId: string, lineNumber: number, cents: number): ItemView {
  const draft = draftOf(store, itemId);
  const line = draft.lines.find((l) => l.lineNumber === lineNumber);
  if (!line) throw new ActionError("Line not found", 404);
  line.amount = cents;
  line.splitMethod = "stated";
  recomputeSum(draft);
  return view(store, itemId);
}

export function createProperty(store: Store, itemId: string, lineNumber: number): ItemView {
  const draft = draftOf(store, itemId);
  const line = draft.lines.find((l) => l.lineNumber === lineNumber);
  if (!line) throw new ActionError("Line not found", 404);
  if (!line.parcelId) throw new ActionError("This line has no parcel yet. Resolve the address first.");
  const parcel = parcelById(line.parcelId);
  if (!parcel) throw new ActionError("Parcel not found", 404);
  if (!store.systemProperties.some((sp) => sp.parcelId === parcel.parcelId)) {
    store.systemProperties.push({ propertyCode: `SP-${store.nextPropertyNumber}`, parcelId: parcel.parcelId, address: oneLineAddress(parcel), createdInDemo: true });
    store.nextPropertyNumber += 1;
  }
  for (const d of Object.values(store.drafts)) for (const l of d.lines) if (l.parcelId === parcel.parcelId) l.systemPropertyExists = true;
  return view(store, itemId);
}

function applyVendor(store: Store, draft: InvoiceDraft, vendor: Vendor, score: number): void {
  draft.payee = vendor.name;
  setSource(draft, "payee", "You", 1);
  draft.vendorMatch = { vendorId: vendor.vendorId, score };
  draft.vendorCandidates = [];
  const defaults = vendorDefaults(vendor, store.ledgerAccounts);
  if (defaults.ledgerChoices) {
    draft.ledgerChoices = defaults.ledgerChoices;
    draft.glAccount = null;
    setSource(draft, "glAccount", null, null);
  } else {
    draft.ledgerChoices = null;
    draft.glAccount = defaults.glAccount;
    setSource(draft, "glAccount", defaults.glAccount ? "Vendor history" : null, defaults.glAccount ? 0.9 : null);
  }
  if (draft.mode !== "splitter" && !draft.propertyResolution) {
    draft.entity = defaults.entityCode;
    setSource(draft, "entity", defaults.entityCode ? "Vendor history" : null, defaults.entityCode ? 0.9 : null);
    draft.cashAccount = defaults.cashAccount;
    setSource(draft, "cashAccount", defaults.cashAccount ? "Vendor history" : null, defaults.cashAccount ? 0.9 : null);
  }
  for (const line of draft.lines) line.glAccount = line.chargeType ? ledgerForChargeType(vendor, line.chargeType, store.ledgerAccounts) : defaults.glAccount;
  const duplicate = findDuplicate(vendor, draft.invoiceNumber, store.demoDate);
  if (duplicate && !draft.exceptions.some((e) => e.kind === "possible_duplicate")) {
    const e = addException(
      draft,
      "possible_duplicate",
      `Possible duplicate of ${duplicate.invoiceNumber}`,
      `Invoice ${duplicate.invoiceNumber} from this vendor was paid on ${duplicate.date} for ${fmtCents(duplicate.amount)}. Skip this one or keep it.`,
    );
    e.duplicateOf = duplicate;
  }
}

export function createVendor(store: Store, itemId: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  const name = (draft.payee ?? "").trim();
  if (!name) throw new ActionError("The document has no vendor name to create. Type the payee first.");
  let vendor = store.vendors.find((v) => v.name.toLowerCase() === name.toLowerCase());
  if (!vendor) {
    vendor = { vendorId: `V-${String(store.nextVendorNumber).padStart(3, "0")}`, name, aliases: [], lastGlAccount: null, lastCashAccount: null, lastEntityCode: null, history: [], createdInDemo: true };
    store.nextVendorNumber += 1;
    store.vendors.push(vendor);
  }
  applyVendor(store, draft, vendor, 1);
  resolveException(draft, "unknown_vendor", `Created vendor ${vendor.name}`);
  refreshState(item, draft);
  return view(store, itemId);
}

export function matchVendor(store: Store, itemId: string, vendorId: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  const vendor = store.vendors.find((v) => v.vendorId === vendorId);
  if (!vendor) throw new ActionError("Vendor not found", 404);
  const alias = (draft.payee ?? "").trim();
  if (alias && alias.toLowerCase() !== vendor.name.toLowerCase() && !vendor.aliases.some((a) => a.toLowerCase() === alias.toLowerCase())) vendor.aliases.push(alias);
  const score = alias ? matchVendorName(alias, [vendor]).candidates[0]?.score ?? 1 : 1;
  applyVendor(store, draft, vendor, Math.max(score, 0.85));
  resolveException(draft, "unknown_vendor", `Matched to ${vendor.name}`);
  refreshState(item, draft);
  return view(store, itemId);
}

export function mapUtilityAccount(store: Store, itemId: string, parcelId: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  const parcel = parcelById(parcelId);
  if (!parcel) throw new ActionError("Parcel not found", 404);
  const number = (draft.extraction?.utilityAccountNumber ?? "").trim();
  if (!number) throw new ActionError("This item has no utility account number to map");
  let account = store.utilityAccounts.find((a) => a.accountNumber === number);
  if (!account) {
    account = { providerName: draft.payee ?? "Utility provider", accountNumber: number, parcelId: null, serviceAddress: null };
    store.utilityAccounts.push(account);
  }
  account.parcelId = parcel.parcelId;
  account.serviceAddress = oneLineAddress(parcel);
  applyResolution(draft, resolutionFor(store, parcel, "utilityAccount", 1));
  resolveException(draft, "unknown_utility_account", `Mapped account ${number} to ${oneLineAddress(parcel)}`);
  refreshState(item, draft);
  postCaptured(store, item, draft);
  return view(store, itemId);
}

export function enterAmount(store: Store, itemId: string, cents: number): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  draft.amount = cents;
  setSource(draft, "amount", "You", 1);
  if (!draft.confirmed.includes("amount")) draft.confirmed.push("amount");
  recomputeSum(draft);
  resolveException(draft, "unreadable_amount", `Amount entered as ${fmtCents(cents)}`);
  refreshState(item, draft);
  return view(store, itemId);
}

export function chooseOwner(store: Store, itemId: string, parcelId: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  const parcel = parcelById(parcelId);
  if (!parcel) throw new ActionError("Parcel not found", 404);
  applyResolution(draft, resolutionFor(store, parcel, "address", 1));
  resolveException(draft, "ambiguous_owner", `Owner chosen: ${parcel.holdingCompany}, ${oneLineAddress(parcel)}`);
  refreshState(item, draft);
  postCaptured(store, item, draft);
  return view(store, itemId);
}

/** Resolve a splitter line's address to a parcel the specialist picked. */
export function chooseLineParcel(store: Store, itemId: string, lineNumber: number, parcelId: string): ItemView {
  const draft = draftOf(store, itemId);
  const line = draft.lines.find((l) => l.lineNumber === lineNumber);
  if (!line) throw new ActionError("Line not found", 404);
  const parcel = parcelById(parcelId);
  if (!parcel) throw new ActionError("Parcel not found", 404);
  const entity = entityForOwner(store, parcel.holdingCompany);
  line.parcelId = parcel.parcelId;
  line.owner = parcel.holdingCompany;
  line.entityCode = entity?.entityCode ?? null;
  line.cashAccount = entity?.cashAccount ?? null;
  line.systemPropertyExists = store.systemProperties.some((sp) => sp.parcelId === parcel.parcelId);
  return view(store, itemId);
}

/** Skip a possible duplicate: the exception is closed as skipped and the card leaves Needs a person. */
export function skip(store: Store, itemId: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  if (item.state === "Paid" || item.state === "Approved") throw new ActionError("This invoice is already approved and cannot be skipped");
  const duplicate = draft.exceptions.find((e) => e.kind === "possible_duplicate" && !e.resolved);
  if (duplicate) {
    const number = duplicate.duplicateOf?.invoiceNumber ?? draft.invoiceNumber;
    resolveException(draft, "possible_duplicate", number ? `Skipped, duplicate of ${number}` : "Skipped as a duplicate");
  }
  item.state = "Skipped";
  return view(store, itemId);
}

/** Keep a possible duplicate, also after a skip: the exception reads kept and the item is Drafted again. */
export function keep(store: Store, itemId: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  const kept = "Kept, not a duplicate";
  if (!resolveException(draft, "possible_duplicate", kept)) {
    for (const e of draft.exceptions) if (e.kind === "possible_duplicate") e.resolution = kept;
  }
  if (item.state === "Skipped") item.state = "Drafted";
  refreshState(item, draft);
  return view(store, itemId);
}

export function sendToExceptions(store: Store, itemId: string, note: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  if (item.state !== "Drafted" && item.state !== "Needs attention") throw new ActionError("Only a draft can be sent to exceptions");
  const text = (note ?? "").trim() || "Sent by the specialist for a second look.";
  addException(draft, "sent_by_specialist", "Sent to exceptions", text);
  item.state = "Needs attention";
  return view(store, itemId);
}

export function clearSent(store: Store, itemId: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  resolveException(draft, "sent_by_specialist", "Cleared");
  refreshState(item, draft);
  return view(store, itemId);
}

export function submit(store: Store, itemId: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  const r = readiness(draft, store);
  if (item.state !== "Drafted" || !r.canSubmit) throw new ActionError(r.reasons[0] ?? "This draft cannot be submitted yet");
  item.state = "Submitted";
  item.returnNote = null;
  draft.submittedAt = stamp(store);
  postSubmitted(store, item, draft);
  return view(store, itemId);
}

export function submitAll(store: Store): InboxView & { submitted: number } {
  let submitted = 0;
  for (const item of [...store.items].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
    const draft = store.drafts[item.itemId];
    if (!draft || item.state !== "Drafted" || !readiness(draft, store).canSubmit) continue;
    submit(store, item.itemId);
    submitted += 1;
  }
  return { ...inboxView(store), submitted };
}

export function approve(store: Store, itemId: string): ApprovalsView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  if (item.state !== "Submitted") throw new ActionError("Only a submitted invoice can be approved");
  item.state = "Approved";
  draft.approvedAt = stamp(store);
  return approvalsView(store);
}

export function returnItem(store: Store, itemId: string, note: string): ApprovalsView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  if (item.state !== "Submitted") throw new ActionError("Only a submitted invoice can be returned");
  item.state = "Drafted";
  item.returnNote = (note ?? "").trim() || "Returned by the approver";
  draft.submittedAt = null;
  return approvalsView(store);
}

export function approveAll(store: Store): ApprovalsView & { approved: number } {
  let approved = 0;
  for (const item of store.items) {
    if (item.state !== "Submitted") continue;
    approve(store, item.itemId);
    approved += 1;
  }
  return { ...approvalsView(store), approved };
}

export function markPaid(store: Store): ReadyView {
  const approved = store.items.filter((i) => i.state === "Approved").sort((a, b) => a.itemId.localeCompare(b.itemId));
  if (approved.length === 0) throw new ActionError("Nothing is approved for payment yet");
  const paidAt = stamp(store);
  const itemIds = approved.map((i) => i.itemId);
  let totalAmount = 0;
  for (const item of approved) {
    const draft = draftOf(store, item.itemId);
    item.state = "Paid";
    draft.paidAt = paidAt;
    totalAmount += draftTotal(draft);
  }
  const rows = importRowsFor(store, itemIds);
  const batch: PaidBatch = { batchId: `B-${store.batches.length + 1}`, paidAt, itemIds, invoiceCount: itemIds.length, lineCount: rows.length, totalAmount };
  store.batches.push(batch);
  for (const item of approved) postPaid(store, item, draftOf(store, item.itemId));
  return readyView(store);
}

function documentKind(mimeType: string): "pdf" | "svg" {
  return mimeType === "image/svg+xml" ? "svg" : "pdf";
}

/** A document added during the demo: a new inbox item, drafted at once. */
export async function addUpload(store: Store, fileName: string, mimeType: string, base64: string): Promise<ItemView> {
  const itemId = `I-${store.nextItemNumber}`;
  store.nextItemNumber += 1;
  const item: InboxItem = {
    itemId,
    source: "email",
    receivedAt: stamp(store),
    fileName: fileName || `${itemId}.pdf`,
    documentKind: documentKind(mimeType),
    trackerCardRef: null,
    noticeText: null,
    state: "New",
    scripted: false,
    returnNote: null,
  };
  store.items.push(item);
  store.uploads[itemId] = { itemId, fileName: item.fileName, mimeType, base64 };
  await draftItem(store, item, base64);
  return view(store, itemId);
}

/** Resolve a single draft's address by hand through the registry (the review screen's property search). */
export function resolveProperty(store: Store, itemId: string, query: string): ItemView {
  const item = itemOf(store, itemId);
  const draft = draftOf(store, itemId);
  const r = resolveParcel({ parcelId: query, address: query }, loadParcels());
  if (r.kind !== "one") throw new ActionError(r.kind === "many" ? `${r.candidates.length} parcels match, narrow the address` : "No parcel matches that address");
  applyResolution(draft, resolutionFor(store, r.parcel, r.method, 1));
  resolveException(draft, "ambiguous_owner", `Owner chosen: ${r.parcel.holdingCompany}`);
  refreshState(item, draft);
  postCaptured(store, item, draft);
  return view(store, itemId);
}

export { hasUnresolved };
