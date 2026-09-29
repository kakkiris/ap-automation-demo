import type { InboxItem, InvoiceDraft, Source, Store, TrackerCard, TrackerReason, TrackerUpdate } from "./types";
import { fmtCents } from "./money";
import { fmtDate, stamp } from "./clock";

// Tracker messages: what would be posted to each property's card when an invoice is
// captured, submitted and paid. One update per invoice, parcel and reason.

const SKIPPED_CARD_NUMBERS = new Set([8812]);

export function ensureCard(store: Store, parcelId: string): { card: TrackerCard; created: boolean } {
  const existing = store.trackerCards.find((c) => c.parcelId === parcelId);
  if (existing) return { card: existing, created: false };
  while (SKIPPED_CARD_NUMBERS.has(store.nextCardNumber) || store.trackerCards.some((c) => c.cardRef === `T-${store.nextCardNumber}`)) store.nextCardNumber += 1;
  const card: TrackerCard = { cardRef: `T-${store.nextCardNumber}`, parcelId, createdInDemo: true };
  store.nextCardNumber += 1;
  store.trackerCards.push(card);
  return { card, created: true };
}

/** The parcels an invoice touches: the single resolution, or each resolved splitter line. */
export function draftParcels(draft: InvoiceDraft): { parcelId: string; lineAmount: number | null }[] {
  if (draft.mode === "splitter") {
    const out: { parcelId: string; lineAmount: number | null }[] = [];
    for (const line of draft.lines) if (line.parcelId && !out.some((o) => o.parcelId === line.parcelId)) out.push({ parcelId: line.parcelId, lineAmount: line.amount });
    return out;
  }
  return draft.propertyResolution ? [{ parcelId: draft.propertyResolution.parcelId, lineAmount: null }] : [];
}

function arrivedBy(source: Source): string {
  switch (source) {
    case "email":
      return "arrived by email";
    case "trackerApproved":
      return "arrived from Monday.com";
    case "utilityPortal":
      return "arrived from the utility portal";
    case "mailScan":
      return "arrived by mail";
  }
}

export function trackerMessage(item: InboxItem, draft: InvoiceDraft, reason: TrackerReason, lineAmount: number | null): string {
  const invoice = draft.invoiceNumber ? `Invoice ${draft.invoiceNumber}` : "An invoice";
  const payee = draft.payee ? ` from ${draft.payee}` : "";
  const amount = draft.amount !== null ? ` for ${fmtCents(draft.amount)}` : "";
  const share = draft.mode === "splitter" && lineAmount !== null ? ` (this property ${fmtCents(lineAmount)})` : "";
  const head = `${invoice}${payee}${amount}${share}`;
  switch (reason) {
    case "captured":
      return `${head} ${arrivedBy(item.source)} and was captured for this property.`;
    case "submitted":
      return `${head} was submitted for approval.`;
    case "paid":
      return `${head} was paid on ${fmtDate(draft.paidAt ?? "")}.`;
  }
}

export function postUpdates(store: Store, item: InboxItem, draft: InvoiceDraft, reason: TrackerReason): TrackerUpdate[] {
  const posted: TrackerUpdate[] = [];
  for (const { parcelId, lineAmount } of draftParcels(draft)) {
    if (store.trackerUpdates.some((u) => u.itemId === item.itemId && u.parcelId === parcelId && u.reason === reason)) continue;
    const { card, created } = ensureCard(store, parcelId);
    const update: TrackerUpdate = {
      updateId: `U-${store.nextUpdateNumber}`,
      cardRef: card.cardRef,
      parcelId,
      itemId: item.itemId,
      source: item.source,
      message: trackerMessage(item, draft, reason, lineAmount),
      createdAt: stamp(store),
      reason,
      newCard: created,
    };
    store.nextUpdateNumber += 1;
    store.trackerUpdates.push(update);
    posted.push(update);
  }
  return posted;
}

export const postCaptured = (store: Store, item: InboxItem, draft: InvoiceDraft) => postUpdates(store, item, draft, "captured");
export const postSubmitted = (store: Store, item: InboxItem, draft: InvoiceDraft) => postUpdates(store, item, draft, "submitted");
export const postPaid = (store: Store, item: InboxItem, draft: InvoiceDraft) => postUpdates(store, item, draft, "paid");
