import { beforeAll, describe, expect, it } from "vitest";
import { resetStore } from "../../store";
import { arrive, chooseLedger, chooseOwner, confirmField, createProperty, createVendor, mapUtilityAccount, markPaid, skip, submit, submitAll, approveAll } from "../actions";
import { readiness } from "../readiness";
import { exceptionsView } from "../views";
import { importRows } from "../importfile";
import { REQUIRED_FIELDS, type Store } from "../types";

// Runs against the real seed once the seed-builder has written it.

describe("arrival over the seeded week", () => {
  let store: Store;
  beforeAll(async () => {
    store = resetStore();
    await arrive(store);
  });

  const draft = (id: string) => store.drafts[id];
  const item = (id: string) => store.items.find((i) => i.itemId === id)!;
  const openTitles = (id: string) => draft(id).exceptions.filter((e) => !e.resolved).map((e) => e.title);

  it("drafts 26 items into 21 Drafted and 5 Needs attention", () => {
    expect(store.items).toHaveLength(26);
    const counts = store.items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.state]: (acc[i.state] ?? 0) + 1 }), {});
    expect(counts["Drafted"]).toBe(21);
    expect(counts["Needs attention"]).toBe(5);
    expect(counts["New"]).toBeUndefined();
  });

  it("I-0005: vendor variant matched at 0.94, resolved by parcel, every field filled, ready to submit", () => {
    const d = draft("I-0005");
    expect(d.vendorMatch?.score).toBe(0.94);
    const vendor = store.vendors.find((v) => v.vendorId === d.vendorMatch?.vendorId);
    expect(vendor?.name).toBe("Peoria Plumbing Company LLC");
    expect(d.payee).toBe("Peoria Plumbing Company LLC");
    expect(d.propertyResolution?.parcelId).toBe("P-12003");
    expect(d.propertyResolution?.method).toBe("parcel");
    expect(d.propertyResolution?.cashAccount).toBe("1000-2201");
    for (const f of REQUIRED_FIELDS) expect(d[f], f).not.toBeNull();
    for (const f of REQUIRED_FIELDS) expect(d.fieldSources[f], f).not.toBeNull();
    expect(readiness(d, store).canSubmit).toBe(true);
  });

  it("I-0011: tracker approved, Drafted, card T-8812", () => {
    expect(item("I-0011").state).toBe("Drafted");
    expect(item("I-0011").trackerCardRef).toBe("T-8812");
    expect(draft("I-0011").propertyResolution?.parcelId).toBe("P-11020");
  });

  it("I-0007: splitter with nine equal lines of 50.00 and one lot missing from the property list", () => {
    const d = draft("I-0007");
    expect(d.mode).toBe("splitter");
    expect(d.lines).toHaveLength(9);
    expect(d.lines.map((l) => l.amount)).toEqual(Array(9).fill(5000));
    expect(d.lines.every((l) => l.splitMethod === "equal")).toBe(true);
    expect(d.sumCheck?.ok).toBe(true);
    expect(d.sumCheck?.invoiceTotal).toBe(45000);
    const missing = d.lines.filter((l) => !l.systemPropertyExists);
    expect(missing).toHaveLength(1);
    expect(missing[0].address).toContain("702 Palmer Ln");
    expect(missing[0].parcelId).toBe("P-10600");
    expect(d.lines.every((l) => l.parcelId !== null)).toBe(true);
    const r = readiness(d, store);
    expect(r.canSubmit).toBe(false);
    expect(r.reasons.some((x) => x.includes("702 Palmer Ln") && x.includes("not in the property list"))).toBe(true);
  });

  it("I-0012: ten stated lines, ledgers differing by charge type, sum ok", () => {
    const d = draft("I-0012");
    expect(d.mode).toBe("splitter");
    expect(d.lines).toHaveLength(10);
    expect(d.lines.every((l) => l.splitMethod === "stated")).toBe(true);
    expect(new Set(d.lines.map((l) => l.glAccount)).size).toBeGreaterThanOrEqual(2);
    expect(d.sumCheck?.ok).toBe(true);
    expect(d.amount).toBe(698840);
    expect(readiness(d, store).canSubmit).toBe(true);
  });

  it("I-0016: three stated lines of 60, 50 and 40", () => {
    const d = draft("I-0016");
    expect(d.lines.map((l) => l.amount)).toEqual([6000, 5000, 4000]);
    expect(d.lines.every((l) => l.splitMethod === "stated")).toBe(true);
    expect(d.sumCheck?.ok).toBe(true);
  });

  it("I-0013: two stated lines", () => {
    const d = draft("I-0013");
    expect(d.mode).toBe("splitter");
    expect(d.lines).toHaveLength(2);
    expect(d.lines.every((l) => l.splitMethod === "stated")).toBe(true);
  });

  it("I-0003: unknown vendor with three candidates below the threshold", () => {
    expect(item("I-0003").state).toBe("Needs attention");
    expect(openTitles("I-0003")).toEqual(["Unknown vendor"]);
    const e = draft("I-0003").exceptions[0];
    expect(e.candidates).toHaveLength(3);
    for (const c of e.candidates) expect(c.score ?? 1).toBeLessThan(0.85);
    expect(draft("I-0003").propertyResolution?.parcelId).toBe("P-10412");
  });

  it("I-0009: possible duplicate of 4471", () => {
    expect(openTitles("I-0009")).toEqual(["Possible duplicate of 4471"]);
    expect(draft("I-0009").exceptions[0].duplicateOf?.invoiceNumber).toBe("4471");
  });

  it("I-0018: unknown utility account 5520-118", () => {
    expect(openTitles("I-0018")).toEqual(["Unknown utility account 5520-118"]);
  });

  it("I-0022: utility account 5520-044 already mapped to P-10231", () => {
    expect(item("I-0022").state).toBe("Drafted");
    expect(draft("I-0022").propertyResolution?.parcelId).toBe("P-10231");
    expect(draft("I-0022").propertyResolution?.method).toBe("utilityAccount");
  });

  it("I-0019: amount at confidence 0.55 must be confirmed", () => {
    expect(draft("I-0019").fieldConfidence.amount).toBe(0.55);
    const r = readiness(draft("I-0019"), store);
    expect(r.canSubmit).toBe(false);
    expect(r.reasons.some((x) => x.toLowerCase().includes("confirm"))).toBe(true);
  });

  it("I-0021: amount unreadable", () => {
    expect(openTitles("I-0021")).toEqual(["Amount unreadable"]);
    expect(draft("I-0021").amount).toBeNull();
  });

  it("I-0026: ambiguous owner with two candidates", () => {
    expect(openTitles("I-0026")).toEqual(["Ambiguous owner, 2 candidates"]);
    expect(draft("I-0026").exceptions[0].candidates.map((c) => c.id)).toEqual(["P-11702", "P-11950"]);
  });

  it("I-0024: office item with no property and the operating entity", () => {
    expect(draft("I-0024").property).toBeNull();
    expect(draft("I-0024").entity).toBe("E-001");
    expect(item("I-0024").state).toBe("Drafted");
  });

  it("I-0015: came by email and got a new tracker card", () => {
    const u = store.trackerUpdates.find((x) => x.itemId === "I-0015" && x.reason === "captured");
    expect(u?.newCard).toBe(true);
    expect(u?.source).toBe("email");
  });

  it("runs the scripted week through to a paid batch", async () => {
    skip(store, "I-0009");
    expect(item("I-0009").state).toBe("Skipped");
    expect(draft("I-0009").exceptions[0].resolved).toBe(true);
    expect(draft("I-0009").exceptions[0].resolution).toBe("Skipped, duplicate of 4471");
    expect(exceptionsView(store).cards.some((c) => c.itemId === "I-0009")).toBe(false);
    expect(exceptionsView(store).open).toBe(4);
    submit(store, "I-0005");
    submit(store, "I-0011");

    // The presenter's fixes from the script, plus the two the checks need before Submit all.
    const flagged = draft("I-0007").lines.find((l) => !l.systemPropertyExists)!;
    createProperty(store, "I-0007", flagged.lineNumber);
    expect(draft("I-0007").lines.every((l) => l.systemPropertyExists)).toBe(true);
    expect(store.systemProperties.some((p) => p.parcelId === "P-10600" && p.createdInDemo)).toBe(true);

    createVendor(store, "I-0003");
    expect(item("I-0003").state).toBe("Drafted");
    expect(draft("I-0003").glAccount).toBeNull();
    expect(store.vendors.some((v) => v.createdInDemo && v.vendorId === "V-041")).toBe(true);
    chooseLedger(store, "I-0003", store.ledgerAccounts[0].glAccount);

    mapUtilityAccount(store, "I-0018", "P-10777");
    expect(item("I-0018").state).toBe("Drafted");
    expect(store.utilityAccounts.find((a) => a.accountNumber === "5520-118")?.parcelId).toBe("P-10777");
    expect(draft("I-0018").propertyResolution?.method).toBe("utilityAccount");

    chooseOwner(store, "I-0026", "P-11702");
    expect(item("I-0026").state).toBe("Drafted");
    expect(draft("I-0026").propertyResolution?.parcelId).toBe("P-11702");

    confirmField(store, "I-0019", "amount");
    expect(readiness(draft("I-0019"), store).canSubmit).toBe(true);

    const after = submitAll(store);
    expect(after.submitted).toBe(22);
    expect(item("I-0021").state).toBe("Needs attention");
    expect(store.items.filter((i) => i.state === "Submitted")).toHaveLength(24);

    approveAll(store);
    expect(store.items.filter((i) => i.state === "Approved")).toHaveLength(24);

    const rows = importRows(store);
    const lineCounts = store.items.filter((i) => i.state === "Approved").map((i) => (draft(i.itemId).mode === "splitter" ? draft(i.itemId).lines.length : 1));
    expect(rows).toHaveLength(lineCounts.reduce((a, b) => a + b, 0));
    for (const row of rows) expect(Object.keys(row)).toHaveLength(15);
    expect(rows.some((r) => r.reference === "I-0009")).toBe(false);

    const ready = markPaid(store);
    expect(ready.paid).toBe(true);
    expect(ready.batch?.invoiceCount).toBe(24);
    expect(ready.batch?.lineCount).toBe(rows.length);
    expect(store.items.filter((i) => i.state === "Paid")).toHaveLength(24);

    for (const i of store.items.filter((x) => x.state === "Paid")) {
      const d = draft(i.itemId);
      const hasProperty = d.propertyResolution !== null || d.lines.some((l) => l.parcelId);
      if (!hasProperty) continue;
      expect(store.trackerUpdates.some((u) => u.itemId === i.itemId && u.reason === "paid"), i.itemId).toBe(true);
    }
  });

  it("reset returns every item to New with no drafts", () => {
    const fresh = resetStore();
    expect(fresh.items.every((i) => i.state === "New")).toBe(true);
    expect(Object.keys(fresh.drafts)).toHaveLength(0);
    expect(fresh.trackerUpdates).toHaveLength(0);
  });
});
