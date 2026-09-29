import fs from "node:fs";
import path from "node:path";
import type { ParcelRecord, ParcelStatus } from "../lib/types";
import { HOLDING_COMPANIES, SCRIPTED_PARCELS } from "../lib/scripted";

// Deterministic registry of 2,000 synthetic Midwest parcels. Run from the repo root:
//   npx tsx packs/property-owner-lookup/lib/generate.ts
// Same output every run. Scripted parcels keep their fixed ids and addresses; every
// other record is invented from the lists below. Parcel ids run P-10100 to P-12099.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}
const rand = mulberry32(20260903);
const intBetween = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

interface City {
  city: string;
  county: string;
  state: string;
  zips: string[];
  weight: number;
}

const CITIES: City[] = [
  { city: "Marion", county: "Grant", state: "IN", zips: ["46952", "46953"], weight: 8 },
  { city: "Peoria", county: "Peoria", state: "IL", zips: ["61603", "61604", "61605", "61606", "61614", "61615"], weight: 7 },
  { city: "Hammond", county: "Lake", state: "IN", zips: ["46320", "46323", "46324", "46327"], weight: 8 },
  { city: "Decatur", county: "Macon", state: "IL", zips: ["62521", "62522", "62523", "62526"], weight: 6 },
  { city: "Springfield", county: "Sangamon", state: "IL", zips: ["62702", "62703", "62704", "62707"], weight: 6 },
  { city: "Springfield", county: "Greene", state: "MO", zips: ["65802", "65803", "65806", "65807"], weight: 4 },
  { city: "Gary", county: "Lake", state: "IN", zips: ["46402", "46404", "46406", "46408"], weight: 6 },
  { city: "Kokomo", county: "Howard", state: "IN", zips: ["46901", "46902"], weight: 5 },
  { city: "Rockford", county: "Winnebago", state: "IL", zips: ["61101", "61103", "61104", "61108"], weight: 6 },
  { city: "Anderson", county: "Madison", state: "IN", zips: ["46012", "46013", "46016"], weight: 5 },
  { city: "Muncie", county: "Delaware", state: "IN", zips: ["47302", "47303", "47304"], weight: 5 },
  { city: "Danville", county: "Vermilion", state: "IL", zips: ["61832", "61834"], weight: 4 },
  { city: "Terre Haute", county: "Vigo", state: "IN", zips: ["47802", "47803", "47804", "47807"], weight: 5 },
  { city: "Fort Wayne", county: "Allen", state: "IN", zips: ["46802", "46805", "46806", "46807", "46808"], weight: 6 },
  { city: "South Bend", county: "St. Joseph", state: "IN", zips: ["46613", "46614", "46615", "46616"], weight: 5 },
  { city: "Joliet", county: "Will", state: "IL", zips: ["60432", "60433", "60435"], weight: 4 },
  { city: "Toledo", county: "Lucas", state: "OH", zips: ["43605", "43607", "43608", "43609"], weight: 5 },
  { city: "Dayton", county: "Montgomery", state: "OH", zips: ["45402", "45403", "45405", "45406"], weight: 5 },
  { city: "Flint", county: "Genesee", state: "MI", zips: ["48503", "48504", "48505", "48506"], weight: 5 },
  { city: "Saginaw", county: "Saginaw", state: "MI", zips: ["48601", "48602", "48607"], weight: 4 },
];
const CITY_DRAW: City[] = CITIES.flatMap((c) => Array.from({ length: c.weight }, () => c));

const STREETS = [
  "Alder", "Ashgrove", "Beacon", "Birch", "Bluestem", "Bramble", "Cardinal", "Cinder", "Cobbler", "Coppermine", "Dovetail", "Driftwood",
  "Dunmore", "Elm", "Evergreen", "Fernwood", "Ferris", "Fieldstone", "Foxglove", "Glenmoor", "Goldenrod", "Granite", "Harrow", "Hawthorne",
  "Heron", "Hillcrest", "Hollow Oak", "Indigo", "Ironwood", "Ivy", "Juniper", "Kestrel", "Kingfisher", "Kingsway", "Lantern", "Larchmont",
  "Lark", "Linden", "Maple", "Marigold", "Meadowlark", "Mill Pond", "Nettle", "Nightingale", "Northgate", "Oakhurst", "Old Mill", "Orchard",
  "Osprey", "Palmer", "Pebble", "Pinecrest", "Prospect", "Quail Run", "Quarry", "Redwing", "Ridgeline", "Riverbend", "Sandhill", "Sparrow",
  "Stonegate", "Tamarack", "Tanager", "Thistle", "Umber", "Valley View", "Vesper", "Westbrook", "Willowbrook", "Woodbine", "Wren", "Yarrow",
];
const SUFFIXES = ["St", "Ave", "Dr", "Ct", "Ln", "Rd", "Pl", "Way"];
const LENDERS = ["Northfield Capital Lending", "Calumet Bridge Lending", "Prairie Bank and Trust", "Heartland Lot Finance", "Lakeview Certificate Credit"];

const key = (address: string, city: string, state: string) => `${address.toLowerCase()}|${city.toLowerCase()}|${state}`;

function status(): ParcelStatus {
  const r = rand();
  if (r < 0.65) return "lien";
  if (r < 0.95) return "deed";
  return "sold";
}

const scriptedById = new Map(SCRIPTED_PARCELS.map((p) => [p.parcelId, p]));
const used = new Set<string>();
for (const p of SCRIPTED_PARCELS) used.add(key(p.address, p.city, p.state));

const parcels: ParcelRecord[] = [];
for (let i = 0; i < 2000; i++) {
  const parcelId = `P-${10100 + i}`;
  const scripted = scriptedById.get(parcelId);
  if (scripted) {
    parcels.push({
      parcelId,
      address: scripted.address,
      city: scripted.city,
      county: scripted.county,
      state: scripted.state,
      zip: scripted.zip,
      status: "deed",
      lender: null,
      holdingCompany: HOLDING_COMPANIES[scripted.holding],
      dollarsOut: intBetween(2_500, 45_000) * 100,
      assessedValue: intBetween(8_000, 180_000) * 100,
    });
    continue;
  }
  for (;;) {
    const c = pick(CITY_DRAW);
    const unit = rand() < 0.08 ? ` Unit ${intBetween(1, 4)}` : "";
    const address = `${intBetween(1, 999)} ${pick(STREETS)} ${pick(SUFFIXES)}${unit}`;
    const k = key(address, c.city, c.state);
    if (used.has(k)) continue;
    used.add(k);
    parcels.push({
      parcelId,
      address,
      city: c.city,
      county: c.county,
      state: c.state,
      zip: pick(c.zips),
      status: status(),
      lender: rand() < 0.4 ? pick(LENDERS) : null,
      holdingCompany: HOLDING_COMPANIES[intBetween(0, HOLDING_COMPANIES.length - 1)],
      dollarsOut: intBetween(2_500, 45_000) * 100,
      assessedValue: intBetween(8_000, 180_000) * 100,
    });
    break;
  }
}

for (const p of SCRIPTED_PARCELS) {
  const got = parcels.find((x) => x.parcelId === p.parcelId);
  if (!got || got.address !== p.address) throw new Error(`scripted parcel ${p.parcelId} missing`);
}
if (parcels.length !== 2000) throw new Error(`expected 2000 parcels, got ${parcels.length}`);

const out = path.join(process.cwd(), "packs", "property-owner-lookup", "seed", "parcels.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(parcels, null, 2) + "\n");
console.log(`wrote ${parcels.length} parcels to ${path.relative(process.cwd(), out)}`);
