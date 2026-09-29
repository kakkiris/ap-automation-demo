import { describe, expect, it } from "vitest";
import { dollarsToCents, fmtCents, fmtCentsPlain, parseMoney } from "../money";

describe("parseMoney", () => {
  it("reads a grouped amount as printed", () => {
    expect(parseMoney("6,988.40")).toBe(698840);
  });
  it("reads a currency sign and spaces", () => {
    expect(parseMoney(" $1,900.00 ")).toBe(190000);
  });
  it("reads whole dollars and one decimal", () => {
    expect(parseMoney("175")).toBe(17500);
    expect(parseMoney("175.5")).toBe(17550);
  });
  it("returns null for nothing and for text that is not money", () => {
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("unreadable")).toBeNull();
    expect(parseMoney("12.345")).toBeNull();
  });
});

describe("dollarsToCents", () => {
  it("reads what the specialist types", () => {
    expect(dollarsToCents("175.00")).toBe(17500);
    expect(dollarsToCents("175")).toBe(17500);
    expect(dollarsToCents("1,900.00")).toBe(190000);
    expect(dollarsToCents("abc")).toBeNull();
  });
});

describe("fmtCents", () => {
  it("prints grouped dollars with two decimals and no sign", () => {
    expect(fmtCents(698840)).toBe("6,988.40");
    expect(fmtCents(5000)).toBe("50.00");
    expect(fmtCents(0)).toBe("0.00");
    expect(fmtCents(123456789)).toBe("1,234,567.89");
    expect(fmtCents(-250)).toBe("-2.50");
  });
  it("prints the plain form for the import file", () => {
    expect(fmtCentsPlain(698840)).toBe("6988.40");
    expect(fmtCentsPlain(48000)).toBe("480.00");
  });
});
