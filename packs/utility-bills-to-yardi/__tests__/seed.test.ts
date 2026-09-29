import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Seed, BillFields } from "../types";
import { mid, inRange } from "../lib/dates";

const seed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "seed.json"), "utf8")) as Seed;
const canned = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "canned-extractions.json"), "utf8")) as Record<string, BillFields>;
const meterById = new Map(seed.meters.map((m) => [m.id, m]));
const unitById = new Map(seed.units.map((u) => [u.id, u]));
const M = "2026-08";

describe("seed shape (session 2)", () => {
  it("has the portfolio at full shape with codes and bank GLs", () => {
    expect(seed.properties).toHaveLength(25);
    expect(seed.units).toHaveLength(1000);
    expect(seed.providers).toHaveLength(20);
    for (const p of seed.properties) {
      expect(p.code).toMatch(/^0999\d{3}$/);
      expect(p.bank_gl).toMatch(/^9\d{5}$/);
    }
    expect(seed.properties.filter((p) => p.recently_acquired)).toHaveLength(3);
    expect(seed.months[0]).toBe("2026-01");
    expect(seed.months[seed.months.length - 1]).toBe("2026-09");
  });
  it("keeps every session 1 scripted id and binds the new ones", () => {
    expect(seed.scripted).toMatchObject({ A: "P01", B: "P02", "A-1": "M9100012", "A-2": "M9100007", "A-3": "M9100051", "A-4": "PAY-101526", "B-2": "M9100099", "B-3": "M9100086", "B-4": "BILL-101268", "B-4-meter": "M9100085" });
    for (const k of ["A-5", "A-6", "A-7", "A-8", "B-5", "B-6", "B-7"]) expect(seed.scripted[k]).toBeTruthy();
  });
  it("has 250 vacant units, 286 owner-paid electric rows, 78 known landlord unit accounts", () => {
    const vacant = seed.units.filter((u) => u.occupancy[M] === "vacant");
    expect(vacant).toHaveLength(250);
    const ownerRows = seed.units.filter((u) => u.occupancy[M] === "vacant" || u.who_pays === "owner");
    expect(ownerRows).toHaveLength(286);
    const ownerRowAccount = (a: (typeof seed.accounts)[number]) => {
      const m = meterById.get(a.meter_id)!;
      const u = m.unit_id ? unitById.get(m.unit_id)! : null;
      return a.holder === "landlord" && inRange(mid(M), a.active_from, a.active_to) && m.kind === "unit" && m.service_type === "electric" && !!u && (u.occupancy[M] === "vacant" || u.who_pays === "owner");
    };
    const knownUnit = seed.accounts.filter(ownerRowAccount);
    expect(knownUnit).toHaveLength(78);
    const billBacks = seed.accounts.filter((a) => a.holder === "landlord" && inRange(mid(M), a.active_from, a.active_to) && meterById.get(a.meter_id)!.kind === "unit" && !ownerRowAccount(a));
    expect(billBacks).toHaveLength(3);
    const carried = seed.units.filter((u) => u.occupancy[M] === "occupied" && u.who_pays === "owner" && u.payer_source === "seller_workbook");
    expect(carried.length).toBeGreaterThanOrEqual(33);
  });
  it("has 46 house electric meters, two 14-account water sites, and about 195 blank meter numbers", () => {
    expect(seed.meters.filter((m) => m.service_type === "electric" && m.kind === "house")).toHaveLength(46);
    const water = (pid: string) => seed.meters.filter((m) => m.property_id === pid && m.service_type === "water").length;
    expect(water("P02")).toBe(14);
    expect(water("P10")).toBe(14);
    const blank = seed.meters.filter((m) => m.kind !== "shared" && !m.meter_number).length;
    expect(blank).toBeGreaterThanOrEqual(190);
    expect(blank).toBeLessThanOrEqual(200);
    expect(seed.meters.some((m) => m.provider === "Crestline Energy")).toBe(true);
  });
  it("keeps the markers", () => {
    for (const a of seed.accounts) expect(a.account_number).toMatch(/^99\d{8}$/);
    for (const m of seed.meters) {
      expect(m.id).toMatch(/^M9\d{6}$/);
      if (m.meter_number) expect(m.meter_number).toMatch(/^M9\d{8}$/);
    }
    for (const p of seed.providers) expect(p.vendor_code).toMatch(/^v99\d{4}$/);
    for (const l of seed.ledger_lines) expect(l.gl_code).toMatch(/^9\d{5}$/);
  });
  it("has the ledger at shape with every invoice style", () => {
    expect(seed.ledger_lines.length).toBeGreaterThanOrEqual(1500);
    expect(seed.ledger_lines.length).toBeLessThanOrEqual(2000);
    const scheme = seed.ledger_lines.filter((l) => /^99\d{8}-\d{8}$/.test(l.invoice_number));
    const legacyA = seed.ledger_lines.filter((l) => /^\d{5}-\d{6}$/.test(l.invoice_number));
    const legacyB = seed.ledger_lines.filter((l) => /^\d{4}-\d{6}$/.test(l.invoice_number));
    const legacyC = seed.ledger_lines.filter((l) => /^[A-Z]{3}\d{2}-\d{6}$/.test(l.invoice_number) && /99\d{8}/.test(l.description));
    const bare = seed.ledger_lines.filter((l) => l.invoice_number === "");
    expect(scheme.length).toBeGreaterThan(300);
    expect(legacyA.length).toBeGreaterThan(50);
    expect(legacyB.length).toBeGreaterThan(50);
    expect(legacyC.length).toBeGreaterThan(50);
    expect(bare).toHaveLength(10);
    expect(seed.ledger_lines.filter((l) => l.gl_name === "Utility deposits").length).toBeGreaterThanOrEqual(40);
    expect(seed.ledger_lines.find((l) => l.id === "PAY-101526")?.description).toBe("Electric");
    const rivermouth = seed.ledger_lines.filter((l) => l.payee_name === "City of Rivermouth").length;
    const electric = seed.ledger_lines.filter((l) => l.gl_name.startsWith("Electricity")).length;
    expect(rivermouth).toBeGreaterThan(250);
    expect(electric).toBeGreaterThan(350);
  });
  it("has August and September batches with the scripted bills", () => {
    const aug = seed.bills.filter((b) => b.arrival_month === M);
    const sep = seed.bills.filter((b) => b.arrival_month === "2026-09");
    expect(aug.length).toBeGreaterThan(200);
    expect(sep.length).toBeGreaterThan(aug.length);
    for (const b of seed.bills) {
      expect(b.status).toBe("unarrived");
      expect(canned[b.id]).toBeDefined();
    }
    const b4 = seed.bills.find((b) => b.id === "BILL-101268")!;
    expect(b4.property_id).toBe("P02");
    expect(b4.meter_as_printed).toBeNull();
    const b6 = seed.bills.find((b) => b.id === seed.scripted["B-6"])!;
    const b6first = seed.bills.find((b) => b.id === seed.scripted["B-6-first"])!;
    expect(b6.account_number).toBe(b6first.account_number);
    expect(b6.service_start).toBe(b6first.service_start);
    const a5 = seed.bills.find((b) => b.id === seed.scripted["A-5"])!;
    const a5acct = seed.accounts.find((a) => a.account_number === a5.account_number)!;
    expect(meterById.get(a5acct.meter_id)!.meter_number).not.toBe(a5.meter_as_printed);
    const b5 = seed.bills.find((b) => b.id === seed.scripted["B-5"])!;
    expect(b5.provider).toBe("Seagrass County Utilities");
    expect(b5.property_id).toBe("P02");
  });
  it("binds A-6, A-7, A-8 to Site A records", () => {
    const a6 = meterById.get(seed.scripted["A-6"])!;
    expect(a6.unit_id).toBe("P01-U13");
    expect(a6.meter_number).toBeNull();
    expect(unitById.get("P01-U13")!.occupancy[M]).toBe("vacant");
    expect(seed.accounts.some((a) => a.meter_id === a6.id && a.holder === "landlord")).toBe(false);
    const a7 = seed.ledger_lines.find((l) => l.id === seed.scripted["A-7"])!;
    expect(a7.invoice_number).toMatch(/^4321-/);
    const sharing = seed.accounts.filter((a) => a.account_number.endsWith("4321") && meterById.get(a.meter_id)!.property_id === "P01");
    expect(sharing.length).toBeGreaterThanOrEqual(2);
    const a8 = meterById.get(seed.scripted["A-8"])!;
    const u = unitById.get(a8.unit_id!)!;
    expect(u.occupancy[M]).toBe("occupied");
    expect(u.who_pays).toBe("owner");
    expect(u.payer_source).toBe("seller_workbook");
    expect(seed.accounts.some((a) => a.meter_id === a8.id && a.holder === "landlord")).toBe(false);
    expect(seed.site_visit_results.find((r) => r.meter_id === a8.id)?.who_pays_found).toBe("tenant");
  });
  it("ships the provider list, site visit results, and discrepancies", () => {
    expect(seed.provider_account_list.length).toBeGreaterThan(200);
    expect(seed.provider_account_list.filter((r) => r.service_address.endsWith("(suite)"))).toHaveLength(3);
    expect(seed.site_visit_results.length).toBeGreaterThan(150);
    expect(seed.discrepancies.length).toBeGreaterThanOrEqual(200);
    expect(Object.keys(seed.discrepancies_cleared)).toHaveLength(25);
  });
});
