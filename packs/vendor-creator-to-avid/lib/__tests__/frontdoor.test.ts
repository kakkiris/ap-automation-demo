import { describe, it, expect } from "vitest";
import { daysBetween, flagInvoice, receiveInvoices, frontDoorPayload } from "../frontdoor";
import { runSync, decide } from "../sync";
import { FLAG_LABELS } from "../types";
import { fixtureStore } from "./fixture";

function invoice(store: ReturnType<typeof fixtureStore>, id: string) {
  const inv = store.incoming_invoices.find((i) => i.invoice_id === id);
  if (!inv) throw new Error(`fixture has no invoice ${id}`);
  return inv;
}

describe("daysBetween", () => {
  it("counts whole days on the demo calendar", () => {
    expect(daysBetween("2026-08-25", "2026-09-01")).toBe(7);
    expect(daysBetween("2026-09-01", "2026-09-01")).toBe(0);
    expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("flagInvoice", () => {
  it("flags INV-5004 as yardi_only with 0 days", () => {
    const store = fixtureStore();
    const out = flagInvoice(store, invoice(store, "INV-5004"));
    expect(out.flag).toBe("yardi_only");
    expect(out.matched_yardi_vendor_id).toBe("V-Y-0121");
    expect(out.matched_avid_vendor_id).toBeNull();
    expect(out.days_in_queue).toBe(0);
  });

  it("flags INV-5007 as first_seen with 0 days", () => {
    const store = fixtureStore();
    const out = flagInvoice(store, invoice(store, "INV-5007"));
    expect(out.flag).toBe("first_seen");
    expect(out.matched_yardi_vendor_id).toBeNull();
    expect(out.matched_avid_vendor_id).toBeNull();
    expect(out.days_in_queue).toBe(0);
  });

  it("flags INV-5009 as near_match with 7 days and V-A-0088", () => {
    const store = fixtureStore();
    const out = flagInvoice(store, invoice(store, "INV-5009"));
    expect(out.flag).toBe("near_match");
    expect(out.matched_yardi_vendor_id).toBe("V-Y-0117");
    expect(out.matched_avid_vendor_id).toBe("V-A-0088");
    expect(out.days_in_queue).toBe(7);
  });

  it("flags a known payee with both ids", () => {
    const store = fixtureStore();
    const out = flagInvoice(store, invoice(store, "INV-5001"));
    expect(out.flag).toBe("known");
    expect(out.matched_yardi_vendor_id).toBe("V-Y-0044");
    expect(out.matched_avid_vendor_id).toBe("V-A-0031");
    expect(out.days_in_queue).toBe(1);
  });

  it("flags an inactive Yardi vendor as yardi_only", () => {
    const store = fixtureStore();
    const out = flagInvoice(store, { ...invoice(store, "INV-5001"), payee_name: "Old Harbor Fencing" });
    expect(out.flag).toBe("yardi_only");
    expect(out.matched_yardi_vendor_id).toBe("V-Y-0130");
  });

  it("points a first_seen payee at an Avid record when only Avid has it", () => {
    const store = fixtureStore();
    store.avid_vendors.push({ avid_vendor_id: "V-A-0099", name: "Keys Gate Fencing", address_line: "4 Keys Gate Blvd", created_at: "2025-02-02", source: "seed", tax_id_last4: null });
    const out = flagInvoice(store, invoice(store, "INV-5007"));
    expect(out.flag).toBe("first_seen");
    expect(out.matched_avid_vendor_id).toBe("V-A-0099");
  });

  it("keeps near_match after a link decision, because Avid still has no record for the payee", () => {
    const store = fixtureStore();
    decide(store, "V-Y-0117", "V-A-0088", "link");
    const out = flagInvoice(store, invoice(store, "INV-5009"));
    expect(out.flag).toBe("near_match");
    expect(out.matched_yardi_vendor_id).toBe("V-Y-0117");
    expect(out.matched_avid_vendor_id).toBe("V-A-0088");
    expect(out.days_in_queue).toBe(7);
  });

  it("turns known once a synced Avid record exists", () => {
    const store = fixtureStore({ mode: "automatic" });
    runSync(store);
    const coral = flagInvoice(store, invoice(store, "INV-5004"));
    expect(coral.flag).toBe("known");
    expect(coral.matched_avid_vendor_id).toBe("V-A-0113");
    // The linked PW pair made no Avid record, so its invoice stays a near match.
    decide(store, "V-Y-0117", "V-A-0088", "link");
    expect(flagInvoice(store, invoice(store, "INV-5009")).flag).toBe("near_match");
  });
});

describe("receiveInvoices and frontDoorPayload", () => {
  it("is empty until the invoices are received", () => {
    const store = fixtureStore();
    expect(frontDoorPayload(store)).toEqual({ demo_date: "2026-09-01", received: false, invoices: [] });
  });

  it("flags every invoice in place and returns rows with names and labels", () => {
    const store = fixtureStore();
    const rows = receiveInvoices(store);
    expect(store.invoices_received).toBe(true);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.flag)).toEqual(["known", "yardi_only", "first_seen", "near_match"]);
    expect(rows.map((r) => r.flag_label)).toEqual([FLAG_LABELS.known, FLAG_LABELS.yardi_only, FLAG_LABELS.first_seen, FLAG_LABELS.near_match]);
    expect(rows[3].matched_yardi_name).toBe("PW Maintenance LLC");
    expect(rows[3].matched_avid_name).toBe("P.W. Maintenance");
    expect(rows[2].matched_yardi_name).toBeNull();
    expect(rows[2].matched_avid_name).toBeNull();
    expect(store.incoming_invoices[3].flag).toBe("near_match");
    const payload = frontDoorPayload(store);
    expect(payload.received).toBe(true);
    expect(payload.invoices).toEqual(rows);
  });
});
