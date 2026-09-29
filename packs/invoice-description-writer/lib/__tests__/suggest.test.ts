import { describe, it, expect } from "vitest";
import { suggestGl, sortHistory } from "../suggest";
import { CODING_HISTORY } from "./fixture";
import type { CodingHistory } from "../types";

describe("suggestGl", () => {
  it("V-01 is 6320 Roofing repairs, 14 of 16, strong, with 6310 as the alternative", () => {
    const s = suggestGl("V-01", CODING_HISTORY);
    expect(s).toEqual({
      gl_code: "6320",
      gl_name: "Roofing repairs",
      basis_count: 14,
      basis_total: 16,
      tier: "strong",
      alternatives: [{ gl_code: "6310", gl_name: "Repairs and maintenance", count: 2, last_used: "2026-05-03" }],
    });
  });

  it("V-03 is 6510 Plumbing repairs, 9 of 15, weak, with 6520 as the alternative", () => {
    const s = suggestGl("V-03", CODING_HISTORY);
    expect(s.gl_code).toBe("6510");
    expect(s.gl_name).toBe("Plumbing repairs");
    expect(s.basis_count).toBe(9);
    expect(s.basis_total).toBe(15);
    expect(s.tier).toBe("weak");
    expect(s.alternatives).toEqual([{ gl_code: "6520", gl_name: "Plumbing capital", count: 6, last_used: "2026-07-15" }]);
  });

  it("V-14 has no history and gets none", () => {
    expect(suggestGl("V-14", CODING_HISTORY)).toEqual({ gl_code: null, gl_name: null, basis_count: 0, basis_total: 0, tier: "none", alternatives: [] });
  });

  it("a null vendor gets none", () => {
    expect(suggestGl(null, CODING_HISTORY).tier).toBe("none");
  });

  it("a single-service vendor with one row is strong with no alternatives", () => {
    const s = suggestGl("V-12", CODING_HISTORY);
    expect(s.gl_code).toBe("7410");
    expect(s.tier).toBe("strong");
    expect(s.basis_count).toBe(11);
    expect(s.basis_total).toBe(11);
    expect(s.alternatives).toEqual([]);
  });

  it("uses integer share math at the boundaries", () => {
    const rows = (a: number, b: number): CodingHistory[] => [
      { vendor_id: "V-02", gl_code: "6420", gl_name: "Landscaping", count: a, last_used: "2026-08-01" },
      { vendor_id: "V-02", gl_code: "6310", gl_name: "Repairs and maintenance", count: b, last_used: "2026-07-01" },
    ];
    expect(suggestGl("V-02", rows(7, 3)).tier).toBe("strong"); // exactly 70 percent
    expect(suggestGl("V-02", rows(6, 3)).tier).toBe("weak"); // 66 percent
    expect(suggestGl("V-02", rows(4, 0)).tier).toBe("weak"); // fewer than 5 codings
    expect(suggestGl("V-02", rows(5, 2)).tier).toBe("strong"); // 71 percent
  });

  it("does not use default_gl; history only", () => {
    // V-05 has a default code in the fixture vendors, but suggestGl never sees vendors.
    const s = suggestGl("V-05", CODING_HISTORY.filter((r) => r.vendor_id !== "V-05"));
    expect(s.tier).toBe("none");
    expect(s.gl_code).toBeNull();
  });
});

describe("sortHistory", () => {
  it("orders by count descending, then last_used descending, then gl_code ascending", () => {
    const rows: CodingHistory[] = [
      { vendor_id: "V-04", gl_code: "7310", gl_name: "Cleaning", count: 3, last_used: "2026-03-01" },
      { vendor_id: "V-04", gl_code: "7210", gl_name: "Supplies", count: 3, last_used: "2026-06-01" },
      { vendor_id: "V-04", gl_code: "6310", gl_name: "Repairs and maintenance", count: 5, last_used: "2026-01-01" },
      { vendor_id: "V-04", gl_code: "7110", gl_name: "Professional fees", count: 3, last_used: "2026-06-01" },
    ];
    expect(sortHistory(rows).map((r) => r.gl_code)).toEqual(["6310", "7110", "7210", "7310"]);
  });
});
