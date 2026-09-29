import { describe, it, expect } from "vitest";
import { normalizeName, normalizeAddress, tokenOverlap, sameNormalizedName, sameAddress, suffixDiffers, NEAR_MATCH_THRESHOLD } from "../normalize";

describe("normalizeName", () => {
  it("makes the PW pair equal once dots and the suffix are stripped", () => {
    expect(normalizeName("PW Maintenance LLC")).toBe("pw maintenance");
    expect(normalizeName("P.W. Maintenance")).toBe("pw maintenance");
    expect(sameNormalizedName("PW Maintenance LLC", "P.W. Maintenance")).toBe(true);
  });

  it("drops a leading the and a trailing inc", () => {
    expect(normalizeName("The Coral Ridge Pressure Washing Inc")).toBe("coral ridge pressure washing");
  });

  it("keeps a name that is only a suffix word", () => {
    expect(normalizeName("Co")).toBe("co");
  });

  it("normalizes addresses without suffix handling", () => {
    expect(normalizeAddress("41 Marlin Bay Dr.")).toBe("41 marlin bay dr");
    expect(sameAddress("41 Marlin Bay Dr", "41  marlin bay DR")).toBe(true);
  });
});

describe("tokenOverlap", () => {
  it("scores the Tidewater pair at 1", () => {
    expect(tokenOverlap("Tidewater Plumbing Co", "Tidewater Plumbing Supply")).toBe(1);
    expect(tokenOverlap("Tidewater Plumbing Co", "Tidewater Plumbing Supply")).toBeGreaterThanOrEqual(NEAR_MATCH_THRESHOLD);
  });

  it("scores a two of three overlap at 0.67", () => {
    expect(tokenOverlap("Old Harbor Fence", "Old Harbor Fencing")).toBe(0.67);
  });

  it("scores unrelated names at 0", () => {
    expect(tokenOverlap("Keys Gate Fencing", "Brightline Landscaping")).toBe(0);
  });
});

describe("suffixDiffers", () => {
  it("is true for the PW pair", () => {
    expect(suffixDiffers("PW Maintenance LLC", "P.W. Maintenance")).toBe(true);
  });

  it("is false for two identical spellings", () => {
    expect(suffixDiffers("Brightline Landscaping", "Brightline Landscaping")).toBe(false);
  });

  it("is false for two different names", () => {
    expect(suffixDiffers("Tidewater Plumbing Co", "Tidewater Plumbing Supply")).toBe(false);
  });
});
