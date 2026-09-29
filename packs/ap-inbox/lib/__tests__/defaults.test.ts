import { describe, expect, it } from "vitest";
import type { LedgerAccount, Vendor, VendorHistoryEntry } from "../types";
import { ledgerForChargeType, vendorDefaults } from "../defaults";

const chart: LedgerAccount[] = [
  { glAccount: "9200-3100", name: "Repairs and maintenance" },
  { glAccount: "9200-3300", name: "Grounds" },
  { glAccount: "9100-2100", name: "Utilities electric" },
  { glAccount: "9100-2200", name: "Utilities gas" },
  { glAccount: "9200-3150", name: "Locks and securing" },
];

const entry = (date: string, invoiceNumber: string, glAccount: string, extra: Partial<VendorHistoryEntry> = {}): VendorHistoryEntry => ({
  date,
  invoiceNumber,
  amount: 10000,
  glAccount,
  cashAccount: "1000-2201",
  entityCode: "E-101",
  chargeType: null,
  ...extra,
});

const vendor = (history: VendorHistoryEntry[]): Vendor => ({
  vendorId: "V-001",
  name: "Peoria Plumbing Company LLC",
  aliases: [],
  lastGlAccount: history[0]?.glAccount ?? null,
  lastCashAccount: history[0]?.cashAccount ?? null,
  lastEntityCode: history[0]?.entityCode ?? null,
  history,
  createdInDemo: false,
});

describe("vendorDefaults", () => {
  it("lets the most recent invoice win", () => {
    const v = vendor([
      entry("2026-08-12", "2201", "9200-3100", { cashAccount: "1000-2203", entityCode: "E-103" }),
      entry("2026-07-02", "2188", "9200-3300"),
      entry("2026-06-01", "2170", "9200-3100"),
    ]);
    const d = vendorDefaults(v, chart);
    expect(d.glAccount).toBe("9200-3100");
    expect(d.cashAccount).toBe("1000-2203");
    expect(d.entityCode).toBe("E-103");
    expect(d.ledgerChoices).toBeNull();
  });

  it("sorts history by date when it arrives out of order", () => {
    const v = vendor([entry("2026-06-01", "2170", "9200-3300"), entry("2026-08-12", "2201", "9200-3100")]);
    expect(vendorDefaults(v, chart).glAccount).toBe("9200-3100");
  });

  it("shows all three and asks when the last three disagree on the ledger account", () => {
    const v = vendor([
      entry("2026-08-12", "2201", "9200-3100"),
      entry("2026-07-02", "2188", "9200-3300"),
      entry("2026-06-01", "2170", "9200-3150"),
      entry("2026-05-01", "2150", "9200-3100"),
    ]);
    const d = vendorDefaults(v, chart);
    expect(d.glAccount).toBeNull();
    expect(d.ledgerChoices).toHaveLength(3);
    expect(d.ledgerChoices?.map((c) => c.glAccount)).toEqual(["9200-3100", "9200-3300", "9200-3150"]);
    expect(d.ledgerChoices?.[2].name).toBe("Locks and securing");
    expect(d.ledgerChoices?.[0].invoiceNumber).toBe("2201");
    expect(d.cashAccount).toBe("1000-2201");
  });

  it("gives nothing for a vendor with no history", () => {
    const d = vendorDefaults(vendor([]), chart);
    expect(d.glAccount).toBeNull();
    expect(d.cashAccount).toBeNull();
    expect(d.entityCode).toBeNull();
    expect(d.ledgerChoices).toBeNull();
  });

  it("gives nothing for no vendor", () => {
    expect(vendorDefaults(null, chart).glAccount).toBeNull();
  });
});

describe("ledgerForChargeType", () => {
  const v = vendor([
    entry("2026-08-12", "7781", "9100-2100", { chargeType: "electric" }),
    entry("2026-08-12", "7781", "9100-2200", { chargeType: "gas" }),
    entry("2026-07-10", "7702", "9200-3150", { chargeType: "locks and securing" }),
  ]);
  it("picks the most recent entry with that charge type", () => {
    expect(ledgerForChargeType(v, "gas", chart)).toBe("9100-2200");
    expect(ledgerForChargeType(v, "Electric", chart)).toBe("9100-2100");
    expect(ledgerForChargeType(v, "locks and securing", chart)).toBe("9200-3150");
  });
  it("falls back to the vendor default for a charge type it has not seen", () => {
    expect(ledgerForChargeType(v, "water", chart)).toBe(vendorDefaults(v, chart).glAccount);
  });
});
