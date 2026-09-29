// Screen payloads. Every route reads the store through one of these so the ui never guesses.
import { describeInvoice, SERVICE_SEGMENTS, UTILITY_SEGMENTS, SERVICE_TEMPLATE, UTILITY_TEMPLATE, templateFor } from "./describe";
import { PackError } from "./errors";
import { sessionLines } from "./feedback";
import { FIELD_LABELS, FIELD_ORDER, ROUTED_NOTE } from "./labels";
import { formatAmount } from "./money";
import { sortHistory } from "./suggest";
import {
  DESCRIPTION_MAX_LENGTH,
  type FieldReading,
  type InboxItem,
  type InboxPayload,
  type Invoice,
  type SchemePayload,
  type Store,
  type VendorHistoryPayload,
  type VendorSummary,
  type WorkbenchPayload,
} from "./types";

export const NOT_RECEIVED = "Press Receive invoices first.";

function vendorById(store: Store, vendor_id: string | null) {
  return vendor_id ? (store.vendors.find((v) => v.vendor_id === vendor_id) ?? null) : null;
}

function inboxItem(store: Store, invoice: Invoice): InboxItem {
  if (invoice.status === "routed") {
    const vendor = vendorById(store, invoice.vendor_id);
    return {
      invoice_id: invoice.invoice_id,
      vendor_id: invoice.vendor_id,
      vendor_name: vendor ? vendor.name : null,
      property_code: invoice.property_code,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      status: invoice.status,
      note: ROUTED_NOTE,
    };
  }
  const extraction = store.extractions[invoice.invoice_id];
  const f = extraction?.fields;
  return {
    invoice_id: invoice.invoice_id,
    vendor_id: extraction?.resolved_vendor_id ?? null,
    vendor_name: f?.vendor_name ?? null,
    property_code: f?.property_hint ?? null,
    invoice_number: f?.invoice_number ?? null,
    amount: f?.amount ?? null,
    status: invoice.status,
    note: null,
  };
}

export function inboxView(store: Store): InboxPayload {
  if (!store.received) return { received: false, summary: { received: 0, ready: 0, manual: 0, routed: 0 }, items: [] };
  const items = store.invoices.map((invoice) => inboxItem(store, invoice));
  const summary = { received: items.length, ready: 0, manual: 0, routed: 0 };
  for (const item of items) {
    if (item.status === "manual") summary.manual++;
    else if (item.status === "routed") summary.routed++;
    else summary.ready++; // ready, used, and corrected all had a description ready to paste
  }
  return { received: true, summary, items };
}

export function fieldReadings(store: Store, invoice: Invoice): FieldReading[] {
  const extraction = store.extractions[invoice.invoice_id];
  if (!extraction) return [];
  return FIELD_ORDER.map((key) => {
    const raw = extraction.fields[key];
    const value = raw === null ? null : key === "amount" ? formatAmount(raw as number) : String(raw);
    return { key, label: FIELD_LABELS[key], value, read: value !== null };
  });
}

export function workbenchView(store: Store, invoice_id: string): WorkbenchPayload {
  if (!store.received) throw new PackError(NOT_RECEIVED, 409);
  const index = store.invoices.findIndex((i) => i.invoice_id === invoice_id);
  if (index < 0) throw new PackError("No invoice with that id.", 404);
  const invoice = store.invoices[index];
  const routed = invoice.status === "routed";
  const extraction = routed ? null : (store.extractions[invoice_id] ?? null);
  const vendor = routed ? vendorById(store, invoice.vendor_id) : vendorById(store, extraction?.resolved_vendor_id ?? null);
  const description = routed || invoice.status === "manual" ? null : (store.descriptions[invoice_id] ?? null);
  const suggestion = routed || invoice.status === "manual" ? null : (store.suggestions[invoice_id] ?? null);
  const latest = [...store.feedback].reverse().find((f) => f.invoice_id === invoice_id) ?? null;
  return {
    invoice: { invoice_id, invoice_type: invoice.invoice_type, status: invoice.status, pdf_path: invoice.pdf_path, preview_path: invoice.preview_path },
    vendor: vendor ? { vendor_id: vendor.vendor_id, name: vendor.name } : null,
    vendor_name_as_read: extraction?.fields.vendor_name ?? null,
    extraction,
    fields: routed ? [] : fieldReadings(store, invoice),
    description,
    template: description ? templateFor(description.template_id) : null,
    suggestion,
    manual_entry: invoice.status === "manual" && extraction ? extraction.missing.map((k) => FIELD_LABELS[k]) : [],
    routed_note: routed ? ROUTED_NOTE : null,
    feedback: latest,
    gl_accounts: store.gl_accounts,
    prev_id: index > 0 ? store.invoices[index - 1].invoice_id : null,
    next_id: index < store.invoices.length - 1 ? store.invoices[index + 1].invoice_id : null,
    position: index + 1,
    total: store.invoices.length,
  };
}

export function vendorsView(store: Store): { vendors: VendorSummary[] } {
  const vendors = [...store.vendors]
    .sort((a, b) => (a.vendor_id < b.vendor_id ? -1 : a.vendor_id > b.vendor_id ? 1 : 0))
    .map((v) => ({
      vendor_id: v.vendor_id,
      name: v.name,
      service_type: v.service_type,
      default_gl: v.default_gl,
      history_rows: store.coding_history.filter((r) => r.vendor_id === v.vendor_id).length,
    }));
  return { vendors };
}

export function vendorHistoryView(store: Store, vendor_id: string): VendorHistoryPayload {
  const vendor = vendorById(store, vendor_id);
  if (!vendor) throw new PackError("No vendor with that id.", 404);
  const rows = sortHistory(store.coding_history.filter((r) => r.vendor_id === vendor_id)).map((r) => ({ gl_code: r.gl_code, gl_name: r.gl_name, count: r.count, last_used: r.last_used }));
  return { vendor, rows, total: rows.reduce((sum, r) => sum + r.count, 0), session: sessionLines(store, vendor_id) };
}

/** Rendered from the seed records directly, so The house description order works before Receive invoices. */
function exampleFrom(store: Store, preferred: string, invoice_type: Invoice["invoice_type"]) {
  const invoice = store.invoices.find((i) => i.invoice_id === preferred && i.invoice_type === invoice_type) ?? store.invoices.find((i) => i.invoice_type === invoice_type);
  if (!invoice) return { invoice_id: "", text: "" };
  const vendor = vendorById(store, invoice.vendor_id);
  const d = describeInvoice({
    invoice_type: invoice.invoice_type,
    vendor_name: vendor ? vendor.name : "",
    service_short: invoice.service_short,
    property_code: invoice.property_code,
    unit_label: invoice.unit_label,
    service_from: invoice.service_from,
    service_to: invoice.service_to,
    account_number: invoice.account_number,
    meter_number: invoice.meter_number,
  });
  return { invoice_id: invoice.invoice_id, text: d.text };
}

export function schemeView(store: Store): SchemePayload {
  return {
    max_length: DESCRIPTION_MAX_LENGTH,
    templates: [
      { template_id: "service", label: "Service vendor", template: SERVICE_TEMPLATE, segments: SERVICE_SEGMENTS, example: exampleFrom(store, "INV-3007", "service") },
      { template_id: "utility", label: "Utility", template: UTILITY_TEMPLATE, segments: UTILITY_SEGMENTS, example: exampleFrom(store, "INV-3025", "utility") },
    ],
  };
}
