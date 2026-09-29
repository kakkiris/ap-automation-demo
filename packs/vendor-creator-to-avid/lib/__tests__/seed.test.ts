import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { createStore, loadSeed } from "../../store";
import { computeGap, computeHeld } from "../match";
import { runSync, importCsv, nearMatchesPayload } from "../sync";
import { receiveInvoices } from "../frontdoor";

const seedPath = path.join(process.cwd(), "packs", "vendor-creator-to-avid", "seed", "seed.json");
const hasSeed = fs.existsSync(seedPath);

describe.skipIf(!hasSeed)("generated seed", () => {
  it("carries the boot-time shape", () => {
    const store = createStore(loadSeed());
    expect(store.demo_date).toBe("2026-09-01");
    expect(store.next_yardi_number).toBe(125);
    expect(store.next_avid_number).toBe(113);
    expect(store.yardi_vendors).toHaveLength(119);
    expect(store.yardi_vendors.filter((v) => v.status === "active")).toHaveLength(117);
    expect(store.avid_vendors).toHaveLength(112);
    expect(store.avid_vendors.every((v) => v.source === "seed")).toBe(true);
    expect(store.incoming_invoices).toHaveLength(15);
    expect(store.mode).toBe("assisted");
  });

  it("reads gap 5 and held 2 at boot", () => {
    const store = createStore(loadSeed());
    expect(computeGap(store)).toBe(5);
    expect(computeHeld(store)).toBe(2);
    const near = nearMatchesPayload(store);
    expect(near.held.map((p) => [p.candidate.yardi_vendor_id, p.candidate.avid_vendor_id])).toEqual([["V-Y-0117", "V-A-0088"], ["V-Y-0119", "V-A-0092"]]);
    expect(near.held[0].candidate.reasons).toEqual(["same normalized name", "same address", "suffix difference", "same tax id last four"]);
    expect(near.held[1].candidate.reasons).toEqual(["similar name", "different address", "different tax id last four"]);
  });

  it("gives the scripted counts on a boot-time assisted run", () => {
    const store = createStore(loadSeed());
    const run = runSync(store);
    expect(run.counts).toEqual({ compared: 119, skipped_exact: 110, staged_or_created: 5, held: 2, skipped_inactive: 2 });
    expect(importCsv(store).row_count).toBe(5);
    expect(store.tasks).toHaveLength(5);
    expect(store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0121")?.action).toBe("stage");
    expect(store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0130")?.action).toBe("skip_inactive");
    expect(store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0044")?.avid_vendor_id).toBe("V-A-0031");
    expect(store.match_candidates).toHaveLength(2);
  });

  it("flags the day's invoices as scripted", () => {
    const store = createStore(loadSeed());
    const rows = receiveInvoices(store);
    const count = (flag: string) => rows.filter((r) => r.flag === flag).length;
    expect(count("known")).toBe(11);
    expect(count("yardi_only")).toBe(2);
    expect(count("first_seen")).toBe(1);
    expect(count("near_match")).toBe(1);
    const byId = (id: string) => rows.find((r) => r.invoice_id === id);
    expect(byId("INV-5004")).toMatchObject({ flag: "yardi_only", matched_yardi_vendor_id: "V-Y-0121", matched_avid_vendor_id: null, days_in_queue: 0 });
    expect(byId("INV-5007")).toMatchObject({ flag: "first_seen", matched_yardi_vendor_id: null, days_in_queue: 0 });
    expect(byId("INV-5009")).toMatchObject({ flag: "near_match", matched_yardi_vendor_id: "V-Y-0117", matched_avid_vendor_id: "V-A-0088", days_in_queue: 7 });
    for (const row of rows) expect(row.flag).toBe(loadSeed().incoming_invoices.find((i) => i.invoice_id === row.invoice_id)?.flag);
  });
});
