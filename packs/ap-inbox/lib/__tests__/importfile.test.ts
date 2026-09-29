import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS } from "../types";
import { importFileName, importRows, rowsTotal, writeImportFile } from "../importfile";
import { makeDraft, makeItem, makeStore } from "./fixture";

function approvedStore() {
  const store = makeStore();
  store.items = [makeItem("I-0015", { state: "Approved" }), makeItem("I-0016", { state: "Approved", source: "trackerApproved" }), makeItem("I-0009", { state: "Skipped" })];
  store.drafts["I-0015"] = makeDraft("I-0015");
  store.drafts["I-0009"] = makeDraft("I-0009", { invoiceNumber: "4471" });
  store.drafts["I-0016"] = makeDraft("I-0016", {
    payee: "Greenway Lawn Care",
    invoiceNumber: "3312",
    vendorMatch: { vendorId: "V-002", score: 1 },
    amount: 15000,
    entity: null,
    cashAccount: null,
    property: "3 properties",
    propertyResolution: null,
    notes: "Monthly lawn service, three lots",
    mode: "splitter",
    lines: [
      { lineNumber: 1, address: "15 Cobbler St", parcelId: "P-10620", owner: "Sangamon Deed Company LLC", entityCode: "E-109", cashAccount: "1000-2209", amount: 6000, glAccount: "9200-3300", splitMethod: "stated", systemPropertyExists: true, chargeType: null, description: "Lot mowing" },
      { lineNumber: 2, address: "17 Cobbler St", parcelId: "P-10621", owner: "Sangamon Deed Company LLC", entityCode: "E-109", cashAccount: "1000-2209", amount: 5000, glAccount: "9200-3300", splitMethod: "stated", systemPropertyExists: true, chargeType: null, description: "Lot mowing" },
      { lineNumber: 3, address: "19 Cobbler St", parcelId: "P-10622", owner: "Sangamon Deed Company LLC", entityCode: "E-109", cashAccount: "1000-2209", amount: 4000, glAccount: "9200-3300", splitMethod: "stated", systemPropertyExists: true, chargeType: null, description: "Lot mowing" },
    ],
    sumCheck: { linesTotal: 15000, invoiceTotal: 15000, ok: true },
  });
  return store;
}

describe("importRows", () => {
  it("writes one row per invoice line for approved items only", () => {
    const rows = importRows(approvedStore());
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.reference)).toEqual(["I-0015", "I-0016", "I-0016", "I-0016"]);
    expect(rows.map((r) => r.line)).toEqual(["1", "1", "2", "3"]);
  });

  it("fills the fifteen columns", () => {
    const [row] = importRows(approvedStore());
    expect(Object.keys(row)).toHaveLength(IMPORT_COLUMNS.length);
    expect(row.entity).toBe("E-109");
    expect(row.vendorCode).toBe("V-010");
    expect(row.payee).toBe("Prairie Fence Co");
    expect(row.invoiceNumber).toBe("2291");
    expect(row.invoiceDate).toBe("2026-08-28");
    expect(row.postMonth).toBe("2026-09");
    expect(row.dueDate).toBe("2026-09-27");
    expect(row.expenseType).toBe("expense");
    expect(row.cashAccount).toBe("1000-2209");
    expect(row.glAccount).toBe("9200-3100");
    expect(row.amount).toBe("725.00");
    expect(row.description).toBe("88 Mill Pond Dr, Decatur, IL 62521, Fence repair");
    expect(row.notes).toBe("Fence repair");
  });

  it("puts the property and the charge in the description of each line", () => {
    const rows = importRows(approvedStore());
    expect(rows[1].description).toBe("15 Cobbler St, Decatur, IL 62526, Lot mowing");
    expect(rows[1].amount).toBe("60.00");
    expect(rows[3].amount).toBe("40.00");
    expect(rows[1].entity).toBe("E-109");
  });

  it("gives just the charge for an office item", () => {
    const store = makeStore();
    store.items = [makeItem("I-0024", { state: "Approved" })];
    store.drafts["I-0024"] = makeDraft("I-0024", { property: null, propertyResolution: null, entity: "E-001", cashAccount: "1000-1001", notes: "Office supplies", glAccount: "9100-1100" });
    expect(importRows(store)[0].description).toBe("Office supplies");
  });

  it("sums the rows in cents", () => {
    expect(rowsTotal(importRows(approvedStore()))).toBe(72500 + 15000);
  });
});

describe("writeImportFile", () => {
  it("writes a header row and one tab-separated line per row", () => {
    const text = writeImportFile(importRows(approvedStore()));
    const lines = text.split("\n");
    expect(lines[lines.length - 1]).toBe("");
    const body = lines.slice(0, -1);
    expect(body).toHaveLength(5);
    expect(body[0]).toBe(IMPORT_COLUMNS.join("\t"));
    for (const line of body) expect(line.split("\t")).toHaveLength(15);
  });

  it("names the file after the demo date", () => {
    expect(importFileName(makeStore())).toBe("import-2026-09-03.txt");
  });
});
