import { describe, it, expect, vi } from "vitest";
import { extractInvoice } from "../model";
import { INVOICES, FIXTURE_CANNED_DIR, FIXTURE_PUBLIC_DIR, offlineOptions } from "./fixture";
import type { ExtractionFields } from "../types";

const scripted = INVOICES.find((i) => i.invoice_id === "INV-3007")!;
const unscripted = INVOICES.find((i) => i.invoice_id === "INV-3008")!;
const WITH_KEY = { ANTHROPIC_API_KEY: "test-key-never-used", DEMO_MODEL: "test-reader" };

const liveFields: ExtractionFields = {
  vendor_name: "Coral Ridge Roofing",
  property_hint: "BW",
  unit_hint: "BW-02",
  service_short: "gutter reseal and flashing",
  service_from: "2026-08-27",
  service_to: "2026-08-27",
  invoice_number: "CR-88230",
  invoice_date: "2026-08-29",
  amount: 760.5,
  due_date: "2026-09-28",
  account_number: null,
  meter_number: null,
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function messagesReply(text: string, status = 200) {
  return reply({ content: [{ type: "text", text }] }, status);
}

describe("extractInvoice", () => {
  it("serves canned without a key and never calls fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const r = await extractInvoice(unscripted, offlineOptions({ env: {}, fetchImpl }));
    expect(r.source).toBe("canned");
    expect(r.fields.service_short).toBe("gutter reseal");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("serves canned for a scripted invoice even with a key, without calling fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const r = await extractInvoice(scripted, offlineOptions({ env: WITH_KEY, fetchImpl }));
    expect(r.source).toBe("canned");
    expect(r.fields.vendor_name).toBe("Coral Ridge Roofing");
    expect(r.fields.amount).toBe(2400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to canned when the key is present and fetch rejects", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("network down"));
    const r = await extractInvoice(unscripted, offlineOptions({ env: WITH_KEY, fetchImpl }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(r.source).toBe("canned");
    expect(r.fields.service_short).toBe("gutter reseal");
  });

  it("falls back to canned when the reply is not valid JSON", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(messagesReply("I could not read this document."));
    const r = await extractInvoice(unscripted, offlineOptions({ env: WITH_KEY, fetchImpl }));
    expect(r.source).toBe("canned");
    expect(r.fields.service_short).toBe("gutter reseal");
  });

  it("falls back to canned on a non-2xx status", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(reply({ error: { message: "overloaded" } }, 529));
    const r = await extractInvoice(unscripted, offlineOptions({ env: WITH_KEY, fetchImpl }));
    expect(r.source).toBe("canned");
  });

  it("falls back to canned when the JSON does not have every field", async () => {
    const { meter_number: _dropped, ...partial } = liveFields;
    void _dropped;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(messagesReply(JSON.stringify(partial)));
    const r = await extractInvoice(unscripted, offlineOptions({ env: WITH_KEY, fetchImpl }));
    expect(r.source).toBe("canned");
  });

  it("falls back to canned when a field has the wrong type", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(messagesReply(JSON.stringify({ ...liveFields, amount: "760.50" })));
    const r = await extractInvoice(unscripted, offlineOptions({ env: WITH_KEY, fetchImpl }));
    expect(r.source).toBe("canned");
  });

  it("returns the live fields when the reply validates, sending the document and the headers", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(messagesReply(`Here it is:\n${JSON.stringify(liveFields)}\nDone.`));
    const r = await extractInvoice(unscripted, offlineOptions({ env: WITH_KEY, fetchImpl }));
    expect(r.source).toBe("live");
    expect(r.fields).toEqual(liveFields);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key-never-used");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("test-reader");
    expect(body.messages).toHaveLength(1);
    const doc = body.messages[0].content.find((c: { type: string }) => c.type === "document");
    expect(doc.source.type).toBe("base64");
    expect(doc.source.media_type).toBe("application/pdf");
    expect(Buffer.from(doc.source.data, "base64").toString("utf8")).toContain("%PDF-1.4 fixture");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the default reader name when DEMO_MODEL is unset", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(messagesReply(JSON.stringify(liveFields)));
    await extractInvoice(unscripted, offlineOptions({ env: { ANTHROPIC_API_KEY: "k" }, fetchImpl }));
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(body.model).toBe("claude-sonnet-5");
  });

  it("returns unavailable with every field null when there is no canned file and no key", async () => {
    const orphan = { ...unscripted, invoice_id: "INV-3099", pdf_path: "/demo/invoice-description-writer/INV-3099.pdf" };
    const r = await extractInvoice(orphan, offlineOptions({ env: {} }));
    expect(r.source).toBe("unavailable");
    expect(Object.values(r.fields).every((v) => v === null)).toBe(true);
    expect(Object.keys(r.fields)).toHaveLength(12);
  });

  it("returns unavailable when live fails and there is no canned file", async () => {
    const orphan = { ...unscripted, invoice_id: "INV-3099", pdf_path: "/demo/invoice-description-writer/INV-3099.pdf" };
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("no route"));
    const r = await extractInvoice(orphan, { env: WITH_KEY, fetchImpl, cannedDir: FIXTURE_CANNED_DIR, publicDir: FIXTURE_PUBLIC_DIR });
    expect(r.source).toBe("unavailable");
  });

  it("times out a slow reply and serves canned", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const r = await extractInvoice(unscripted, { ...offlineOptions({ env: WITH_KEY, fetchImpl }), timeoutMs: 5 });
    expect(r.source).toBe("canned");
  });
});
