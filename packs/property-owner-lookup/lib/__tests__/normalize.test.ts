import { describe, expect, it } from "vitest";
import { normalizeAddress } from "../normalize";

describe("normalizeAddress", () => {
  it("reads a full address with a unit, city, state and zip", () => {
    const n = normalizeAddress("45 Hillcrest Drive #2, Peoria, IL 61604");
    expect(n.houseNumber).toBe("45");
    expect(n.street).toBe("hillcrest dr");
    expect(n.unit).toBe("2");
    expect(n.city).toBe("peoria");
    expect(n.state).toBe("IL");
    expect(n.zip).toBe("61604");
    expect(n.key).toBe("45 hillcrest dr|2|peoria|IL");
  });

  it("gives the same key for the short and long suffix forms", () => {
    const a = normalizeAddress("45 Hillcrest Dr Unit 2, Peoria IL");
    const b = normalizeAddress("45 Hillcrest Drive Apt 2, Peoria, IL");
    expect(a.key).toBe(b.key);
    expect(a.key).toBe("45 hillcrest dr|2|peoria|IL");
  });

  it("abbreviates every suffix it knows", () => {
    expect(normalizeAddress("1 Elm Street").street).toBe("elm st");
    expect(normalizeAddress("1 Elm Avenue").street).toBe("elm ave");
    expect(normalizeAddress("1 Elm Court").street).toBe("elm ct");
    expect(normalizeAddress("1 Elm Lane").street).toBe("elm ln");
    expect(normalizeAddress("1 Elm Road").street).toBe("elm rd");
    expect(normalizeAddress("1 Elm Place").street).toBe("elm pl");
    expect(normalizeAddress("1 Elm Way").street).toBe("elm way");
    expect(normalizeAddress("1 Elm Boulevard").street).toBe("elm blvd");
    expect(normalizeAddress("1 Elm Blvd.").street).toBe("elm blvd");
  });

  it("reads a city with no state and no zip", () => {
    const n = normalizeAddress("14 Elm St, Springfield");
    expect(n.city).toBe("springfield");
    expect(n.state).toBeNull();
    expect(n.key).toBe("14 elm st||springfield|");
  });

  it("reads a city and state with no comma", () => {
    const n = normalizeAddress("702 Palmer Ln Marion IN");
    expect(n.houseNumber).toBe("702");
    expect(n.street).toBe("palmer ln");
    expect(n.city).toBe("marion");
    expect(n.state).toBe("IN");
  });

  it("reads two-word cities", () => {
    expect(normalizeAddress("9 Wren Rd, Terre Haute IN").city).toBe("terre haute");
    expect(normalizeAddress("9 Wren Rd Fort Wayne IN").city).toBe("fort wayne");
    expect(normalizeAddress("9 Wren Rd, South Bend").city).toBe("south bend");
  });

  it("does not mistake a court suffix for a state", () => {
    const n = normalizeAddress("601 Birch Ct");
    expect(n.street).toBe("birch ct");
    expect(n.state).toBeNull();
    expect(n.city).toBeNull();
  });

  it("keeps multi-word street names", () => {
    expect(normalizeAddress("88 Mill Pond Dr, Decatur IL").street).toBe("mill pond dr");
    expect(normalizeAddress("3 Hollow Oak Drive").street).toBe("hollow oak dr");
  });

  it("reads Ste and Suite as a unit", () => {
    expect(normalizeAddress("10 Lark St Ste 4").unit).toBe("4");
    expect(normalizeAddress("10 Lark St Suite 4, Marion IN").unit).toBe("4");
  });

  it("handles empty and junk text without throwing", () => {
    const n = normalizeAddress("");
    expect(n.houseNumber).toBeNull();
    expect(n.street).toBe("");
    expect(normalizeAddress("account 5520-118").houseNumber).toBeNull();
  });
});
