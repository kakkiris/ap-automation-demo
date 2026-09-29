// Inline fixture holding the pack's scripted vendors and invoices. Used by the match, sync,
// and front door tests so they never depend on the generated seed.
import type { AvidVendor, IncomingInvoice, MatchCandidate, Store, YardiVendor } from "../types";

export const yardiVendors: YardiVendor[] = [
  { yardi_vendor_id: "V-Y-0044", name: "Brightline Landscaping", address_line: "200 Palmetto Row", status: "active", created_at: "2025-03-02", tax_id_last4: "1930" },
  { yardi_vendor_id: "V-Y-0117", name: "PW Maintenance LLC", address_line: "41 Marlin Bay Dr", status: "active", created_at: "2026-08-30", tax_id_last4: "4471" },
  { yardi_vendor_id: "V-Y-0119", name: "Tidewater Plumbing Co", address_line: "18 Heron Cove Rd", status: "active", created_at: "2026-01-20", tax_id_last4: "3390" },
  { yardi_vendor_id: "V-Y-0121", name: "Coral Ridge Pressure Washing", address_line: "9 Seagrass Ct", status: "active", created_at: "2026-09-01", tax_id_last4: "2210" },
  { yardi_vendor_id: "V-Y-0130", name: "Old Harbor Fencing", address_line: "3 Cypress Ln", status: "inactive", created_at: "2024-02-11", tax_id_last4: "8804" },
];

export const avidVendors: AvidVendor[] = [
  { avid_vendor_id: "V-A-0031", name: "Brightline Landscaping", address_line: "200 Palmetto Row", created_at: "2025-03-02", source: "seed", tax_id_last4: "1930" },
  { avid_vendor_id: "V-A-0088", name: "P.W. Maintenance", address_line: "41 Marlin Bay Dr", created_at: "2025-11-12", source: "seed", tax_id_last4: "4471" },
  { avid_vendor_id: "V-A-0092", name: "Tidewater Plumbing Supply", address_line: "77 Pelican Point Rd", created_at: "2025-06-14", source: "seed", tax_id_last4: "7712" },
];

export const seededCandidates: MatchCandidate[] = [
  { yardi_vendor_id: "V-Y-0117", avid_vendor_id: "V-A-0088", score: 1, reasons: ["same normalized name", "same address", "suffix difference", "same tax id last four"], decision: "none" },
  { yardi_vendor_id: "V-Y-0119", avid_vendor_id: "V-A-0092", score: 1, reasons: ["similar name", "different address", "different tax id last four"], decision: "none" },
];

export const invoices: IncomingInvoice[] = [
  { invoice_id: "INV-5001", payee_name: "Brightline Landscaping", amount: 920, received_at: "2026-08-31", matched_yardi_vendor_id: null, matched_avid_vendor_id: null, flag: "known", days_in_queue: 0 },
  { invoice_id: "INV-5004", payee_name: "Coral Ridge Pressure Washing", amount: 640, received_at: "2026-09-01", matched_yardi_vendor_id: null, matched_avid_vendor_id: null, flag: "known", days_in_queue: 0 },
  { invoice_id: "INV-5007", payee_name: "Keys Gate Fencing", amount: 1180, received_at: "2026-09-01", matched_yardi_vendor_id: null, matched_avid_vendor_id: null, flag: "known", days_in_queue: 0 },
  { invoice_id: "INV-5009", payee_name: "PW Maintenance", amount: 355, received_at: "2026-08-25", matched_yardi_vendor_id: null, matched_avid_vendor_id: null, flag: "known", days_in_queue: 0 },
];

/** A fresh store built from the fixture, the way createStore builds one from the seed. */
export function fixtureStore(overrides: Partial<Store> = {}): Store {
  return {
    demo_date: "2026-09-01",
    next_yardi_number: 125,
    next_avid_number: 113,
    yardi_vendors: structuredClone(yardiVendors),
    avid_vendors: structuredClone(avidVendors),
    match_candidates: structuredClone(seededCandidates),
    incoming_invoices: structuredClone(invoices),
    mode: "assisted",
    sync_runs: [],
    delta_items: [],
    import_rows: [],
    tasks: [],
    invoices_received: false,
    next_run_number: 1,
    next_task_number: 1,
    ...overrides,
  };
}

export function yardi(id: string): YardiVendor {
  const v = yardiVendors.find((x) => x.yardi_vendor_id === id);
  if (!v) throw new Error(`fixture has no Yardi vendor ${id}`);
  return v;
}
