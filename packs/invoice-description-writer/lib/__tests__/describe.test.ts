import { describe, it, expect } from "vitest";
import { describeInvoice, SERVICE_TEMPLATE, UTILITY_TEMPLATE, SERVICE_SEGMENTS, UTILITY_SEGMENTS, type DescribeInput } from "../describe";
import { DESCRIPTION_MAX_LENGTH } from "../types";

const DATE = /\d{4}-\d{2}-\d{2}/;

const inv3007: DescribeInput = {
  invoice_type: "service",
  vendor_name: "Coral Ridge Roofing",
  service_short: "roof leak repair",
  property_code: "PR",
  unit_label: "PR-12",
  service_from: "2026-08-24",
  service_to: "2026-08-26",
  account_number: null,
  meter_number: null,
};

describe("describeInvoice, service template", () => {
  it("INV-3007 renders the pack's exact description with nothing missing", () => {
    const d = describeInvoice(inv3007);
    expect(d.text).toBe("Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26");
    expect(d.template_id).toBe("service");
    expect(d.missing_fields).toEqual([]);
    expect(d.truncated).toBe(false);
  });

  it("INV-3012 with no service dates says so and prints no date", () => {
    const d = describeInvoice({ ...inv3007, vendor_name: "Palmetto Pest Control", service_short: "quarterly pest treatment", property_code: "LK", unit_label: "LK-04", service_from: null, service_to: null });
    expect(d.text).toBe("Palmetto Pest Control quarterly pest treatment LK LK-04 dates not on invoice");
    expect(d.text).toContain("dates not on invoice");
    expect(d.text).not.toMatch(DATE);
    expect(d.missing_fields).toEqual(["service_from", "service_to"]);
  });

  it("INV-3033 puts the account number first, followed by a space", () => {
    const d = describeInvoice({ ...inv3007, vendor_name: "Harbor Elevator Service", service_short: "elevator service contract", property_code: "LK", unit_label: null, service_from: "2026-08-01", service_to: "2026-08-31", account_number: "9955512340" });
    expect(d.text.startsWith("9955512340 ")).toBe(true);
    expect(d.text).toBe("9955512340 Harbor Elevator Service elevator service contract LK no unit 2026-08-01 to 2026-08-31");
    expect(d.missing_fields).toEqual(["unit_label"]);
  });

  it("a missing unit renders as no unit and is listed", () => {
    const d = describeInvoice({ ...inv3007, unit_label: null });
    expect(d.text).toBe("Coral Ridge Roofing roof leak repair PR no unit 2026-08-24 to 2026-08-26");
    expect(d.missing_fields).toEqual(["unit_label"]);
  });

  it("a missing property is skipped and listed", () => {
    const d = describeInvoice({ ...inv3007, property_code: null });
    expect(d.text).toBe("Coral Ridge Roofing roof leak repair PR-12 2026-08-24 to 2026-08-26");
    expect(d.missing_fields).toEqual(["property_code"]);
  });

  it("a missing service renders as service not on invoice and is listed", () => {
    const d = describeInvoice({ ...inv3007, service_short: null });
    expect(d.text).toBe("Coral Ridge Roofing service not on invoice PR PR-12 2026-08-24 to 2026-08-26");
    expect(d.missing_fields).toEqual(["service_short"]);
  });

  it("one missing date still renders dates not on invoice and lists only the missing one", () => {
    const from = describeInvoice({ ...inv3007, service_to: null });
    expect(from.text).toBe("Coral Ridge Roofing roof leak repair PR PR-12 dates not on invoice");
    expect(from.missing_fields).toEqual(["service_to"]);
    const to = describeInvoice({ ...inv3007, service_from: null });
    expect(to.missing_fields).toEqual(["service_from"]);
  });

  it("never renders no account number on the service template", () => {
    const d = describeInvoice(inv3007);
    expect(d.text).not.toContain("no account number");
    expect(d.missing_fields).not.toContain("account_number");
  });
});

describe("describeInvoice, utility template", () => {
  const inv3025: DescribeInput = {
    invoice_type: "utility",
    vendor_name: "Sunline Power",
    service_short: "electric service",
    property_code: "PR",
    unit_label: null,
    service_from: "2026-07-20",
    service_to: "2026-08-19",
    account_number: "9912345678",
    meter_number: "M912345678",
  };

  it("INV-3025 renders account, service, dates, meter", () => {
    const d = describeInvoice(inv3025);
    expect(d.text).toBe("9912345678 electric service 2026-07-20 to 2026-08-19 meter M912345678");
    expect(d.template_id).toBe("utility");
    expect(d.missing_fields).toEqual([]);
  });

  it("states each missing utility segment", () => {
    const d = describeInvoice({ ...inv3025, account_number: null, meter_number: null, service_from: null, service_to: null, service_short: null });
    expect(d.text).toBe("no account number service not on invoice dates not on invoice meter number not on invoice");
    expect(d.missing_fields).toEqual(["account_number", "service_short", "service_from", "service_to", "meter_number"]);
  });
});

describe("describeInvoice, length limit", () => {
  it("drops the service segment's last words until the text fits", () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i + 1}`);
    const d = describeInvoice({ ...inv3007, service_short: words.join(" ") });
    expect(d.text.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH);
    expect(d.truncated).toBe(true);
    expect(d.text.startsWith("Coral Ridge Roofing word1 word2")).toBe(true);
    expect(d.text.endsWith(" PR PR-12 2026-08-24 to 2026-08-26")).toBe(true);
    expect(d.text).not.toContain("word60");
    expect(d.missing_fields).toEqual([]);
  });

  it("trims characters off a single long service word", () => {
    const d = describeInvoice({ ...inv3007, service_short: "x".repeat(300) });
    expect(d.text.length).toBe(DESCRIPTION_MAX_LENGTH);
    expect(d.truncated).toBe(true);
    expect(d.text.endsWith(" PR PR-12 2026-08-24 to 2026-08-26")).toBe(true);
  });

  it("cuts the text at the limit when the service segment alone cannot make it fit", () => {
    const d = describeInvoice({ ...inv3007, vendor_name: "V".repeat(300), service_short: "roof" });
    expect(d.text.length).toBe(DESCRIPTION_MAX_LENGTH);
    expect(d.truncated).toBe(true);
  });

  it("leaves a text of exactly the limit alone", () => {
    const base = describeInvoice({ ...inv3007, service_short: "x" });
    const room = DESCRIPTION_MAX_LENGTH - base.text.length + 1;
    const d = describeInvoice({ ...inv3007, service_short: "s".repeat(room) });
    expect(d.text.length).toBe(DESCRIPTION_MAX_LENGTH);
    expect(d.truncated).toBe(false);
  });

  it("treats an empty service string as not on the invoice", () => {
    const d = describeInvoice({ ...inv3007, service_short: "   " });
    expect(d.text).toContain("service not on invoice");
    expect(d.missing_fields).toEqual(["service_short"]);
  });
});

describe("template display strings", () => {
  it("match the recorded wording", () => {
    expect(SERVICE_TEMPLATE).toBe("{account number, when the invoice prints one} {vendor} {service} {property} {unit} {service from} to {service to}");
    expect(UTILITY_TEMPLATE).toBe("{account number} {service} {service from} to {service to} meter {meter number}");
  });

  it("list what each placeholder renders when missing", () => {
    expect(SERVICE_SEGMENTS.map((s) => s.placeholder)).toEqual(["{account number, when the invoice prints one}", "{vendor}", "{service}", "{property}", "{unit}", "{service from} to {service to}"]);
    expect(SERVICE_SEGMENTS.find((s) => s.placeholder === "{unit}")?.when_missing).toBe("no unit");
    expect(SERVICE_SEGMENTS.find((s) => s.placeholder === "{service}")?.when_missing).toBe("service not on invoice");
    expect(SERVICE_SEGMENTS.find((s) => s.placeholder === "{service from} to {service to}")?.when_missing).toBe("dates not on invoice");
    expect(SERVICE_SEGMENTS.find((s) => s.placeholder === "{property}")?.when_missing).toBeNull();
    expect(UTILITY_SEGMENTS.map((s) => s.placeholder)).toEqual(["{account number}", "{service}", "{service from} to {service to}", "meter {meter number}"]);
    expect(UTILITY_SEGMENTS[0].when_missing).toBe("no account number");
    expect(UTILITY_SEGMENTS[3].when_missing).toBe("meter number not on invoice");
  });
});
