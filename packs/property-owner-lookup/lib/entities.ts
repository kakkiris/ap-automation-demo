import { HOLDING_COMPANIES, OPERATING_COMPANY } from "./scripted";

// Owner to entity map: the operating company, then one holding company per registry
// owner in order. Entity codes E-101 upward and cash accounts 1000-2201 upward follow
// the HOLDING_COMPANIES order, so every module that imports this sees the same map.
export interface Entity {
  entityCode: string;
  name: string;
  cashAccount: string;
  kind: "holding" | "operating";
}

export function entityList(): Entity[] {
  return [
    { entityCode: "E-001", name: OPERATING_COMPANY, cashAccount: "1000-1001", kind: "operating" },
    ...HOLDING_COMPANIES.map((name, i): Entity => ({ entityCode: `E-${101 + i}`, name, cashAccount: `1000-${2201 + i}`, kind: "holding" })),
  ];
}

export function entityForOwner(ownerName: string): Entity | null {
  return entityList().find((e) => e.name === ownerName) ?? null;
}
