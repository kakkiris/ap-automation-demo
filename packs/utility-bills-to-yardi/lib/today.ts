import type { Discrepancy, Property, Store } from "../types";
import { indexStore, activeAccount } from "./status";
import { depositsFor, linesFor } from "./ledger";

export const MANUAL_STEPS = [
  "Log into each provider portal and download the bills one at a time",
  "Build the upload file per property by hand",
  "Import to Yardi",
  "Type each paid amount into the month column on every property tab",
  "Paste last month's tenant names into the rent roll tab",
  "Generate the discrepancy comparison",
  "Clear the discrepancy list",
  "Look through vacant units for missing payments",
];

export const DEMO_STEPS = [
  "Capture this month's bills: read, matched, surfaced, or queued",
  "Match bills to meters",
  "Export the upload files to Yardi",
  "Yardi import confirmed: the paid column fills itself",
  "Confirm which account a payment matched, for the few legacy lines",
  "Bill-backs, transfers and calls",
];

export interface TrackerRow {
  block: "common" | "tenant";
  unit: string;
  tenant_or_description: string;
  address_or_serves: string;
  lease_from: string;
  lease_to: string;
  meter_number: string;
  meter_missing: boolean;
  account_number: string;
  account_missing: boolean;
  who_pays: "Owner" | "Tenant" | "";
  deposit: string;
  bill_freq: string;
  due_date: string;
  months: (number | null)[];
  ytd: number;
  last_paid: string;
  notes: string;
}

export interface TrackerTab {
  property: Property;
  header: { utility: string; vendor: string; property_code: string; property_name: string; tracking_year: number };
  common: TrackerRow[];
  tenants: TrackerRow[];
  none_identified: boolean;
}

const YEAR_MONTHS = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);

function hash(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return h;
}

// The tracker as it is kept today: one tab per property, electric only in this replica,
// blank meter and account cells where the client said they are blank.
export function trackerTabs(store: Store): TrackerTab[] {
  const ix = indexStore(store);
  const month = store.demo_month;
  return [...store.properties].sort((a, b) => (a.id < b.id ? -1 : 1)).map((property) => {
    const meters = (ix.metersByProperty.get(property.id) ?? []).filter((m) => m.service_type === "electric");
    const electric = meters[0]?.provider ?? "Fairshore Power";
    const rows: TrackerRow[] = [];
    for (const meter of meters) {
      const unit = meter.unit_id ? ix.unitById.get(meter.unit_id) ?? null : null;
      const accounts = ix.accountsByMeter.get(meter.id) ?? [];
      const active = activeAccount(accounts, month);
      const landlord = activeAccount(accounts, month, "landlord");
      const ownerPays = !unit || unit.occupancy[month] === "vacant" || unit.who_pays === "owner";
      const acct = landlord ?? active;
      const months = YEAR_MONTHS.map((m) => {
        if (!acct || m > month) return null;
        const lines = linesFor(ix.ledger, acct.account_number, m);
        return lines.length ? Math.round(lines.reduce((n, l) => n + l.line.amount, 0) * 100) / 100 : null;
      });
      const ytd = Math.round(months.reduce((n: number, v) => n + (v ?? 0), 0) * 100) / 100;
      const lastIdx = months.map((v, i) => (v ? i : -1)).filter((i) => i >= 0).pop();
      const deposit = acct ? depositsFor(store, acct.account_number)[0] : undefined;
      const h = hash(meter.id);
      rows.push({
        block: meter.kind === "house" ? "common" : "tenant",
        unit: unit ? unit.label : "",
        tenant_or_description: unit ? unit.tenant ?? "VACANT" : meter.location_note ?? "house meter",
        address_or_serves: unit ? unit.address : `${property.street}, ${meter.location_note ?? "common area"}`,
        lease_from: unit?.move_in ?? "",
        lease_to: unit?.move_out ?? "",
        meter_number: meter.meter_number ?? "",
        meter_missing: !meter.meter_number,
        account_number: acct && h % 10 !== 0 ? acct.account_number : "",
        account_missing: !acct || h % 10 === 0,
        who_pays: unit ? (ownerPays ? "Owner" : "Tenant") : "Owner",
        deposit: deposit ? deposit.amount.toFixed(2) : "",
        bill_freq: "Monthly",
        due_date: acct ? `${((h % 20) + 5).toString()}th` : "",
        months,
        ytd,
        last_paid: lastIdx !== undefined ? YEAR_MONTHS[lastIdx] : "",
        notes: unit?.payer_source === "seller_workbook" ? "who pays from seller's workbook" : "",
      });
    }
    const common = rows.filter((r) => r.block === "common");
    return {
      property,
      header: { utility: "Electric", vendor: electric, property_code: property.code, property_name: property.name, tracking_year: 2026 },
      common,
      tenants: rows.filter((r) => r.block === "tenant"),
      none_identified: common.length === 0 || hash(property.id) % 5 === 0,
    };
  });
}

export interface RentRollRow {
  property_code: string;
  property: string;
  unit: string;
  current_tenant: string;
  lease_from: string;
  lease_to: string;
  status: "Occupied" | "Vacant";
  prior_month_tenant: string;
  change_flag: "CHANGED" | "";
}

export function rentRollRows(store: Store): RentRollRow[] {
  const month = store.demo_month;
  const prev = `${month.slice(0, 4)}-${String(Number(month.slice(5)) - 1).padStart(2, "0")}`;
  const byProperty = new Map(store.properties.map((p) => [p.id, p]));
  return store.units.map((u) => {
    const p = byProperty.get(u.property_id)!;
    const current = u.tenant_history[month] ?? "";
    const prior = u.tenant_history[prev] ?? "";
    return { property_code: p.code, property: p.name, unit: u.label, current_tenant: current || "VACANT", lease_from: u.move_in ?? "", lease_to: u.move_out ?? "", status: u.occupancy[month] === "occupied" ? "Occupied" : "Vacant", prior_month_tenant: prior || "VACANT", change_flag: current !== prior ? "CHANGED" : "" };
  });
}

export function discrepancySummary(store: Store): { property: Property; count: number; cleared: boolean; by_category: Record<Discrepancy["category"], number> }[] {
  return [...store.properties].sort((a, b) => (a.id < b.id ? -1 : 1)).map((property) => {
    const items = store.discrepancies.filter((d) => d.property_id === property.id);
    const by_category = { Occupancy: 0, "Lease From": 0, "Lease To": 0, "Tenant name": 0, "Missing on property tab": 0, "Missing in Rent Roll": 0 } as Record<Discrepancy["category"], number>;
    for (const d of items) by_category[d.category]++;
    return { property, count: items.length, cleared: store.discrepancies_cleared[property.id] ?? false, by_category };
  });
}
