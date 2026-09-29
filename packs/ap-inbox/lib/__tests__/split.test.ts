import { describe, expect, it } from "vitest";
import { equalSplit, sumCheck } from "../split";

describe("equalSplit", () => {
  it("splits 450.00 over nine lots into nine 50.00 lines", () => {
    const parts = equalSplit(45000, 9);
    expect(parts).toEqual([5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(45000);
  });
  it("puts the remainder on the first line", () => {
    expect(equalSplit(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(equalSplit(1, 2)).toEqual([1, 0]);
  });
  it("gives nothing for zero lines", () => {
    expect(equalSplit(45000, 0)).toEqual([]);
  });
});

describe("sumCheck", () => {
  it("is ok only when every line has an amount and the sum matches exactly", () => {
    expect(sumCheck([{ amount: 6000 }, { amount: 5000 }, { amount: 4000 }], 15000)).toEqual({ linesTotal: 15000, invoiceTotal: 15000, ok: true });
  });
  it("turns red when one amount is off by a dollar", () => {
    const c = sumCheck([{ amount: 6100 }, { amount: 5000 }, { amount: 4000 }], 15000);
    expect(c.ok).toBe(false);
    expect(c.linesTotal).toBe(15100);
  });
  it("is not ok when a line has no amount", () => {
    const c = sumCheck([{ amount: 6000 }, { amount: null }], 6000);
    expect(c.ok).toBe(false);
    expect(c.linesTotal).toBe(6000);
  });
});
