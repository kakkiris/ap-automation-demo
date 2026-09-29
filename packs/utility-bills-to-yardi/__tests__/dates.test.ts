import { describe, it, expect } from "vitest";
import { addDays, addMonths, monthsBetween, monthStart, monthEnd, mid, inRange, fmtMMDD, monthLabel, fmtDate, fmtMoney, monthKey } from "../lib/dates";

describe("dates", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("handles months", () => {
    expect(monthKey("2026-08-02")).toBe("2026-08");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(monthsBetween("2026-03", "2026-05")).toEqual(["2026-03", "2026-04", "2026-05"]);
    expect(monthStart("2026-02")).toBe("2026-02-01");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(mid("2026-06")).toBe("2026-06-15");
  });
  it("checks ranges with open ends", () => {
    expect(inRange("2026-06-15", "2026-06-11", null)).toBe(true);
    expect(inRange("2026-06-10", "2026-06-11", null)).toBe(false);
    expect(inRange("2026-06-15", "2026-01-01", "2026-06-14")).toBe(false);
  });
  it("formats", () => {
    expect(fmtMMDD("2026-07-01")).toBe("07/01");
    expect(monthLabel("2026-07")).toBe("Jul 2026");
    expect(fmtDate("2026-08-20")).toBe("Aug 20, 2026");
    expect(fmtMoney(1234.5)).toBe("$1,234.50");
  });
});
