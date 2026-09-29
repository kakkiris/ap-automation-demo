import { describe, it, expect } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { createStore, loadSeed } from "../store";
import { buildUpload, buildZip, fileText, billBacksCsv, markExported, rowsForBill, YARDI_COLUMNS, AP_GL } from "../lib/export";

function matchedStore() {
  const store = createStore(loadSeed());
  const byAccount = new Map(store.accounts.map((a) => [a.account_number, a]));
  for (const b of store.bills) {
    if (b.arrival_month !== "2026-08") continue;
    const a = byAccount.get(b.account_number);
    if (a) {
      b.meter_id = a.meter_id;
      b.status = "matched";
    }
  }
  return store;
}

describe("Yardi upload", () => {
  const store = matchedStore();
  it("writes thirteen headerless columns with the property's bank GL on every row", () => {
    const { files } = buildUpload(store, "2026-08");
    const siteA = files.filter((f) => f.property_id === "P01");
    expect(siteA.length).toBeGreaterThanOrEqual(2);
    const bankGl = store.properties.find((p) => p.id === "P01")!.bank_gl;
    for (const f of siteA) {
      expect(f.name).toMatch(/^0999001-v99\d{4}-2026-08\.csv$/);
      const text = fileText(f.rows);
      const lines = text.trim().split("\n");
      expect(lines).toHaveLength(f.rows.length);
      for (const line of lines) {
        const cols = line.split(",");
        expect(cols).toHaveLength(YARDI_COLUMNS.length);
        expect(cols[0]).toBe("I");
        expect(cols[12]).toBe(bankGl);
        expect(cols[11]).toBe(AP_GL);
        expect(cols[8]).toBe("0999001");
        expect(cols[4]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        // The rule the team uses by hand: last five of the account number, then the due date.
        expect(cols[6]).toMatch(/^\d{5}-\d{8}$/);
        // The account number leads the description, which is what ties a payment to its meter.
        expect(cols[7]).toMatch(/^99\d{8} /);
      }
    }
  });
  it("splits a municipal water bill into three rows under one invoice number", () => {
    const water = store.bills.find((b) => b.arrival_month === "2026-08" && b.status === "matched" && store.meters.find((m) => m.id === b.meter_id)!.service_type === "water")!;
    const rows = rowsForBill(store, water, 1);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.invoice_number)).size).toBe(1);
    expect(rows.map((r) => r.gl_name)).toEqual(["Water recoverable", "Sewer recoverable", "Stormwater"]);
    expect(Math.round(rows.reduce((n, r) => n + r.amount, 0) * 100) / 100).toBe(water.amount);
    expect(rows.map((r) => r.line_number)).toEqual([1, 2, 3]);
  });
  it("zips one file per property per provider plus the bill-backs file", () => {
    const { files } = buildUpload(store, "2026-08");
    const zip = buildZip(files, billBacksCsv(store, "2026-08"), "2026-08");
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toHaveLength(files.length + 1);
    expect(strFromU8(entries["bill-backs-2026-08.csv"])).toMatch(/^tenant,unit,property_code/);
    const names = new Set(files.map((f) => f.name));
    expect(names.size).toBe(files.length);
  });
  it("marks bills exported with the house invoice number and a description carrying the account and meter", () => {
    const result = markExported(store, "2026-08");
    expect(result.rows).toBeGreaterThan(200);
    const exported = store.bills.filter((b) => b.arrival_month === "2026-08" && b.status === "exported");
    expect(exported.length).toBeGreaterThanOrEqual(150);
    for (const b of exported) {
      expect(b.invoice_number).toMatch(/^\d{5}-\d{4}2026$/);
      expect(b.description).toMatch(/^99\d{8} \d\d\/\d\d to \d\d\/\d\d M9\d+$/);
    }
  });
});
