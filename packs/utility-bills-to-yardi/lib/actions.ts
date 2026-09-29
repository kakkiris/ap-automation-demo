import type { Bill, CallNote, Cell, Exception, Meter, Property, Store, TransferDraft, Unit } from "../types";
import { addDays, fmtDate, fmtMoney, mid, inRange } from "./dates";
import { billBackRowFor } from "./export";
import { siteChecklist, transferByDate } from "./mechanisms";
import { logEvent, snapshot } from "./run";
import { cellFor, indexStore, missingBillSweep, rowFlags, sortMeters, type Indexed, type SweepItem } from "./status";

export interface ActionItem {
  key: string;
  meter: Meter;
  unit: Unit | null;
  property: Property;
  cell: Cell;
  done: boolean;
}

export interface ActionList {
  month: string;
  pay: (ActionItem & { file: string | null })[];
  bill_back: ActionItem[];
  transfer: (ActionItem & { kind: "tenant_letter" | "provider_request" })[];
  call: { provider: string; behind: boolean; items: (SweepItem & { done: boolean; note: string | null })[] }[];
  verify: { property: Property; meters: Meter[]; reasons: string[]; done: boolean }[];
  resolve: Exception[];
}

function fileFor(store: Store, bill: Bill | undefined): string | null {
  if (!bill || bill.status !== "exported") return null;
  const property = store.properties.find((p) => p.id === bill.property_id)!;
  const provider = store.providers.find((p) => p.name === bill.provider)!;
  return `${property.code}-${provider.vendor_code}-${bill.arrival_month}.csv`;
}

export function actionList(store: Store, propertyId: string | null, month: string): ActionList {
  const ix: Indexed = indexStore(store);
  const props = propertyId ? [ix.propertyById.get(propertyId)!] : [...store.properties].sort((a, b) => (a.id < b.id ? -1 : 1));
  const out: ActionList = { month, pay: [], bill_back: [], transfer: [], call: [], verify: [], resolve: [] };
  const done = new Set(store.done_actions);
  for (const property of props) {
    const verifyMeters: Meter[] = [];
    const reasons: string[] = [];
    for (const meter of [...(ix.metersByProperty.get(property.id) ?? [])].sort(sortMeters)) {
      const unit = meter.unit_id ? (ix.unitById.get(meter.unit_id) ?? null) : null;
      const cell = cellFor(ix, meter, month);
      const flags = rowFlags(ix, meter, month);
      const base = { meter, unit, property, cell };
      if (cell.status === "unpaid") {
        const bill = store.bills.find((b) => b.arrival_month === month && b.account_number === cell.account_number);
        out.pay.push({ ...base, key: `pay|${meter.id}|${month}`, done: bill?.status === "exported", file: fileFor(store, bill) });
      }
      if (cell.status === "bill_back") out.bill_back.push({ ...base, key: `billback|${meter.id}|${month}`, done: done.has(`billback|${meter.id}|${month}`) });
      if (flags.transfer_needed && (cell.status === "bill_back" || cell.status === "transfer_needed" || cell.status === "no_account")) {
        out.transfer.push({ ...base, key: `transfer|${meter.id}|${month}`, done: done.has(`transfer|${meter.id}|${month}`), kind: cell.status === "no_account" ? "provider_request" : "tenant_letter" });
      }
      if (flags.no_account_history || !meter.meter_number) {
        if (meter.kind !== "shared") verifyMeters.push(meter);
      }
    }
    for (const v of store.verify_items.filter((x) => x.property_id === property.id && x.month === month)) {
      const m = ix.meterById.get(v.meter_id);
      if (m && !verifyMeters.includes(m)) verifyMeters.push(m);
      reasons.push(`${m?.id ?? v.meter_id}: ${v.reason}`);
    }
    if (verifyMeters.length) out.verify.push({ property, meters: verifyMeters, reasons, done: done.has(`verify|${property.id}|${month}`) });
    out.resolve.push(...store.exceptions.filter((e) => e.property_id === property.id && e.status !== "resolved"));
  }
  const sweep = missingBillSweep(ix, month).filter((s) => !propertyId || s.property.id === propertyId);
  const byProvider = new Map<string, { provider: string; behind: boolean; items: (SweepItem & { done: boolean; note: string | null })[] }>();
  for (const s of sweep) {
    const g = byProvider.get(s.provider) ?? { provider: s.provider, behind: s.behind, items: [] };
    const note = store.call_notes.find((c) => c.account_number === s.account_number && c.month === month);
    g.items.push({ ...s, done: Boolean(note), note: note?.note ?? null });
    byProvider.set(s.provider, g);
  }
  out.call = [...byProvider.values()].sort((a, b) => b.items.length - a.items.length);
  return out;
}

export function doBillBack(store: Store, meterId: string, month: string) {
  const ix = indexStore(store);
  const meter = ix.meterById.get(meterId);
  if (!meter) throw new Error(`meter ${meterId} not found`);
  const cell = cellFor(ix, meter, month);
  if (cell.status !== "bill_back" || !cell.account_number) throw new Error("this row is not a bill-back candidate this month");
  snapshot(store, `bill back ${meterId}`);
  const row = billBackRowFor(store, month, meterId, cell.account_number, cell.months_since_move_in ?? 1, cell.running_total ?? cell.amount ?? 0);
  if (!row) throw new Error("no tenant on this unit");
  store.bill_backs.push(row);
  store.done_actions.push(`billback|${meterId}|${month}`);
  logEvent(store, { month, mechanism: "exceptions", kind: "account_confirmed", count: 0, note: `bill-back row for ${row.tenant}, ${fmtMoney(row.amount)}` });
  return row;
}

export function doTransfer(store: Store, meterId: string, month: string): TransferDraft {
  const ix = indexStore(store);
  const meter = ix.meterById.get(meterId);
  if (!meter) throw new Error(`meter ${meterId} not found`);
  const unit = meter.unit_id ? ix.unitById.get(meter.unit_id) ?? null : null;
  const property = ix.propertyById.get(meter.property_id)!;
  const landlord = store.accounts.find((a) => a.meter_id === meterId && a.holder === "landlord" && inRange(mid(month), a.active_from, a.active_to)) ?? null;
  snapshot(store, `transfer draft ${meterId}`);
  const by = transferByDate(month);
  let draft: TransferDraft;
  if (landlord && unit?.tenant) {
    const covered = unit.move_in && unit.move_in > landlord.active_from ? unit.move_in : landlord.active_from;
    const text = [
      `To: ${unit.tenant}, unit ${unit.label}, ${property.name}`,
      ``,
      `The electric service for unit ${unit.label} at ${property.street} is still billed to the landlord under account ${landlord.account_number}. The landlord has covered this service from ${fmtDate(covered)}.`,
      ``,
      `Please transfer the account into your name with ${meter.provider} by ${fmtDate(by)}. Charges from ${fmtDate(covered)} will be billed back under your lease.`,
      ``,
      `Meter ${meter.meter_number ?? "(number to be confirmed on site)"}.`,
    ].join("\n");
    draft = { id: `TR-${store.transfer_drafts.length + 1}`, month, meter_id: meterId, unit_id: unit.id, kind: "tenant_letter", text, covered_from: covered, transfer_by: by };
  } else {
    const since = unit?.move_out ? addDays(unit.move_out, 1) : property.acquisition_date;
    const text = [
      `To: ${meter.provider}, business accounts`,
      ``,
      `Please open or transfer electric service into the owner's name for ${unit ? `unit ${unit.label} at ${property.street}` : `${property.street} (${meter.location_note ?? "house meter"})`}, effective ${fmtDate(since)}.`,
      ``,
      `Meter ${meter.meter_number ?? "(number to be confirmed on site)"}. Requested transfer date: ${fmtDate(by)}.`,
    ].join("\n");
    draft = { id: `TR-${store.transfer_drafts.length + 1}`, month, meter_id: meterId, unit_id: unit?.id ?? null, kind: "provider_request", text, covered_from: since, transfer_by: by };
  }
  store.transfer_drafts.push(draft);
  store.done_actions.push(`transfer|${meterId}|${month}`);
  return draft;
}

export function markCalled(store: Store, account_number: string, provider: string, note: string, month: string): CallNote {
  snapshot(store, `call note ${account_number}`);
  const n: CallNote = { id: `CN-${store.call_notes.length + 1}`, month, account_number, provider, note };
  store.call_notes.push(n);
  return n;
}

export function makeChecklist(store: Store, propertyId: string, month: string) {
  snapshot(store, `checklist ${propertyId}`);
  const c = siteChecklist(store, propertyId, month);
  if (!store.done_actions.includes(`verify|${propertyId}|${month}`)) store.done_actions.push(`verify|${propertyId}|${month}`);
  return c;
}
