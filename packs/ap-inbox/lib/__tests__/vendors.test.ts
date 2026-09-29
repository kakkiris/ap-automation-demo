import { describe, expect, it } from "vitest";
import type { Vendor } from "../types";
import { matchVendor, normaliseVendorName, scoreVendor, VENDOR_THRESHOLD } from "../vendors";

const vendor = (vendorId: string, name: string, aliases: string[] = []): Vendor => ({
  vendorId,
  name,
  aliases,
  lastGlAccount: null,
  lastCashAccount: null,
  lastEntityCode: null,
  history: [],
  createdInDemo: false,
});

const master: Vendor[] = [
  vendor("V-001", "Peoria Plumbing Company LLC", ["Peoria Plumbing Co.", "Peoria Plumbing"]),
  vendor("V-002", "Greenway Lawn Care"),
  vendor("V-003", "Summit Roofing"),
  vendor("V-004", "Ridgeway Locksmith"),
  vendor("V-005", "Harborview Property Services"),
  vendor("V-006", "Northshore Tree Service"),
  vendor("V-007", "Lakefront Office Supply"),
  vendor("V-008", "Copperfield Pest Control"),
];

describe("normaliseVendorName", () => {
  it("lower-cases, strips punctuation and expands co and svc", () => {
    expect(normaliseVendorName("Peoria Plumbing Co.")).toBe("peoria plumbing company");
    expect(normaliseVendorName("Ridgeway Svc, Inc.")).toBe("ridgeway services inc");
    expect(normaliseVendorName("Smoke & Mirrors LLC")).toBe("smoke and mirrors llc");
  });
});

describe("scoreVendor", () => {
  it("scores the short variant at exactly 0.94", () => {
    expect(scoreVendor("Peoria Plumbing Co.", master[0])).toBe(0.94);
  });
  it("scores an exact name at 1.00", () => {
    expect(scoreVendor("Greenway Lawn Care", master[1])).toBe(1);
  });
  it("never scores an alias below the threshold", () => {
    const v = vendor("V-009", "Prairie Fence Company", ["PFC"]);
    expect(scoreVendor("PFC", v)).toBeGreaterThanOrEqual(VENDOR_THRESHOLD);
  });
  it("takes 0.20 off per master core word the document leaves out", () => {
    expect(scoreVendor("Harborview Property", master[4])).toBe(0.8);
  });
  it("takes 0.10 off per extra core word the document adds", () => {
    expect(scoreVendor("Greenway Lawn Care Services", master[1])).toBe(0.9);
  });
  it("keeps partial overlaps below the threshold", () => {
    expect(scoreVendor("Summit Locksmith", master[3])).toBeLessThan(VENDOR_THRESHOLD);
  });
});

describe("matchVendor", () => {
  it("matches the plumbing variant to the master name at 0.94", () => {
    const r = matchVendor("Peoria Plumbing Co.", master);
    expect(r.match?.vendorId).toBe("V-001");
    expect(r.match?.score).toBe(0.94);
    expect(r.match?.name).toBe("Peoria Plumbing Company LLC");
  });
  it("matches an exact name at 1.00", () => {
    const r = matchVendor("Greenway Lawn Care", master);
    expect(r.match?.vendorId).toBe("V-002");
    expect(r.match?.score).toBe(1);
  });
  it("gives no match and three candidates below the threshold for an unknown vendor", () => {
    const r = matchVendor("Bluewater Tree Removal", master);
    expect(r.match).toBeNull();
    expect(r.candidates).toHaveLength(3);
    for (const c of r.candidates) expect(c.score).toBeLessThan(VENDOR_THRESHOLD);
    expect(r.candidates[0].score).toBeGreaterThanOrEqual(r.candidates[1].score);
    expect(r.candidates[1].score).toBeGreaterThanOrEqual(r.candidates[2].score);
    expect(r.candidates[0].vendorId).toBe("V-006");
  });
  it("gives nothing for empty text", () => {
    const r = matchVendor("", master);
    expect(r.match).toBeNull();
    expect(r.candidates).toEqual([]);
  });
});
