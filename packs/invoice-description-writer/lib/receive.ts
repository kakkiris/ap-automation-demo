// Receive invoices: the one day's arrivals. The reading step is async; everything after it is plain code.
import { checkExtraction } from "./checks";
import { describeInvoice } from "./describe";
import { extractInvoice, type ExtractOptions, type ExtractResult } from "./model";
import { suggestGl } from "./suggest";
import { inboxView } from "./views";
import type { Extraction, InboxPayload, Invoice, Store } from "./types";

/** A utility bill is routed out; nothing is read for it. */
export function routeUtility(store: Store, invoice: Invoice): void {
  invoice.status = "routed";
  delete store.extractions[invoice.invoice_id];
  delete store.descriptions[invoice.invoice_id];
  delete store.suggestions[invoice.invoice_id];
}

/** Applies one reading to the store: checks, then description and suggestion, or manual. Pure apart from the store writes. */
export function ingestExtraction(store: Store, invoice: Invoice, result: ExtractResult): Extraction {
  const id = invoice.invoice_id;
  const check = checkExtraction(result.fields, store.vendors, result.source);
  const extraction: Extraction = {
    invoice_id: id,
    source: result.source,
    fields: result.fields,
    status: check.status,
    missing: check.missing,
    reasons: check.reasons,
    resolved_vendor_id: check.resolved_vendor_id,
  };
  store.extractions[id] = extraction;
  invoice.extraction_status = check.status;
  if (check.status === "read") {
    const vendor = check.resolved_vendor_id ? store.vendors.find((v) => v.vendor_id === check.resolved_vendor_id) : undefined;
    const f = result.fields;
    store.descriptions[id] = {
      invoice_id: id,
      ...describeInvoice({
        invoice_type: invoice.invoice_type,
        vendor_name: vendor ? vendor.name : (f.vendor_name ?? ""),
        service_short: f.service_short,
        property_code: f.property_hint,
        unit_label: f.unit_hint,
        service_from: f.service_from,
        service_to: f.service_to,
        account_number: f.account_number,
        meter_number: f.meter_number,
      }),
    };
    store.suggestions[id] = { invoice_id: id, ...suggestGl(check.resolved_vendor_id, store.coding_history) };
    invoice.status = "ready";
  } else {
    delete store.descriptions[id];
    delete store.suggestions[id];
    invoice.status = "manual";
  }
  return extraction;
}

/** Idempotent: once received, returns the current inbox without reading anything again. */
export async function receiveInvoices(store: Store, options: ExtractOptions = {}): Promise<InboxPayload> {
  if (store.received) return inboxView(store);
  const results = await Promise.all(
    store.invoices.map((invoice) => (invoice.invoice_type === "utility" ? Promise.resolve(null) : extractInvoice(invoice, options))),
  );
  store.invoices.forEach((invoice, i) => {
    const result = results[i];
    if (result === null) routeUtility(store, invoice);
    else ingestExtraction(store, invoice, result);
  });
  store.received = true;
  return inboxView(store);
}
