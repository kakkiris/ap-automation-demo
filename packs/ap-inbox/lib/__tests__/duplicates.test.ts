import { describe, expect, it } from "vitest";
import type { Vendor, VendorHistoryEntry } from "../types";
import { findDuplicate } from "../duplicates";

const entry = (date: string, invoiceNumber: string): VendorHistoryEntry => ({
  date,
  invoiceNumber,
  amount: 190000,
  glAccount: "9200-3100",
  cashAccount: "1000-2205",
  entityCode: "E-105",
  chargeType: null,
});

const vendor = (history: VendorHistoryEntry[]): Vendor => ({
  vendorId: "V-003",
  name: "Summit Roofing",
  aliases: [],
  lastGlAccount: "9200-3100",
  lastCashAccount: "1000-2205",
  lastEntityCode: "E-105",
  history,
  createdInDemo: false,
});

describe("findDuplicate", () => {
  it("finds 4471 paid last month", () => {
    const v = vendor([entry("2026-08-05", "4471"), entry("2026-06-11", "4402")]);
    expect(findDuplicate(v, "4471", "2026-09-03")?.date).toBe("2026-08-05");
  });
  it("ignores the same number paid 13 months ago", () => {
    const v = vendor([entry("2025-08-01", "4471")]);
    expect(findDuplicate(v, "4471", "2026-09-03")).toBeNull();
  });
  it("counts exactly twelve months ago as within the window", () => {
    const v = vendor([entry("2025-09-03", "4471")]);
    expect(findDuplicate(v, "4471", "2026-09-03")?.invoiceNumber).toBe("4471");
  });
  it("ignores other numbers, missing numbers and missing vendors", () => {
    const v = vendor([entry("2026-08-05", "4471")]);
    expect(findDuplicate(v, "4472", "2026-09-03")).toBeNull();
    expect(findDuplicate(v, null, "2026-09-03")).toBeNull();
    expect(findDuplicate(null, "4471", "2026-09-03")).toBeNull();
  });
});
