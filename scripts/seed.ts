import fs from "node:fs";
import path from "node:path";
import type {
  Account, Bill, BillFields, Discrepancy, GlName, LedgerLine, Meter, Occupancy, Property, Provider, ProviderAccountRow, Seed, SiteVisitRow, Unit, WhoPays,
} from "../packs/utility-bills-to-yardi/types";
import { addDays, addMonths, fmtMMDD, mid, monthEnd, monthStart, monthsBetween, inRange } from "../packs/utility-bills-to-yardi/lib/dates";
import { schemeInvoice } from "../packs/utility-bills-to-yardi/lib/ledger";

// Deterministic generator, session 2 shape. Every name, place, and provider is fictional.
// Markers: accounts 99, meters M9, vendors v99,
// property codes 0999, GL codes start with 9.

const MONTHS = monthsBetween("2026-01", "2026-09");
const HISTORY = monthsBetween("2026-01", "2026-07");
const DEMO_MONTH = "2026-08";
const NEXT_MONTH = "2026-09";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}
const rand = mulberry32(20260902);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const intBetween = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const money = (x: number) => Math.round(x * 100) / 100;
const pad2 = (n: number) => String(n).padStart(2, "0");
const pad3 = (n: number) => String(n).padStart(3, "0");
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`seed assertion failed: ${msg}`);
};

// Providers (all fictional)
const FAIRSHORE = "Fairshore Power";
const CRESTLINE = "Crestline Energy";
const RIVERMOUTH = "City of Rivermouth";
const MARLOW = "City of Marlow";
const WESTHAVEN = "City of Westhaven";
const DEERPATH = "City of Deerpath Beach";
const MAPLE_PARK = "Town of Maple Park";
const LARKHILL = "City of Larkhill";
const OAKMERE = "City of Oakmere";
const ST_CORWIN = "City of St Corwin";
const PELICAN = "City of Pelican Shores";
const COUNTY = "Seagrass County Utilities";
const SMALL = ["Coquina Water Co-op", "Sandpiper Utility District", "Tidewater Water Works", "Marlstone Water Authority", "Palmgrove Irrigation District", "Heron Bay Water", "Lantern Key Water", "Mangrove Utility District"];
let vendorSeq = 1;
const vendor = () => `v99${String(vendorSeq++).padStart(4, "0")}`;
const providers: Provider[] = [
  { name: FAIRSHORE, service_type: "electric", delivery_route: "download", billing_status: "current", vendor_code: vendor(), phone_label: "business customer line" },
  { name: CRESTLINE, service_type: "electric", delivery_route: "download", billing_status: "current", vendor_code: vendor(), phone_label: "business customer line" },
  { name: RIVERMOUTH, service_type: "water", delivery_route: "emails", billing_status: "behind", vendor_code: vendor(), phone_label: "utility billing office" },
  ...[MARLOW, WESTHAVEN, DEERPATH, MAPLE_PARK, LARKHILL, OAKMERE, ST_CORWIN, PELICAN, COUNTY, ...SMALL].map((name) => ({
    name, service_type: "water" as const, delivery_route: "download" as const, billing_status: "current" as const, vendor_code: vendor(), phone_label: "utility billing office",
  })),
];
assert(providers.length === 20, "20 providers");
const providerByName = new Map(providers.map((p) => [p.name, p]));

// Fictional lists
const PROPERTY_NAMES = [
  "Palmetto Row Commerce Park", "Harbor Lane Flex Center", "Cypress Point Industrial", "Seagrass Commons",
  "Osprey Landing Business Park", "Marlin Bay Flex", "Coral Ridge Works", "Kestrel Commerce Center",
  "Sandbar Industrial", "Heron Cove Flex", "Driftwood Business Park", "Saltgrass Commerce",
  "Blue Pelican Industrial", "Tidewater Flex Center", "Mangrove Row", "Sawgrass Point Works",
  "Lantern Key Commerce", "Coquina Business Park", "Sable Palm Industrial", "Seagrape Flex",
  "Brightwater Commerce", "Pinecrest Bay Works", "Turtle Run Flex", "Cormorant Commerce Park", "Ibis Landing Industrial",
];
const STREET_NAMES = ["Coquina", "Sandpiper", "Tidewater", "Marlstone", "Palmgrove", "Seagrape", "Osprey", "Kestrel", "Heron", "Saltmarsh", "Harborline", "Cypress Bend", "Driftwood", "Lantern", "Mangrove", "Pelican", "Ibis", "Cormorant", "Egret", "Tarpon", "Snook", "Conch", "Manatee", "Sailfish", "Bonefish"];
const STREET_SUFFIX = ["Trade Way", "Commerce Drive", "Industrial Boulevard", "Flex Court", "Business Parkway", "Logistics Lane"];
const TENANT_FIRST = ["Kestrel", "Heron", "Osprey", "Marlin", "Sandpiper", "Coral", "Palmetto", "Seagrape", "Driftwood", "Mangrove", "Cypress", "Tidewater", "Lantern", "Saltgrass", "Ibis", "Pelican", "Coquina", "Sawgrass", "Turtle", "Cormorant", "Egret", "Tarpon", "Snook", "Conch", "Manatee", "Dolphin", "Sailfish", "Bonefish", "Permit", "Redfish", "Amber", "Cobalt", "Juniper", "Sable", "Wren"];
const TENANT_SECOND = ["Cabinetry", "Logistics", "Auto Works", "Print Co", "Marine Supply", "Fitness", "Tile", "Bakery", "HVAC", "Studio", "Imports", "Kitchens", "Optics", "Distribution", "Signs", "Upholstery", "Coffee Roasters", "Electric", "Plumbing", "Pool Supply", "Bikes", "Floral", "Glass", "Woodworks", "Dental Lab", "Fabrication", "Boat Repair", "Packaging", "Drones", "Ceramics", "Awnings", "Flooring", "Storage", "Apparel", "Brewing"];
const TENANT_SUFFIX = ["LLC", "Inc", "Co", "Group", ""];
const HOUSE_ELECTRIC_NOTES = ["parking lot lights", "common area lighting", "fire pump", "irrigation pump", "office suite", "sign lighting"];
const HOUSE_WATER_NOTES = ["irrigation", "fire line", "common restroom", "site water"];

// Site layout. Site A (index 0) and Site B (index 1) keep their session 1 structure so ids hold.
const UNIT_COUNTS = [48, 30, 62, 40, 36, 54, 28, 44, 50, 32, 38, 26, 58, 42, 20, 46, 34, 24, 50, 46, 22, 60, 36, 40, 34];
const HOUSE_ELECTRIC = [2, 3, 1, 2, 2, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 2, 1, 2, 2, 1, 2, 2, 2, 1];
const HOUSE_WATER = [2, 3, 3, 3, 2, 3, 1, 2, 3, 7, 3, 1, 3, 2, 1, 3, 2, 1, 2, 2, 1, 3, 2, 3, 1];
type SiteWater = { provider: string; city: string };
const SITE_WATER: SiteWater[] = [
  { provider: WESTHAVEN, city: "Westhaven" }, { provider: RIVERMOUTH, city: "Rivermouth" }, { provider: MARLOW, city: "Marlow" }, { provider: WESTHAVEN, city: "Westhaven" },
  { provider: DEERPATH, city: "Deerpath Beach" }, { provider: MARLOW, city: "Marlow" }, { provider: RIVERMOUTH, city: "Rivermouth" }, { provider: MAPLE_PARK, city: "Maple Park" },
  { provider: MARLOW, city: "Marlow" }, { provider: RIVERMOUTH, city: "Rivermouth" }, { provider: LARKHILL, city: "Larkhill" }, { provider: COUNTY, city: "Bayford" },
  { provider: RIVERMOUTH, city: "Rivermouth" }, { provider: OAKMERE, city: "Oakmere" }, { provider: SMALL[0], city: "Juniper Bay" }, { provider: MARLOW, city: "Marlow" },
  { provider: ST_CORWIN, city: "St Corwin" }, { provider: RIVERMOUTH, city: "Rivermouth" }, { provider: PELICAN, city: "Pelican Shores" }, { provider: SMALL[1], city: "Lake Wren" },
  { provider: DEERPATH, city: "Deerpath Beach" }, { provider: SMALL[2], city: "Stowbridge" }, { provider: WESTHAVEN, city: "Westhaven" }, { provider: SMALL[3], city: "Dunmore Beach" }, { provider: RIVERMOUTH, city: "Rivermouth" },
];
const CRESTLINE_SITE = 16;
const RECENT_SITES = [20, 22, 24];
const SHARED_WATER_SITES = [1, 4, 14];
const QUIET_BILLBACK_SITES = [4, 11];
const SITE_A = 0;
const SITE_B = 1;

const usedTenantNames = new Set<string>();
function tenantName(): string {
  for (let i = 0; i < 2000; i++) {
    const n = `${pick(TENANT_FIRST)} ${pick(TENANT_SECOND)} ${pick(TENANT_SUFFIX)}`.trim();
    if (!usedTenantNames.has(n)) {
      usedTenantNames.add(n);
      return n;
    }
  }
  throw new Error("ran out of tenant names");
}
const usedAccounts = new Set<string>();
function accountNumber(suffix?: string): string {
  for (;;) {
    const n = suffix ? `99${String(intBetween(1000, 9999))}${suffix}` : `99${String(intBetween(10000000, 99999999))}`;
    if (n.length === 10 && !usedAccounts.has(n)) {
      usedAccounts.add(n);
      return n;
    }
  }
}
let meterSeq = 100001;
const meterId = () => `M9${meterSeq++}`;
const usedMeterNumbers = new Set<string>();
function meterNumber(): string {
  for (;;) {
    const n = `M9${String(intBetween(10000000, 99999999))}`;
    if (!usedMeterNumbers.has(n)) {
      usedMeterNumbers.add(n);
      return n;
    }
  }
}

// Properties
const properties: Property[] = [];
for (let i = 0; i < 25; i++) {
  const street = `${intBetween(100, 9800)} ${STREET_NAMES[i]} ${pick(STREET_SUFFIX)}`;
  properties.push({
    id: `P${pad2(i + 1)}`, code: `0999${pad3(i + 1)}`, name: PROPERTY_NAMES[i], street, city: SITE_WATER[i].city, unit_count: UNIT_COUNTS[i],
    acquisition_date: RECENT_SITES.includes(i) ? `2026-${pad2(intBetween(4, 6))}-01` : `${intBetween(2019, 2025)}-${pad2(intBetween(1, 12))}-01`,
    water_provider: SITE_WATER[i].provider, bank_gl: `91${pad2(i + 1)}00`, recently_acquired: RECENT_SITES.includes(i),
  });
}

// Units and the vacancy plan (250 vacant in August)
type Kind = "stable" | "vacant_before" | "vacated" | "relet" | "billback" | "owner_covered";
type UnitPlan = { unit: Unit; kind: Kind; oldTenant: string | null; oldMoveIn: string | null };
const plans: UnitPlan[] = [];
const units: Unit[] = [];
const vacantTargets = UNIT_COUNTS.map((n, i) => Math.round(n * (RECENT_SITES.includes(i) ? between(0.6, 0.7) : between(0.1, 0.3))));
{
  let diff = vacantTargets.reduce((a, b) => a + b, 0) - 250;
  for (let i = 2; diff !== 0; i = (i + 1) % 25) {
    if (i === SITE_A || i === SITE_B || RECENT_SITES.includes(i)) continue;
    if (diff > 0 && vacantTargets[i] > 3) { vacantTargets[i]--; diff--; }
    else if (diff < 0) { vacantTargets[i]++; diff++; }
  }
  assert(vacantTargets.reduce((a, b) => a + b, 0) === 250, "vacancy targets sum to 250");
}
function occupancyFor(u: Pick<Unit, "tenant" | "move_in" | "move_out">): Record<string, Occupancy> {
  const out: Record<string, Occupancy> = {};
  for (const m of MONTHS) {
    const d = mid(m);
    const occupied = u.tenant !== null ? u.move_in !== null && u.move_in <= d : u.move_out !== null && u.move_out >= d;
    out[m] = occupied ? "occupied" : "vacant";
  }
  return out;
}
const OWNER_COVERED_TARGET = 36;
let ownerCoveredLeft = OWNER_COVERED_TARGET - 1; // Site A forces one carried-over row (A-8); the rest spread over other sites
for (let i = 0; i < 25; i++) {
  const p = properties[i];
  const n = UNIT_COUNTS[i];
  const forced: Record<number, Kind> = i === SITE_A ? { 11: "vacated", 12: "vacant_before", 6: "billback", 19: "owner_covered" } : i === SITE_B ? { 4: "vacant_before", 5: "vacant_before" } : {};
  const free = shuffled([...Array(n).keys()].filter((j) => !(j in forced)));
  const v = vacantTargets[i] - Object.values(forced).filter((k) => k === "vacated" || k === "vacant_before").length;
  const relets = Math.max(1, Math.round(n * 0.03));
  const quietBillback = QUIET_BILLBACK_SITES.includes(i);
  const ownerCoveredHere = i === SITE_A || i === SITE_B ? 1 : Math.min(ownerCoveredLeft, 2);
  let ownerCoveredAssigned = 0;
  for (let j = 0; j < n; j++) {
    const uid = `${p.id}-U${pad2(j + 1)}`;
    const label = pad2(j + 1);
    const sqft = intBetween(20, 100) * 50;
    let kind: Kind;
    if (j in forced) kind = forced[j];
    else {
      const pos = free.indexOf(j);
      if (pos < v) kind = RECENT_SITES.includes(i) ? "vacant_before" : rand() < 0.65 ? "vacant_before" : "vacated";
      else if (pos < v + relets) kind = quietBillback && pos === v ? "billback" : "relet";
      else if (ownerCoveredAssigned < ownerCoveredHere && !(i === SITE_A) ) { kind = "owner_covered"; ownerCoveredAssigned++; }
      else kind = "stable";
    }
    if (kind === "owner_covered" && !(i === SITE_A)) ownerCoveredLeft--;
    let unit: Unit;
    let oldTenant: string | null = null;
    let oldMoveIn: string | null = null;
    const base = { id: uid, property_id: p.id, label, address: `${p.street} Unit ${label}`, square_feet: sqft, previous_move_out: null as string | null, occupancy: {}, tenant_history: {}, who_pays: "tenant" as WhoPays, payer_source: "system" as const };
    if (kind === "stable" || kind === "owner_covered") {
      unit = { ...base, tenant: tenantName(), move_in: `${intBetween(2019, 2025)}-${pad2(intBetween(1, 12))}-${pad2(intBetween(1, 28))}`, move_out: null, who_pays: kind === "owner_covered" ? "owner" : "tenant", payer_source: kind === "owner_covered" ? "seller_workbook" : "system" };
    } else if (kind === "vacant_before") {
      oldTenant = tenantName();
      oldMoveIn = `${intBetween(2019, 2024)}-${pad2(intBetween(1, 12))}-01`;
      const moveOut = RECENT_SITES.includes(i) ? `${pick(["2025-09", "2025-11", "2026-01", "2026-03"])}-${pad2(intBetween(2, 27))}` : `${pick(["2025-06", "2025-08", "2025-10", "2025-12", "2026-01", "2026-02"])}-${pad2(intBetween(2, 27))}`;
      unit = { ...base, tenant: null, move_in: null, move_out: moveOut, who_pays: "owner", payer_source: "seller_workbook" };
    } else if (kind === "vacated") {
      oldTenant = tenantName();
      oldMoveIn = `${intBetween(2019, 2024)}-${pad2(intBetween(1, 12))}-01`;
      const moveOut = i === SITE_A && j === 11 ? "2026-06-10" : `2026-${pad2(intBetween(3, 7))}-${pad2(intBetween(2, 27))}`;
      unit = { ...base, tenant: null, move_in: null, move_out: moveOut, who_pays: "owner", payer_source: "system" };
    } else {
      oldTenant = tenantName();
      oldMoveIn = `${intBetween(2019, 2023)}-${pad2(intBetween(1, 12))}-01`;
      const prevOut = `${pick(["2025-08", "2025-10", "2025-12", "2026-01", "2026-02"])}-${pad2(intBetween(2, 27))}`;
      const moveIn = i === SITE_A && j === 6 ? "2026-04-01" : `2026-${pad2(intBetween(4, 7))}-${pad2(intBetween(1, 27))}`;
      unit = { ...base, tenant: tenantName(), move_in: moveIn, move_out: null, previous_move_out: prevOut, who_pays: "tenant", payer_source: "system" };
    }
    unit.occupancy = occupancyFor(unit);
    for (const m of MONTHS) unit.tenant_history[m] = unit.occupancy[m] === "occupied" ? unit.tenant ?? oldTenant : null;
    // history months before a move-out carry the old tenant
    if (unit.tenant === null && oldTenant) for (const m of MONTHS) if (unit.occupancy[m] === "occupied") unit.tenant_history[m] = oldTenant;
    units.push(unit);
    plans.push({ unit, kind, oldTenant, oldMoveIn });
  }
}
// a few tenant changes for Check payer: ten stable units change tenant in August
{
  const candidates = plans.filter((x) => x.kind === "stable" && x.unit.property_id !== "P01" && x.unit.property_id !== "P02").slice(0, 10);
  for (const c of candidates) {
    const prior = tenantName();
    for (const m of MONTHS) if (m < DEMO_MONTH) c.unit.tenant_history[m] = prior;
  }
}
assert(units.length === 1000, "1000 units");
assert(units.filter((u) => u.occupancy[DEMO_MONTH] === "vacant").length === 250, `250 vacant, got ${units.filter((u) => u.occupancy[DEMO_MONTH] === "vacant").length}`);

// Meters
const meters: Meter[] = [];
const meterOfUnit = new Map<string, Meter>();
for (let i = 0; i < 25; i++) {
  const p = properties[i];
  const electric = i === CRESTLINE_SITE ? CRESTLINE : FAIRSHORE;
  const sitePlans = plans.filter((x) => x.unit.property_id === p.id);
  for (const plan of sitePlans) {
    const m: Meter = { id: meterId(), property_id: p.id, service_type: "electric", kind: "unit", unit_id: plan.unit.id, units_served: [], provider: electric, location_note: null, meter_number: meterNumber(), notes: [] };
    meters.push(m);
    meterOfUnit.set(plan.unit.id, m);
  }
  for (let k = 0; k < HOUSE_ELECTRIC[i]; k++) {
    meters.push({ id: meterId(), property_id: p.id, service_type: "electric", kind: "house", unit_id: null, units_served: [], provider: electric, location_note: HOUSE_ELECTRIC_NOTES[k % HOUSE_ELECTRIC_NOTES.length], meter_number: meterNumber(), notes: [] });
  }
  for (let k = 0; k < HOUSE_WATER[i]; k++) {
    meters.push({ id: meterId(), property_id: p.id, service_type: "water", kind: "house", unit_id: null, units_served: [], provider: p.water_provider, location_note: HOUSE_WATER_NOTES[k % HOUSE_WATER_NOTES.length], meter_number: meterNumber(), notes: [] });
  }
  if (i === SITE_B || i === 9) {
    // the two sites with 14 water accounts: unit water masters serving single units
    const count = i === SITE_B ? 10 : 7;
    for (const plan of sitePlans.slice(0, count)) {
      meters.push({ id: meterId(), property_id: p.id, service_type: "water", kind: "house", unit_id: plan.unit.id, units_served: [], provider: p.water_provider, location_note: `serves unit ${plan.unit.label}`, meter_number: meterNumber(), notes: [] });
    }
  }
  if (SHARED_WATER_SITES.includes(i)) {
    const served = sitePlans.slice(10, 13).map((x) => x.unit.id);
    meters.push({ id: meterId(), property_id: p.id, service_type: "water", kind: "shared", unit_id: null, units_served: served, provider: p.water_provider, location_note: "shared line, three units", meter_number: meterNumber(), notes: [] });
  }
}
// Site B: two of its 14 water accounts sit on the county utility so a current-provider water bill can arrive there (B-5)
for (const id of ["M9100087", "M9100098"]) meters.find((m) => m.id === id)!.provider = COUNTY;
for (const m of meters) m.notes = [];
const meterById = new Map(meters.map((m) => [m.id, m]));
assert(meters.filter((m) => m.service_type === "electric" && m.kind === "house").length === 46, "46 house electric meters");
assert(meters.filter((m) => m.property_id === "P02" && m.service_type === "water").length === 14, "Site B has 14 water accounts");
assert(meters.filter((m) => m.property_id === "P10" && m.service_type === "water").length === 14, "P10 has 14 water accounts");

// Owner-paid electric rows and where their landlord accounts stand
const scripted: Record<string, string> = { A: "P01", B: "P02", "B-1": "P02", "A-1": "M9100012", "A-2": "M9100007", "A-3": "M9100051", "B-2": "M9100099", "B-3": "M9100086", "B-4-meter": "M9100085" };
type Standing = "known" | "at_provider_surfaces" | "at_provider_unmapped" | "at_provider_no_bill" | "no_account_vacant" | "no_account_carried";
const standing = new Map<string, Standing>();
{
  const ownerVacant = plans.filter((x) => x.unit.occupancy[DEMO_MONTH] === "vacant");
  const ownerCovered = plans.filter((x) => x.unit.occupancy[DEMO_MONTH] === "occupied" && x.unit.who_pays === "owner");
  assert(ownerVacant.length === 250, "250 vacant owner rows");
  assert(ownerCovered.length === OWNER_COVERED_TARGET, `36 owner-covered occupied rows, got ${ownerCovered.length}`);
  // occupied owner-covered: three have landlord accounts at the provider and on the master; 33 are carried over from the seller's workbook
  let knownCovered = 0;
  for (const x of ownerCovered) {
    const known = x.unit.property_id !== "P01" && knownCovered < 3;
    if (known) knownCovered++;
    standing.set(x.unit.id, known ? "known" : "no_account_carried");
  }
  // vacant rows: 75 known, 70 surface by bill, 10 unmapped, 30 no August bill, 65 no account
  const forcedVacant: Record<string, Standing> = { "P01-U12": "known", "P01-U13": "no_account_vacant", "P02-U05": "known", "P02-U06": "known" };
  const rest = shuffled(ownerVacant.filter((x) => !(x.unit.id in forcedVacant)));
  const buckets: [Standing, number][] = [["known", 72], ["at_provider_surfaces", 70], ["at_provider_unmapped", 10], ["at_provider_no_bill", 30], ["no_account_vacant", 64]];
  // 72 plus the three forced known rows (P01-U12, P02-U05, P02-U06) makes 75 known vacant rows; with the three owner-covered known rows the master knows 78
  let idx = 0;
  for (const [s, count] of buckets) for (let k = 0; k < count; k++) standing.set(rest[idx++].unit.id, s);
  for (const [id, s] of Object.entries(forcedVacant)) standing.set(id, s);
  assert(idx === rest.length, `all vacant rows bucketed (${idx} of ${rest.length})`);
}

// Accounts on the master
const accounts: Account[] = [];
const providerAccounts: Account[] = []; // exist at the provider; a subset is on the master
function landlordAccount(meter: Meter, from: string, to: string | null, number?: string): Account {
  return { account_number: number ?? accountNumber(), provider: meter.provider, meter_id: meter.id, holder: "landlord", holder_name: null, active_from: from, active_to: to };
}
function tenantAccount(meter: Meter, name: string, from: string, to: string | null, number?: string): Account {
  return { account_number: number ?? accountNumber(), provider: meter.provider, meter_id: meter.id, holder: "tenant", holder_name: name, active_from: from, active_to: to };
}
const A7_SUFFIX = "4321";
for (const plan of plans) {
  const m = meterOfUnit.get(plan.unit.id)!;
  const u = plan.unit;
  const st = standing.get(u.id);
  const tenantEnd = u.move_out ?? u.previous_move_out;
  if (plan.kind === "stable") {
    accounts.push(tenantAccount(m, u.tenant!, u.move_in!, null, u.id === "P01-U21" ? accountNumber(A7_SUFFIX) : undefined));
    continue;
  }
  if (plan.kind === "owner_covered") {
    if (st === "known") {
      // the owner really covers this unit: a landlord account on the master, tenant never held one
      accounts.push(landlordAccount(m, u.move_in!, null));
    } else {
      // owner-paid per the seller's workbook, but no landlord account exists at the provider (the tenant pays)
      providerAccounts.push(tenantAccount(m, u.tenant!, u.move_in!, null));
    }
    continue;
  }
  if (plan.kind === "relet") {
    accounts.push(tenantAccount(m, plan.oldTenant!, plan.oldMoveIn!, u.previous_move_out!));
    accounts.push(landlordAccount(m, addDays(u.previous_move_out!, 1), addDays(u.move_in!, -1)));
    accounts.push(tenantAccount(m, u.tenant!, u.move_in!, null));
    continue;
  }
  if (plan.kind === "billback") {
    accounts.push(tenantAccount(m, plan.oldTenant!, plan.oldMoveIn!, u.previous_move_out!));
    accounts.push(landlordAccount(m, addDays(u.previous_move_out!, 1), null));
    continue;
  }
  // vacant rows
  const old = tenantAccount(m, plan.oldTenant!, plan.oldMoveIn!, tenantEnd!);
  const landlordFrom = addDays(tenantEnd!, 1);
  if (st === "known") {
    accounts.push(old, landlordAccount(m, landlordFrom, null, u.id === "P01-U12" ? undefined : undefined));
  } else if (st === "at_provider_surfaces" || st === "at_provider_unmapped" || st === "at_provider_no_bill") {
    accounts.push(old);
    providerAccounts.push(landlordAccount(m, landlordFrom, null, u.id === "P01-U05" ? accountNumber(A7_SUFFIX) : undefined));
    m.meter_number = null;
  } else {
    // no landlord account at the provider at all; the master has only the old tenant and a blank meter number
    accounts.push(old);
    m.meter_number = null;
  }
}
// A-7 needs two Site A accounts sharing the four-digit suffix on the master: the P01-U21 tenant account and a house account
scripted["A-6"] = meterOfUnit.get("P01-U13")!.id;
scripted["A-8"] = meterOfUnit.get("P01-U20")!.id;
// House electric and water masters
for (const m of meters) {
  if (m.kind === "unit") continue;
  const p = properties.find((x) => x.id === m.property_id)!;
  if (m.id === scripted["B-4-meter"]) { providerAccounts.push(landlordAccount(m, p.acquisition_date, null)); m.meter_number = null; continue; }
  if (m.id === scripted["A-3"]) { m.meter_number = null; continue; }
  const number = m.id === "M9100049" ? accountNumber(A7_SUFFIX) : undefined;
  accounts.push(landlordAccount(m, p.acquisition_date, null, number));
}
// blank meter numbers on some known rows so the count lands near 195
{
  const known = meters.filter((m) => m.kind === "unit" && standing.get(m.unit_id!) === "known" && m.meter_number);
  for (const m of shuffled(known).slice(0, 20)) m.meter_number = null;
}
const accountsByMeter = new Map<string, Account[]>();
for (const a of accounts) {
  const list = accountsByMeter.get(a.meter_id) ?? [];
  list.push(a);
  accountsByMeter.set(a.meter_id, list);
}
const activeOn = (meterId: string, date: string, holder?: "landlord" | "tenant") => (accountsByMeter.get(meterId) ?? []).find((a) => inRange(date, a.active_from, a.active_to) && (!holder || a.holder === holder)) ?? null;

// Amounts
const baseRate = new Map<string, number>();
function baseFor(m: Meter): number {
  let b = baseRate.get(m.id);
  if (b === undefined) {
    if (m.service_type === "electric") b = m.kind === "house" ? between(120, 600) : between(45, 140);
    else if (m.kind === "shared") b = between(200, 500);
    else b = m.unit_id ? between(40, 160) : between(90, 480);
    baseRate.set(m.id, b);
  }
  return b;
}
function amountFor(m: Meter, month: string): number {
  const jitter = 1 + (((m.id.charCodeAt(7) * 31 + Number(month.slice(5))) % 21) - 10) / 100;
  return money(baseFor(m) * jitter);
}

// Ledger lines January to July
const GL: Record<GlName, string> = {
  "Electricity non-recoverable": "950010", "Electricity recoverable": "950020", "Water recoverable": "950110", "Sewer recoverable": "950120", "Stormwater": "950130", "Garbage recoverable": "950140", "Utility deposits": "912500", "Tenant charges": "940100",
};
const ledger: LedgerLine[] = [];
let lineSeq = 100001;
let controlSeq = 500001;
let paymentSeq = 700001;
const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
type Style = "scheme" | "legacyA" | "legacyB" | "legacyC" | "bare";
function styleFor(account: string): Style {
  const h = Number(account.slice(-3)) % 9;
  return h < 3 ? "scheme" : h < 5 ? "legacyA" : h < 7 ? "legacyB" : "legacyC";
}
function invoiceFor(style: Style, account: string, invoiceDate: string, servicePeriod: string): { invoice_number: string; description: string } {
  const mmddyy = `${invoiceDate.slice(5, 7)}${invoiceDate.slice(8, 10)}${invoiceDate.slice(2, 4)}`;
  switch (style) {
    case "scheme": return { invoice_number: schemeInvoice(account, invoiceDate), description: servicePeriod };
    case "legacyA": return { invoice_number: `${account.slice(-5)}-${mmddyy}`, description: servicePeriod };
    case "legacyB": return { invoice_number: `${account.slice(-4)}-${mmddyy}`, description: servicePeriod };
    case "legacyC": return { invoice_number: `${MONTH_ABBR[Number(invoiceDate.slice(5, 7)) - 1]}${invoiceDate.slice(2, 4)}-${controlSeq}`, description: `${account} ${servicePeriod}` };
    case "bare": return { invoice_number: "", description: servicePeriod };
  }
}
function pushLine(m: Meter, account: string, month: string, amount: number, gl: GlName, invoice: { invoice_number: string; description: string }, id?: string): LedgerLine {
  const p = properties.find((x) => x.id === m.property_id)!;
  const prov = providerByName.get(m.provider)!;
  const line: LedgerLine = {
    id: id ?? `LL-${lineSeq++}`, payee_code: prov.vendor_code, payee_name: m.provider, description: invoice.description, control_number: `C${controlSeq++}`, property_code: p.code, property_id: p.id,
    invoice_date: `${month}-${pad2(intBetween(1, 5))}`, payment_method: rand() < 0.7 ? "Check" : "ACH", post_month: month, gl_code: GL[gl], gl_name: gl, invoice_number: invoice.invoice_number, amount,
    due_date: addDays(monthEnd(month), -5), unpaid_amount: 0, payment_number: `PN${paymentSeq++}`, payment_date: `${month}-${pad2(intBetween(10, 26))}`, confirmed_account: null,
  };
  ledger.push(line);
  return line;
}
const servicePeriod = (month: string) => `${fmtMMDD(monthStart(addMonths(month, -1)))} to ${fmtMMDD(monthEnd(addMonths(month, -1)))}`;
for (const m of meters) {
  const prov = providerByName.get(m.provider)!;
  for (const month of HISTORY) {
    const acct = activeOn(m.id, mid(month), "landlord");
    if (!acct) continue;
    const style = styleFor(acct.account_number);
    const invoiceDate = `${month}-${pad2(intBetween(1, 5))}`;
    const inv = invoiceFor(style, acct.account_number, invoiceDate, servicePeriod(month));
    const amount = amountFor(m, month);
    if (m.service_type === "water" && (prov.name === RIVERMOUTH || prov.name === MARLOW) && Number(acct.account_number.slice(-1)) % 2 === 0) {
      pushLine(m, acct.account_number, month, money(amount * 0.6), "Water recoverable", inv);
      pushLine(m, acct.account_number, month, money(amount * 0.3), "Sewer recoverable", inv);
      pushLine(m, acct.account_number, month, money(amount - money(amount * 0.6) - money(amount * 0.3)), "Stormwater", inv);
    } else if (m.service_type === "water") {
      pushLine(m, acct.account_number, month, amount, "Water recoverable", inv);
    } else {
      const unit = m.unit_id ? units.find((u) => u.id === m.unit_id) : null;
      pushLine(m, acct.account_number, month, amount, unit && unit.occupancy[month] === "occupied" ? "Electricity recoverable" : "Electricity non-recoverable", inv);
    }
  }
}
// A-7: a July legacy-B line on Site A whose four-digit suffix two Site A accounts share
{
  const house = meters.find((m) => m.id === "M9100049")!;
  const acct = activeOn(house.id, mid("2026-07"), "landlord")!;
  const twin = accounts.find((a) => a.account_number !== acct.account_number && a.account_number.endsWith(A7_SUFFIX) && meterById.get(a.meter_id)!.property_id === "P01");
  assert(Boolean(twin), "A-7 twin account on Site A");
  const l = pushLine(house, acct.account_number, "2026-07", amountFor(house, "2026-07"), "Electricity non-recoverable", { invoice_number: `${A7_SUFFIX}-070326`, description: servicePeriod("2026-07") });
  scripted["A-7"] = l.id;
}
// Bare legacy lines: A-4 first
{
  const siteA = properties[SITE_A];
  const prov = providerByName.get(FAIRSHORE)!;
  ledger.push({ id: "PAY-101526", payee_code: prov.vendor_code, payee_name: FAIRSHORE, description: "Electric", control_number: `C${controlSeq++}`, property_code: siteA.code, property_id: siteA.id, invoice_date: "2026-03-04", payment_method: "Check", post_month: "2026-03", gl_code: GL["Electricity non-recoverable"], gl_name: "Electricity non-recoverable", invoice_number: "", amount: 88.4, due_date: "2026-03-26", unpaid_amount: 0, payment_number: `PN${paymentSeq++}`, payment_date: "2026-03-20", confirmed_account: null });
  scripted["A-4"] = "PAY-101526";
  const BARE = ["Water", "Water July", "Power", "Electric bill", "Utilities", "Water bill", "Electric Apr", "Water May", "Power bill"];
  for (let k = 0; k < 9; k++) {
    const p = properties[intBetween(2, 24)];
    const prov2 = providerByName.get(k % 2 === 0 ? (p.id === "P17" ? CRESTLINE : FAIRSHORE) : p.water_provider)!;
    const month = pick(["2026-03", "2026-04", "2026-05"]);
    ledger.push({ id: `LL-${lineSeq++}`, payee_code: prov2.vendor_code, payee_name: prov2.name, description: BARE[k], control_number: `C${controlSeq++}`, property_code: p.code, property_id: p.id, invoice_date: `${month}-03`, payment_method: "Check", post_month: month, gl_code: GL[k % 2 === 0 ? "Electricity non-recoverable" : "Water recoverable"], gl_name: k % 2 === 0 ? "Electricity non-recoverable" : "Water recoverable", invoice_number: "", amount: money(between(60, 400)), due_date: addDays(monthEnd(month), -5), unpaid_amount: 0, payment_number: `PN${paymentSeq++}`, payment_date: `${month}-18`, confirmed_account: null });
  }
}
// Deposits on the Utility deposits GL, about a third of landlord accounts
for (const a of accounts) {
  if (a.holder !== "landlord" || rand() >= 0.34) continue;
  const m = meterById.get(a.meter_id)!;
  const month = a.active_from >= "2026-01-01" ? a.active_from.slice(0, 7) : "2026-01";
  if (month > "2026-07") continue;
  pushLine(m, a.account_number, month, intBetween(2, 30) * 50, "Utility deposits", { invoice_number: `DEP-${a.account_number.slice(-5)}`, description: `${a.account_number} deposit` });
}

// Batches: August and September
const bills: Bill[] = [];
let billSeq = 100001;
const nextBillId = () => {
  const id = `BILL-${billSeq++}`;
  return id === "BILL-101268" ? `BILL-${billSeq++}` : id;
};
function makeBill(m: Meter, account: string, month: string, o: Partial<Bill> = {}): Bill {
  const prov = providerByName.get(m.provider)!;
  const unit = m.unit_id ? units.find((u) => u.id === m.unit_id) : null;
  const service = addMonths(month, -1);
  const b: Bill = {
    id: nextBillId(), provider: m.provider, account_number: account, service_address: unit ? unit.address : properties.find((p) => p.id === m.property_id)!.street,
    service_start: monthStart(service), service_end: monthEnd(service), amount: amountFor(m, month), meter_as_printed: m.meter_number ?? meterNumber(),
    arrival_month: month, arrival_route: prov.delivery_route === "emails" ? "emailed" : "downloaded", status: "unarrived", property_id: m.property_id, meter_id: null, description: null, invoice_number: null, exception_id: null, duplicate_of: null,
    ...o,
  };
  bills.push(b);
  return b;
}
const trailing = (account: string) => {
  const lines = ledger.filter((l) => l.post_month >= "2026-05" && l.post_month <= "2026-07" && (l.invoice_number.startsWith(account) || l.description.includes(account) || l.invoice_number.startsWith(account.slice(-5)) || l.invoice_number.startsWith(account.slice(-4))) && l.gl_name !== "Utility deposits");
  return lines.length ? lines.reduce((n, l) => n + l.amount, 0) / 3 : 0;
};
// Accounts whose bill never arrives: A-1 (the shut-off story) and four quiet known vacant rows.
const missingBillMeters = new Set<string>([scripted["A-1"]]);
{
  const quiet = meters.filter((m) => m.kind === "unit" && m.property_id !== "P01" && m.property_id !== "P02" && standing.get(m.unit_id!) === "known" && activeOn(m.id, mid(DEMO_MONTH), "landlord"));
  for (const m of shuffled(quiet).slice(0, 4)) missingBillMeters.add(m.id);
}
for (const month of [DEMO_MONTH, NEXT_MONTH]) {
  for (const m of meters) {
    if (m.kind === "shared" && month === DEMO_MONTH && m.property_id !== "P02") continue;
    if (missingBillMeters.has(m.id)) continue;
    const prov = providerByName.get(m.provider)!;
    if (prov.billing_status === "behind") continue;
    const known = activeOn(m.id, mid(month), "landlord");
    const atProvider = providerAccounts.find((a) => a.meter_id === m.id && inRange(mid(month), a.active_from, a.active_to) && a.holder === "landlord") ?? null;
    const st = m.unit_id ? standing.get(m.unit_id) : null;
    if (known) {
      makeBill(m, known.account_number, month);
    } else if (atProvider) {
      if (month === DEMO_MONTH && st === "at_provider_no_bill") continue;
      const garbled = month === DEMO_MONTH && (st === "at_provider_unmapped" || m.id === scripted["B-4-meter"]);
      makeBill(m, atProvider.account_number, month, garbled ? { service_address: "address not printed", meter_as_printed: null } : {});
    }
  }
}
// B-4 keeps its session 1 id
{
  const b4 = bills.find((b) => b.arrival_month === DEMO_MONTH && meterById.get(m4id())?.property_id === "P02" && b.service_address === "address not printed" && b.provider === FAIRSHORE && b.property_id === "P02")!;
  function m4id() { return scripted["B-4-meter"]; }
  b4.id = "BILL-101268";
  scripted["B-4"] = b4.id;
}
// A-5: Site A house electric bill whose printed meter differs from the master
{
  const b = bills.find((x) => x.arrival_month === DEMO_MONTH && x.property_id === "P01" && x.account_number === activeOn("M9100050", mid(DEMO_MONTH), "landlord")!.account_number)!;
  b.meter_as_printed = meterNumber();
  scripted["A-5"] = b.id;
}
// B-5: Site B county water bill (three lines after import)
{
  const b = bills.find((x) => x.arrival_month === DEMO_MONTH && x.account_number === activeOn("M9100087", mid(DEMO_MONTH), "landlord")!.account_number)!;
  scripted["B-5"] = b.id;
}
// B-6: duplicate in the August batch, a vacant Site B unit with a known account
{
  const vacantKnown = meters.find((m) => m.property_id === "P02" && m.kind === "unit" && standing.get(m.unit_id!) === "known" && activeOn(m.id, mid(DEMO_MONTH), "landlord"))!;
  const first = bills.find((x) => x.arrival_month === DEMO_MONTH && x.meter_id === null && x.account_number === activeOn(vacantKnown.id, mid(DEMO_MONTH), "landlord")!.account_number)!;
  const dup = makeBill(vacantKnown, first.account_number, DEMO_MONTH, { amount: first.amount, service_address: first.service_address, meter_as_printed: first.meter_as_printed, arrival_route: "emailed" });
  scripted["B-6"] = dup.id;
  scripted["B-6-first"] = first.id;
}
// B-7: a different vacant Site B unit whose August bill is 2.7 times its trailing average
{
  const candidates = meters.filter((m) => m.property_id === "P02" && m.kind === "unit" && standing.get(m.unit_id!) === "known" && activeOn(m.id, mid(DEMO_MONTH), "landlord") && m.id !== meterById.get(bills.find((b) => b.id === scripted["B-6"])!.meter_id ?? "")?.id);
  const acctOf = (m: Meter) => activeOn(m.id, mid(DEMO_MONTH), "landlord")!.account_number;
  const target = candidates.find((m) => acctOf(m) !== bills.find((b) => b.id === scripted["B-6"])!.account_number && trailing(acctOf(m)) > 0)!;
  const b = bills.find((x) => x.arrival_month === DEMO_MONTH && x.account_number === acctOf(target))!;
  b.amount = money(trailing(acctOf(target)) * 2.7);
  scripted["B-7"] = b.id;
}
assert(bills.filter((b) => b.arrival_month === DEMO_MONTH).length > 200, "August batch size");

// Provider account list (in the owner's name at the electric provider) and site visit results
const provider_account_list: ProviderAccountRow[] = [];
for (const a of [...accounts, ...providerAccounts]) {
  if (a.holder !== "landlord") continue;
  const m = meterById.get(a.meter_id)!;
  if (m.service_type !== "electric") continue;
  const unit = m.unit_id ? units.find((u) => u.id === m.unit_id)! : null;
  const st = m.unit_id ? standing.get(m.unit_id) : null;
  const ambiguous = st === "at_provider_no_bill" && provider_account_list.filter((r) => r.service_address.endsWith("(suite)")).length < 3;
  provider_account_list.push({ account_number: a.account_number, service_address: ambiguous ? `${properties.find((p) => p.id === m.property_id)!.street} (suite)` : unit ? unit.address : `${properties.find((p) => p.id === m.property_id)!.street} ${m.location_note ?? "house"}`, meter_number: m.meter_number ?? (providerAccounts.includes(a) ? meterNumber() : null) });
}
const site_visit_results: SiteVisitRow[] = [];
{
  const blank = meters.filter((m) => m.kind !== "shared" && !m.meter_number);
  const fill = shuffled(blank).slice(0, blank.length - 45);
  for (const m of fill) site_visit_results.push({ meter_id: m.id, meter_number: meterNumber(), who_pays_found: null });
  for (const [uid, st] of standing) if (st === "no_account_carried") {
    const m = meterOfUnit.get(uid)!;
    const row = site_visit_results.find((r) => r.meter_id === m.id);
    if (row) row.who_pays_found = "tenant";
    else site_visit_results.push({ meter_id: m.id, meter_number: null, who_pays_found: "tenant" });
  }
}

// Discrepancies replica
const discrepancies: Discrepancy[] = [];
const discrepancies_cleared: Record<string, boolean> = {};
{
  const CATS: Discrepancy["category"][] = ["Occupancy", "Lease From", "Lease To", "Tenant name", "Missing on property tab", "Missing in Rent Roll"];
  let dSeq = 1;
  for (const p of properties) {
    discrepancies_cleared[p.id] = rand() < 0.6;
    const count = intBetween(8, 16);
    for (let k = 0; k < count; k++) {
      const u = pick(units.filter((x) => x.property_id === p.id));
      const cat = pick(CATS);
      const d = `2026-${pad2(intBetween(1, 8))}-${pad2(intBetween(1, 28))}`;
      const d2 = addDays(d, intBetween(1, 15));
      const name = u.tenant ?? u.tenant_history["2026-01"] ?? "vacant";
      const pair: Record<Discrepancy["category"], [string, string]> = {
        Occupancy: [u.occupancy[DEMO_MONTH] === "vacant" ? "vacant" : "occupied", u.occupancy[DEMO_MONTH] === "vacant" ? "occupied" : "vacant"],
        "Lease From": [d, d2], "Lease To": [d2, d], "Tenant name": [name, name.replace(/LLC|Inc|Co|Group/, "").trim() + (rand() < 0.5 ? " Inc." : " L.L.C.")],
        "Missing on property tab": ["", name], "Missing in Rent Roll": [name, ""],
      };
      discrepancies.push({ id: `D-${dSeq++}`, category: cat, property_id: p.id, unit_label: u.label, tracker_value: pair[cat][0], rent_roll_value: pair[cat][1] });
    }
  }
}

// Final assertions
const unitOwnerRows = plans.filter((x) => x.unit.occupancy[DEMO_MONTH] === "vacant" || x.unit.who_pays === "owner");
assert(unitOwnerRows.length === 286, `286 owner-paid electric rows, got ${unitOwnerRows.length}`);
const billbackUnits = new Set(plans.filter((x) => x.kind === "billback").map((x) => x.unit.id));
const isOwnerRowAccount = (a: Account) => { const m = meterById.get(a.meter_id)!; return a.holder === "landlord" && m.kind === "unit" && m.service_type === "electric" && inRange(mid(DEMO_MONTH), a.active_from, a.active_to) && !billbackUnits.has(m.unit_id!); };
const landlordUnitAtProvider = [...accounts, ...providerAccounts].filter(isOwnerRowAccount);
assert(landlordUnitAtProvider.length === 188, `188 landlord unit electric accounts at the provider, got ${landlordUnitAtProvider.length}`);
const knownUnit = accounts.filter(isOwnerRowAccount);
assert(knownUnit.length === 78, `78 known on the master, got ${knownUnit.length}`);
assert(billbackUnits.size === 3, "three bill-back rows");
const blank = meters.filter((m) => m.kind !== "shared" && !m.meter_number).length;
assert(blank >= 190 && blank <= 200, `about 195 blank meter numbers, got ${blank}`);
assert(meters.filter((m) => m.service_type === "water" && m.kind !== "shared").length >= 60, "about 64 water masters");
assert(ledger.length >= 1500 && ledger.length <= 2000, `about 1700 ledger lines, got ${ledger.length}`);
for (const [k, v] of Object.entries({ "A-1": "M9100012", "A-2": "M9100007", "A-3": "M9100051", "A-4": "PAY-101526", "B-2": "M9100099", "B-3": "M9100086", "B-4": "BILL-101268", "B-4-meter": "M9100085" })) assert(scripted[k] === v, `scripted ${k} unchanged (${scripted[k]})`);
for (const k of ["A-5", "A-6", "A-7", "A-8", "B-5", "B-6", "B-7"]) assert(Boolean(scripted[k]), `scripted ${k}`);
for (const a of [...accounts, ...providerAccounts]) assert(/^99\d{8}$/.test(a.account_number), `account marker ${a.account_number}`);
for (const m of meters) { assert(/^M9\d{6}$/.test(m.id), `meter id ${m.id}`); if (m.meter_number) assert(/^M9\d{8}$/.test(m.meter_number), `meter number ${m.meter_number}`); }

const seed: Seed = {
  demo_month: DEMO_MONTH, months: MONTHS, properties, units, meters, accounts, bills, ledger_lines: ledger, providers, discrepancies, discrepancies_cleared, provider_account_list, site_visit_results, exceptions: [], scripted,
};
const canned: Record<string, BillFields> = {};
for (const b of bills) canned[b.id] = { provider: b.provider, account_number: b.account_number, service_address: b.service_address, service_start: b.service_start, service_end: b.service_end, amount: b.amount, meter_as_printed: b.meter_as_printed };
const outDir = path.join(process.cwd(), "data");
fs.writeFileSync(path.join(outDir, "seed.json"), JSON.stringify(seed));
fs.writeFileSync(path.join(outDir, "canned-extractions.json"), JSON.stringify(canned, null, 1));
fs.writeFileSync(path.join(outDir, "provider-account-list.csv"), ["account_number,service_address,meter_number", ...provider_account_list.map((r) => `${r.account_number},"${r.service_address}",${r.meter_number ?? ""}`)].join("\n") + "\n");
fs.writeFileSync(path.join(outDir, "site-visit-results.csv"), ["meter_id,meter_number,who_pays_found", ...site_visit_results.map((r) => `${r.meter_id},${r.meter_number ?? ""},${r.who_pays_found ?? ""}`)].join("\n") + "\n");
console.log(`seed written: ${properties.length} properties, ${units.length} units, ${meters.length} meters, ${accounts.length} accounts on master, ${providerAccounts.length} only at provider, ${bills.length} bills (${bills.filter((b) => b.arrival_month === DEMO_MONTH).length} August), ${ledger.length} ledger lines, ${blank} blank meter numbers, ${provider_account_list.length} provider list rows, ${site_visit_results.length} site visit rows, ${discrepancies.length} discrepancies`);
