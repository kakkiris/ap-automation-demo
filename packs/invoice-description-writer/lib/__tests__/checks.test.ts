import { describe, it, expect } from "vitest";
import { checkExtraction, normalizeName, resolveVendor, isRealDate } from "../checks";
import { VENDORS } from "./fixture";
import type { ExtractionFields } from "../types";

const good: ExtractionFields = {
  vendor_name: "Coral Ridge Roofing",
  property_hint: "PR",
  unit_hint: "PR-12",
  service_short: "roof leak repair",
  service_from: "2026-08-24",
  service_to: "2026-08-26",
  invoice_number: "CR-88213",
  invoice_date: "2026-08-28",
  amount: 2400,
  due_date: "2026-09-27",
  account_number: null,
  meter_number: null,
};

describe("checkExtraction", () => {
  it("passes a complete reading and resolves the vendor", () => {
    const c = checkExtraction(good, VENDORS);
    expect(c.status).toBe("read");
    expect(c.reasons).toEqual([]);
    expect(c.resolved_vendor_id).toBe("V-01");
    expect(c.missing).toEqual(["account_number", "meter_number"]);
  });

  it("resolves the vendor by normalized name", () => {
    expect(checkExtraction({ ...good, vendor_name: "  CORAL ridge Roofing. " }, VENDORS).resolved_vendor_id).toBe("V-01");
    expect(checkExtraction({ ...good, vendor_name: "Coral-Ridge Roofing" }, VENDORS).resolved_vendor_id).toBe("V-01");
  });

  it("an unseen vendor still passes with no resolved vendor", () => {
    const c = checkExtraction({ ...good, vendor_name: "Keys Gate Fencing Co" }, VENDORS);
    expect(c.status).toBe("read");
    expect(c.resolved_vendor_id).toBeNull();
  });

  it("INV-3021's null vendor and null amount fail the checks", () => {
    const c = checkExtraction({ ...good, vendor_name: null, amount: null, service_short: null }, VENDORS);
    expect(c.status).toBe("failed");
    expect(c.reasons).toEqual(["vendor name not found on the invoice", "amount not found on the invoice"]);
    expect(c.missing).toEqual(["vendor_name", "service_short", "amount", "account_number", "meter_number"]);
    expect(c.resolved_vendor_id).toBeNull();
  });

  it("an amount of zero or less fails", () => {
    expect(checkExtraction({ ...good, amount: 0 }, VENDORS).status).toBe("failed");
    expect(checkExtraction({ ...good, amount: -5 }, VENDORS).reasons).toEqual(["amount is not greater than zero"]);
  });

  it("dates must be real YYYY-MM-DD dates", () => {
    expect(checkExtraction({ ...good, service_from: "2026-02-30" }, VENDORS).reasons).toEqual(["service dates do not read as dates"]);
    expect(checkExtraction({ ...good, service_to: "08/26/2026" }, VENDORS).status).toBe("failed");
    expect(checkExtraction({ ...good, invoice_date: "2026-13-01" }, VENDORS).reasons).toEqual(["invoice date does not read as a date"]);
    expect(checkExtraction({ ...good, due_date: "next month" }, VENDORS).reasons).toEqual(["due date does not read as a date"]);
  });

  it("service from may not be after service to", () => {
    const c = checkExtraction({ ...good, service_from: "2026-08-27", service_to: "2026-08-26" }, VENDORS);
    expect(c.status).toBe("failed");
    expect(c.reasons).toEqual(["service from is later than service to"]);
    expect(checkExtraction({ ...good, service_from: "2026-08-26", service_to: "2026-08-26" }, VENDORS).status).toBe("read");
  });

  it("missing service dates are allowed", () => {
    const c = checkExtraction({ ...good, service_from: null, service_to: null }, VENDORS);
    expect(c.status).toBe("read");
    expect(c.missing).toContain("service_from");
  });

  it("an unavailable reading fails with the one reason and every field missing", () => {
    const empty = Object.fromEntries(Object.keys(good).map((k) => [k, null])) as unknown as ExtractionFields;
    const c = checkExtraction(empty, VENDORS, "unavailable");
    expect(c.status).toBe("failed");
    expect(c.reasons).toEqual(["extraction unavailable"]);
    expect(c.missing).toHaveLength(12);
  });

  it("never uses a forbidden word in a reason", () => {
    const empty = Object.fromEntries(Object.keys(good).map((k) => [k, null])) as unknown as ExtractionFields;
    const all = [...checkExtraction(empty, VENDORS).reasons, ...checkExtraction({ ...good, service_from: "x", invoice_date: "y", due_date: "z", amount: 0 }, VENDORS).reasons];
    for (const r of all) expect(r).not.toMatch(/\b(model|deterministic|pipeline|API)\b/i);
  });
});

describe("helpers", () => {
  it("normalizeName keeps letters and digits only, lowercased", () => {
    expect(normalizeName(" Coral Ridge Roofing, Inc. ")).toBe("coralridgeroofinginc");
    expect(normalizeName("A1 B2")).toBe("a1b2");
  });

  it("resolveVendor returns the vendor or null", () => {
    expect(resolveVendor("tidewater plumbing", VENDORS)?.vendor_id).toBe("V-03");
    expect(resolveVendor("Nobody", VENDORS)).toBeNull();
    expect(resolveVendor(null, VENDORS)).toBeNull();
  });

  it("isRealDate rejects impossible and misformatted dates", () => {
    expect(isRealDate("2026-08-31")).toBe(true);
    expect(isRealDate("2026-02-29")).toBe(false);
    expect(isRealDate("2024-02-29")).toBe(true);
    expect(isRealDate("2026-8-1")).toBe(false);
    expect(isRealDate("2026-08-31T00:00:00")).toBe(false);
  });
});
