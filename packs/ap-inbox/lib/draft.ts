import { loadParcels, parcelById, resolveParcel } from "@/packs/property-owner-lookup/lib";
import type { ParcelRecord } from "@/packs/property-owner-lookup/lib";
import type {
  DraftException,
  DraftField,
  Entity,
  ExceptionCandidate,
  ExceptionKind,
  Extraction,
  FieldSource,
  InboxItem,
  InvoiceDraft,
  ItemState,
  PropertyResolution,
  ResolutionMethod,
  SplitLine,
  Store,
  Vendor,
} from "./types";
import { DRAFT_FIELDS } from "./types";
import { matchVendor } from "./vendors";
import { ledgerForChargeType, vendorDefaults } from "./defaults";
import { parseMoney, fmtCents } from "./money";
import { equalSplit, sumCheck } from "./split";
import { findDuplicate } from "./duplicates";
import { notesTemplate } from "./notes";

// The draft builder: the checked fields from the reader in, a pre-filled InvoiceDraft
// out. Every decision here is plain code. Steps run in the order the pack lists them.

function fieldRecord<T>(value: T): Record<DraftField, T> {
  return Object.fromEntries(DRAFT_FIELDS.map((f) => [f, value])) as Record<DraftField, T>;
}

export function emptyDraft(itemId: string, postMonth: string): InvoiceDraft {
  const draft: InvoiceDraft = {
    itemId,
    payee: null,
    invoiceNumber: null,
    expenseType: "expense",
    invoiceDate: null,
    postMonth,
    cashAccount: null,
    notes: null,
    entity: null,
    amount: null,
    glAccount: null,
    property: null,
    fieldSources: fieldRecord<FieldSource | null>(null),
    fieldConfidence: fieldRecord<number | null>(null),
    vendorMatch: null,
    vendorCandidates: [],
    propertyResolution: null,
    mode: "single",
    lines: [],
    sumCheck: null,
    exceptions: [],
    ledgerChoices: null,
    confirmed: [],
    readFailed: false,
    extraction: null,
    submittedAt: null,
    approvedAt: null,
    paidAt: null,
  };
  setSource(draft, "expenseType", "Default", 1);
  setSource(draft, "postMonth", "Default", 1);
  return draft;
}

export function setSource(draft: InvoiceDraft, field: DraftField, source: FieldSource | null, confidence: number | null): void {
  draft.fieldSources[field] = source;
  draft.fieldConfidence[field] = confidence;
}

export function addException(draft: InvoiceDraft, kind: ExceptionKind, title: string, detail: string, candidates: ExceptionCandidate[] = []): DraftException {
  const exception: DraftException = { kind, title, detail, candidates, duplicateOf: null, resolved: false, resolution: null };
  draft.exceptions.push(exception);
  return exception;
}

export function resolveException(draft: InvoiceDraft, kind: ExceptionKind, resolution: string): boolean {
  let found = false;
  for (const e of draft.exceptions) {
    if (e.kind === kind && !e.resolved) {
      e.resolved = true;
      e.resolution = resolution;
      found = true;
    }
  }
  return found;
}

export function hasUnresolved(draft: InvoiceDraft): boolean {
  return draft.exceptions.some((e) => !e.resolved);
}

export function draftState(draft: InvoiceDraft): ItemState {
  return hasUnresolved(draft) ? "Needs attention" : "Drafted";
}

export function oneLineAddress(p: ParcelRecord): string {
  return `${p.address}, ${p.city}, ${p.state} ${p.zip}`;
}

export function entityForOwner(store: Store, holdingCompany: string): Entity | null {
  return store.entities.find((e) => e.name === holdingCompany) ?? null;
}

export function resolutionFor(store: Store, parcel: ParcelRecord, method: ResolutionMethod, confidence: number): PropertyResolution {
  const entity = entityForOwner(store, parcel.holdingCompany);
  return {
    parcelId: parcel.parcelId,
    address: oneLineAddress(parcel),
    owner: parcel.holdingCompany,
    entityCode: entity?.entityCode ?? "",
    cashAccount: entity?.cashAccount ?? "",
    method,
    confidence,
  };
}

/** Apply a property resolution to a single-mode draft: property, entity and cash account. */
export function applyResolution(draft: InvoiceDraft, resolution: PropertyResolution): void {
  draft.propertyResolution = resolution;
  draft.property = resolution.address;
  setSource(draft, "property", "Resolved from property", resolution.confidence);
  draft.entity = resolution.entityCode || null;
  setSource(draft, "entity", "Resolved from property", resolution.confidence);
  draft.cashAccount = resolution.cashAccount || null;
  setSource(draft, "cashAccount", "Resolved from property", resolution.confidence);
}

export function parcelCandidate(p: ParcelRecord): ExceptionCandidate {
  return { id: p.parcelId, label: oneLineAddress(p), detail: `${p.county} County, ${p.holdingCompany}`, score: null };
}

export function vendorOf(store: Store, draft: InvoiceDraft): Vendor | null {
  return draft.vendorMatch ? (store.vendors.find((v) => v.vendorId === draft.vendorMatch?.vendorId) ?? null) : null;
}

export function isSplitterExtraction(extraction: Extraction): boolean {
  return extraction.lineItems.filter((l) => l.address && l.address.trim()).length >= 2;
}

const ADDRESS_LABEL = /^(service|property|site|lot|parcel)?\s*(address|location)?\s*:\s*/i;

/** An address line as printed, without a leading label such as "Service address:". */
export function cleanAddressLine(text: string): string {
  return text.trim().replace(ADDRESS_LABEL, "").trim();
}

function addressQuery(extraction: Extraction): string | null {
  const lines = extraction.serviceAddressLines.map(cleanAddressLine).filter(Boolean);
  return lines.length ? lines.join(", ") : null;
}

/** Build the splitter lines from the extraction's line items. */
export function buildLines(store: Store, extraction: Extraction, vendor: Vendor | null, totalCents: number | null): SplitLine[] {
  const parcels = loadParcels();
  const items = extraction.lineItems.filter((l) => l.address && l.address.trim());
  const statedAmounts = items.map((l) => parseMoney(l.amount));
  const allStated = statedAmounts.every((a) => a !== null);
  const equal = !allStated && totalCents !== null ? equalSplit(totalCents, items.length) : null;
  const defaults = vendorDefaults(vendor, store.ledgerAccounts);
  return items.map((l, i) => {
    const address = cleanAddressLine(l.address!);
    const r = resolveParcel({ address }, parcels);
    const parcel = r.kind === "one" ? r.parcel : null;
    const entity = parcel ? entityForOwner(store, parcel.holdingCompany) : null;
    return {
      lineNumber: i + 1,
      address,
      parcelId: parcel?.parcelId ?? null,
      owner: parcel?.holdingCompany ?? null,
      entityCode: entity?.entityCode ?? null,
      cashAccount: entity?.cashAccount ?? null,
      amount: allStated ? statedAmounts[i] : equal ? equal[i] : null,
      glAccount: l.chargeType ? ledgerForChargeType(vendor, l.chargeType, store.ledgerAccounts) : defaults.glAccount,
      splitMethod: allStated ? "stated" : "equal",
      systemPropertyExists: parcel ? store.systemProperties.some((sp) => sp.parcelId === parcel.parcelId) : false,
      chargeType: l.chargeType,
      description: l.description || null,
    };
  });
}

export function buildDraft(item: InboxItem, extraction: Extraction | null, store: Store): InvoiceDraft {
  const draft = emptyDraft(item.itemId, store.postMonth);
  draft.extraction = extraction;

  // 1. Nothing could be read: the two defaults stay, everything else is typed by hand.
  if (!extraction) {
    draft.readFailed = true;
    return draft;
  }
  const parcels = loadParcels();
  const splitter = isSplitterExtraction(extraction);

  // 2. Payee through the vendor master.
  const documentName = (extraction.payee ?? "").trim();
  const { match, candidates } = matchVendor(documentName, store.vendors);
  let vendor: Vendor | null = null;
  if (match) {
    vendor = store.vendors.find((v) => v.vendorId === match.vendorId) ?? null;
    draft.payee = match.name;
    setSource(draft, "payee", "Read from document", match.score);
    draft.vendorMatch = { vendorId: match.vendorId, score: match.score };
  } else {
    draft.payee = documentName || null;
    if (documentName) setSource(draft, "payee", "Read from document", extraction.confidence.payee);
    draft.vendorCandidates = candidates;
    addException(
      draft,
      "unknown_vendor",
      "Unknown vendor",
      documentName ? `"${documentName}" is not in the vendor master. Create it, or match it to one of the closest names.` : "No vendor name could be read from the document.",
      candidates.map((c) => {
        const v = store.vendors.find((x) => x.vendorId === c.vendorId);
        const n = v?.history.length ?? 0;
        return { id: c.vendorId, label: c.name, detail: n === 1 ? "1 invoice on file" : `${n} invoices on file`, score: c.score };
      }),
    );
  }

  // 3. Invoice number and date as read.
  draft.invoiceNumber = extraction.invoiceNumber?.trim() || null;
  if (draft.invoiceNumber) setSource(draft, "invoiceNumber", "Read from document", extraction.confidence.invoiceNumber);
  draft.invoiceDate = extraction.invoiceDate?.trim() || null;
  if (draft.invoiceDate) setSource(draft, "invoiceDate", "Read from document", extraction.confidence.invoiceDate);

  // 4. Amount.
  draft.amount = parseMoney(extraction.totalAmount);
  if (draft.amount === null) {
    addException(draft, "unreadable_amount", "Amount unreadable", "The total could not be read from the document. Enter the amount to complete the draft.");
  } else {
    setSource(draft, "amount", "Read from document", extraction.confidence.totalAmount);
  }

  // 5. Expense type and post month are defaults, already set.

  // 6. Property, single documents only; the splitter resolves per line.
  if (!splitter) {
    if (extraction.utilityAccountNumber) {
      const number = extraction.utilityAccountNumber.trim();
      const account = store.utilityAccounts.find((a) => a.accountNumber === number);
      const parcel = account?.parcelId ? parcelById(account.parcelId) : undefined;
      if (parcel) {
        applyResolution(draft, resolutionFor(store, parcel, "utilityAccount", 0.95));
      } else {
        addException(
          draft,
          "unknown_utility_account",
          `Unknown utility account ${number}`,
          account
            ? `Account ${number} from ${account.providerName} has no parcel in the crosswalk yet. Search a parcel to map it.`
            : `Account ${number} is not in the utility crosswalk. Search a parcel to map it; the account stays mapped afterwards.`,
        );
      }
    } else {
      const ref = extraction.parcelRefs.map((r) => r.trim()).find(Boolean);
      const byRef = ref ? resolveParcel({ parcelId: ref }, parcels) : null;
      const query = addressQuery(extraction);
      if (byRef && byRef.kind === "one") {
        applyResolution(draft, resolutionFor(store, byRef.parcel, "parcel", 1));
      } else if (query) {
        let r = resolveParcel({ address: query }, parcels);
        if (r.kind === "none" && extraction.serviceAddressLines.length > 1) r = resolveParcel({ address: cleanAddressLine(extraction.serviceAddressLines[0]) }, parcels);
        if (r.kind === "one") {
          applyResolution(draft, resolutionFor(store, r.parcel, "address", 0.9));
        } else if (r.kind === "many") {
          addException(
            draft,
            "ambiguous_owner",
            `Ambiguous owner, ${r.candidates.length} candidates`,
            `"${query}" matches ${r.candidates.length} parcels in the registry. Pick the one this invoice is for.`,
            r.candidates.map(parcelCandidate),
          );
        } else {
          addException(draft, "ambiguous_owner", "Owner not found", `"${query}" did not match a parcel in the registry. Search a parcel to resolve the owner.`);
        }
      }
      // No address lines and no parcel refs: an office item, no property.
    }
  }

  // 7 and 8. Entity, cash account and ledger account from the vendor's history.
  const defaults = vendorDefaults(vendor, store.ledgerAccounts);
  if (!splitter && !draft.propertyResolution) {
    if (defaults.entityCode) {
      draft.entity = defaults.entityCode;
      setSource(draft, "entity", "Vendor history", 0.9);
    }
    if (defaults.cashAccount) {
      draft.cashAccount = defaults.cashAccount;
      setSource(draft, "cashAccount", "Vendor history", 0.9);
    }
  }
  if (defaults.ledgerChoices) {
    draft.ledgerChoices = defaults.ledgerChoices;
    draft.glAccount = null;
  } else if (defaults.glAccount) {
    draft.glAccount = defaults.glAccount;
    setSource(draft, "glAccount", "Vendor history", 0.9);
  }

  // 10. Duplicates.
  const duplicate = findDuplicate(vendor, draft.invoiceNumber, store.demoDate);
  if (duplicate) {
    const e = addException(
      draft,
      "possible_duplicate",
      `Possible duplicate of ${duplicate.invoiceNumber}`,
      `Invoice ${duplicate.invoiceNumber} from this vendor was paid on ${duplicate.date} for ${fmtCents(duplicate.amount)}. Skip this one or keep it.`,
    );
    e.duplicateOf = duplicate;
  }

  // 11. Splitter lines.
  if (splitter) {
    draft.mode = "splitter";
    draft.lines = buildLines(store, extraction, vendor, draft.amount);
    draft.entity = null;
    setSource(draft, "entity", null, null);
    draft.cashAccount = null;
    setSource(draft, "cashAccount", null, null);
    draft.property = `${draft.lines.length} properties`;
    setSource(draft, "property", "Read from document", extraction.confidence.address);
    if (draft.amount !== null) {
      draft.sumCheck = sumCheck(draft.lines, draft.amount);
      if (draft.lines.every((l) => l.splitMethod === "stated") && !draft.sumCheck.ok) {
        addException(
          draft,
          "lines_not_summing",
          "Lines do not sum",
          `The lines add up to ${fmtCents(draft.sumCheck.linesTotal)} but the invoice total is ${fmtCents(draft.amount)}. Correct a line amount or the total.`,
        );
      }
    } else {
      draft.sumCheck = { linesTotal: draft.lines.reduce((a, l) => a + (l.amount ?? 0), 0), invoiceTotal: 0, ok: false };
    }
  }

  // 9. Notes (after the lines so the count is known).
  draft.notes = notesTemplate(extraction, splitter ? draft.lines.length : 1);
  setSource(draft, "notes", "Default", 1);

  return draft;
}
