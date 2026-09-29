import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { receiveInvoices } from "../receive";
import { inboxView } from "../views";
import { ROUTED_NOTE } from "../labels";
import { createStore, loadSeed } from "../../store";
import { fixtureSeed, offlineOptions } from "./fixture";

const SEED_PATH = path.join(process.cwd(), "packs", "invoice-description-writer", "seed", "seed.json");
const CANNED_DIR = path.join(process.cwd(), "packs", "invoice-description-writer", "seed", "canned");
const seedReady = fs.existsSync(SEED_PATH) && fs.existsSync(path.join(CANNED_DIR, "INV-3007.json"));

describe("receiveInvoices on the fixture", () => {
  it("before receive the inbox is empty with zero counts", () => {
    const store = createStore(fixtureSeed());
    expect(inboxView(store)).toEqual({ received: false, summary: { received: 0, ready: 0, manual: 0, routed: 0 }, items: [] });
  });

  it("ingests every invoice: ready, manual, or routed", async () => {
    const store = createStore(fixtureSeed());
    const payload = await receiveInvoices(store, offlineOptions());
    expect(store.received).toBe(true);
    expect(payload.received).toBe(true);
    expect(payload.summary).toEqual({ received: 8, ready: 6, manual: 1, routed: 1 });
    const byId = Object.fromEntries(payload.items.map((i) => [i.invoice_id, i]));
    expect(byId["INV-3007"].status).toBe("ready");
    expect(byId["INV-3021"].status).toBe("manual");
    expect(byId["INV-3025"].status).toBe("routed");
    expect(payload.items.map((i) => i.invoice_id)).toEqual(store.invoices.map((i) => i.invoice_id));
  });

  it("INV-3007 gets the exact description and the strong 6320 suggestion", async () => {
    const store = createStore(fixtureSeed());
    await receiveInvoices(store, offlineOptions());
    expect(store.descriptions["INV-3007"]).toEqual({
      invoice_id: "INV-3007",
      text: "Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26",
      template_id: "service",
      missing_fields: [],
      truncated: false,
    });
    expect(store.suggestions["INV-3007"]).toEqual({
      invoice_id: "INV-3007",
      gl_code: "6320",
      gl_name: "Roofing repairs",
      basis_count: 14,
      basis_total: 16,
      tier: "strong",
      alternatives: [{ gl_code: "6310", gl_name: "Repairs and maintenance", count: 2, last_used: "2026-05-03" }],
    });
    expect(store.extractions["INV-3007"].source).toBe("canned");
    expect(store.extractions["INV-3007"].status).toBe("read");
    expect(store.extractions["INV-3007"].resolved_vendor_id).toBe("V-01");
  });

  it("INV-3012 says dates not on invoice and suggests 7410 strong", async () => {
    const store = createStore(fixtureSeed());
    await receiveInvoices(store, offlineOptions());
    expect(store.descriptions["INV-3012"].text).toContain("dates not on invoice");
    expect(store.descriptions["INV-3012"].text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(store.suggestions["INV-3012"].gl_code).toBe("7410");
    expect(store.suggestions["INV-3012"].tier).toBe("strong");
  });

  it("INV-3019 from the vendor with no history is described with no suggestion", async () => {
    const store = createStore(fixtureSeed());
    await receiveInvoices(store, offlineOptions());
    expect(store.descriptions["INV-3019"].text).toBe("Keys Gate Fencing fence panel replacement PR PR-03 2026-08-20 to 2026-08-21");
    expect(store.suggestions["INV-3019"].tier).toBe("none");
    expect(store.suggestions["INV-3019"].gl_code).toBeNull();
    expect(store.extractions["INV-3019"].resolved_vendor_id).toBe("V-14");
  });

  it("a vendor name that matches no seed vendor still reads, with no vendor and no suggestion", async () => {
    const store = createStore(fixtureSeed());
    store.vendors = store.vendors.filter((v) => v.vendor_id !== "V-14");
    await receiveInvoices(store, offlineOptions());
    expect(store.extractions["INV-3019"].status).toBe("read");
    expect(store.extractions["INV-3019"].resolved_vendor_id).toBeNull();
    expect(store.descriptions["INV-3019"].text.startsWith("Keys Gate Fencing ")).toBe(true);
    expect(store.suggestions["INV-3019"].tier).toBe("none");
  });

  it("INV-3021 fails the checks and goes to manual with no description", async () => {
    const store = createStore(fixtureSeed());
    await receiveInvoices(store, offlineOptions());
    const inv = store.invoices.find((i) => i.invoice_id === "INV-3021")!;
    expect(inv.status).toBe("manual");
    expect(inv.extraction_status).toBe("failed");
    expect(store.extractions["INV-3021"].status).toBe("failed");
    expect(store.extractions["INV-3021"].missing).toContain("vendor_name");
    expect(store.extractions["INV-3021"].missing).toContain("amount");
    expect(store.descriptions["INV-3021"]).toBeUndefined();
    expect(store.suggestions["INV-3021"]).toBeUndefined();
  });

  it("INV-3025 is routed with the note and nothing read", async () => {
    const store = createStore(fixtureSeed());
    const payload = await receiveInvoices(store, offlineOptions());
    const row = payload.items.find((i) => i.invoice_id === "INV-3025")!;
    expect(row.status).toBe("routed");
    expect(row.note).toBe("utility, handled by the capture pipeline");
    expect(row.note).toBe(ROUTED_NOTE);
    expect(row.vendor_id).toBe("V-09");
    expect(row.vendor_name).toBe("Sunline Power");
    expect(row.property_code).toBe("PR");
    expect(row.invoice_number).toBe("SP-77120");
    expect(row.amount).toBe(312.4);
    expect(store.extractions["INV-3025"]).toBeUndefined();
    expect(store.descriptions["INV-3025"]).toBeUndefined();
    const other = payload.items.find((i) => i.invoice_id === "INV-3007")!;
    expect(other.note).toBeNull();
  });

  it("INV-3033 starts with the account number", async () => {
    const store = createStore(fixtureSeed());
    await receiveInvoices(store, offlineOptions());
    expect(store.descriptions["INV-3033"].text.startsWith("9955512340 ")).toBe(true);
  });

  it("inbox rows carry the values as read, null when not read", async () => {
    const store = createStore(fixtureSeed());
    const payload = await receiveInvoices(store, offlineOptions());
    const row = payload.items.find((i) => i.invoice_id === "INV-3007")!;
    expect(row).toEqual({ invoice_id: "INV-3007", vendor_id: "V-01", vendor_name: "Coral Ridge Roofing", property_code: "PR", invoice_number: "CR-88213", amount: 2400, status: "ready", note: null });
    const manual = payload.items.find((i) => i.invoice_id === "INV-3021")!;
    expect(manual.vendor_name).toBeNull();
    expect(manual.amount).toBeNull();
    expect(manual.vendor_id).toBeNull();
    expect(manual.invoice_number).toBe("PP-2231");
  });

  it("is idempotent once received", async () => {
    const store = createStore(fixtureSeed());
    const first = await receiveInvoices(store, offlineOptions());
    store.feedback.push({ invoice_id: "INV-3007", outcome: "used", corrected_gl: null, at: 1 });
    store.invoices[0].status = "used";
    const second = await receiveInvoices(store, offlineOptions());
    expect(second.items[0].status).toBe("used");
    expect(second.summary).toEqual(first.summary);
    expect(store.feedback).toHaveLength(1);
  });

  it("counts used and corrected invoices as ready in the summary", async () => {
    const store = createStore(fixtureSeed());
    await receiveInvoices(store, offlineOptions());
    store.invoices[0].status = "used";
    store.invoices[1].status = "corrected";
    expect(inboxView(store).summary).toEqual({ received: 8, ready: 6, manual: 1, routed: 1 });
  });
});

describe.skipIf(!seedReady)("receiveInvoices on the real seed", () => {
  it("gives 30 received, 27 ready, 1 manual, 2 routed and matches the seed's expected fields", async () => {
    const expected = loadSeed();
    const store = createStore(loadSeed());
    const payload = await receiveInvoices(store, { env: {} });
    expect(payload.summary).toEqual({ received: 30, ready: 27, manual: 1, routed: 2 });
    for (const inv of expected.invoices) {
      const got = store.invoices.find((i) => i.invoice_id === inv.invoice_id)!;
      expect({ id: inv.invoice_id, status: got.status, extraction_status: got.extraction_status }).toEqual({ id: inv.invoice_id, status: inv.status, extraction_status: inv.extraction_status });
    }
    expect(store.invoices.map((i) => i.invoice_id)).toEqual(Array.from({ length: 30 }, (_, i) => `INV-${3004 + i}`));
    expect(store.invoices.filter((i) => i.status === "manual").map((i) => i.invoice_id)).toEqual(["INV-3021"]);
    expect(store.invoices.filter((i) => i.status === "routed").map((i) => i.invoice_id)).toContain("INV-3025");
    expect(store.invoices.filter((i) => i.status === "routed").every((i) => i.vendor_id === "V-09")).toBe(true);
  });

  it("INV-3007's description and suggestion are exactly as the pack states", async () => {
    const store = createStore(loadSeed());
    await receiveInvoices(store, { env: {} });
    expect(store.descriptions["INV-3007"].text).toBe("Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26");
    expect(store.descriptions["INV-3007"].missing_fields).toEqual([]);
    expect(store.descriptions["INV-3007"].template_id).toBe("service");
    const s = store.suggestions["INV-3007"];
    expect([s.gl_code, s.gl_name, s.basis_count, s.basis_total, s.tier]).toEqual(["6320", "Roofing repairs", 14, 16, "strong"]);
    expect(s.alternatives).toEqual([{ gl_code: "6310", gl_name: "Repairs and maintenance", count: 2, last_used: "2026-05-03" }]);
  });

  it("the other scripted records land where the acceptance checks expect", async () => {
    const store = createStore(loadSeed());
    await receiveInvoices(store, { env: {} });
    expect(store.descriptions["INV-3012"].text).toContain("dates not on invoice");
    expect(store.descriptions["INV-3012"].text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect([store.suggestions["INV-3012"].gl_code, store.suggestions["INV-3012"].tier]).toEqual(["7410", "strong"]);
    expect(store.descriptions["INV-3019"]).toBeDefined();
    expect(store.suggestions["INV-3019"].tier).toBe("none");
    expect(store.descriptions["INV-3021"]).toBeUndefined();
    expect(store.extractions["INV-3021"].status).toBe("failed");
    const s30 = store.suggestions["INV-3030"];
    expect([s30.gl_code, s30.basis_count, s30.basis_total, s30.tier]).toEqual(["6510", 9, 15, "weak"]);
    expect(s30.alternatives.map((a) => a.gl_code)).toContain("6520");
    const inv33 = store.invoices.find((i) => i.invoice_id === "INV-3033")!;
    expect(inv33.account_number).toMatch(/^99\d{8}$/);
    expect(store.descriptions["INV-3033"].text.startsWith(`${inv33.account_number} `)).toBe(true);
    const inv25 = store.invoices.find((i) => i.invoice_id === "INV-3025")!;
    expect(inv25.account_number).toMatch(/^99\d{8}$/);
    expect(inv25.meter_number).toMatch(/^M9\d{8}$/);
  });
});
