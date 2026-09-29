import type { Account, Bill, Cell, CellStatus, Exception, GridRow, LineMatch, MatchKind, Meter, MonthCounts, Property, RowFlags, SiteCounts, SiteSummary, Store, Unit } from "../types";
import { addMonths, inRange, mid, monthKey } from "./dates";
import { indexLedger, linesFor, paidState, tagAccountProperty, type LedgerIndex } from "./ledger";

export interface Indexed {
  store: Store;
  unitById: Map<string, Unit>;
  propertyById: Map<string, Property>;
  meterById: Map<string, Meter>;
  accountsByMeter: Map<string, Account[]>;
  metersByProperty: Map<string, Meter[]>;
  providerBehind: Set<string>;
  ledger: LedgerIndex;
  billsByAccountMonth: Map<string, Bill>;
  openExceptions: Exception[];
}

export function indexStore(store: Store): Indexed {
  const meterById = new Map(store.meters.map((m) => [m.id, m]));
  const accountsByMeter = new Map<string, Account[]>();
  for (const a of store.accounts) {
    const meter = meterById.get(a.meter_id);
    tagAccountProperty(a, meter?.property_id ?? "");
    const list = accountsByMeter.get(a.meter_id) ?? [];
    list.push(a);
    accountsByMeter.set(a.meter_id, list);
  }
  const metersByProperty = new Map<string, Meter[]>();
  for (const m of store.meters) {
    const list = metersByProperty.get(m.property_id) ?? [];
    list.push(m);
    metersByProperty.set(m.property_id, list);
  }
  const billsByAccountMonth = new Map<string, Bill>();
  for (const b of store.bills) {
    if (b.status === "matched" || b.status === "surfaced" || b.status === "exported") {
      const key = `${b.account_number}|${b.arrival_month}`;
      if (!billsByAccountMonth.has(key)) billsByAccountMonth.set(key, b);
    }
  }
  return {
    store,
    unitById: new Map(store.units.map((u) => [u.id, u])),
    propertyById: new Map(store.properties.map((p) => [p.id, p])),
    meterById,
    accountsByMeter,
    metersByProperty,
    providerBehind: new Set(store.providers.filter((p) => p.billing_status === "behind").map((p) => p.name)),
    ledger: indexLedger(store),
    billsByAccountMonth,
    openExceptions: store.exceptions.filter((e) => e.status === "open"),
  };
}

export function activeAccount(accounts: Account[], month: string, holder?: "landlord" | "tenant"): Account | null {
  const d = mid(month);
  return accounts.find((a) => inRange(d, a.active_from, a.active_to) && (!holder || a.holder === holder)) ?? null;
}

export function isOccupied(unit: Unit | null, month: string): boolean {
  return unit?.occupancy[month] === "occupied";
}

export function expectedPayer(meter: Meter, unit: Unit | null, month: string): "landlord" | "tenant" | null {
  if (meter.kind === "shared") return null;
  if (meter.kind === "house" || meter.service_type === "water" || !unit) return "landlord";
  if (!isOccupied(unit, month)) return "landlord";
  // An owner-paid row with a current tenant is one the owner covers; history months of a
  // now-vacant row were tenant-paid.
  return unit.who_pays === "owner" && unit.tenant !== null ? "landlord" : "tenant";
}

function baseCell(meter: Meter, month: string, status: CellStatus): Cell {
  return { meter_id: meter.id, month, status, account_number: null, line_ids: [], match_kind: null, amount: null, months_since_move_in: null, running_total: null };
}

function withLines(cell: Cell, acct: Account, lines: LineMatch[], amount: number, kind: MatchKind | null): Cell {
  return { ...cell, account_number: acct.account_number, line_ids: lines.map((m) => m.line.id), match_kind: kind, amount };
}

export function cellFor(ix: Indexed, meter: Meter, month: string): Cell {
  if (meter.kind === "shared") return baseCell(meter, month, "manual_split");
  const accounts = ix.accountsByMeter.get(meter.id) ?? [];
  const unit = meter.unit_id ? (ix.unitById.get(meter.unit_id) ?? null) : null;
  const payer = expectedPayer(meter, unit, month);
  const landlord = activeAccount(accounts, month, "landlord");
  if (payer === "landlord") {
    if (!landlord) return baseCell(meter, month, "no_account");
    const lines = linesFor(ix.ledger, landlord.account_number, month);
    const bill = ix.billsByAccountMonth.get(`${landlord.account_number}|${month}`) ?? null;
    const state = paidState(bill, lines, ix.ledger);
    if (state.paid) {
      const underInvoice = bill?.invoice_number ? (ix.ledger.byInvoice.get(bill.invoice_number) ?? []) : [];
      const ids = underInvoice.length > 0 ? underInvoice.map((l) => l.id) : lines.map((m) => m.line.id);
      return { ...withLines(baseCell(meter, month, "paid"), landlord, lines, state.sum, state.kind), line_ids: ids };
    }
    const cell = baseCell(meter, month, ix.providerBehind.has(meter.provider) ? "not_yet_billed" : "unpaid");
    return { ...cell, account_number: landlord.account_number };
  }
  if (landlord) {
    const lines = linesFor(ix.ledger, landlord.account_number, month);
    if (lines.length > 0 && unit?.move_in) {
      const months = ix.store.months;
      const start = Math.max(0, months.indexOf(monthKey(unit.move_in)));
      const end = months.indexOf(month);
      let total = 0;
      for (const m of months.slice(start, end + 1)) total += linesFor(ix.ledger, landlord.account_number, m).reduce((n, x) => n + x.line.amount, 0);
      const cell = withLines(baseCell(meter, month, "bill_back"), landlord, lines, Math.round(lines.reduce((n, x) => n + x.line.amount, 0) * 100) / 100, lines[0].kind);
      return { ...cell, months_since_move_in: end - start + 1, running_total: Math.round(total * 100) / 100 };
    }
    return { ...baseCell(meter, month, "transfer_needed"), account_number: landlord.account_number };
  }
  return baseCell(meter, month, "tenant_held");
}

export function rowFlags(ix: Indexed, meter: Meter, month: string): RowFlags {
  const accounts = ix.accountsByMeter.get(meter.id) ?? [];
  const unit = meter.unit_id ? (ix.unitById.get(meter.unit_id) ?? null) : null;
  const occupied = isOccupied(unit, month);
  const landlord = activeAccount(accounts, month, "landlord");
  const payer = expectedPayer(meter, unit, month);
  const prev = addMonths(month, -1);
  const manual_split =
    meter.kind === "shared"
      ? { units: meter.units_served.map((id) => { const u = ix.unitById.get(id)!; return { id, label: u.label, square_feet: u.square_feet }; }), basis: "square feet" }
      : null;
  return {
    no_account_history: accounts.length === 0 && meter.kind !== "shared",
    meter_differs: ix.openExceptions.some((e) => e.type === "meter_differs" && e.meter_id === meter.id),
    check_payer: !!unit && unit.tenant_history[prev] !== undefined && unit.tenant_history[prev] !== unit.tenant_history[month],
    payer_carried_over: !!unit && occupied && unit.who_pays === "owner" && unit.payer_source === "seller_workbook",
    transfer_needed: meter.service_type === "electric" && meter.kind === "unit" && ((occupied && landlord !== null) || (payer === "landlord" && landlord === null)),
    manual_split,
  };
}

export const RULE_TEXT: Record<CellStatus, string> = {
  paid: "landlord expected and the ledger lines under this account sum to the bill",
  unpaid: "landlord expected, no payment found, provider billing current",
  not_yet_billed: "landlord expected, no payment found, provider billing behind",
  tenant_held: "tenant expected, no landlord account active",
  bill_back: "unit occupied, landlord account still active, payment found",
  transfer_needed: "unit occupied, landlord account still active, no payment this month",
  manual_split: "shared meter, split by hand on square feet",
  no_account: "landlord expected, no landlord account on record, so the check cannot run",
};

export function whyStatus(ix: Indexed, meter: Meter, month: string) {
  const cell = cellFor(ix, meter, month);
  const unit = meter.unit_id ? (ix.unitById.get(meter.unit_id) ?? null) : null;
  const accounts = ix.accountsByMeter.get(meter.id) ?? [];
  const active = activeAccount(accounts, month);
  const lineById = new Map(ix.store.ledger_lines.map((l) => [l.id, l]));
  const matchByLine = new Map(ix.ledger.matches.map((m) => [m.line.id, m.kind]));
  return {
    status: cell.status,
    rule: RULE_TEXT[cell.status],
    rent_roll: unit ? `${unit.occupancy[month] ?? "unknown"} on the 15th${unit.tenant_history[month] ? `, ${unit.tenant_history[month]}` : ""}, ${unit.who_pays === "owner" ? "owner pays" : "tenant pays"}${unit.payer_source === "seller_workbook" ? " (carried over, unverified)" : ""}` : meter.kind === "shared" ? "shared meter, no single unit" : "house or master meter, landlord always",
    account: active ? `${active.account_number}, ${active.holder}${active.holder_name ? ` (${active.holder_name})` : ""}, active from ${active.active_from}` : "no account active on the 15th",
    lines: cell.line_ids.map((id) => { const l = lineById.get(id)!; return { id, invoice_number: l.invoice_number, amount: l.amount, gl_name: l.gl_name, kind: matchByLine.get(id) ?? "exact" }; }),
    flags: rowFlags(ix, meter, month),
  };
}

export function sortMeters(a: Meter, b: Meter): number {
  const order = { house: 0, shared: 1, unit: 2 } as const;
  if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
  if (a.service_type !== b.service_type) return a.service_type === "electric" ? -1 : 1;
  return (a.unit_id ?? a.id) < (b.unit_id ?? b.id) ? -1 : 1;
}

export function windowMonths(ix: Indexed, month: string): string[] {
  const all = ix.store.months;
  const end = all.indexOf(month);
  return all.slice(Math.max(0, end - 5), end + 1);
}

export function gridRows(ix: Indexed, propertyId: string, month: string): GridRow[] {
  const months = windowMonths(ix, month);
  return [...(ix.metersByProperty.get(propertyId) ?? [])].sort(sortMeters).map((meter) => ({
    meter,
    unit: meter.unit_id ? (ix.unitById.get(meter.unit_id) ?? null) : null,
    flags: rowFlags(ix, meter, month),
    cells: months.map((m) => cellFor(ix, meter, m)),
  }));
}

export function siteCounts(ix: Indexed, propertyId: string, month: string): SiteCounts {
  const counts: SiteCounts = { unpaid: 0, bill_back: 0, transfer_needed: 0, not_yet_billed: 0, unmapped: 0, no_account: 0 };
  for (const meter of ix.metersByProperty.get(propertyId) ?? []) {
    const c = cellFor(ix, meter, month);
    if (c.status === "unpaid") counts.unpaid++;
    else if (c.status === "bill_back") counts.bill_back++;
    else if (c.status === "transfer_needed") counts.transfer_needed++;
    else if (c.status === "not_yet_billed") counts.not_yet_billed++;
    else if (c.status === "no_account") counts.no_account++;
  }
  counts.unmapped = ix.openExceptions.filter((e) => e.type === "unmapped" && e.property_id === propertyId).length;
  return counts;
}

export function siteSummaries(ix: Indexed, month: string): SiteSummary[] {
  return [...ix.store.properties].sort((a, b) => (a.id < b.id ? -1 : 1)).map((property) => ({ property, counts: siteCounts(ix, property.id, month) }));
}

export function totalCounts(summaries: SiteSummary[]): SiteCounts {
  const t: SiteCounts = { unpaid: 0, bill_back: 0, transfer_needed: 0, not_yet_billed: 0, unmapped: 0, no_account: 0 };
  for (const s of summaries) for (const k of Object.keys(t) as (keyof SiteCounts)[]) t[k] += s.counts[k];
  return t;
}

export function monthCounts(ix: Indexed, month: string): MonthCounts {
  const totals = totalCounts(siteSummaries(ix, month));
  const monthMatches = ix.ledger.matches.filter((m) => m.line.post_month === month && m.kind !== "unplaced");
  return {
    month,
    ...totals,
    blank_meters: ix.store.meters.filter((m) => m.kind !== "shared" && !m.meter_number).length,
    matched_lines: monthMatches.length,
    exact_lines: monthMatches.filter((m) => m.kind === "exact" || m.kind === "confirmed").length,
  };
}

export interface SweepItem {
  account_number: string;
  meter: Meter;
  property: Property;
  provider: string;
  behind: boolean;
  last_bill_date: string | null;
}

// Accounts on record with no bill in this month's batch, with the last bill date per account.
export function missingBillSweep(ix: Indexed, month: string): SweepItem[] {
  const inBatch = new Set(ix.store.bills.filter((b) => b.arrival_month === month).map((b) => b.account_number));
  const out: SweepItem[] = [];
  for (const a of ix.store.accounts) {
    if (a.holder !== "landlord" || !inRange(mid(month), a.active_from, a.active_to) || inBatch.has(a.account_number)) continue;
    const meter = ix.meterById.get(a.meter_id);
    if (!meter) continue;
    const dates = ix.store.bills.filter((b) => b.account_number === a.account_number && b.arrival_month < month && b.status !== "unarrived").map((b) => b.service_end);
    const lineDates = ix.ledger.matches.filter((m) => m.account_number === a.account_number).map((m) => m.line.invoice_date);
    const last = [...dates, ...lineDates].sort().pop() ?? null;
    out.push({ account_number: a.account_number, meter, property: ix.propertyById.get(meter.property_id)!, provider: meter.provider, behind: ix.providerBehind.has(meter.provider), last_bill_date: last });
  }
  return out.sort((x, y) => (x.provider < y.provider ? -1 : x.provider > y.provider ? 1 : x.property.id < y.property.id ? -1 : 1));
}

export function unplacedLines(ix: Indexed) {
  return ix.ledger.unplaced;
}
