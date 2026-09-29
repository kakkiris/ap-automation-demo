import { findParcelText, loadParcels, parcelById } from "@/packs/property-owner-lookup/lib";
import type {
  ApprovalRow,
  ApprovalsView,
  ArchiveDocument,
  ArchiveView,
  ArchiveWeek,
  ExceptionCard,
  ExceptionsView,
  InboxItem,
  InboxRow,
  InboxView,
  InvoiceDraft,
  ItemState,
  ItemView,
  PaidBatch,
  ParcelLookupView,
  ReadyRow,
  ReadyView,
  Store,
  TrackerCardGroup,
  TrackerView,
} from "./types";
import { IMPORT_COLUMNS, ITEM_STATES, SOURCE_LABELS } from "./types";
import { readiness } from "./readiness";
import { importFileName, importRows, importRowsFor } from "./importfile";
import { fmtDate, mondayOf } from "./clock";
import { oneLineAddress, vendorOf } from "./draft";

// Route payloads: exactly the *View shapes in types.ts, computed from the store.

const byId = (a: { itemId: string }, b: { itemId: string }) => a.itemId.localeCompare(b.itemId);

export function documentUrl(item: InboxItem): string {
  return item.scripted ? `/demo/ap-inbox/${item.fileName}` : `/api/family-office-ap/ap-inbox/items/${item.itemId}/document`;
}

export function lineCount(draft: InvoiceDraft | undefined): number {
  return draft?.mode === "splitter" ? draft.lines.length : 1;
}

/** The invoice total: the amount, or the sum of the lines when the amount is missing. */
export function draftTotal(draft: InvoiceDraft): number {
  if (draft.amount !== null) return draft.amount;
  return draft.mode === "splitter" ? draft.lines.reduce((a, l) => a + (l.amount ?? 0), 0) : 0;
}

function canSubmit(store: Store, item: InboxItem): boolean {
  const draft = store.drafts[item.itemId];
  return !!draft && item.state === "Drafted" && readiness(draft, store).canSubmit;
}

export function inboxView(store: Store): InboxView {
  const items = [...store.items].sort(byId);
  const counters = Object.fromEntries(ITEM_STATES.map((s) => [s, 0])) as Record<ItemState, number>;
  const rows: InboxRow[] = items.map((item) => {
    counters[item.state] += 1;
    const draft = store.drafts[item.itemId];
    return {
      item,
      sourceLabel: SOURCE_LABELS[item.source],
      vendorGuess: draft?.payee ?? null,
      amount: draft?.amount ?? null,
      propertyGuess: draft?.property ?? null,
      state: item.state,
      exceptionTitles: draft ? draft.exceptions.filter((e) => !e.resolved).map((e) => e.title) : [],
      lineCount: lineCount(draft),
      canSubmit: canSubmit(store, item),
    };
  });
  return {
    demoDate: store.demoDate,
    postMonth: store.postMonth,
    items: rows,
    counters,
    total: items.length,
    readyToSubmit: rows.filter((r) => r.canSubmit).length,
  };
}

export function itemView(store: Store, itemId: string): ItemView | null {
  const item = store.items.find((i) => i.itemId === itemId);
  const draft = store.drafts[itemId];
  if (!item || !draft) return null;
  return {
    item,
    draft,
    documentUrl: documentUrl(item),
    vendor: vendorOf(store, draft),
    readiness: readiness(draft, store),
    ledgerAccounts: store.ledgerAccounts,
    entities: store.entities,
  };
}

/** One card per open exception, only for items still in Needs attention; a Skipped, Submitted, Approved, Paid, Drafted or New item never shows here. */
export function exceptionsView(store: Store): ExceptionsView {
  const cards: ExceptionCard[] = [];
  for (const item of [...store.items].sort(byId)) {
    if (item.state !== "Needs attention") continue;
    const draft = store.drafts[item.itemId];
    if (!draft) continue;
    for (const exception of draft.exceptions) {
      if (exception.resolved) continue;
      cards.push({
        itemId: item.itemId,
        source: item.source,
        sourceLabel: SOURCE_LABELS[item.source],
        vendorGuess: draft.payee,
        amount: draft.amount,
        propertyGuess: draft.property,
        exception,
        documentUrl: documentUrl(item),
        state: item.state,
      });
    }
  }
  return { cards, open: cards.length };
}

function distinct(values: (string | null)[]): string {
  return [...new Set(values.filter((v): v is string => !!v))].join(", ");
}

export function approvalsView(store: Store): ApprovalsView {
  const invoices: ApprovalRow[] = [];
  for (const item of [...store.items].sort(byId)) {
    if (item.state !== "Submitted") continue;
    const draft = store.drafts[item.itemId];
    if (!draft) continue;
    const split = draft.mode === "splitter";
    invoices.push({
      itemId: item.itemId,
      source: item.source,
      sourceLabel: SOURCE_LABELS[item.source],
      payee: draft.payee ?? "",
      invoiceNumber: draft.invoiceNumber ?? "",
      amount: draftTotal(draft),
      entity: split ? distinct(draft.lines.map((l) => l.entityCode)) : (draft.entity ?? ""),
      glAccount: split ? distinct(draft.lines.map((l) => l.glAccount)) : (draft.glAccount ?? ""),
      property: draft.property,
      lineCount: lineCount(draft),
      submittedAt: draft.submittedAt ?? "",
    });
  }
  return { invoices };
}

function readyRow(store: Store, item: InboxItem): ReadyRow | null {
  const draft = store.drafts[item.itemId];
  if (!draft) return null;
  return {
    itemId: item.itemId,
    payee: draft.payee ?? "",
    invoiceNumber: draft.invoiceNumber ?? "",
    amount: draftTotal(draft),
    lineCount: lineCount(draft),
    property: draft.property,
    state: item.state,
  };
}

export function readyView(store: Store): ReadyView {
  const approved = [...store.items].filter((i) => i.state === "Approved").sort(byId);
  const lastBatch = store.batches[store.batches.length - 1] ?? null;
  let items: InboxItem[] = approved;
  let rows = importRows(store);
  let paid = false;
  let batch: PaidBatch | null = null;
  if (approved.length === 0 && lastBatch) {
    items = store.items.filter((i) => lastBatch.itemIds.includes(i.itemId)).sort(byId);
    rows = importRowsFor(store, lastBatch.itemIds);
    paid = true;
    batch = lastBatch;
  }
  const invoices = items.map((i) => readyRow(store, i)).filter((r): r is ReadyRow => r !== null);
  return {
    invoices,
    invoiceCount: invoices.length,
    lineCount: rows.length,
    totalAmount: invoices.reduce((a, r) => a + r.amount, 0),
    columns: IMPORT_COLUMNS,
    rows,
    fileName: importFileName(store),
    paid,
    batch,
  };
}

export function trackerView(store: Store): TrackerView {
  const groups = new Map<string, TrackerCardGroup>();
  const order = new Map<string, number>();
  for (const u of store.trackerUpdates) {
    const n = parseInt(u.updateId.slice(2), 10);
    let g = groups.get(u.cardRef);
    if (!g) {
      const card = store.trackerCards.find((c) => c.cardRef === u.cardRef);
      const parcel = parcelById(u.parcelId);
      g = {
        cardRef: u.cardRef,
        parcelId: u.parcelId,
        address: parcel ? oneLineAddress(parcel) : u.parcelId,
        newCard: card?.createdInDemo ?? false,
        itemIds: [],
        cameByEmailNotInTrackerBefore: false,
        updates: [],
      };
      groups.set(u.cardRef, g);
    }
    if (!g.itemIds.includes(u.itemId)) g.itemIds.push(u.itemId);
    g.updates.push(u);
    order.set(u.cardRef, Math.max(order.get(u.cardRef) ?? 0, n));
  }
  const cards = [...groups.values()];
  for (const g of cards) {
    const first = g.updates[0];
    g.cameByEmailNotInTrackerBefore = g.newCard && first.source === "email";
  }
  cards.sort((a, b) => (order.get(b.cardRef) ?? 0) - (order.get(a.cardRef) ?? 0));
  return { cards, updateCount: store.trackerUpdates.length, emailNewCount: cards.filter((c) => c.cameByEmailNotInTrackerBefore).length };
}

export function archiveView(store: Store): ArchiveView {
  const weeks = new Map<string, ArchiveWeek>();
  const items = [...store.items].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || byId(a, b));
  for (const item of items) {
    const weekStart = mondayOf(item.receivedAt);
    let w = weeks.get(weekStart);
    if (!w) {
      w = { weekStart, label: `Week of ${fmtDate(weekStart)}`, documents: [] };
      weeks.set(weekStart, w);
    }
    const doc: ArchiveDocument = {
      itemId: item.itemId,
      fileName: item.fileName,
      receivedAt: item.receivedAt,
      source: item.source,
      sourceLabel: SOURCE_LABELS[item.source],
      documentUrl: documentUrl(item),
      state: item.state,
      payee: store.drafts[item.itemId]?.payee ?? null,
    };
    w.documents.push(doc);
  }
  return { weeks: [...weeks.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart)) };
}

export function parcelLookupView(store: Store, query: string): ParcelLookupView {
  const result = findParcelText(query, loadParcels());
  const parcel = result.kind === "one" ? result.parcel : null;
  return {
    query,
    result,
    systemProperty: parcel ? (store.systemProperties.find((p) => p.parcelId === parcel.parcelId) ?? null) : null,
    entity: parcel ? (store.entities.find((e) => e.name === parcel.holdingCompany) ?? null) : null,
  };
}
