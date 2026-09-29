import type { Account, Bill, LedgerLine, Meter, Property, Provider, Store, Unit } from "../types";
import { monthsBetween } from "../lib/dates";

export const MONTHS = monthsBetween("2026-01", "2026-09");

export function property(o: Partial<Property> = {}): Property {
  return { id: "P01", code: "0999001", name: "Test Park", street: "1 Test Way", city: "Westhaven", unit_count: 4, acquisition_date: "2024-01-01", water_provider: "City of Westhaven", bank_gl: "910001", recently_acquired: false, ...o };
}

export function unit(id: string, o: Partial<Unit> = {}): Unit {
  const base: Unit = { id, property_id: "P01", label: id.slice(-2), address: `1 Test Way Unit ${id.slice(-2)}`, square_feet: 2000, tenant: "Kestrel Bikes", move_in: "2024-01-01", move_out: null, previous_move_out: null, occupancy: {}, tenant_history: {}, who_pays: "tenant", payer_source: "system" };
  const u = { ...base, ...o };
  for (const m of MONTHS) {
    if (!(m in u.occupancy)) u.occupancy[m] = u.tenant ? "occupied" : "vacant";
    if (!(m in u.tenant_history)) u.tenant_history[m] = u.tenant;
  }
  return u;
}

export function meter(id: string, o: Partial<Meter> = {}): Meter {
  return { id, property_id: "P01", service_type: "electric", kind: "unit", unit_id: null, units_served: [], provider: "Fairshore Power", location_note: null, meter_number: `M9${id.slice(2)}00`, notes: [], ...o };
}

export function account(account_number: string, meter_id: string, o: Partial<Account> = {}): Account {
  return { account_number, provider: "Fairshore Power", meter_id, holder: "landlord", holder_name: null, active_from: "2026-01-01", active_to: null, ...o };
}

export function line(o: Partial<LedgerLine> = {}): LedgerLine {
  return { id: `LL-${Math.random().toString(36).slice(2, 8)}`, payee_code: "v990001", payee_name: "Fairshore Power", description: "07/01 to 07/31", control_number: "C1", property_code: "0999001", property_id: "P01", invoice_date: `${o.post_month ?? "2026-08"}-01`, payment_method: "Check", post_month: "2026-08", gl_code: "950010", gl_name: "Electricity non-recoverable", invoice_number: "", amount: 100, due_date: "2026-08-20", unpaid_amount: 0, payment_number: "PN1", payment_date: "2026-08-15", confirmed_account: null, ...o };
}

export function bill(o: Partial<Bill> = {}): Bill {
  return { id: "BILL-1", provider: "Fairshore Power", account_number: "9900000001", service_address: "1 Test Way Unit 01", service_start: "2026-07-01", service_end: "2026-07-31", amount: 100, meter_as_printed: null, arrival_month: "2026-08", arrival_route: "downloaded", status: "exported", property_id: "P01", meter_id: null, description: null, invoice_number: null, exception_id: null, duplicate_of: null, ...o };
}

export const PROVIDERS: Provider[] = [
  { name: "Fairshore Power", service_type: "electric", delivery_route: "download", billing_status: "current", vendor_code: "v990001", phone_label: "Fairshore Power business line" },
  { name: "City of Westhaven", service_type: "water", delivery_route: "download", billing_status: "current", vendor_code: "v990002", phone_label: "utility billing" },
  { name: "City of Rivermouth", service_type: "water", delivery_route: "emails", billing_status: "behind", vendor_code: "v990003", phone_label: "utility billing" },
];

export function store(o: Partial<Store> = {}): Store {
  return {
    demo_month: "2026-08", months: MONTHS, properties: [property()], units: [], meters: [], accounts: [], bills: [], ledger_lines: [], providers: PROVIDERS,
    discrepancies: [], discrepancies_cleared: {}, provider_account_list: [], site_visit_results: [], exceptions: [], scripted: {},
    runs: {}, events: [], bill_backs: [], transfer_drafts: [], call_notes: [], checklists: [], verify_items: [], done_actions: [], snapshots: {}, provider_import_done: false, site_visit_done: false, operator_steps: {}, undo: null, undo_label: null,
    ...o,
  };
}
