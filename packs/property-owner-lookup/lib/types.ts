// Property Owner Lookup: the parcel registry, address normalisation, the resolver, and the
// owner to entity map. One code module, imported by AP Inbox and the splitter today and
// by the legal line coder later, and a module of its own with a lookup screen.

export type ParcelStatus = "lien" | "deed" | "sold";

export interface ParcelRecord {
  parcelId: string; // P-10100 to P-12099
  address: string; // street line, unit included when present, e.g. "45 Hillcrest Dr Unit 2"
  city: string;
  county: string;
  state: string; // two-letter
  zip: string;
  status: ParcelStatus;
  lender: string | null;
  holdingCompany: string; // one owner per parcel: the one-owner rule
  dollarsOut: number; // integer cents
  assessedValue: number; // integer cents
}

/** A free-text address after normalisation. `key` is what the resolver compares. */
export interface NormalizedAddress {
  raw: string;
  houseNumber: string | null;
  street: string; // street words with the suffix abbreviated, lower case, e.g. "hillcrest dr"
  unit: string | null; // "2" for "Unit 2", "Apt 2", "#2"
  city: string | null; // lower case
  state: string | null; // two-letter upper case
  zip: string | null;
  key: string; // `${houseNumber} ${street}|${unit ?? ""}|${city ?? ""}|${state ?? ""}`
}

export type ResolveMethod = "parcel" | "address";

export type Resolution =
  | { kind: "one"; parcel: ParcelRecord; method: ResolveMethod; confidence: number }
  | { kind: "none"; query: string }
  | { kind: "many"; query: string; candidates: ParcelRecord[] };

export interface ResolveInput {
  parcelId?: string | null; // parcel first
  address?: string | null; // cleaned address second
}
