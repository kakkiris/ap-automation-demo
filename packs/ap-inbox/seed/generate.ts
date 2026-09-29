import fs from "node:fs";
import path from "node:path";
import { loadParcels } from "../../property-owner-lookup/lib/registry";
import { NOT_IN_SYSTEM_LIST, SCRIPTED_PARCELS } from "../../property-owner-lookup/lib/scripted";
import { entityList } from "../../property-owner-lookup/lib/entities";
import type { ParcelRecord } from "../../property-owner-lookup/lib/types";
import type {
  Entity, Extraction, ExtractedLine, ExtractionKind, InboxItem, LedgerAccount, Seed, Source, SystemProperty, TrackerCard, UtilityAccount, Vendor, VendorHistoryEntry,
} from "../lib/types";
import { prettyDate, renderNotesSvg, renderScanSvg, writePdf, writeSvg, type DocLine, type DocumentSpec, type VendorBlock } from "./documents";

// Seed generator for the invoice intake and capture pack. Run from the repo root:
//   npx tsx packs/ap-inbox/seed/generate.ts
// Same output every run: a seeded generator with a fixed constant, never the clock.
// Writes seed.json, canned/<itemId>.json for all 26 items, and the documents under
// public/demo/ap-inbox/. Every name below is invented; the parcel
// registry comes from packs/property-owner-lookup/lib/ and is never edited here.

const SEED_DIR = path.join(process.cwd(), "packs", "ap-inbox", "seed");
const CANNED_DIR = path.join(SEED_DIR, "canned");
const DOC_DIR = path.join(process.cwd(), "public", "demo", "ap-inbox");

const DEMO_DATE = "2026-09-03";
const POST_MONTH = "2026-09";
const WEEK_START = "2026-08-27";
const WEEK_END = "2026-09-02";
const ARRIVAL_DAYS = ["2026-08-27", "2026-08-28", "2026-08-31", "2026-09-01", "2026-09-02"];
const UTILITY_DUE = "2026-09-18";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}
const rand = mulberry32(20260910);
const intBetween = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
function shuffled<T>(arr: readonly T[]): T[] {
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
const pad2 = (n: number) => String(n).padStart(2, "0");
const pad3 = (n: number) => String(n).padStart(3, "0");
export function fmtMoney(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const withCommas = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withCommas}.${pad2(cents % 100)}`;
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Entities: the operating company, then one holding company per registry owner in order.
const entities: Entity[] = entityList();
const entityByCode = new Map(entities.map((e) => [e.entityCode, e]));
const cashOf = (code: string) => entityByCode.get(code)!.cashAccount;

const ledgerAccounts: LedgerAccount[] = [
  { glAccount: "9200-3100", name: "Repairs and maintenance" },
  { glAccount: "9200-3300", name: "Grounds" },
  { glAccount: "9100-2100", name: "Utilities, electric" },
  { glAccount: "9100-2200", name: "Utilities, gas" },
  { glAccount: "9100-2300", name: "Water and sewer" },
  { glAccount: "9200-3150", name: "Locks and securing" },
  { glAccount: "9100-1100", name: "Office expense" },
  { glAccount: "9200-3200", name: "Plumbing" },
  { glAccount: "9200-3400", name: "Pest control" },
  { glAccount: "9200-3500", name: "Roofing" },
  { glAccount: "9200-3600", name: "Tree and lot clearing" },
  { glAccount: "9200-3700", name: "Fencing" },
  { glAccount: "9200-3800", name: "Glass and windows" },
  { glAccount: "9200-3900", name: "Concrete and paving" },
  { glAccount: "9200-4100", name: "Mowing and lot service" },
  { glAccount: "9100-1200", name: "Postage and printing" },
];
const ledgerCodes = new Set(ledgerAccounts.map((l) => l.glAccount));

// Parcels and the system property list (1,600 of 2,000).
const parcels = loadParcels();
assert(parcels.length === 2000, "registry holds 2000 parcels");
const parcelById = new Map(parcels.map((p) => [p.parcelId, p]));
const P = (id: string): ParcelRecord => {
  const p = parcelById.get(id);
  assert(!!p, `parcel ${id} in registry`);
  return p!;
};
const oneLine = (p: ParcelRecord) => `${p.address}, ${p.city}, ${p.state} ${p.zip}`;
const docAddress = (p: ParcelRecord) => `${p.address}, ${p.city} ${p.state}`;
const scriptedIds = new Set(SCRIPTED_PARCELS.map((p) => p.parcelId));
const excluded = new Set<string>(NOT_IN_SYSTEM_LIST);
for (const p of shuffled(parcels.filter((p) => !scriptedIds.has(p.parcelId))).slice(0, 399)) excluded.add(p.parcelId);
assert(excluded.size === 400, "400 parcels left out of the property list");
const systemProperties: SystemProperty[] = parcels
  .filter((p) => !excluded.has(p.parcelId))
  .map((p, i) => ({ propertyCode: `SP-${20001 + i}`, parcelId: p.parcelId, address: oneLine(p), createdInDemo: false }));
assert(systemProperties.length === 1600, "1600 system properties");
const inSystem = new Set(systemProperties.map((s) => s.parcelId));
const streetCount = new Map<string, number>();
for (const p of parcels) streetCount.set(p.address.toLowerCase(), (streetCount.get(p.address.toLowerCase()) ?? 0) + 1);
const uniqueStreet = (p: ParcelRecord) => streetCount.get(p.address.toLowerCase()) === 1;

// Tracker cards: 299 on T-8001 upward plus T-8812 on P-11020. P-10600 and P-11348 have none.
const NO_CARD = new Set(["P-10600", "P-11348", "P-11020"]);
const scriptedCarded = [...scriptedIds].filter((id) => !NO_CARD.has(id));
const deedPool = parcels.filter((p) => p.status === "deed" && inSystem.has(p.parcelId) && !scriptedIds.has(p.parcelId));
const extraCarded = shuffled(deedPool).slice(0, 299 - scriptedCarded.length);
const cardedIds = [...scriptedCarded, ...extraCarded.map((p) => p.parcelId)].sort();
const trackerCards: TrackerCard[] = cardedIds.map((parcelId, i) => ({ cardRef: `T-${8001 + i}`, parcelId, createdInDemo: false }));
trackerCards.push({ cardRef: "T-8812", parcelId: "P-11020", createdInDemo: false });
assert(trackerCards.length === 300, "300 tracker cards");
assert(trackerCards[trackerCards.length - 2].cardRef <= "T-8799", "cards stay below T-8800");
const cardByParcel = new Map(trackerCards.map((c) => [c.parcelId, c.cardRef]));
const cardOf = (parcelId: string) => {
  const ref = cardByParcel.get(parcelId);
  assert(!!ref, `tracker card on ${parcelId}`);
  return ref!;
};

// Parcels for the eight unscripted tracker items: carded, in the list, unique street line, one per city, no Springfield.
const takenCities = new Set<string>();
const unscriptedParcels: ParcelRecord[] = [];
for (const p of extraCarded) {
  if (unscriptedParcels.length === 8) break;
  if (!uniqueStreet(p) || p.city === "Springfield" || takenCities.has(p.city)) continue;
  takenCities.add(p.city);
  unscriptedParcels.push(p);
}
assert(unscriptedParcels.length === 8, "eight parcels for the unscripted tracker items");
const usedParcels = new Set([...scriptedIds, ...unscriptedParcels.map((p) => p.parcelId)]);

// Utility accounts: 30, two unmapped on purpose.
const MPL = "Midwest Power and Light";
const PSG = "Prairie State Gas";
const utilityPool = shuffled(parcels.filter((p) => inSystem.has(p.parcelId) && !usedParcels.has(p.parcelId) && uniqueStreet(p)));
const suffixes = new Set(["044", "118", "131"]);
const nextSuffix = () => {
  for (;;) {
    const s = pad3(intBetween(1, 999));
    if (!suffixes.has(s)) {
      suffixes.add(s);
      return s;
    }
  }
};
const utilityAccounts: UtilityAccount[] = [
  { providerName: MPL, accountNumber: "5520-044", parcelId: "P-10231", serviceAddress: oneLine(P("P-10231")) },
  { providerName: MPL, accountNumber: "5520-118", parcelId: null, serviceAddress: null },
  { providerName: MPL, accountNumber: "5520-131", parcelId: null, serviceAddress: null },
];
let poolIdx = 0;
for (let i = 0; i < 18; i++) {
  const p = utilityPool[poolIdx++];
  utilityAccounts.push({ providerName: MPL, accountNumber: `5520-${nextSuffix()}`, parcelId: p.parcelId, serviceAddress: oneLine(p) });
}
for (let i = 0; i < 9; i++) {
  const p = utilityPool[poolIdx++];
  utilityAccounts.push({ providerName: PSG, accountNumber: `3310-${nextSuffix()}`, parcelId: p.parcelId, serviceAddress: oneLine(p) });
}
assert(utilityAccounts.length === 30, "30 utility accounts");
assert(new Set(utilityAccounts.map((u) => u.accountNumber)).size === 30, "utility account numbers unique");
const mplExtra = utilityAccounts[3]; // I-0020
const psgExtra = utilityAccounts[21]; // I-0010
assert(mplExtra.providerName === MPL && psgExtra.providerName === PSG, "extra utility items on mapped accounts");
const utilityByNumber = new Map(utilityAccounts.map((u) => [u.accountNumber, u]));

// Vendor master: 40 vendors with two to five invoices of history each.
interface VendorSpec {
  name: string;
  aliases?: string[];
  gl: string;
  entities?: string[]; // owner entity codes the vendor has billed
  n: number;
  dollars: [number, number];
  gls?: string[]; // per-entry ledger override, most recent first
  chargeTypes?: (string | null)[];
  first?: Partial<VendorHistoryEntry>;
  base?: number; // most recent invoice number
}
const HOLDING_CODES = entities.filter((e) => e.kind === "holding").map((e) => e.entityCode);
const someHoldings = () => shuffled(HOLDING_CODES).slice(0, intBetween(1, 3));
const VENDOR_SPECS: VendorSpec[] = [
  { name: "Peoria Plumbing Company LLC", aliases: ["Peoria Plumbing Co.", "Peoria Plumbing"], gl: "9200-3100", entities: ["E-101", "E-102"], n: 4, dollars: [180, 640], gls: ["9200-3100", "9200-3100", "9200-3100", "9200-3200"], first: { entityCode: "E-101" }, base: 2274 },
  { name: "Greenway Lawn Care", aliases: ["Greenway Lawn"], gl: "9200-3300", entities: ["E-106", "E-107", "E-109"], n: 5, dollars: [120, 480], base: 1164 },
  {
    name: "Harborview Property Services",
    aliases: ["Harborview"],
    gl: "9100-2100",
    entities: ["E-104", "E-105"],
    n: 5,
    dollars: [1800, 7400],
    gls: ["9100-2100", "9100-2100", "9100-2100", "9100-2200", "9200-3150"],
    chargeTypes: ["electric", "electric", "electric", "gas", "locks and securing"],
    base: 7730,
  },
  { name: "Lakefront Office Supply", aliases: ["Lakefront Office"], gl: "9100-1100", entities: ["E-001"], n: 3, dollars: [40, 260], base: 30842 },
  {
    name: "Summit Roofing",
    gl: "9200-3500",
    entities: ["E-106"],
    n: 4,
    dollars: [900, 3400],
    gls: ["9200-3500", "9200-3100", "9200-3800", "9200-3500"],
    first: { date: "2026-08-06", invoiceNumber: "4471", amount: 190000 },
    base: 4471,
  },
  { name: "Ridgeway Locksmith", gl: "9200-3150", entities: ["E-104", "E-105"], n: 3, dollars: [95, 260], base: 5518 },
  { name: "Prairie Fence Co", aliases: ["Prairie Fence"], gl: "9200-3700", entities: ["E-109"], n: 2, dollars: [400, 1400], base: 3306 },
  { name: "Copperfield Pest Control", gl: "9200-3400", entities: ["E-111"], n: 3, dollars: [120, 260], base: 9915 },
  { name: "Northshore Glass", gl: "9200-3800", entities: ["E-111", "E-112"], n: 2, dollars: [180, 620], base: 2047 },
  { name: "Riverbend Mowing", gl: "9200-4100", entities: ["E-108"], n: 4, dollars: [70, 340], base: 6120 },
  { name: MPL, gl: "9100-2100", entities: ["E-104", "E-106", "E-101", "E-109"], n: 5, dollars: [40, 180], base: 604210 },
  { name: PSG, gl: "9100-2200", entities: ["E-104", "E-108", "E-111"], n: 4, dollars: [30, 140], base: 331880 },
  { name: "Tri-County Print and Postage", gl: "9100-1200", entities: ["E-001"], n: 2, dollars: [30, 160], base: 8804 },
  { name: "Timber Ridge Tree Care", gl: "9200-3600", n: 3, dollars: [300, 1600] },
  { name: "Clearwater Gutter Service", gl: "9200-3100", n: 3, dollars: [150, 520] },
  { name: "Wabash Valley Electric", gl: "9200-3100", n: 2, dollars: [180, 900] },
  { name: "Ironbridge Hauling", gl: "9200-3600", n: 3, dollars: [200, 1100] },
  { name: "Granite Peak Concrete", gl: "9200-3900", n: 2, dollars: [700, 3200] },
  { name: "Cornfield Snow and Ice", gl: "9200-3300", n: 3, dollars: [90, 400] },
  { name: "Stonebrook Appliance Repair", gl: "9200-3100", n: 3, dollars: [110, 480] },
  { name: "Bright Broom Cleaning", gl: "9200-3100", n: 4, dollars: [120, 380] },
  { name: "Heartland Board Up and Secure", gl: "9200-3150", n: 3, dollars: [200, 700] },
  { name: "Lakeside Electrical Contractors", gl: "9200-3100", n: 2, dollars: [220, 1200] },
  { name: "Sandstone Paving", gl: "9200-3900", n: 2, dollars: [900, 4200] },
  { name: "Meadowbrook Lawn and Lot", gl: "9200-4100", n: 4, dollars: [60, 300] },
  { name: "Oak Hollow Fencing", gl: "9200-3700", n: 2, dollars: [500, 1800] },
  { name: "Blue Heron Glass and Mirror", gl: "9200-3800", n: 2, dollars: [160, 700] },
  { name: "Cedar Ridge Plumbing", gl: "9200-3200", n: 3, dollars: [150, 800] },
  { name: "Riverside Drain and Sewer", gl: "9200-3200", n: 2, dollars: [200, 1100] },
  { name: "Tallgrass Mowing", gl: "9200-4100", n: 5, dollars: [50, 240] },
  { name: "Northwind Roofing and Gutters", gl: "9200-3500", n: 2, dollars: [800, 3600] },
  { name: "Crossroads Pest Solutions", gl: "9200-3400", n: 3, dollars: [100, 300] },
  { name: "Fieldstone Masonry", gl: "9200-3900", n: 2, dollars: [600, 2800] },
  { name: "Two Rivers Junk Hauling", gl: "9200-3600", n: 3, dollars: [180, 900] },
  { name: "Hometown Window and Door", gl: "9200-3800", n: 2, dollars: [250, 1300] },
  { name: "Lantern Hill Cleaning Crew", gl: "9200-3100", n: 3, dollars: [110, 420] },
  { name: "Prairie Wind Snow Removal", gl: "9200-3300", n: 2, dollars: [90, 360] },
  { name: "Cardinal Appliance and HVAC", gl: "9200-3100", n: 2, dollars: [140, 900] },
  { name: "Calumet Regional Water", gl: "9100-2300", n: 4, dollars: [30, 160] },
  { name: "Hilltop Stump Grinding", gl: "9200-3600", n: 2, dollars: [150, 600] },
];
assert(VENDOR_SPECS.length === 40, "40 vendor specs");

const nextInvoice = new Map<string, number>();
function makeHistory(v: VendorSpec): VendorHistoryEntry[] {
  const owners = v.entities ?? someHoldings();
  let num = v.base ?? intBetween(1200, 48000);
  let date = v.first?.date ?? addDays("2026-08-31", -intBetween(3, 25));
  const out: VendorHistoryEntry[] = [];
  for (let k = 0; k < v.n; k++) {
    const entityCode = (k === 0 && v.first?.entityCode) || pick(owners);
    const entry: VendorHistoryEntry = {
      date,
      invoiceNumber: String(num),
      amount: intBetween(v.dollars[0], v.dollars[1]) * 100 + intBetween(0, 99),
      glAccount: v.gls?.[k] ?? v.gl,
      cashAccount: cashOf(entityCode),
      entityCode,
      chargeType: v.chargeTypes?.[k] ?? null,
    };
    if (k === 0 && v.first) Object.assign(entry, v.first);
    assert(ledgerCodes.has(entry.glAccount), `ledger ${entry.glAccount} in the chart`);
    out.push(entry);
    num -= intBetween(12, 60);
    date = addDays(date, -intBetween(16, 34));
  }
  nextInvoice.set(v.name, Number(out[0].invoiceNumber) + intBetween(15, 45));
  assert(out[out.length - 1].date >= "2026-03-01", `${v.name} history stays after 2026-03`);
  return out;
}
const vendors: Vendor[] = VENDOR_SPECS.map((v, i) => {
  const history = makeHistory(v);
  return {
    vendorId: `V-${pad3(i + 1)}`,
    name: v.name,
    aliases: v.aliases ?? [],
    lastGlAccount: history[0].glAccount,
    lastCashAccount: history[0].cashAccount,
    lastEntityCode: history[0].entityCode,
    history,
    createdInDemo: false,
  };
});
assert(vendors.length === 40, "40 vendors");
assert(!vendors.some((v) => v.name === "Bluewater Tree Removal"), "Bluewater Tree Removal is not in the master");
const vendorByName = new Map(vendors.map((v) => [v.name, v]));
function takeInvoiceNumber(vendorName: string): string {
  const n = nextInvoice.get(vendorName) ?? intBetween(1200, 9800);
  nextInvoice.set(vendorName, n + intBetween(9, 40));
  return String(n);
}

// Vendor blocks printed on documents. Streets and cities are invented or generic.
const VENDOR_STREETS = ["Wharf St", "Foundry Rd", "Commerce Dr", "Depot St", "Millrace Ave", "Cannery Row", "Granary Ln", "Ironworks Way", "Tannery Rd", "Switchyard Dr", "Kiln St", "Harbor Row", "Sawmill Ct", "Quarry Bend"];
const VENDOR_CITIES = ["Peoria, IL 61603", "Hammond, IN 46320", "Marion, IN 46952", "Decatur, IL 62521", "Springfield, IL 62702", "Kokomo, IN 46901", "Gary, IN 46402", "Rockford, IL 61101", "Fort Wayne, IN 46802", "Muncie, IN 47302"];
const AREA_CODES = ["309", "219", "765", "217", "815", "260"];
const phoneSuffixes = new Set<string>();
const blocks = new Map<string, VendorBlock>();
function block(name: string): VendorBlock {
  let b = blocks.get(name);
  if (!b) {
    let sfx = pad2(intBetween(10, 99));
    while (phoneSuffixes.has(sfx)) sfx = pad2(intBetween(10, 99));
    phoneSuffixes.add(sfx);
    b = { name, street: `${intBetween(100, 2400)} ${pick(VENDOR_STREETS)}`, cityLine: pick(VENDOR_CITIES), phone: `(${pick(AREA_CODES)}) 555-01${sfx}` };
    blocks.set(name, b);
  }
  return b;
}
const BILL_TO = ["Lakeshore Lien Partners", "PO Box 2140", "Hammond, IN 46325"];

// Inbox items. Sources: 12 tracker approved, 8 email, 4 utility portal, 2 mail scan.
interface Lot {
  parcelId: string;
  amount: number | null; // cents; null when the list gives no per-lot price
  chargeType?: string;
  description?: string;
}
interface ItemSpec {
  itemId: string;
  source: Source;
  kind: ExtractionKind;
  docKind: "pdf" | "svg";
  vendor: string; // master name, or the unknown vendor's name
  payee?: string; // as printed when it differs from the master name
  invoiceNumber?: string;
  invoiceDate?: string;
  total: number | null; // cents; null when the document hides it
  property?: string; // parcel id of a single-property item
  serviceLines?: string[]; // printed service address, when not the parcel's own line
  parcelRefs?: string[];
  lots?: Lot[];
  cardParcel?: string; // tracker items: the parcel whose card approved the invoice, when not the first lot
  utilityAccount?: string;
  lines?: { description: string; amount: number }[]; // office items with several lines
  description?: string;
  notesHint: string;
  confidence?: Partial<Extraction["confidence"]>;
  fileName?: string;
}
const U = unscriptedParcels;
const STATEMENT: Lot[] = [
  { parcelId: "P-11100", amount: 61240, chargeType: "electric" },
  { parcelId: "P-11101", amount: 48310, chargeType: "gas" },
  { parcelId: "P-11102", amount: 92500, chargeType: "locks and securing" },
  { parcelId: "P-11103", amount: 73865, chargeType: "electric" },
  { parcelId: "P-11104", amount: 55720, chargeType: "gas" },
  { parcelId: "P-11105", amount: 88000, chargeType: "locks and securing" },
  { parcelId: "P-11106", amount: 66905, chargeType: "electric" },
  { parcelId: "P-11107", amount: 51480, chargeType: "gas" },
  { parcelId: "P-11108", amount: 97500, chargeType: "locks and securing" },
  { parcelId: "P-11109", amount: 63320, chargeType: "electric" },
];
assert(STATEMENT.reduce((s, l) => s + (l.amount ?? 0), 0) === 698840, "statement lines sum to 6,988.40");
const CHARGE_TEXT: Record<string, string> = {
  electric: "Electric service, Jul 15 to Aug 14",
  gas: "Gas service, Jul 15 to Aug 14",
  "locks and securing": "Lock change and board up",
};
const ITEM_SPECS: ItemSpec[] = [
  { itemId: "I-0001", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Timber Ridge Tree Care", total: 65000, property: U[0].parcelId, description: "Trim and remove dead limbs", notesHint: "Tree trimming" },
  { itemId: "I-0002", source: "mailScan", kind: "invoice", docKind: "pdf", vendor: "Tri-County Print and Postage", total: 6450, description: "Postage and mailing envelopes", notesHint: "Postage" },
  { itemId: "I-0003", source: "email", kind: "invoice", docKind: "pdf", vendor: "Bluewater Tree Removal", invoiceNumber: "1088", total: 48000, property: "P-10412", description: "Remove fallen tree and haul away", notesHint: "Tree removal" },
  { itemId: "I-0004", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Clearwater Gutter Service", total: 28500, property: U[1].parcelId, description: "Clean and reattach gutters", notesHint: "Gutter cleaning" },
  {
    itemId: "I-0005", source: "email", kind: "invoice", docKind: "pdf", vendor: "Peoria Plumbing Company LLC", payee: "Peoria Plumbing Co.", invoiceNumber: "2291", total: 26500, property: "P-12003", parcelRefs: ["P-12003"],
    description: "Replace shutoff valve and supply line", notesHint: "Plumbing repair", confidence: { payee: 0.96, invoiceNumber: 0.97, invoiceDate: 0.95, totalAmount: 0.98, address: 0.94 },
  },
  { itemId: "I-0006", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Cedar Ridge Plumbing", total: 41000, property: U[2].parcelId, description: "Repair leaking supply line", notesHint: "Plumbing repair" },
  {
    itemId: "I-0007", source: "trackerApproved", kind: "list", docKind: "svg", vendor: "Greenway Lawn Care", invoiceNumber: "1181", total: 45000, fileName: "lots-photo-I-0007.svg", cardParcel: "P-10601",
    lots: ["P-10600", "P-10601", "P-10602", "P-10603", "P-10604", "P-10605", "P-10606", "P-10607", "P-10608"].map((parcelId) => ({ parcelId, amount: null, description: "Lawn service" })),
    notesHint: "Monthly lawn service, nine lots", confidence: { payee: 0.9, invoiceNumber: 0.86, invoiceDate: 0.88, totalAmount: 0.91, address: 0.87 },
  },
  { itemId: "I-0008", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Granite Peak Concrete", total: 125000, property: U[3].parcelId, description: "Replace front walk, 30 ft", notesHint: "Concrete walk" },
  { itemId: "I-0009", source: "email", kind: "invoice", docKind: "pdf", vendor: "Summit Roofing", invoiceNumber: "4471", invoiceDate: "2026-08-06", total: 190000, property: "P-10455", description: "Patch roof and replace flashing", notesHint: "Roof repair" },
  { itemId: "I-0010", source: "utilityPortal", kind: "invoice", docKind: "pdf", vendor: PSG, total: 5840, utilityAccount: psgExtra.accountNumber, notesHint: "Gas service" },
  { itemId: "I-0011", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Ridgeway Locksmith", total: 14000, property: "P-11020", description: "Rekey front and rear doors", notesHint: "Lock change" },
  { itemId: "I-0012", source: "email", kind: "statement", docKind: "pdf", vendor: "Harborview Property Services", total: 698840, lots: STATEMENT, notesHint: "Property services, ten properties" },
  { itemId: "I-0013", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Riverbend Mowing", total: 17000, lots: [{ parcelId: "P-10630", amount: 8500, description: "Mow and trim lot" }, { parcelId: "P-10631", amount: 8500, description: "Mow and trim lot" }], notesHint: "Lot mowing, two lots" },
  { itemId: "I-0014", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Oak Hollow Fencing", total: 89000, property: U[4].parcelId, description: "Install rear fence panels", notesHint: "Fence install" },
  { itemId: "I-0015", source: "email", kind: "invoice", docKind: "pdf", vendor: "Prairie Fence Co", total: 72500, property: "P-11348", description: "Replace 40 ft of chain link fence", notesHint: "Fence repair" },
  { itemId: "I-0016", source: "trackerApproved", kind: "list", docKind: "pdf", vendor: "Greenway Lawn Care", total: 15000, lots: [{ parcelId: "P-10620", amount: 6000, description: "Lawn service" }, { parcelId: "P-10621", amount: 5000, description: "Lawn service" }, { parcelId: "P-10622", amount: 4000, description: "Lawn service" }], notesHint: "Lawn service, three lots" },
  { itemId: "I-0017", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Heartland Board Up and Secure", total: 32000, property: U[5].parcelId, description: "Board up rear windows and door", notesHint: "Board up" },
  { itemId: "I-0018", source: "utilityPortal", kind: "invoice", docKind: "pdf", vendor: MPL, total: 9630, utilityAccount: "5520-118", notesHint: "Electric service" },
  {
    itemId: "I-0019", source: "mailScan", kind: "invoice", docKind: "svg", vendor: "Lakefront Office Supply", total: 21275, fileName: "mail-scan-I-0019.svg",
    lines: [{ description: "Copier paper, 10 cases", amount: 14990 }, { description: "Toner cartridges, 2", amount: 4285 }, { description: "Mailing envelopes, 1 box", amount: 2000 }],
    notesHint: "Office supplies", confidence: { payee: 0.88, invoiceNumber: 0.86, invoiceDate: 0.87, totalAmount: 0.55, address: 0.9 },
  },
  { itemId: "I-0020", source: "utilityPortal", kind: "invoice", docKind: "pdf", vendor: MPL, total: 11265, utilityAccount: mplExtra.accountNumber, notesHint: "Electric service" },
  {
    itemId: "I-0021", source: "email", kind: "invoice", docKind: "pdf", vendor: "Copperfield Pest Control", total: null, property: "P-11702", description: "Quarterly pest treatment", notesHint: "Pest treatment",
    confidence: { totalAmount: 0.1 },
  },
  { itemId: "I-0022", source: "utilityPortal", kind: "invoice", docKind: "pdf", vendor: MPL, total: 7110, utilityAccount: "5520-044", notesHint: "Electric service" },
  { itemId: "I-0023", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Tallgrass Mowing", total: 7500, property: U[6].parcelId, description: "Mow and trim lot", notesHint: "Lot mowing" },
  { itemId: "I-0024", source: "email", kind: "invoice", docKind: "pdf", vendor: "Lakefront Office Supply", total: 8900, lines: [{ description: "Printer paper, 4 cases", amount: 6200 }, { description: "Address labels", amount: 2700 }], notesHint: "Office supplies" },
  { itemId: "I-0025", source: "trackerApproved", kind: "invoice", docKind: "pdf", vendor: "Stonebrook Appliance Repair", total: 24000, property: U[7].parcelId, description: "Replace water heater element", notesHint: "Appliance repair" },
  { itemId: "I-0026", source: "email", kind: "invoice", docKind: "pdf", vendor: "Northshore Glass", total: 33000, property: "P-11702", serviceLines: ["14 Elm St, Springfield"], description: "Replace broken window pane", notesHint: "Window replacement" },
];
assert(ITEM_SPECS.length === 26, "26 item specs");
ITEM_SPECS.forEach((s, i) => assert(s.itemId === `I-${String(i + 1).padStart(4, "0")}`, `item ${i + 1} id`));

function receivedAt(index: number): string {
  const dayIdx = Math.floor((index * ARRIVAL_DAYS.length) / ITEM_SPECS.length);
  const first = Math.ceil((dayIdx * ITEM_SPECS.length) / ARRIVAL_DAYS.length);
  const count = Math.ceil(((dayIdx + 1) * ITEM_SPECS.length) / ARRIVAL_DAYS.length) - first;
  const slot = Math.floor(540 / count);
  const minutes = 7 * 60 + (index - first) * slot + intBetween(0, slot - 12);
  assert(minutes < 17 * 60, "arrivals before 17:00");
  return `${ARRIVAL_DAYS[dayIdx]}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}:00Z`;
}
function confidence(over: Partial<Extraction["confidence"]> | undefined): Extraction["confidence"] {
  const j = () => Math.round((92 + rand() * 7)) / 100;
  return { payee: j(), invoiceNumber: j(), invoiceDate: j(), totalAmount: j(), address: j(), ...over };
}

const items: InboxItem[] = [];
const canned = new Map<string, Extraction>();
const docs: DocumentSpec[] = [];
const svgs = new Map<string, string>();

ITEM_SPECS.forEach((spec, index) => {
  const received = receivedAt(index);
  const invoiceDate = spec.invoiceDate ?? addDays(received.slice(0, 10), -intBetween(2, 6));
  assert(invoiceDate.startsWith("2026-08"), `${spec.itemId} invoice date in August`);
  const payee = spec.payee ?? spec.vendor;
  const invoiceNumber = spec.invoiceNumber ?? (vendorByName.has(spec.vendor) ? takeInvoiceNumber(spec.vendor) : String(intBetween(1200, 9800)));
  const fileName = spec.fileName ?? `${slug(payee)}-${invoiceNumber}.pdf`;
  const utility = spec.utilityAccount ? utilityByNumber.get(spec.utilityAccount) : undefined;
  if (spec.utilityAccount) assert(!!utility, `${spec.itemId} utility account exists`);
  const property = spec.property ? P(spec.property) : utility?.parcelId ? P(utility.parcelId) : null;
  const serviceLines = spec.serviceLines ?? (property && !spec.lots ? [docAddress(property)] : []);
  const total = spec.total === null ? null : fmtMoney(spec.total);

  let lineItems: ExtractedLine[];
  if (spec.lots) {
    lineItems = spec.lots.map((lot) => ({
      description: lot.description ?? (lot.chargeType ? CHARGE_TEXT[lot.chargeType] : "Service"),
      address: docAddress(P(lot.parcelId)),
      amount: lot.amount === null ? null : fmtMoney(lot.amount),
      chargeType: lot.chargeType ?? null,
    }));
    const stated = spec.lots.map((l) => l.amount);
    if (stated.every((a) => a !== null)) assert(stated.reduce((s, a) => s + (a ?? 0), 0) === spec.total, `${spec.itemId} lots sum to the total`);
  } else if (spec.lines) {
    assert(spec.lines.reduce((s, l) => s + l.amount, 0) === spec.total, `${spec.itemId} lines sum to the total`);
    lineItems = spec.lines.map((l) => ({ description: l.description, address: null, amount: fmtMoney(l.amount), chargeType: null }));
  } else if (utility) {
    const kind = utility.providerName === MPL ? "electric" : "gas";
    lineItems = [{ description: kind === "electric" ? "Electric service, Jul 20 to Aug 19" : "Gas service, Jul 20 to Aug 19", address: serviceLines[0] ?? null, amount: total, chargeType: kind }];
  } else {
    lineItems = [{ description: spec.description ?? "Service", address: serviceLines[0] ?? null, amount: total, chargeType: null }];
  }

  const trackerCardRef = spec.source === "trackerApproved" ? cardOf(spec.cardParcel ?? spec.property ?? spec.lots![0].parcelId) : null;
  const noticeText = utility ? `Your ${utility.providerName} bill for account ${utility.accountNumber} is ready. Amount due ${total} by ${prettyDate(UTILITY_DUE)}.` : null;

  items.push({
    itemId: spec.itemId,
    source: spec.source,
    receivedAt: received,
    fileName,
    documentKind: spec.docKind,
    trackerCardRef,
    noticeText,
    state: "New",
    scripted: true,
    returnNote: null,
  });
  canned.set(spec.itemId, {
    kind: spec.kind,
    payee,
    invoiceNumber,
    invoiceDate,
    totalAmount: total,
    serviceAddressLines: serviceLines,
    parcelRefs: spec.parcelRefs ?? [],
    utilityAccountNumber: spec.utilityAccount ?? null,
    lineItems,
    confidence: confidence(spec.confidence),
    notesHint: spec.notesHint,
  });

  const vendorBlock = block(payee);
  const docLines: DocLine[] = lineItems.map((l) => ({ ...l }));
  if (spec.docKind === "svg" && spec.kind === "list") {
    svgs.set(
      fileName,
      renderNotesSvg({
        heading: payee,
        subheading: "Aug lawn service, monthly",
        refLine: `Inv ${invoiceNumber}   ${prettyDate(invoiceDate)}`,
        lots: lineItems.map((l) => l.address ?? ""),
        totalLine: `Total  ${total}`,
        footer: `Bill to ${BILL_TO[0]}`,
      }),
    );
  } else if (spec.docKind === "svg") {
    svgs.set(
      fileName,
      renderScanSvg({
        vendor: vendorBlock,
        billTo: BILL_TO,
        invoiceNumber,
        invoiceDate,
        lines: lineItems.map((l) => ({ description: l.description, amount: l.amount ?? "" })),
        total: total ?? "",
      }),
    );
  } else {
    const extra: string[] = [];
    if (utility) {
      const kwh = intBetween(180, 760);
      extra.push(`Billing period Jul 20, 2026 to Aug 19, 2026`);
      extra.push(utility.providerName === MPL ? `Usage ${kwh} kWh` : `Usage ${intBetween(8, 60)} therms`);
    }
    docs.push({
      itemId: spec.itemId,
      fileName,
      kind: utility ? "utility" : spec.kind === "statement" ? "statement" : "invoice",
      vendor: vendorBlock,
      invoiceNumber,
      invoiceDate,
      dueDate: utility ? UTILITY_DUE : null,
      billTo: BILL_TO,
      serviceLines,
      parcelRefs: spec.parcelRefs ?? [],
      utilityAccountNumber: spec.utilityAccount ?? null,
      lines: docLines,
      total,
      note: spec.notesHint,
      extra,
    });
  }
});

// Checks on the mix and the scripted facts.
const count = (s: Source) => items.filter((i) => i.source === s).length;
assert(count("trackerApproved") === 12 && count("email") === 8 && count("utilityPortal") === 4 && count("mailScan") === 2, "route mix 12, 8, 4, 2");
assert(new Set(items.map((i) => i.fileName)).size === 26, "file names unique");
assert(items.every((i, k) => k === 0 || i.receivedAt > items[k - 1].receivedAt), "arrivals in item order");
assert(items.find((i) => i.itemId === "I-0011")!.trackerCardRef === "T-8812", "I-0011 on card T-8812");
assert(!cardByParcel.has("P-11348") && !cardByParcel.has("P-10600"), "P-11348 and P-10600 have no card");
assert(canned.get("I-0012")!.lineItems.length === 10 && canned.get("I-0007")!.lineItems.length === 9, "statement and list line counts");
assert(canned.get("I-0021")!.totalAmount === null, "I-0021 total unreadable");
assert(vendorByName.get("Summit Roofing")!.history[0].invoiceNumber === "4471", "Summit Roofing paid 4471");
for (const spec of ITEM_SPECS) {
  if (spec.property) assert(inSystem.has(spec.property), `${spec.itemId} parcel in the property list`);
  if (spec.source === "trackerApproved" && spec.property) assert(cardByParcel.has(spec.property), `${spec.itemId} parcel has a card`);
}

const seed: Seed = {
  demoDate: DEMO_DATE,
  postMonth: POST_MONTH,
  weekStart: WEEK_START,
  weekEnd: WEEK_END,
  items,
  vendors,
  entities,
  ledgerAccounts,
  systemProperties,
  utilityAccounts,
  trackerCards,
};

async function main() {
  fs.rmSync(CANNED_DIR, { recursive: true, force: true });
  fs.rmSync(DOC_DIR, { recursive: true, force: true });
  fs.mkdirSync(CANNED_DIR, { recursive: true });
  fs.mkdirSync(DOC_DIR, { recursive: true });
  fs.writeFileSync(path.join(SEED_DIR, "seed.json"), JSON.stringify(seed, null, 2) + "\n");
  for (const [itemId, extraction] of canned) fs.writeFileSync(path.join(CANNED_DIR, `${itemId}.json`), JSON.stringify(extraction, null, 2) + "\n");
  let largest = 0;
  for (const doc of docs) largest = Math.max(largest, await writePdf(DOC_DIR, doc));
  for (const [fileName, svg] of svgs) largest = Math.max(largest, writeSvg(DOC_DIR, fileName, svg));
  assert(largest < 200 * 1024, "every document under 200 KB");
  console.log(
    `wrote seed.json: ${items.length} items (${count("trackerApproved")} tracker approved, ${count("email")} email, ${count("utilityPortal")} utility portal, ${count("mailScan")} mail scan), ` +
      `${vendors.length} vendors, ${entities.length} entities, ${ledgerAccounts.length} ledger accounts, ${systemProperties.length} system properties, ` +
      `${utilityAccounts.length} utility accounts, ${trackerCards.length} tracker cards; ${canned.size} canned extractions; ${docs.length} PDFs and ${svgs.size} SVGs (largest ${largest} bytes)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
