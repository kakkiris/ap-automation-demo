import type { ParcelRecord } from "./types";

// Parcels the intake pack's scripted items depend on. The generator writes these at
// their fixed ids; everything else in the registry is random but deterministic.
// Holding companies are indexed into HOLDING_COMPANIES; the intake seed derives entity
// codes (E-101 upward) and cash accounts (1000-2201 upward) from the same order.

export const HOLDING_COMPANIES: readonly string[] = [
  "Lakeshore Lien Fund 2 LLC",
  "Lakeshore Lien Fund 3 LLC",
  "Lakeshore Lien Fund 4 LLC",
  "Calumet Lot Holdings LLC",
  "Wabash Lien Holdings LLC",
  "Birchline Holdings LLC",
  "Prairie Deed Holdings LLC",
  "Tippecanoe Lien Holdings LLC",
  "Sangamon Deed Company LLC",
  "Kankakee Holdings LLC",
  "Illinois River Holdings LLC",
  "Rock River Deeds LLC",
  "Maumee Property Holdings LLC",
  "Fox Valley Lien Holdings LLC",
  "Great Lakes Certificate Holdings LLC",
  "Heartland Lot Company LLC",
  "Northfork Holdings LLC",
  "Redbud Lien Holdings LLC",
  "Sycamore Deed Holdings LLC",
  "Bluestem Property Holdings LLC",
  "Copperline Holdings LLC",
  "Whitewater Lien Holdings LLC",
  "Saginaw Bay Holdings LLC",
  "Mad River Deed Holdings LLC",
];

export const OPERATING_COMPANY = "Lakeshore Lien Partners";

type Scripted = Omit<ParcelRecord, "status" | "lender" | "dollarsOut" | "assessedValue" | "holdingCompany"> & { holding: number };

const s = (parcelId: string, address: string, city: string, county: string, state: string, zip: string, holding: number): Scripted => ({
  parcelId,
  address,
  city,
  county,
  state,
  zip,
  holding,
});

export const SCRIPTED_PARCELS: readonly Scripted[] = [
  // I-0005: vendor variant matched, resolved by parcel id printed on the invoice. Owner cash account 1000-2201.
  s("P-12003", "45 Hillcrest Dr Unit 2", "Peoria", "Peoria", "IL", "61604", 0),
  // I-0022: utility account 5520-044 maps here.
  s("P-10231", "230 Ferris Ave", "Hammond", "Lake", "IN", "46324", 3),
  // I-0003: unknown vendor, property resolves.
  s("P-10412", "19 Lark St", "Marion", "Grant", "IN", "46952", 5),
  // I-0009: possible duplicate of 4471.
  s("P-10455", "412 Alder St", "Marion", "Grant", "IN", "46953", 5),
  // I-0011: tracker approved, card T-8812.
  s("P-11020", "601 Birch Ct", "Hammond", "Lake", "IN", "46320", 3),
  // I-0015: came by email, no tracker card before.
  s("P-11348", "88 Mill Pond Dr", "Decatur", "Macon", "IL", "62521", 8),
  // I-0021 (state given, resolves here) and I-0026 candidate 1 (no state).
  s("P-11702", "14 Elm St", "Springfield", "Sangamon", "IL", "62704", 10),
  // I-0026 candidate 2.
  s("P-11950", "14 Elm St", "Springfield", "Greene", "MO", "65806", 11),
  // I-0018: the parcel the unknown utility account 5520-118 gets mapped to.
  s("P-10777", "310 Quarry Rd", "Marion", "Grant", "IN", "46952", 5),
  // I-0007: nine lots from a phone photo. 702 Palmer Ln is not in the system property list.
  s("P-10600", "702 Palmer Ln", "Marion", "Grant", "IN", "46953", 5),
  s("P-10601", "704 Palmer Ln", "Marion", "Grant", "IN", "46953", 5),
  s("P-10602", "706 Palmer Ln", "Marion", "Grant", "IN", "46953", 5),
  s("P-10603", "708 Palmer Ln", "Marion", "Grant", "IN", "46953", 5),
  s("P-10604", "710 Palmer Ln", "Marion", "Grant", "IN", "46953", 5),
  s("P-10605", "712 Palmer Ln", "Marion", "Grant", "IN", "46953", 5),
  s("P-10606", "1 Orchard Ct", "Marion", "Grant", "IN", "46953", 6),
  s("P-10607", "3 Orchard Ct", "Marion", "Grant", "IN", "46953", 6),
  s("P-10608", "5 Orchard Ct", "Marion", "Grant", "IN", "46953", 6),
  // I-0016: three lots with stated amounts 60, 50, 40.
  s("P-10620", "15 Cobbler St", "Decatur", "Macon", "IL", "62526", 8),
  s("P-10621", "17 Cobbler St", "Decatur", "Macon", "IL", "62526", 8),
  s("P-10622", "19 Cobbler St", "Decatur", "Macon", "IL", "62526", 8),
  // I-0013: the fourth multi-property item, two lots with stated amounts.
  s("P-10630", "40 Redwing Ave", "Kokomo", "Howard", "IN", "46901", 7),
  s("P-10631", "42 Redwing Ave", "Kokomo", "Howard", "IN", "46901", 7),
  // I-0012: ten-property statement, itemised by charge type.
  s("P-11100", "118 Heron St", "Hammond", "Lake", "IN", "46320", 3),
  s("P-11101", "120 Heron St", "Hammond", "Lake", "IN", "46320", 3),
  s("P-11102", "27 Kestrel Ave", "Hammond", "Lake", "IN", "46323", 3),
  s("P-11103", "29 Kestrel Ave", "Hammond", "Lake", "IN", "46323", 4),
  s("P-11104", "305 Larchmont Dr", "Hammond", "Lake", "IN", "46324", 4),
  s("P-11105", "811 Nettle Rd", "Hammond", "Lake", "IN", "46324", 4),
  s("P-11106", "813 Nettle Rd", "Hammond", "Lake", "IN", "46324", 4),
  s("P-11107", "64 Osprey Ct", "Hammond", "Lake", "IN", "46327", 3),
  s("P-11108", "66 Osprey Ct", "Hammond", "Lake", "IN", "46327", 3),
  s("P-11109", "902 Sandhill Ln", "Hammond", "Lake", "IN", "46327", 4),
];

/** Registry parcels deliberately absent from the accounting system's property list. */
export const NOT_IN_SYSTEM_LIST: readonly string[] = ["P-10600"];
