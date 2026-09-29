import { describe, it, expect } from "vitest";
import { entityList, entityForOwner } from "../entities";
import { HOLDING_COMPANIES, OPERATING_COMPANY } from "../scripted";

describe("owner to entity map", () => {
  it("gives the operating company E-001 and each holding company a code and cash account in order", () => {
    const list = entityList();
    expect(list[0]).toEqual({ entityCode: "E-001", name: OPERATING_COMPANY, cashAccount: "1000-1001", kind: "operating" });
    expect(list).toHaveLength(HOLDING_COMPANIES.length + 1);
    expect(list[1]).toEqual({ entityCode: "E-101", name: HOLDING_COMPANIES[0], cashAccount: "1000-2201", kind: "holding" });
    expect(new Set(list.map((e) => e.entityCode)).size).toBe(list.length);
  });
  it("finds an owner by name and returns null for a stranger", () => {
    expect(entityForOwner(HOLDING_COMPANIES[3])?.entityCode).toBe("E-104");
    expect(entityForOwner("Nobody Holdings LLC")).toBeNull();
  });
});
