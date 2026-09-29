// Small inline seed built from the pack's example rows. Used by every unit test until the
// real seed.json lands; the seed-level test in receive.test.ts loads the real file.
import path from "node:path";
import type { CodingHistory, GlAccount, Invoice, Seed, Vendor } from "../types";

export const FIXTURE_DIR = path.join(process.cwd(), "packs", "invoice-description-writer", "lib", "__tests__", "fixtures");
export const FIXTURE_CANNED_DIR = path.join(FIXTURE_DIR, "canned");
export const FIXTURE_PUBLIC_DIR = path.join(FIXTURE_DIR, "public");

export const GL_ACCOUNTS: GlAccount[] = [
  { gl_code: "6110", gl_name: "Electric" },
  { gl_code: "6120", gl_name: "Water and sewer" },
  { gl_code: "6310", gl_name: "Repairs and maintenance" },
  { gl_code: "6320", gl_name: "Roofing repairs" },
  { gl_code: "6420", gl_name: "Landscaping" },
  { gl_code: "6510", gl_name: "Plumbing repairs" },
  { gl_code: "6520", gl_name: "Plumbing capital" },
  { gl_code: "7010", gl_name: "Legal" },
  { gl_code: "7110", gl_name: "Professional fees" },
  { gl_code: "7210", gl_name: "Supplies" },
  { gl_code: "7310", gl_name: "Cleaning" },
  { gl_code: "7410", gl_name: "Pest control" },
];

export const VENDORS: Vendor[] = [
  { vendor_id: "V-01", name: "Coral Ridge Roofing", service_type: "multi", default_gl: null },
  { vendor_id: "V-03", name: "Tidewater Plumbing", service_type: "multi", default_gl: null },
  { vendor_id: "V-05", name: "Harbor Elevator Service", service_type: "single", default_gl: "6310" },
  { vendor_id: "V-09", name: "Sunline Power", service_type: "single", default_gl: "6110" },
  { vendor_id: "V-12", name: "Palmetto Pest Control", service_type: "single", default_gl: "7410" },
  { vendor_id: "V-14", name: "Keys Gate Fencing", service_type: "single", default_gl: null },
];

export const CODING_HISTORY: CodingHistory[] = [
  { vendor_id: "V-01", gl_code: "6320", gl_name: "Roofing repairs", count: 14, last_used: "2026-08-21" },
  { vendor_id: "V-01", gl_code: "6310", gl_name: "Repairs and maintenance", count: 2, last_used: "2026-05-03" },
  { vendor_id: "V-03", gl_code: "6510", gl_name: "Plumbing repairs", count: 9, last_used: "2026-08-27" },
  { vendor_id: "V-03", gl_code: "6520", gl_name: "Plumbing capital", count: 6, last_used: "2026-07-15" },
  { vendor_id: "V-05", gl_code: "6310", gl_name: "Repairs and maintenance", count: 7, last_used: "2026-08-12" },
  { vendor_id: "V-09", gl_code: "6110", gl_name: "Electric", count: 8, last_used: "2026-08-10" },
  { vendor_id: "V-12", gl_code: "7410", gl_name: "Pest control", count: 11, last_used: "2026-08-19" },
];

function invoice(partial: Partial<Invoice> & { invoice_id: string; vendor_id: string }): Invoice {
  const id = partial.invoice_id;
  return {
    property_code: "PR",
    unit_label: null,
    invoice_number: `${id}-N`,
    invoice_date: "2026-08-28",
    amount: 100,
    due_date: "2026-09-27",
    service_from: null,
    service_to: null,
    account_number: null,
    meter_number: null,
    invoice_type: "service",
    pdf_path: `/demo/invoice-description-writer/${id}.pdf`,
    preview_path: `/demo/invoice-description-writer/${id}.svg`,
    service_short: null,
    scripted: false,
    extraction_status: "read",
    status: "ready",
    ...partial,
  };
}

export const INVOICES: Invoice[] = [
  invoice({ invoice_id: "INV-3007", vendor_id: "V-01", property_code: "PR", unit_label: "PR-12", invoice_number: "CR-88213", invoice_date: "2026-08-28", amount: 2400, due_date: "2026-09-27", service_from: "2026-08-24", service_to: "2026-08-26", service_short: "roof leak repair", scripted: true }),
  invoice({ invoice_id: "INV-3008", vendor_id: "V-01", property_code: "BW", unit_label: "BW-02", invoice_number: "CR-88230", invoice_date: "2026-08-29", amount: 760.5, due_date: "2026-09-28", service_from: "2026-08-27", service_to: "2026-08-27", service_short: "gutter reseal", scripted: false }),
  invoice({ invoice_id: "INV-3012", vendor_id: "V-12", property_code: "LK", unit_label: "LK-04", invoice_number: "PP-2210", invoice_date: "2026-08-27", amount: 185, due_date: "2026-09-26", service_short: "quarterly pest treatment", scripted: true }),
  invoice({ invoice_id: "INV-3019", vendor_id: "V-14", property_code: "PR", unit_label: "PR-03", invoice_number: "KG-1044", invoice_date: "2026-08-27", amount: 1250, due_date: "2026-09-26", service_from: "2026-08-20", service_to: "2026-08-21", service_short: "fence panel replacement", scripted: true }),
  invoice({ invoice_id: "INV-3021", vendor_id: "V-12", property_code: "BW", unit_label: "BW-11", invoice_number: "PP-2231", invoice_date: "2026-08-28", amount: 210, due_date: "2026-09-27", service_from: "2026-08-25", service_to: "2026-08-25", service_short: "rodent bait service", scripted: true, extraction_status: "failed", status: "manual" }),
  invoice({ invoice_id: "INV-3025", vendor_id: "V-09", property_code: "PR", unit_label: null, invoice_number: "SP-77120", invoice_date: "2026-08-25", amount: 312.4, due_date: "2026-09-15", service_from: "2026-07-20", service_to: "2026-08-19", account_number: "9912345678", meter_number: "M912345678", invoice_type: "utility", service_short: "electric service", scripted: true, status: "routed" }),
  invoice({ invoice_id: "INV-3030", vendor_id: "V-03", property_code: "BW", unit_label: "BW-07", invoice_number: "TP-5531", invoice_date: "2026-08-29", amount: 980, due_date: "2026-09-28", service_from: "2026-08-27", service_to: "2026-08-27", service_short: "water heater replacement", scripted: true }),
  invoice({ invoice_id: "INV-3033", vendor_id: "V-05", property_code: "LK", unit_label: null, invoice_number: "HE-3390", invoice_date: "2026-08-30", amount: 640, due_date: "2026-09-29", service_from: "2026-08-01", service_to: "2026-08-31", account_number: "9955512340", service_short: "elevator service contract", scripted: true }),
];

export function fixtureSeed(): Seed {
  return structuredClone({ vendors: VENDORS, gl_accounts: GL_ACCOUNTS, coding_history: CODING_HISTORY, invoices: INVOICES });
}

/** Options that keep every extraction in the unit tests on the fixture files and off the network. */
export function offlineOptions(extra: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {}) {
  return { env: extra.env ?? {}, fetchImpl: extra.fetchImpl, cannedDir: FIXTURE_CANNED_DIR, publicDir: FIXTURE_PUBLIC_DIR };
}
