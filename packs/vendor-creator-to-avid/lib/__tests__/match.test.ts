import { describe, it, expect } from "vitest";
import { matchVendor, applyDecision, outcomeFor, computeGap, computeHeld } from "../match";
import { MATCH_REASONS } from "../types";
import { avidVendors, fixtureStore, yardi } from "./fixture";

describe("matchVendor", () => {
  it("holds V-Y-0117 against V-A-0088 with same normalized name and same address", () => {
    const out = matchVendor(yardi("V-Y-0117"), avidVendors, "assisted");
    expect(out.action).toBe("hold");
    expect(out.avid_vendor_id).toBe("V-A-0088");
    expect(out.candidate?.reasons).toEqual([
      MATCH_REASONS.sameNormalizedName,
      MATCH_REASONS.sameAddress,
      MATCH_REASONS.suffixDifference,
      MATCH_REASONS.sameTaxLast4,
    ]);
    expect(out.candidate?.score).toBe(1);
    expect(out.candidate?.decision).toBe("none");
    expect(out.reason).toBe("near match with V-A-0088: same normalized name, same address, suffix difference, same tax id last four");
  });

  it("holds V-Y-0119 against V-A-0092 with similar name and different address", () => {
    const out = matchVendor(yardi("V-Y-0119"), avidVendors, "assisted");
    expect(out.action).toBe("hold");
    expect(out.avid_vendor_id).toBe("V-A-0092");
    expect(out.candidate?.reasons).toEqual([
      MATCH_REASONS.similarName,
      MATCH_REASONS.differentAddress,
      MATCH_REASONS.differentTaxLast4,
    ]);
    expect(out.candidate?.score).toBe(1);
  });

  it("omits the tax reason when the Avid record has no tax digits", () => {
    const avid = avidVendors.map((a) => (a.avid_vendor_id === "V-A-0092" ? { ...a, tax_id_last4: null } : a));
    const out = matchVendor(yardi("V-Y-0119"), avid, "assisted");
    expect(out.candidate?.reasons).toEqual([MATCH_REASONS.similarName, MATCH_REASONS.differentAddress]);
  });

  it("holds a same name at a different address", () => {
    const avid = [{ ...avidVendors[0], address_line: "1 Somewhere Else" }];
    const out = matchVendor(yardi("V-Y-0044"), avid, "assisted");
    expect(out.action).toBe("hold");
    expect(out.candidate?.reasons).toEqual([MATCH_REASONS.sameNormalizedName, MATCH_REASONS.differentAddress, MATCH_REASONS.sameTaxLast4]);
  });

  it("stages V-Y-0121 in assisted mode and creates it in automatic mode", () => {
    const assisted = matchVendor(yardi("V-Y-0121"), avidVendors, "assisted");
    expect(assisted.action).toBe("stage");
    expect(assisted.reason).toBe("no match in Avid");
    expect(assisted.avid_vendor_id).toBeNull();
    expect(assisted.candidate).toBeNull();
    const automatic = matchVendor(yardi("V-Y-0121"), avidVendors, "automatic");
    expect(automatic.action).toBe("create");
    expect(automatic.avid_vendor_id).toBeNull();
  });

  it("skips V-Y-0130 as inactive in either mode", () => {
    for (const mode of ["assisted", "automatic"] as const) {
      const out = matchVendor(yardi("V-Y-0130"), avidVendors, mode);
      expect(out.action).toBe("skip_inactive");
      expect(out.reason).toBe("inactive in Yardi, not synced");
      expect(out.avid_vendor_id).toBeNull();
      expect(out.candidate).toBeNull();
    }
  });

  it("skips V-Y-0044 as an exact match with V-A-0031", () => {
    const out = matchVendor(yardi("V-Y-0044"), avidVendors, "assisted");
    expect(out.action).toBe("skip_exact");
    expect(out.avid_vendor_id).toBe("V-A-0031");
    expect(out.reason).toBe("already in Avid as V-A-0031, same name and address");
    expect(out.candidate).toBeNull();
  });
});

describe("applyDecision", () => {
  it("link turns the PW hold into skip_exact with V-A-0088", () => {
    const held = matchVendor(yardi("V-Y-0117"), avidVendors, "assisted");
    const out = applyDecision(held, "link", "assisted");
    expect(out.action).toBe("skip_exact");
    expect(out.avid_vendor_id).toBe("V-A-0088");
    expect(out.reason).toBe("linked by hand to V-A-0088, same vendor");
    expect(out.candidate?.decision).toBe("link");
  });

  it("create turns the Tidewater hold into stage in assisted mode and create in automatic mode", () => {
    const held = matchVendor(yardi("V-Y-0119"), avidVendors, "assisted");
    const staged = applyDecision(held, "create", "assisted");
    expect(staged.action).toBe("stage");
    expect(staged.avid_vendor_id).toBeNull();
    expect(staged.reason).toBe("different vendor, confirmed by hand");
    const created = applyDecision(held, "create", "automatic");
    expect(created.action).toBe("create");
    expect(created.avid_vendor_id).toBeNull();
  });

  it("later and none leave the hold in place", () => {
    const held = matchVendor(yardi("V-Y-0119"), avidVendors, "assisted");
    expect(applyDecision(held, "later", "assisted").action).toBe("hold");
    expect(applyDecision(held, "none", "assisted").action).toBe("hold");
  });

  it("does nothing to an outcome that is not a hold", () => {
    const exact = matchVendor(yardi("V-Y-0044"), avidVendors, "assisted");
    expect(applyDecision(exact, "create", "assisted")).toEqual(exact);
  });
});

describe("outcomeFor, computeGap, computeHeld", () => {
  it("uses the stored decision for the pair", () => {
    const store = fixtureStore();
    expect(outcomeFor(store, yardi("V-Y-0117")).action).toBe("hold");
    store.match_candidates[0].decision = "link";
    const out = outcomeFor(store, yardi("V-Y-0117"));
    expect(out.action).toBe("skip_exact");
    expect(out.avid_vendor_id).toBe("V-A-0088");
  });

  it("counts the gap and the held pairs from the masters", () => {
    const store = fixtureStore();
    expect(computeGap(store)).toBe(1);
    expect(computeHeld(store)).toBe(2);
    store.match_candidates[1].decision = "create";
    expect(computeGap(store)).toBe(2);
    expect(computeHeld(store)).toBe(1);
    store.match_candidates[0].decision = "link";
    expect(computeGap(store)).toBe(2);
    expect(computeHeld(store)).toBe(0);
  });
});
