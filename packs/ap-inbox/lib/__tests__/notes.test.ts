import { describe, expect, it } from "vitest";
import type { Extraction } from "../types";
import { notesTemplate, numberWord } from "../notes";

const extraction = (over: Partial<Extraction>): Extraction => ({
  kind: "invoice",
  payee: "Greenway Lawn Care",
  invoiceNumber: "3310",
  invoiceDate: "2026-08-28",
  totalAmount: "450.00",
  serviceAddressLines: [],
  parcelRefs: [],
  utilityAccountNumber: null,
  lineItems: [],
  confidence: { payee: 0.95, invoiceNumber: 0.95, invoiceDate: 0.95, totalAmount: 0.95, address: 0.9 },
  notesHint: null,
  ...over,
});

const words = (s: string) => s.trim().split(/\s+/).length;

describe("notesTemplate", () => {
  it("names the count of lots in words for a list", () => {
    const n = notesTemplate(extraction({ kind: "list", notesHint: "Monthly lawn service" }), 9);
    expect(n).toBe("Monthly lawn service, nine lots");
    expect(words(n)).toBeLessThan(20);
  });
  it("uses digits above twelve", () => {
    expect(notesTemplate(extraction({ kind: "statement", notesHint: "Monthly statement" }), 13)).toBe("Monthly statement, 13 properties");
  });
  it("gives the hint alone for a single item", () => {
    expect(notesTemplate(extraction({ notesHint: "Kitchen drain repair" }), 1)).toBe("Kitchen drain repair");
  });
  it("gives Office supplies for an office item with no hint", () => {
    expect(notesTemplate(extraction({ notesHint: null, serviceAddressLines: [] }), 1)).toBe("Office supplies");
  });
  it("gives a plain fallback for a property item with no hint", () => {
    const n = notesTemplate(extraction({ notesHint: null, serviceAddressLines: ["19 Lark St, Marion IN"] }), 1);
    expect(n.length).toBeGreaterThan(0);
    expect(words(n)).toBeLessThan(20);
  });
  it("keeps a long hint under twenty words", () => {
    const hint = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
    expect(words(notesTemplate(extraction({ notesHint: hint }), 1))).toBeLessThan(20);
  });
  it("spells two to twelve", () => {
    expect(numberWord(2)).toBe("two");
    expect(numberWord(12)).toBe("twelve");
    expect(numberWord(13)).toBe("13");
  });
});

describe("notes template when the hint already carries the count", () => {
  it("does not repeat the count", () => {
    expect(notesTemplate(extraction({ kind: "list", notesHint: "Monthly lawn service, nine lots" }), 9)).toBe("Monthly lawn service, nine lots");
    expect(notesTemplate(extraction({ kind: "invoice", notesHint: "Lot mowing, two lots" }), 2)).toBe("Lot mowing, two lots");
    expect(notesTemplate(extraction({ kind: "statement", notesHint: "Property services, ten properties" }), 10)).toBe("Property services, ten properties");
  });
});
