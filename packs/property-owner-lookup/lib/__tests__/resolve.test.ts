import { describe, expect, it } from "vitest";
import { loadParcels } from "../registry";
import { findParcelText, resolveParcel, searchParcels } from "../resolve";
import { SCRIPTED_PARCELS } from "../scripted";

const parcels = loadParcels();

describe("resolveParcel", () => {
  it("resolves a parcel id first", () => {
    const r = resolveParcel({ parcelId: "P-12003" }, parcels);
    expect(r.kind).toBe("one");
    if (r.kind === "one") {
      expect(r.parcel.parcelId).toBe("P-12003");
      expect(r.method).toBe("parcel");
      expect(r.confidence).toBe(1);
    }
  });

  it("resolves a cleaned address with a unit", () => {
    const r = resolveParcel({ address: "45 Hillcrest Dr Unit 2, Peoria IL" }, parcels);
    expect(r.kind).toBe("one");
    if (r.kind === "one") {
      expect(r.parcel.parcelId).toBe("P-12003");
      expect(r.method).toBe("address");
      expect(r.confidence).toBe(0.9);
    }
  });

  it("resolves the long form of the same address", () => {
    const r = resolveParcel({ address: "45 Hillcrest Drive #2, Peoria, IL 61604" }, parcels);
    expect(r.kind).toBe("one");
    if (r.kind === "one") expect(r.parcel.parcelId).toBe("P-12003");
  });

  it("narrows by state when the query has one", () => {
    const r = resolveParcel({ address: "14 Elm St, Springfield IL" }, parcels);
    expect(r.kind).toBe("one");
    if (r.kind === "one") expect(r.parcel.parcelId).toBe("P-11702");
  });

  it("returns many when the state is missing and two cities share the name", () => {
    const r = resolveParcel({ address: "14 Elm St, Springfield" }, parcels);
    expect(r.kind).toBe("many");
    if (r.kind === "many") expect(r.candidates.map((p) => p.parcelId)).toEqual(["P-11702", "P-11950"]);
  });

  it("resolves the lot missing from the system list, which is still in the registry", () => {
    const r = resolveParcel({ address: "702 Palmer Ln, Marion IN" }, parcels);
    expect(r.kind).toBe("one");
    if (r.kind === "one") expect(r.parcel.parcelId).toBe("P-10600");
  });

  it("returns none for an address nobody holds", () => {
    const r = resolveParcel({ address: "9999 Nowhere Rd, Peoria IL" }, parcels);
    expect(r.kind).toBe("none");
  });

  it("returns none for an unknown parcel id with no address", () => {
    expect(resolveParcel({ parcelId: "P-12999" }, parcels).kind).toBe("none");
  });

  it("resolves each of the ten Hammond statement addresses", () => {
    const hammond = SCRIPTED_PARCELS.filter((p) => p.parcelId >= "P-11100" && p.parcelId <= "P-11109");
    expect(hammond).toHaveLength(10);
    for (const p of hammond) {
      const r = resolveParcel({ address: `${p.address}, Hammond IN` }, parcels);
      expect(r.kind, p.address).toBe("one");
      if (r.kind === "one") expect(r.parcel.parcelId).toBe(p.parcelId);
    }
  });

  it("resolves every scripted parcel from its own address, city and state", () => {
    for (const p of SCRIPTED_PARCELS) {
      const r = resolveParcel({ address: `${p.address}, ${p.city} ${p.state}` }, parcels);
      expect(r.kind, p.address).toBe("one");
      if (r.kind === "one") expect(r.parcel.parcelId).toBe(p.parcelId);
    }
  });
});

describe("findParcelText", () => {
  it("accepts a parcel id", () => {
    const r = findParcelText("P-12003", parcels);
    expect(r.kind).toBe("one");
    if (r.kind === "one") expect(r.method).toBe("parcel");
  });

  it("accepts a lower-case parcel id with spaces around it", () => {
    const r = findParcelText("  p-12003 ", parcels);
    expect(r.kind).toBe("one");
  });

  it("accepts an address", () => {
    const r = findParcelText("601 Birch Ct, Hammond IN", parcels);
    expect(r.kind).toBe("one");
    if (r.kind === "one") expect(r.parcel.parcelId).toBe("P-11020");
  });

  it("returns none for empty text", () => {
    expect(findParcelText("", parcels).kind).toBe("none");
  });
});

describe("searchParcels", () => {
  it("finds parcels by id prefix", () => {
    const hits = searchParcels("P-1060", parcels, 20);
    expect(hits.map((p) => p.parcelId)).toContain("P-10600");
    expect(hits.length).toBeLessThanOrEqual(20);
  });

  it("finds parcels by address text and caps the list", () => {
    const hits = searchParcels("Quarry Rd", parcels, 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(hits.some((p) => p.parcelId === "P-10777")).toBe(true);
  });

  it("finds parcels by city", () => {
    const hits = searchParcels("hammond", parcels, 5);
    expect(hits).toHaveLength(5);
    expect(hits.every((p) => p.city === "Hammond")).toBe(true);
  });

  it("returns nothing for empty text", () => {
    expect(searchParcels("   ", parcels, 5)).toEqual([]);
  });
});
