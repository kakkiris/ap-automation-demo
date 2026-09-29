import type { Account, Bill, BillFields, DemoEvent, Exception, RunReport, Store } from "../types";
import { addDays, addMonths, mid, inRange } from "./dates";
import { indexLedger, linesFor, tagAccountProperty } from "./ledger";
import { invoiceNumberFor } from "./export";

export type Canned = Record<string, BillFields>;

const UNDO_SKIP = new Set(["undo", "undo_label"]);

export function snapshot(store: Store, label: string): void {
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(store)) if (!UNDO_SKIP.has(k)) copy[k] = v;
  store.undo = JSON.stringify(copy);
  store.undo_label = label;
}

export function undoLast(store: Store): string | null {
  if (!store.undo) return null;
  const label = store.undo_label;
  const restored = JSON.parse(store.undo) as Record<string, unknown>;
  for (const [k, v] of Object.entries(restored)) (store as unknown as Record<string, unknown>)[k] = v;
  store.undo = null;
  store.undo_label = null;
  return label;
}

let eventSeq = 1;
export function logEvent(store: Store, e: Omit<DemoEvent, "id">): DemoEvent {
  const ev = { id: `EV-${store.events.length + 1}-${eventSeq++}`, ...e };
  store.events.push(ev);
  return ev;
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// Suggest the meter for a bill with no account on record, by printed meter number,
// exact service address, then plain string similarity. No model.
export function suggestMeter(store: Store, bill: Bill): { meter_id: string; reason: string; exact: boolean } | null {
  const meters = store.meters.filter((m) => m.property_id === bill.property_id && m.kind !== "shared");
  const provider = store.providers.find((p) => p.name === bill.provider);
  const service = provider?.service_type ?? "electric";
  if (bill.meter_as_printed) {
    const m = meters.find((x) => x.meter_number === bill.meter_as_printed);
    if (m) return { meter_id: m.id, reason: `printed meter number ${bill.meter_as_printed} is on the master`, exact: true };
  }
  const units = store.units.filter((u) => u.property_id === bill.property_id);
  const meterForUnit = (unitId: string) => meters.find((m) => m.unit_id === unitId && m.service_type === service) ?? meters.find((m) => m.unit_id === unitId);
  const exact = units.find((u) => normalize(u.address) === normalize(bill.service_address));
  if (exact) {
    const m = meterForUnit(exact.id);
    if (m) return { meter_id: m.id, reason: `service address matches unit ${exact.label}`, exact: true };
  }
  const target = normalize(bill.service_address);
  const unitToken = /unit (\d+)/.exec(target);
  if (unitToken) {
    const u = units.find((x) => Number(x.label) === Number(unitToken[1]));
    const m = u ? meterForUnit(u.id) : null;
    if (m && u) return { meter_id: m.id, reason: `service address names unit ${u.label}`, exact: false };
  }
  let best: { meter_id: string; score: number; label: string } | null = null;
  const targetTokens = new Set(target.split(" "));
  for (const u of units) {
    const tokens = normalize(u.address).split(" ");
    const shared = tokens.filter((t) => targetTokens.has(t)).length;
    const score = shared / Math.max(tokens.length, 1);
    if (score > 0.6 && (!best || score > best.score)) {
      const m = meterForUnit(u.id);
      if (m) best = { meter_id: m.id, score, label: u.label };
    }
  }
  if (best) return { meter_id: best.meter_id, reason: `service address is close to unit ${best.label}`, exact: false };
  if (service === "electric" && !bill.service_address.includes("Unit")) {
    const house = meters.find((m) => m.kind === "house" && m.service_type === "electric" && !store.accounts.some((a) => a.meter_id === m.id));
    if (house) return { meter_id: house.id, reason: `house meter with no account on record (${house.location_note ?? "house"})`, exact: false };
  }
  return null;
}

export function trailingAverage(store: Store, account_number: string, month: string): number {
  const ix = indexLedger(storeWithTags(store));
  const months = [addMonths(month, -3), addMonths(month, -2), addMonths(month, -1)];
  const sums = months.map((m) => linesFor(ix, account_number, m).reduce((n, x) => n + x.line.amount, 0));
  const present = sums.filter((s) => s > 0);
  return present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0;
}

function storeWithTags(store: Store): Store {
  const meterById = new Map(store.meters.map((m) => [m.id, m]));
  for (const a of store.accounts) tagAccountProperty(a, meterById.get(a.meter_id)?.property_id ?? "");
  return store;
}

let exceptionSeq = 1;
function addException(store: Store, e: Omit<Exception, "id" | "status" | "resolution">): Exception {
  const ex: Exception = { id: `EX-${store.exceptions.length + 1}-${exceptionSeq++}`, status: "open", resolution: null, ...e };
  store.exceptions.push(ex);
  return ex;
}

export function createLandlordAccount(store: Store, meterId: string, account_number: string, from: string): Account {
  const meter = store.meters.find((m) => m.id === meterId)!;
  const acct: Account = { account_number, provider: meter.provider, meter_id: meterId, holder: "landlord", holder_name: null, active_from: from, active_to: null };
  tagAccountProperty(acct, meter.property_id);
  store.accounts.push(acct);
  return acct;
}

export function accountStart(store: Store, meterId: string, fallback: string): string {
  const meter = store.meters.find((m) => m.id === meterId);
  const unit = meter?.unit_id ? store.units.find((u) => u.id === meter.unit_id) : null;
  if (unit?.move_out && unit.tenant === null) return addDays(unit.move_out, 1);
  const property = store.properties.find((p) => p.id === meter?.property_id);
  if (!unit && property) return property.acquisition_date;
  return fallback;
}

// The month run: every bill in the batch is read, matched, surfaced, or queued.
export function runMonth(store: Store, month: string, canned: Canned): RunReport {
  const report: RunReport = { month, received: { emailed: 0, downloaded: 0 }, fields_read: 0, matched: 0, surfaced: 0, unmapped: 0, meter_differs: 0, duplicates: 0, unusual: 0, upload_rows: 0, files: [], exported: false, imported: false };
  const batch = store.bills.filter((b) => b.arrival_month === month).sort((a, b) => (a.id < b.id ? -1 : 1));
  const seen = new Map<string, Bill>();
  for (const bill of batch) {
    if (bill.status !== "unarrived") continue;
    bill.status = "arrived";
    report.received[bill.arrival_route]++;
    const fields = canned[bill.id];
    if (fields) {
      Object.assign(bill, fields);
      report.fields_read++;
    }
    // The bill carries no invoice number, so one is built from what was just read.
    bill.invoice_number = invoiceNumberFor(bill);
    const dupKey = `${bill.account_number}|${bill.service_start}|${bill.service_end}`;
    const first = seen.get(dupKey);
    if (first) {
      bill.status = "blocked";
      bill.duplicate_of = first.id;
      const ex = addException(store, { type: "duplicate", month, bill_id: bill.id, meter_id: first.meter_id, account_number: bill.account_number, property_id: bill.property_id, suggestion: null, details: { first_bill: first.id, amount: bill.amount, service_start: bill.service_start } });
      bill.exception_id = ex.id;
      report.duplicates++;
      continue;
    }
    seen.set(dupKey, bill);
    const account = store.accounts.find((a) => a.account_number === bill.account_number && a.holder === "landlord" && inRange(mid(month), a.active_from, a.active_to)) ?? store.accounts.find((a) => a.account_number === bill.account_number);
    if (account) {
      bill.meter_id = account.meter_id;
      bill.status = "matched";
      report.matched++;
      const meter = store.meters.find((m) => m.id === account.meter_id)!;
      if (bill.meter_as_printed && meter.meter_number && bill.meter_as_printed !== meter.meter_number) {
        const ex = addException(store, { type: "meter_differs", month, bill_id: bill.id, meter_id: meter.id, account_number: bill.account_number, property_id: bill.property_id, suggestion: null, details: { printed: bill.meter_as_printed, master: meter.meter_number } });
        bill.exception_id = ex.id;
        report.meter_differs++;
      }
    } else {
      const s = suggestMeter(store, bill);
      if (s && s.exact) {
        createLandlordAccount(store, s.meter_id, bill.account_number, accountStart(store, s.meter_id, bill.service_start));
        bill.meter_id = s.meter_id;
        bill.status = "surfaced";
        report.surfaced++;
        logEvent(store, { month, mechanism: "bills", kind: "account_added", count: 1, note: `${bill.account_number} surfaced by bill ${bill.id}: ${s.reason}` });
      } else {
        bill.status = "unmapped";
        const ex = addException(store, { type: "unmapped", month, bill_id: bill.id, meter_id: null, account_number: bill.account_number, property_id: bill.property_id, suggestion: s ? { meter_id: s.meter_id, reason: s.reason } : null, details: { service_address: bill.service_address, meter_as_printed: bill.meter_as_printed, amount: bill.amount } });
        bill.exception_id = ex.id;
        report.unmapped++;
      }
    }
    if (bill.status === "matched" || bill.status === "surfaced") {
      const avg = trailingAverage(store, bill.account_number, month);
      if (avg > 0 && bill.amount > 2.5 * avg) {
        const ex = addException(store, { type: "unusual_amount", month, bill_id: bill.id, meter_id: bill.meter_id, account_number: bill.account_number, property_id: bill.property_id, suggestion: null, details: { amount: bill.amount, trailing_average: Math.round(avg * 100) / 100, ratio: Math.round((bill.amount / avg) * 10) / 10 } });
        bill.exception_id = bill.exception_id ?? ex.id;
        report.unusual++;
      }
    }
  }
  store.runs[month] = report;
  store.operator_steps.run = true;
  return report;
}
