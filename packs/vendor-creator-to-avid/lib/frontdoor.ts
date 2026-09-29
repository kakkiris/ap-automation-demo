// The front door: flag each incoming invoice against the two masters the moment it lands.
// Same matcher as the sync, run over the masters alone: a human decision on a pair does not
// change the flag, only a record in Avid does (a synced copy turns a payee known). Days in
// queue count from the received date to the demo date, never to the wall clock.

import type { FrontDoorPayload, IncomingInvoice, InvoiceFlag, InvoiceRow, Store } from "./types";
import { FLAG_LABELS } from "./types";
import { sameNormalizedName } from "./normalize";
import { matchVendor, type MatchView } from "./match";

type FrontDoorView = MatchView & Pick<Store, "demo_date">;

const DAY_MS = 86_400_000;

function utcDay(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Whole days from one YYYY-MM-DD date to another. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcDay(toIso) - utcDay(fromIso)) / DAY_MS);
}

/** Flag one invoice: known, first_seen, yardi_only, or near_match, with the matched ids. */
export function flagInvoice(store: FrontDoorView, invoice: IncomingInvoice): IncomingInvoice {
  const daysInQueue = daysBetween(invoice.received_at, store.demo_date);
  const yardi = store.yardi_vendors.find((v) => sameNormalizedName(invoice.payee_name, v.name));
  if (!yardi) {
    const avid = store.avid_vendors.find((a) => sameNormalizedName(invoice.payee_name, a.name));
    return { ...invoice, matched_yardi_vendor_id: null, matched_avid_vendor_id: avid ? avid.avid_vendor_id : null, flag: "first_seen", days_in_queue: daysInQueue };
  }
  const outcome = matchVendor(yardi, store.avid_vendors, store.mode);
  let flag: InvoiceFlag;
  let avidVendorId: string | null;
  if (outcome.action === "skip_exact") {
    flag = "known";
    avidVendorId = outcome.avid_vendor_id;
  } else if (outcome.action === "hold") {
    flag = "near_match";
    avidVendorId = outcome.candidate ? outcome.candidate.avid_vendor_id : outcome.avid_vendor_id;
  } else {
    flag = "yardi_only";
    avidVendorId = null;
  }
  return { ...invoice, matched_yardi_vendor_id: yardi.yardi_vendor_id, matched_avid_vendor_id: avidVendorId, flag, days_in_queue: daysInQueue };
}

function invoiceRows(store: Store): InvoiceRow[] {
  return store.incoming_invoices.map((inv) => {
    const yardi = inv.matched_yardi_vendor_id ? store.yardi_vendors.find((v) => v.yardi_vendor_id === inv.matched_yardi_vendor_id) : undefined;
    const avid = inv.matched_avid_vendor_id ? store.avid_vendors.find((v) => v.avid_vendor_id === inv.matched_avid_vendor_id) : undefined;
    return { ...inv, matched_yardi_name: yardi ? yardi.name : null, matched_avid_name: avid ? avid.name : null, flag_label: FLAG_LABELS[inv.flag] };
  });
}

/** "Receive invoices": flag the day's arrivals in place and return the rows for the screen. */
export function receiveInvoices(store: Store): InvoiceRow[] {
  store.incoming_invoices = store.incoming_invoices.map((inv) => flagInvoice(store, inv));
  store.invoices_received = true;
  return invoiceRows(store);
}

export function frontDoorPayload(store: Store): FrontDoorPayload {
  return { demo_date: store.demo_date, received: store.invoices_received, invoices: store.invoices_received ? invoiceRows(store) : [] };
}
