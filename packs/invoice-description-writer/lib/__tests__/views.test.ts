import { describe, it, expect, beforeEach } from "vitest";
import { workbenchView, vendorsView, vendorHistoryView, schemeView } from "../views";
import { SERVICE_TEMPLATE, UTILITY_TEMPLATE } from "../describe";
import { recordFeedback } from "../feedback";
import { receiveInvoices } from "../receive";
import { PackError } from "../errors";
import { createStore } from "../../store";
import { fixtureSeed, offlineOptions } from "./fixture";
import type { Store } from "../types";

let store: Store;

beforeEach(async () => {
  store = createStore(fixtureSeed());
  await receiveInvoices(store, offlineOptions());
});

describe("workbenchView", () => {
  it("INV-3007 carries the fields in order with plain labels and display values", () => {
    const w = workbenchView(store, "INV-3007");
    expect(w.invoice).toEqual({ invoice_id: "INV-3007", invoice_type: "service", status: "ready", pdf_path: "/demo/invoice-description-writer/INV-3007.pdf", preview_path: "/demo/invoice-description-writer/INV-3007.svg" });
    expect(w.vendor).toEqual({ vendor_id: "V-01", name: "Coral Ridge Roofing" });
    expect(w.vendor_name_as_read).toBe("Coral Ridge Roofing");
    expect(w.fields.map((f) => [f.key, f.label])).toEqual([
      ["vendor_name", "Vendor"],
      ["invoice_number", "Invoice number"],
      ["invoice_date", "Invoice date"],
      ["due_date", "Due date"],
      ["amount", "Amount"],
      ["property_hint", "Property"],
      ["unit_hint", "Unit"],
      ["service_short", "Service"],
      ["service_from", "Service from"],
      ["service_to", "Service to"],
      ["account_number", "Account number"],
      ["meter_number", "Meter number"],
    ]);
    const amount = w.fields.find((f) => f.key === "amount")!;
    expect(amount).toEqual({ key: "amount", label: "Amount", value: "$2,400.00", read: true });
    const meter = w.fields.find((f) => f.key === "meter_number")!;
    expect(meter).toEqual({ key: "meter_number", label: "Meter number", value: null, read: false });
    expect(w.description?.text).toBe("Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26");
    expect(w.template).toBe(SERVICE_TEMPLATE);
    expect(w.suggestion?.gl_code).toBe("6320");
    expect(w.manual_entry).toEqual([]);
    expect(w.routed_note).toBeNull();
    expect(w.feedback).toBeNull();
    expect(w.gl_accounts).toHaveLength(12);
    expect([w.prev_id, w.next_id, w.position, w.total]).toEqual([null, "INV-3008", 1, 8]);
  });

  it("walks the inbox order", () => {
    const w = workbenchView(store, "INV-3012");
    expect([w.prev_id, w.next_id, w.position]).toEqual(["INV-3008", "INV-3019", 3]);
    const last = workbenchView(store, "INV-3033");
    expect([last.prev_id, last.next_id, last.position]).toEqual(["INV-3030", null, 8]);
  });

  it("INV-3021 is manual with the missing labels and no description or suggestion", () => {
    const w = workbenchView(store, "INV-3021");
    expect(w.invoice.status).toBe("manual");
    expect(w.description).toBeNull();
    expect(w.template).toBeNull();
    expect(w.suggestion).toBeNull();
    expect(w.manual_entry).toEqual(["Vendor", "Service", "Amount", "Account number", "Meter number"]);
    expect(w.extraction?.status).toBe("failed");
    expect(w.extraction?.reasons).toEqual(["vendor name not found on the invoice", "amount not found on the invoice"]);
    expect(w.vendor).toBeNull();
    expect(w.vendor_name_as_read).toBeNull();
    expect(w.fields.find((f) => f.key === "vendor_name")?.read).toBe(false);
  });

  it("INV-3025 is routed with the note and nothing else", () => {
    const w = workbenchView(store, "INV-3025");
    expect(w.invoice.status).toBe("routed");
    expect(w.invoice.invoice_type).toBe("utility");
    expect(w.vendor).toEqual({ vendor_id: "V-09", name: "Sunline Power" });
    expect(w.vendor_name_as_read).toBeNull();
    expect(w.extraction).toBeNull();
    expect(w.fields).toEqual([]);
    expect(w.description).toBeNull();
    expect(w.suggestion).toBeNull();
    expect(w.manual_entry).toEqual([]);
    expect(w.routed_note).toBe("utility, handled by the capture pipeline");
  });

  it("INV-3019 from the vendor with no history links the vendor and shows no code", () => {
    const w = workbenchView(store, "INV-3019");
    expect(w.vendor).toEqual({ vendor_id: "V-14", name: "Keys Gate Fencing" });
    expect(w.vendor_name_as_read).toBe("Keys Gate Fencing");
    expect(w.description).not.toBeNull();
    expect(w.suggestion?.tier).toBe("none");
    expect(w.suggestion?.gl_code).toBeNull();
  });

  it("a vendor name that matches no seed vendor has no vendor link", () => {
    const fresh = createStore(fixtureSeed());
    fresh.vendors = fresh.vendors.filter((v) => v.vendor_id !== "V-14");
    fresh.received = true;
    fresh.invoices = fresh.invoices.filter((i) => i.invoice_id === "INV-3019");
    fresh.extractions["INV-3019"] = { ...store.extractions["INV-3019"], resolved_vendor_id: null };
    fresh.descriptions["INV-3019"] = store.descriptions["INV-3019"];
    fresh.suggestions["INV-3019"] = store.suggestions["INV-3019"];
    const w = workbenchView(fresh, "INV-3019");
    expect(w.vendor).toBeNull();
    expect(w.vendor_name_as_read).toBe("Keys Gate Fencing");
  });

  it("shows the latest feedback for the invoice", () => {
    recordFeedback(store, { invoice_id: "INV-3007", outcome: "used" });
    recordFeedback(store, { invoice_id: "INV-3007", outcome: "corrected", corrected_gl: "6310" });
    const w = workbenchView(store, "INV-3007");
    expect(w.invoice.status).toBe("corrected");
    expect(w.feedback).toEqual({ invoice_id: "INV-3007", outcome: "corrected", corrected_gl: "6310", at: 2 });
  });

  it("fails 404 for an unknown invoice and 409 before receive", () => {
    try {
      workbenchView(store, "INV-3099");
      expect.unreachable();
    } catch (err) {
      expect((err as PackError).status).toBe(404);
    }
    const fresh = createStore(fixtureSeed());
    try {
      workbenchView(fresh, "INV-3007");
      expect.unreachable();
    } catch (err) {
      expect((err as PackError).status).toBe(409);
      expect((err as PackError).message).toBe("Press Receive invoices first.");
    }
  });
});

describe("vendorsView", () => {
  it("lists every vendor by id with its history row count", () => {
    const { vendors } = vendorsView(store);
    expect(vendors.map((v) => v.vendor_id)).toEqual(["V-01", "V-03", "V-05", "V-09", "V-12", "V-14"]);
    expect(vendors[0]).toEqual({ vendor_id: "V-01", name: "Coral Ridge Roofing", service_type: "multi", default_gl: null, history_rows: 2 });
    expect(vendors[5].history_rows).toBe(0);
  });
});

describe("vendorHistoryView", () => {
  it("V-01 rows most used first with the total and no session lines", () => {
    const h = vendorHistoryView(store, "V-01");
    expect(h.vendor.vendor_id).toBe("V-01");
    expect(h.rows).toEqual([
      { gl_code: "6320", gl_name: "Roofing repairs", count: 14, last_used: "2026-08-21" },
      { gl_code: "6310", gl_name: "Repairs and maintenance", count: 2, last_used: "2026-05-03" },
    ]);
    expect(h.total).toBe(16);
    expect(h.session).toEqual([]);
  });

  it("V-03 shows the correction as a session line", () => {
    recordFeedback(store, { invoice_id: "INV-3030", outcome: "corrected", corrected_gl: "6520" });
    const h = vendorHistoryView(store, "V-03");
    expect(h.total).toBe(15);
    expect(h.session.map((s) => s.text)).toEqual(["Recorded this session: INV-3030 corrected to 6520 Plumbing capital."]);
  });

  it("V-14 has no rows and works before receive", () => {
    const fresh = createStore(fixtureSeed());
    const h = vendorHistoryView(fresh, "V-14");
    expect(h.rows).toEqual([]);
    expect(h.total).toBe(0);
  });

  it("fails 404 for an unknown vendor", () => {
    expect(() => vendorHistoryView(store, "V-13")).toThrow(PackError);
  });
});

describe("schemeView", () => {
  it("renders both templates with examples from the seed records, before receive", () => {
    const fresh = createStore(fixtureSeed());
    const s = schemeView(fresh);
    expect(s.max_length).toBe(250);
    expect(s.templates.map((t) => t.template_id)).toEqual(["service", "utility"]);
    const service = s.templates[0];
    expect(service.label).toBe("Service vendor");
    expect(service.template).toBe(SERVICE_TEMPLATE);
    expect(service.example).toEqual({ invoice_id: "INV-3007", text: "Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26" });
    expect(service.segments.length).toBe(6);
    const utility = s.templates[1];
    expect(utility.label).toBe("Utility");
    expect(utility.template).toBe(UTILITY_TEMPLATE);
    expect(utility.example).toEqual({ invoice_id: "INV-3025", text: "9912345678 electric service 2026-07-20 to 2026-08-19 meter M912345678" });
    expect(utility.segments.length).toBe(4);
  });
});
