import parcelsJson from "../seed/parcels.json";
import type { ParcelRecord } from "./types";

// The generated registry, bundled rather than read from disk: the demo runs on Workers,
// which have no filesystem.

let cache: ParcelRecord[] | null = null;

export function loadParcels(): ParcelRecord[] {
  if (!cache) cache = parcelsJson as unknown as ParcelRecord[];
  return cache;
}

export function parcelById(parcelId: string): ParcelRecord | undefined {
  return loadParcels().find((p) => p.parcelId === parcelId);
}
