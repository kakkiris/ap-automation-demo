import { describe, it, expect } from "vitest";
import { formatAmount, toCents } from "../money";

describe("formatAmount", () => {
  it("renders dollars with grouping and two decimals", () => {
    expect(formatAmount(2400)).toBe("$2,400.00");
    expect(formatAmount(45.5)).toBe("$45.50");
    expect(formatAmount(312.4)).toBe("$312.40");
    expect(formatAmount(1234567.891)).toBe("$1,234,567.89");
    expect(formatAmount(0)).toBe("$0.00");
  });

  it("works in integer cents so float noise never shows", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(formatAmount(0.1 + 0.2)).toBe("$0.30");
    expect(toCents(760.5)).toBe(76050);
  });
});
