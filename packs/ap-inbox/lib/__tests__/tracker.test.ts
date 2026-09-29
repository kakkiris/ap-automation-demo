import { describe, expect, it } from "vitest";
import { ensureCard, postCaptured, postPaid, postSubmitted } from "../tracker";
import { makeDraft, makeItem, makeStore } from "./fixture";

describe("ensureCard", () => {
  it("returns the existing card for a parcel that has one", () => {
    const store = makeStore();
    const r = ensureCard(store, "P-11020");
    expect(r.created).toBe(false);
    expect(r.card.cardRef).toBe("T-8812");
    expect(store.trackerCards).toHaveLength(1);
  });

  it("creates a card for a parcel without one and skips T-8812", () => {
    const store = makeStore({ nextCardNumber: 8811 });
    const a = ensureCard(store, "P-11348");
    expect(a.created).toBe(true);
    expect(a.card.cardRef).toBe("T-8811");
    expect(a.card.createdInDemo).toBe(true);
    const b = ensureCard(store, "P-10620");
    expect(b.card.cardRef).toBe("T-8813");
    expect(store.trackerCards).toHaveLength(3);
  });
});

describe("tracker updates", () => {
  it("posts captured, submitted and paid once each per invoice and parcel", () => {
    const store = makeStore();
    const item = makeItem("I-0015");
    const draft = makeDraft("I-0015");
    store.items = [item];
    store.drafts["I-0015"] = draft;

    const captured = postCaptured(store, item, draft);
    expect(captured).toHaveLength(1);
    expect(captured[0].reason).toBe("captured");
    expect(captured[0].newCard).toBe(true);
    expect(captured[0].cardRef).toBe("T-8801");
    expect(captured[0].updateId).toBe("U-1");
    expect(captured[0].message).toBe("Invoice 2291 from Prairie Fence Co for 725.00 arrived by email and was captured for this property.");
    expect(captured[0].createdAt).toBe("2026-09-03T09:01:00Z");

    expect(postCaptured(store, item, draft)).toHaveLength(0);

    const submitted = postSubmitted(store, item, draft);
    expect(submitted[0].message).toBe("Invoice 2291 from Prairie Fence Co for 725.00 was submitted for approval.");
    expect(submitted[0].newCard).toBe(false);

    draft.paidAt = "2026-09-03T09:40:00Z";
    const paid = postPaid(store, item, draft);
    expect(paid[0].message).toBe("Invoice 2291 from Prairie Fence Co for 725.00 was paid on Sep 3, 2026.");
    expect(store.trackerUpdates.map((u) => u.reason)).toEqual(["captured", "submitted", "paid"]);
  });

  it("posts one update per resolved line in splitter mode", () => {
    const store = makeStore();
    const item = makeItem("I-0016", { source: "trackerApproved" });
    const draft = makeDraft("I-0016", {
      mode: "splitter",
      propertyResolution: null,
      amount: 15000,
      lines: [
        { lineNumber: 1, address: "15 Cobbler St", parcelId: "P-10620", owner: "x", entityCode: "E-109", cashAccount: "1000-2209", amount: 6000, glAccount: "9200-3300", splitMethod: "stated", systemPropertyExists: true, chargeType: null, description: null },
        { lineNumber: 2, address: "17 Cobbler St", parcelId: null, owner: null, entityCode: null, cashAccount: null, amount: 5000, glAccount: null, splitMethod: "stated", systemPropertyExists: false, chargeType: null, description: null },
        { lineNumber: 3, address: "19 Cobbler St", parcelId: "P-10622", owner: "x", entityCode: "E-109", cashAccount: "1000-2209", amount: 4000, glAccount: "9200-3300", splitMethod: "stated", systemPropertyExists: true, chargeType: null, description: null },
      ],
    });
    const updates = postCaptured(store, item, draft);
    expect(updates.map((u) => u.parcelId)).toEqual(["P-10620", "P-10622"]);
    expect(updates[0].message).toContain("this property 60.00");
    expect(updates[0].message).toContain("arrived from Monday.com");
  });

  it("posts nothing for an office item", () => {
    const store = makeStore();
    const item = makeItem("I-0024");
    const draft = makeDraft("I-0024", { propertyResolution: null, property: null });
    expect(postCaptured(store, item, draft)).toEqual([]);
  });
});
