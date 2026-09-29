import { normalizeAddress } from "./normalize";
import type { ParcelRecord, ResolveInput, Resolution } from "./types";

// The resolver: parcel id first, cleaned address second, exception on none or many.
// Pure over the parcels array it is given; an index per array is kept in a WeakMap so
// repeated calls over the registry do not rescan 2,000 records.

type Index = { byId: Map<string, ParcelRecord>; byStreet: Map<string, ParcelRecord[]> };
const indexes = new WeakMap<ParcelRecord[], Index>();

function streetKey(houseNumber: string | null, street: string, unit: string | null): string {
  return `${houseNumber ?? ""} ${street}|${unit ?? ""}`;
}

function indexFor(parcels: ParcelRecord[]): Index {
  let idx = indexes.get(parcels);
  if (idx) return idx;
  idx = { byId: new Map(), byStreet: new Map() };
  for (const p of parcels) {
    idx.byId.set(p.parcelId, p);
    const n = normalizeAddress(p.address);
    const k = streetKey(n.houseNumber, n.street, n.unit);
    const list = idx.byStreet.get(k);
    if (list) list.push(p);
    else idx.byStreet.set(k, [p]);
  }
  indexes.set(parcels, idx);
  return idx;
}

export function normalizeParcelId(text: string | null | undefined): string | null {
  const m = /^\s*p\s*-?\s*(\d{5})\s*$/i.exec(text ?? "");
  return m ? `P-${m[1]}` : null;
}

export function resolveParcel(input: ResolveInput, parcels: ParcelRecord[]): Resolution {
  const idx = indexFor(parcels);
  const parcelId = normalizeParcelId(input.parcelId);
  if (parcelId) {
    const hit = idx.byId.get(parcelId);
    if (hit) return { kind: "one", parcel: hit, method: "parcel", confidence: 1 };
  }
  const address = (input.address ?? "").trim();
  if (!address) return { kind: "none", query: (input.parcelId ?? "").trim() };

  const n = normalizeAddress(address);
  if (!n.houseNumber || !n.street) return { kind: "none", query: address };
  let hits = idx.byStreet.get(streetKey(n.houseNumber, n.street, n.unit)) ?? [];
  if (n.city) hits = hits.filter((p) => p.city.toLowerCase() === n.city);
  if (n.state) hits = hits.filter((p) => p.state === n.state);
  if (hits.length === 1) return { kind: "one", parcel: hits[0], method: "address", confidence: 0.9 };
  if (hits.length === 0) return { kind: "none", query: address };
  const candidates = [...hits].sort((a, b) => a.parcelId.localeCompare(b.parcelId));
  return { kind: "many", query: address, candidates };
}

/** The Parcel lookup panel and the exception search: a parcel id or an address string. */
export function findParcelText(query: string, parcels: ParcelRecord[]): Resolution {
  const q = (query ?? "").trim();
  if (!q) return { kind: "none", query: q };
  const parcelId = normalizeParcelId(q);
  if (parcelId) return resolveParcel({ parcelId }, parcels);
  return resolveParcel({ address: q }, parcels);
}

/** Prefix or substring search over parcel id and "address, city, state", in parcel id order. */
export function searchParcels(query: string, parcels: ParcelRecord[], limit: number): ParcelRecord[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q || limit <= 0) return [];
  const out: ParcelRecord[] = [];
  const sorted = [...parcels].sort((a, b) => a.parcelId.localeCompare(b.parcelId));
  for (const p of sorted) {
    const text = `${p.parcelId} ${p.address}, ${p.city}, ${p.state} ${p.zip}`.toLowerCase();
    if (text.includes(q)) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}
