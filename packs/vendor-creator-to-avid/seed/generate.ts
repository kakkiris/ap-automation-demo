// Seed generator for the vendor master one-way sync pack.
//
// Run from the repo root: npx tsx packs/vendor-creator-to-avid/seed/generate.ts
//
// Seeded generator (mulberry32) behind one fixed constant. No clock, no Math.random,
// no current date: running it twice writes byte-identical output. Every vendor name,
// address, amount, date, and tax digit is invented; the word lists live in this file.
// Records the acceptance checks name are pinned by id below; everything else is drawn
// from the pools. Normalization and scoring come from ../lib/normalize so the seed's
// expected outcomes and the running matcher can never disagree. Every rule the pack
// relies on is asserted before the file is written; a violation throws.

import fs from "node:fs";
import path from "node:path";
import type {
  AvidVendor, IncomingInvoice, InvoiceFlag, MatchCandidate, MatchReason, Seed, YardiVendor,
} from "../lib/types";
import { MATCH_REASONS } from "../lib/types";
import {
  NEAR_MATCH_THRESHOLD, normalizeName, normalizeText, sameAddress, sameNormalizedName, suffixDiffers, tokenOverlap,
} from "../lib/normalize";

const ROOT = process.cwd();
const PACK_DIR = path.join(ROOT, "packs", "vendor-creator-to-avid");
if (!fs.existsSync(path.join(ROOT, "package.json")) || !fs.existsSync(path.join(PACK_DIR, "lib", "normalize.ts"))) {
  throw new Error("run from the ap-automation-demo repo root: npx tsx packs/vendor-creator-to-avid/seed/generate.ts");
}
const OUT_FILE = path.join(PACK_DIR, "seed", "seed.json");

// Fixed constants. Volumes follow the coordinator's ruling, not the pack's own totals.
const RNG_SEED = 20260901;
const DEMO_DATE = "2026-09-01";
const EARLIEST_DATE = "2023-01-09";
const NEXT_YARDI_NUMBER = 125;
const NEXT_AVID_NUMBER = 113;
const YARDI_DENSE_MAX = 124; // V-Y-0001 through V-Y-0124, minus the gaps
const YARDI_GAPS = [7, 38, 61, 90, 102, 111]; // ids left unused
const YARDI_TAIL = 130; // the inactive vendor at the end of the id range
const AVID_COUNT = 112;
const CLEAN_CREATION_NUMBERS = [118, 121, 122, 123, 124]; // active, in Yardi, no Avid match at all
const INACTIVE_NUMBERS = [73, 130]; // inactive, no Avid match at all
const NEAR_MATCH_NUMBERS = [117, 119]; // held pairs
const AVID_SLOT_BRIGHTLINE = 31; // V-A-0031 is the twin of V-Y-0044
const AVID_SLOT_PW = 88;
const AVID_SLOT_TIDEWATER = 92;
const AVID_UNKNOWN_TAX_COUNT = 6; // a few Avid twins carry no tax digits
const RESERVED_NUMBERS = new Set([150, 188, 1000, 1500]); // never an address number or an amount
const KNOWN_INVOICE_COUNT = 11;
const LIVE_VENDOR_NAME = "Marlin Bay Cleaning"; // created by the presenter in beat 1
const FIRST_SEEN_PAYEE = "Keys Gate Fencing"; // INV-5007, in neither master

// Seeded random helpers.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}
const rand = mulberry32(RNG_SEED);
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
const check = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`seed check failed: ${msg}`);
};

// Dates as whole days from the epoch, UTC only, so the machine's zone never matters.
const DAY_MS = 86_400_000;
function toDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}
const fromDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const randomDate = (lo: string, hi: string) => fromDay(intBetween(toDay(lo), toDay(hi)));
const daysBetween = (from: string, to: string) => toDay(to) - toDay(from);

// Word lists. Invented place words only; no person names, no client words.

const PLACE_FIRST = [
  "Palmetto", "Seagrass", "Heron", "Osprey", "Pelican", "Sandpiper", "Mangrove", "Cypress", "Coquina", "Sawgrass",
  "Lantern", "Kestrel", "Cormorant", "Ibis", "Driftwood", "Saltgrass", "Seagrape", "Turtle", "Egret", "Marlin",
  "Tarpon", "Snook", "Sable", "Loggerhead", "Spoonbill", "Anhinga", "Bayberry", "Sandbar", "Sunfish", "Manatee",
];
const PLACE_SECOND = [
  "Bay", "Key", "Ridge", "Harbor", "Shore", "Creek", "Grove", "Point", "Cove", "Landing",
  "Inlet", "Sound", "Hammock", "Bluff", "Pass", "Reach", "Isle", "Run",
];
// One fixed spelling per trade so no generated name is a token subset of another.
const TRADES = [
  "Landscaping", "Plumbing", "Roofing", "Pressure Washing", "Pest Control",
  "Fencing", "Cleaning", "Electrical", "Legal Group", "Supply",
];
const SUFFIXES: { text: string; weight: number }[] = [
  { text: "", weight: 40 }, { text: "LLC", weight: 30 }, { text: "Inc", weight: 15 }, { text: "Co", weight: 15 },
];
const STREETS = [
  "Palmetto", "Seagrass", "Cypress", "Marlin Bay", "Heron", "Osprey", "Pelican", "Sandpiper", "Mangrove", "Coquina",
  "Sawgrass", "Lantern Key", "Driftwood", "Saltgrass", "Seagrape", "Tarpon", "Snook", "Bayberry", "Sunfish", "Sea Oats",
  "Kestrel", "Cormorant", "Ibis", "Egret", "Loggerhead", "Spoonbill", "Sable Palm", "Sandbar", "Coral Ridge", "Turtle Run",
];
const STREET_SUFFIXES = ["Dr", "Ct", "Ln", "Row", "Way", "Blvd", "Ave", "St", "Pl"];

// Scripted records, exactly as the pack and the coordinator name them.

const yid = (n: number) => `V-Y-${String(n).padStart(4, "0")}`;
const aid = (n: number) => `V-A-${String(n).padStart(4, "0")}`;
const numberOf = (id: string) => Number(id.slice(4));

const SCRIPTED_YARDI = new Map<number, YardiVendor>([
  [44, { yardi_vendor_id: yid(44), name: "Brightline Landscaping", address_line: "200 Palmetto Row", status: "active", created_at: "2025-03-02", tax_id_last4: "1930" }],
  [117, { yardi_vendor_id: yid(117), name: "PW Maintenance LLC", address_line: "41 Marlin Bay Dr", status: "active", created_at: "2026-08-30", tax_id_last4: "4471" }],
  [119, { yardi_vendor_id: yid(119), name: "Tidewater Plumbing Co", address_line: "118 Snook Creek Way", status: "active", created_at: "2026-08-28", tax_id_last4: "3390" }],
  [121, { yardi_vendor_id: yid(121), name: "Coral Ridge Pressure Washing", address_line: "9 Seagrass Ct", status: "active", created_at: "2026-09-01", tax_id_last4: "2210" }],
  [130, { yardi_vendor_id: yid(130), name: "Old Harbor Fencing", address_line: "3 Cypress Ln", status: "inactive", created_at: "2024-02-11", tax_id_last4: "8804" }],
]);
const SCRIPTED_AVID: AvidVendor[] = [
  { avid_vendor_id: aid(AVID_SLOT_PW), name: "P.W. Maintenance", address_line: "41 Marlin Bay Dr", created_at: "2025-11-12", source: "seed", tax_id_last4: "4471" },
  { avid_vendor_id: aid(AVID_SLOT_TIDEWATER), name: "Tidewater Plumbing Supply", address_line: "7 Sandbar Isle Ct", created_at: "2024-06-17", source: "seed", tax_id_last4: "7712" },
];

// Names the pools must never produce: the scripted names, the live-created vendor, and the first-seen payee.
const RESERVED_NAMES = new Set(
  [...[...SCRIPTED_YARDI.values()].map((v) => v.name), ...SCRIPTED_AVID.map((v) => v.name), LIVE_VENDOR_NAME, FIRST_SEEN_PAYEE].map(normalizeName),
);

// Generators for names, addresses, and tax digits. Each place pair is used at most once,
// so two generated names share at most one place token, and the token overlap between any
// two of them stays at or below 0.75, under the 0.85 hold threshold.

const placePairs = shuffled(PLACE_FIRST.flatMap((f) => PLACE_SECOND.map((s) => `${f} ${s}`)));
let placePairIndex = 0;
const usedNames = new Set<string>();
function pickSuffix(): string {
  const total = SUFFIXES.reduce((sum, s) => sum + s.weight, 0);
  let roll = rand() * total;
  for (const s of SUFFIXES) {
    roll -= s.weight;
    if (roll < 0) return s.text;
  }
  return "";
}
function nextName(): string {
  for (;;) {
    const pair = placePairs[placePairIndex++];
    check(pair !== undefined, "ran out of place pairs");
    const trade = pick(TRADES);
    const suffix = pickSuffix();
    const name = suffix ? `${pair} ${trade} ${suffix}` : `${pair} ${trade}`;
    const norm = normalizeName(name);
    if (RESERVED_NAMES.has(norm) || usedNames.has(norm)) continue;
    check(norm.split(" ").length >= 3, `generated name has fewer than three tokens: ${name}`);
    usedNames.add(norm);
    return name;
  }
}

const usedAddresses = new Set<string>();
for (const v of SCRIPTED_YARDI.values()) usedAddresses.add(normalizeText(v.address_line));
for (const v of SCRIPTED_AVID) usedAddresses.add(normalizeText(v.address_line));
function addressNumber(): number {
  for (;;) {
    const roll = rand();
    const n = roll < 0.3 ? intBetween(1, 99) : roll < 0.8 ? intBetween(100, 999) : intBetween(1001, 9999);
    if (!RESERVED_NUMBERS.has(n)) return n;
  }
}
function nextAddress(): string {
  for (;;) {
    const line = `${addressNumber()} ${pick(STREETS)} ${pick(STREET_SUFFIXES)}`;
    const norm = normalizeText(line);
    if (usedAddresses.has(norm)) continue;
    usedAddresses.add(norm);
    return line;
  }
}

const usedTax = new Set<string>();
for (const v of SCRIPTED_YARDI.values()) usedTax.add(v.tax_id_last4);
for (const v of SCRIPTED_AVID) if (v.tax_id_last4) usedTax.add(v.tax_id_last4);
function nextTax(): string {
  for (;;) {
    const digits = String(intBetween(0, 9999)).padStart(4, "0");
    if (usedTax.has(digits)) continue;
    usedTax.add(digits);
    return digits;
  }
}

// Yardi vendors, in id order.

type Role = "exact" | "near" | "clean" | "inactive";
function roleOf(n: number): Role {
  if (NEAR_MATCH_NUMBERS.includes(n)) return "near";
  if (CLEAN_CREATION_NUMBERS.includes(n)) return "clean";
  if (INACTIVE_NUMBERS.includes(n)) return "inactive";
  return "exact";
}

const yardiNumbers: number[] = [];
for (let n = 1; n <= YARDI_DENSE_MAX; n++) if (!YARDI_GAPS.includes(n)) yardiNumbers.push(n);
yardiNumbers.push(YARDI_TAIL);

const yardi: YardiVendor[] = yardiNumbers.map((n) => {
  const scripted = SCRIPTED_YARDI.get(n);
  if (scripted) {
    usedNames.add(normalizeName(scripted.name));
    return scripted;
  }
  const role = roleOf(n);
  const created_at =
    role === "clean" ? randomDate("2026-08-26", DEMO_DATE)
    : role === "inactive" ? randomDate(EARLIEST_DATE, "2025-06-30")
    : randomDate(EARLIEST_DATE, DEMO_DATE);
  return {
    yardi_vendor_id: yid(n),
    name: nextName(),
    address_line: nextAddress(),
    status: role === "inactive" ? "inactive" : "active",
    created_at,
    tax_id_last4: nextTax(),
  };
});
const yardiByNumber = new Map(yardi.map((v) => [numberOf(v.yardi_vendor_id), v]));

// Avid vendors: one exact twin per exact-role Yardi vendor (same raw name, same raw address,
// created the same day or within a week), plus the two scripted near-match records.
// Avid ids were handed out as invoices arrived, in a different order from Yardi's, so the
// twins take a seeded shuffle of the free slots; V-A-0031 is pinned to Brightline.

const exactYardi = yardi.filter((v) => roleOf(numberOf(v.yardi_vendor_id)) === "exact");
const freeSlots: number[] = [];
for (let n = 1; n <= AVID_COUNT; n++) {
  if (n !== AVID_SLOT_BRIGHTLINE && n !== AVID_SLOT_PW && n !== AVID_SLOT_TIDEWATER) freeSlots.push(n);
}
const slotOrder = shuffled(freeSlots);
const unknownTax = new Set(shuffled(exactYardi.filter((v) => v.yardi_vendor_id !== yid(44))).slice(0, AVID_UNKNOWN_TAX_COUNT).map((v) => v.yardi_vendor_id));
const twinByYardi = new Map<string, AvidVendor>();
let slotIndex = 0;
for (const y of exactYardi) {
  const isBrightline = y.yardi_vendor_id === yid(44);
  const slot = isBrightline ? AVID_SLOT_BRIGHTLINE : slotOrder[slotIndex++];
  const created_at = isBrightline ? y.created_at : fromDay(Math.min(toDay(y.created_at) + intBetween(0, 6), toDay(DEMO_DATE)));
  twinByYardi.set(y.yardi_vendor_id, {
    avid_vendor_id: aid(slot),
    name: y.name,
    address_line: y.address_line,
    created_at,
    source: "seed",
    tax_id_last4: unknownTax.has(y.yardi_vendor_id) ? null : y.tax_id_last4,
  });
}
const avid: AvidVendor[] = [...twinByYardi.values(), ...SCRIPTED_AVID].sort((a, b) => numberOf(a.avid_vendor_id) - numberOf(b.avid_vendor_id));
const avidById = new Map(avid.map((v) => [v.avid_vendor_id, v]));

// Match outcomes, computed only with the library.
// Exact: same normalized name, same address, and no suffix or punctuation difference in the raw name.
// Near: same normalized name with a different address, a suffix difference, or token overlap at
// or above the threshold. The PW pair shares a name and an address but differs by suffix, which
// is exactly why it is held rather than skipped.

type Outcome = { kind: "exact" | "near"; avid: AvidVendor } | { kind: "none" };
function outcomeOf(y: YardiVendor): Outcome {
  const exact = avid.find((a) => sameNormalizedName(y.name, a.name) && sameAddress(y.address_line, a.address_line) && !suffixDiffers(y.name, a.name));
  if (exact) return { kind: "exact", avid: exact };
  const near = avid.find((a) => sameNormalizedName(y.name, a.name) || tokenOverlap(y.name, a.name) >= NEAR_MATCH_THRESHOLD);
  if (near) return { kind: "near", avid: near };
  return { kind: "none" };
}

function reasonsFor(y: YardiVendor, a: AvidVendor): MatchReason[] {
  const reasons: MatchReason[] = [];
  if (sameNormalizedName(y.name, a.name)) reasons.push(MATCH_REASONS.sameNormalizedName);
  else if (tokenOverlap(y.name, a.name) >= NEAR_MATCH_THRESHOLD) reasons.push(MATCH_REASONS.similarName);
  reasons.push(sameAddress(y.address_line, a.address_line) ? MATCH_REASONS.sameAddress : MATCH_REASONS.differentAddress);
  if (suffixDiffers(y.name, a.name)) reasons.push(MATCH_REASONS.suffixDifference);
  if (a.tax_id_last4 !== null) reasons.push(a.tax_id_last4 === y.tax_id_last4 ? MATCH_REASONS.sameTaxLast4 : MATCH_REASONS.differentTaxLast4);
  return reasons;
}

const match_candidates: MatchCandidate[] = NEAR_MATCH_NUMBERS.map((n) => {
  const y = yardiByNumber.get(n)!;
  const outcome = outcomeOf(y);
  check(outcome.kind === "near", `${y.yardi_vendor_id} should be a near match, got ${outcome.kind}`);
  const a = (outcome as { avid: AvidVendor }).avid;
  return {
    yardi_vendor_id: y.yardi_vendor_id,
    avid_vendor_id: a.avid_vendor_id,
    score: tokenOverlap(y.name, a.name),
    reasons: reasonsFor(y, a),
    decision: "none",
  };
});

// Incoming invoices: one day's arrivals, INV-5001 through INV-5015.

function amount(): number {
  for (;;) {
    const cents = intBetween(8_000, 480_000);
    const dollars = cents / 100;
    if (!RESERVED_NUMBERS.has(dollars)) return dollars;
  }
}
function suffixVariant(name: string): string {
  const variant = name.endsWith(" LLC") ? name.slice(0, -4) : name.endsWith(" Co") ? name.slice(0, -3) : `${name} Inc`;
  check(sameNormalizedName(name, variant), `suffix variant must normalize the same: ${name} / ${variant}`);
  return variant;
}
const brightline = yardiByNumber.get(44)!;
const knownVendors = [brightline, ...shuffled(exactYardi.filter((v) => v !== brightline)).slice(0, KNOWN_INVOICE_COUNT - 1)];
const knownPayees = knownVendors.map((v, i) => (i === 0 ? "Brightline Landscaping LLC" : i === 5 ? suffixVariant(v.name) : v.name));
const secondYardiOnly = yardiByNumber.get(123)!;

const incoming_invoices: IncomingInvoice[] = [];
let knownIndex = 0;
for (let n = 5001; n <= 5015; n++) {
  const invoice_id = `INV-${n}`;
  if (n === 5004) {
    incoming_invoices.push({ invoice_id, payee_name: "Coral Ridge Pressure Washing", amount: 640, received_at: DEMO_DATE, matched_yardi_vendor_id: yid(121), matched_avid_vendor_id: null, flag: "yardi_only", days_in_queue: 0 });
  } else if (n === 5007) {
    incoming_invoices.push({ invoice_id, payee_name: FIRST_SEEN_PAYEE, amount: 1180, received_at: DEMO_DATE, matched_yardi_vendor_id: null, matched_avid_vendor_id: null, flag: "first_seen", days_in_queue: 0 });
  } else if (n === 5009) {
    incoming_invoices.push({ invoice_id, payee_name: "PW Maintenance", amount: 355, received_at: "2026-08-25", matched_yardi_vendor_id: yid(117), matched_avid_vendor_id: aid(AVID_SLOT_PW), flag: "near_match", days_in_queue: 7 });
  } else if (n === 5012) {
    incoming_invoices.push({ invoice_id, payee_name: secondYardiOnly.name, amount: amount(), received_at: DEMO_DATE, matched_yardi_vendor_id: secondYardiOnly.yardi_vendor_id, matched_avid_vendor_id: null, flag: "yardi_only", days_in_queue: 0 });
  } else {
    const vendor = knownVendors[knownIndex];
    const payee_name = knownPayees[knownIndex];
    knownIndex++;
    incoming_invoices.push({ invoice_id, payee_name, amount: amount(), received_at: DEMO_DATE, matched_yardi_vendor_id: vendor.yardi_vendor_id, matched_avid_vendor_id: twinByYardi.get(vendor.yardi_vendor_id)!.avid_vendor_id, flag: "known", days_in_queue: 0 });
  }
}

const seed: Seed = {
  demo_date: DEMO_DATE,
  next_yardi_number: NEXT_YARDI_NUMBER,
  next_avid_number: NEXT_AVID_NUMBER,
  yardi_vendors: yardi,
  avid_vendors: avid,
  match_candidates,
  incoming_invoices,
};

// Self-checks. Every rule the pack leans on is asserted here, with the library doing the matching.

// Counts and ordering.
check(yardi.length === 119, `119 Yardi vendors, got ${yardi.length}`);
check(yardi.filter((v) => v.status === "active").length === 117, "117 active Yardi vendors");
check(yardi.filter((v) => v.status === "inactive").length === 2, "2 inactive Yardi vendors");
check(avid.length === AVID_COUNT, `${AVID_COUNT} Avid vendors, got ${avid.length}`);
check(avid.every((v) => v.source === "seed"), "every Avid vendor has source seed");
check(match_candidates.length === 2, "2 match candidates");
check(match_candidates.every((c) => c.decision === "none"), "every candidate has decision none");
check(incoming_invoices.length === 15, "15 invoices");
const flagCount = (flag: InvoiceFlag) => incoming_invoices.filter((i) => i.flag === flag).length;
check(flagCount("known") === 11 && flagCount("yardi_only") === 2 && flagCount("first_seen") === 1 && flagCount("near_match") === 1, "invoice flags split 11/2/1/1");
for (let i = 1; i < yardi.length; i++) check(numberOf(yardi[i - 1].yardi_vendor_id) < numberOf(yardi[i].yardi_vendor_id), "Yardi ids ascending");
for (let i = 1; i < avid.length; i++) check(numberOf(avid[i - 1].avid_vendor_id) < numberOf(avid[i].avid_vendor_id), "Avid ids ascending");
for (let i = 0; i < avid.length; i++) check(avid[i].avid_vendor_id === aid(i + 1), "Avid ids dense from V-A-0001");
incoming_invoices.forEach((inv, i) => check(inv.invoice_id === `INV-${5001 + i}`, "invoice ids INV-5001 through INV-5015 in order"));

// Ids present and absent.
const yardiIds = new Set(yardi.map((v) => v.yardi_vendor_id));
check(!yardiIds.has(yid(NEXT_YARDI_NUMBER)), `${yid(NEXT_YARDI_NUMBER)} must be absent, it is minted live`);
for (const g of YARDI_GAPS) check(!yardiIds.has(yid(g)), `gap ${yid(g)} must be absent`);
for (const n of [44, 117, 119, 121, 130]) check(yardiIds.has(yid(n)), `${yid(n)} present`);
check(yardiByNumber.get(130)!.status === "inactive", "V-Y-0130 inactive");
check(yardiByNumber.get(44)!.status === "active", "V-Y-0044 active");
check(avidById.has(aid(31)) && avidById.has(aid(88)) && avidById.has(aid(92)), "V-A-0031, V-A-0088, V-A-0092 present");
check(avidById.get(aid(31))!.name === "Brightline Landscaping" && avidById.get(aid(31))!.address_line === "200 Palmetto Row" && avidById.get(aid(31))!.created_at === "2025-03-02" && avidById.get(aid(31))!.tax_id_last4 === "1930", "V-A-0031 is the Brightline twin");
check(yardi.every((v) => /^\d{4}$/.test(v.tax_id_last4)), "every Yardi tax_id_last4 is four digits");
check(avid.every((v) => v.tax_id_last4 === null || /^\d{4}$/.test(v.tax_id_last4)), "every Avid tax_id_last4 is four digits or null");
check(avid.filter((v) => v.tax_id_last4 === null).length === AVID_UNKNOWN_TAX_COUNT, `${AVID_UNKNOWN_TAX_COUNT} Avid vendors with unknown tax digits`);

// Unique normalized names within each master.
const yardiNorms = yardi.map((v) => normalizeName(v.name));
check(new Set(yardiNorms).size === yardi.length, "every Yardi normalized name is unique");
const avidNorms = avid.map((v) => normalizeName(v.name));
check(new Set(avidNorms).size === avid.length, "every Avid normalized name is unique");
check(yardi.every((v) => normalizeName(v.name).split(" ").length >= 3 || SCRIPTED_YARDI.has(numberOf(v.yardi_vendor_id))), "every generated name has at least three tokens");

// Outcomes by role.
const outcomes = new Map(yardi.map((v) => [v.yardi_vendor_id, outcomeOf(v)]));
const withKind = (kind: Outcome["kind"]) => yardi.filter((v) => outcomes.get(v.yardi_vendor_id)!.kind === kind);
check(withKind("exact").length === 110, `110 exact matches, got ${withKind("exact").length}`);
check(withKind("exact").every((v) => v.status === "active"), "every exact match is active");
check(withKind("near").map((v) => v.yardi_vendor_id).join(",") === `${yid(117)},${yid(119)}`, "near matches are exactly V-Y-0117 and V-Y-0119");
check((outcomes.get(yid(117)) as { avid: AvidVendor }).avid.avid_vendor_id === aid(88), "V-Y-0117 pairs with V-A-0088");
check((outcomes.get(yid(119)) as { avid: AvidVendor }).avid.avid_vendor_id === aid(92), "V-Y-0119 pairs with V-A-0092");
const noMatch = withKind("none");
check(noMatch.filter((v) => v.status === "active").map((v) => v.yardi_vendor_id).join(",") === CLEAN_CREATION_NUMBERS.map(yid).join(","), "clean creations are exactly the five planned ids");
check(noMatch.filter((v) => v.status === "inactive").map((v) => v.yardi_vendor_id).join(",") === INACTIVE_NUMBERS.map(yid).join(","), "the two inactive vendors have no Avid match");
// The literal same-name-and-same-address test counts 111 pairs; the extra one is the PW pair, which differs by suffix.
const sameNameSameAddress = yardi.flatMap((y) => avid.filter((a) => sameNormalizedName(y.name, a.name) && sameAddress(y.address_line, a.address_line)).map((a) => [y, a] as const));
check(sameNameSameAddress.length === 111, `111 same-name same-address pairs, got ${sameNameSameAddress.length}`);
const suffixPairs = sameNameSameAddress.filter(([y, a]) => suffixDiffers(y.name, a.name));
check(suffixPairs.length === 1 && suffixPairs[0][0].yardi_vendor_id === yid(117) && suffixPairs[0][1].avid_vendor_id === aid(88), "the only same-name same-address pair with a suffix difference is V-Y-0117 / V-A-0088");

// No stray pair scores at or above the threshold.
const allowedHighPairs = new Set([`${yid(117)}|${aid(88)}`, `${yid(119)}|${aid(92)}`]);
for (const y of yardi) {
  for (const a of avid) {
    const score = tokenOverlap(y.name, a.name);
    if (score < NEAR_MATCH_THRESHOLD && !sameNormalizedName(y.name, a.name)) continue;
    const twin = twinByYardi.get(y.yardi_vendor_id);
    const isTwin = twin !== undefined && twin.avid_vendor_id === a.avid_vendor_id;
    check(isTwin || allowedHighPairs.has(`${y.yardi_vendor_id}|${a.avid_vendor_id}`), `stray near match ${y.yardi_vendor_id} "${y.name}" vs ${a.avid_vendor_id} "${a.name}" scores ${score}`);
  }
}

// Scripted pair details.
const pw = match_candidates[0];
check(pw.score === 1 && pw.reasons.join("|") === [MATCH_REASONS.sameNormalizedName, MATCH_REASONS.sameAddress, MATCH_REASONS.suffixDifference, MATCH_REASONS.sameTaxLast4].join("|"), `PW pair score and reasons, got ${pw.score} ${pw.reasons.join(", ")}`);
const tidewater = match_candidates[1];
check(tidewater.score >= NEAR_MATCH_THRESHOLD && tidewater.reasons.join("|") === [MATCH_REASONS.similarName, MATCH_REASONS.differentAddress, MATCH_REASONS.differentTaxLast4].join("|"), `Tidewater pair score and reasons, got ${tidewater.score} ${tidewater.reasons.join(", ")}`);
check(!sameNormalizedName("Tidewater Plumbing Co", "Tidewater Plumbing Supply"), "Tidewater names differ once normalized");

// The live-created vendor and the first-seen payee collide with nothing.
for (const probe of [LIVE_VENDOR_NAME, FIRST_SEEN_PAYEE]) {
  for (const v of [...yardi.map((y) => y.name), ...avid.map((a) => a.name)]) {
    check(!sameNormalizedName(probe, v), `"${probe}" collides with "${v}"`);
    check(tokenOverlap(probe, v) < NEAR_MATCH_THRESHOLD, `"${probe}" scores ${tokenOverlap(probe, v)} against "${v}"`);
  }
}

// Invoice flags follow the seed: payee to Yardi vendor by normalized name, then that vendor's own outcome.
for (const inv of incoming_invoices) {
  const hits = yardi.filter((y) => sameNormalizedName(inv.payee_name, y.name));
  check(hits.length <= 1, `${inv.invoice_id} payee matches more than one Yardi vendor`);
  let expectedFlag: InvoiceFlag;
  let expectedYardi: string | null = null;
  let expectedAvid: string | null = null;
  if (hits.length === 0) {
    expectedFlag = "first_seen";
  } else {
    const y = hits[0];
    const outcome = outcomes.get(y.yardi_vendor_id)!;
    expectedYardi = y.yardi_vendor_id;
    if (outcome.kind === "exact") { expectedFlag = "known"; expectedAvid = outcome.avid.avid_vendor_id; }
    else if (outcome.kind === "near") { expectedFlag = "near_match"; expectedAvid = outcome.avid.avid_vendor_id; }
    else expectedFlag = "yardi_only";
  }
  check(inv.flag === expectedFlag, `${inv.invoice_id} flag ${inv.flag}, expected ${expectedFlag}`);
  check(inv.matched_yardi_vendor_id === expectedYardi, `${inv.invoice_id} matched_yardi_vendor_id ${inv.matched_yardi_vendor_id}, expected ${expectedYardi}`);
  check(inv.matched_avid_vendor_id === expectedAvid, `${inv.invoice_id} matched_avid_vendor_id ${inv.matched_avid_vendor_id}, expected ${expectedAvid}`);
  check(inv.days_in_queue === daysBetween(inv.received_at, DEMO_DATE), `${inv.invoice_id} days_in_queue must equal whole days to the demo date`);
  check(inv.amount >= 80 && inv.amount <= 4800 && !RESERVED_NUMBERS.has(inv.amount), `${inv.invoice_id} amount ${inv.amount} out of range or reserved`);
  check(Math.abs(inv.amount * 100 - Math.round(inv.amount * 100)) < 1e-6, `${inv.invoice_id} amount has more than two decimals`);
}
check(new Set(incoming_invoices.map((i) => i.payee_name)).size === 15, "invoice payees are distinct");
check(incoming_invoices.some((i) => i.payee_name === "Brightline Landscaping LLC" && i.flag === "known"), "Brightline invoice spelled with LLC is known");

// Dates.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
for (const v of yardi) check(ISO_DATE.test(v.created_at) && v.created_at >= EARLIEST_DATE && v.created_at <= DEMO_DATE, `${v.yardi_vendor_id} created_at in range`);
for (const v of avid) check(ISO_DATE.test(v.created_at) && v.created_at >= EARLIEST_DATE && v.created_at <= DEMO_DATE, `${v.avid_vendor_id} created_at in range`);

// Text-level checks over the file about to be written: markers, field names, em dashes, forbidden names.
const text = JSON.stringify(seed, null, 2) + "\n";
check(!text.includes("\u2014"), "no em dash in seed.json");
for (const m of text.matchAll(/"([^"\n]*)"\s*:/g)) check(!m[1].includes("gl"), `field name ${m[1]} contains gl`);
check(!/\b\d{10}\b/.test(text), "no 10-digit numbers");
check(!/\bM\d{6,}\b/.test(text), "no meter-like ids");
check(!/\bv\d{4,}\b/.test(text), "no lowercase vendor-like codes");
check(!/\b0\d{6}\b/.test(text), "no 7-digit codes starting with 0");
const forbiddenNamesFile = process.env.FORBIDDEN_NAMES_FILE ?? path.join(ROOT, "..", "forbidden-names.txt");
if (fs.existsSync(forbiddenNamesFile)) {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const line of fs.readFileSync(forbiddenNamesFile, "utf8").split("\n")) {
    const term = line.trim();
    if (!term || term.startsWith("#")) continue;
    check(!new RegExp(`\\b${escape(term)}\\b`, "i").test(text), `forbidden name "${term}" appears in seed.json`);
  }
}

fs.writeFileSync(OUT_FILE, text);

const indexOfYardi = (n: number) => yardi.findIndex((v) => v.yardi_vendor_id === yid(n));
const indexOfAvid = (n: number) => avid.findIndex((v) => v.avid_vendor_id === aid(n));
console.log(`seed written to ${path.relative(ROOT, OUT_FILE)}`);
console.log(`yardi ${yardi.length} (active ${yardi.filter((v) => v.status === "active").length}, inactive ${yardi.filter((v) => v.status === "inactive").length}), avid ${avid.length}, candidates ${match_candidates.length}, invoices ${incoming_invoices.length} (known ${flagCount("known")}, yardi_only ${flagCount("yardi_only")}, first_seen ${flagCount("first_seen")}, near_match ${flagCount("near_match")})`);
console.log(`yardi index: V-Y-0044 at ${indexOfYardi(44)}, V-Y-0117 at ${indexOfYardi(117)}, V-Y-0119 at ${indexOfYardi(119)}, V-Y-0121 at ${indexOfYardi(121)}, V-Y-0130 at ${indexOfYardi(130)}`);
console.log(`avid index: V-A-0031 at ${indexOfAvid(31)}, V-A-0088 at ${indexOfAvid(88)}, V-A-0092 at ${indexOfAvid(92)}`);
console.log(`clean creations: ${CLEAN_CREATION_NUMBERS.map((n) => `${yid(n)} ${yardiByNumber.get(n)!.name}`).join("; ")}`);
console.log(`inactive: ${INACTIVE_NUMBERS.map((n) => `${yid(n)} ${yardiByNumber.get(n)!.name}`).join("; ")}`);
console.log(`yardi_only invoices: ${incoming_invoices.filter((i) => i.flag === "yardi_only").map((i) => `${i.invoice_id} ${i.payee_name}`).join("; ")}`);
console.log(`known payees: ${incoming_invoices.filter((i) => i.flag === "known").map((i) => `${i.invoice_id} ${i.payee_name}`).join("; ")}`);
