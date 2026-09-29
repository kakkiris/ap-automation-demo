import { describe, it, expect, beforeEach } from "vitest";
import { recordFeedback, sessionLines } from "../feedback";
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

describe("recordFeedback", () => {
  it("used as is sets the status to used and records the first feedback", () => {
    const payload = recordFeedback(store, { invoice_id: "INV-3007", outcome: "used" });
    expect(payload.invoice.status).toBe("used");
    expect(payload.feedback).toEqual({ invoice_id: "INV-3007", outcome: "used", corrected_gl: null, at: 1 });
    expect(store.feedback).toEqual([{ invoice_id: "INV-3007", outcome: "used", corrected_gl: null, at: 1 }]);
    expect(store.invoices.find((i) => i.invoice_id === "INV-3007")!.status).toBe("used");
    expect(payload.description?.text).toBe("Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26");
  });

  it("corrected records the code and sets the status to corrected", () => {
    recordFeedback(store, { invoice_id: "INV-3007", outcome: "used" });
    const payload = recordFeedback(store, { invoice_id: "INV-3030", outcome: "corrected", corrected_gl: "6520" });
    expect(payload.invoice.status).toBe("corrected");
    expect(payload.feedback).toEqual({ invoice_id: "INV-3030", outcome: "corrected", corrected_gl: "6520", at: 2 });
    expect(store.feedback).toHaveLength(2);
  });

  it("a second feedback on the same invoice replaces the status and appends a record", () => {
    recordFeedback(store, { invoice_id: "INV-3007", outcome: "used" });
    const payload = recordFeedback(store, { invoice_id: "INV-3007", outcome: "corrected", corrected_gl: "6310" });
    expect(payload.invoice.status).toBe("corrected");
    expect(payload.feedback?.at).toBe(2);
    expect(store.feedback.map((f) => f.at)).toEqual([1, 2]);
  });

  it("corrected needs a code from the chart", () => {
    expect(() => recordFeedback(store, { invoice_id: "INV-3030", outcome: "corrected" })).toThrow(PackError);
    try {
      recordFeedback(store, { invoice_id: "INV-3030", outcome: "corrected", corrected_gl: "8888" });
      expect.unreachable();
    } catch (err) {
      expect((err as PackError).status).toBe(400);
    }
    expect(store.feedback).toEqual([]);
  });

  it("rejects an unknown outcome", () => {
    expect(() => recordFeedback(store, { invoice_id: "INV-3007", outcome: "maybe" as "used" })).toThrow(PackError);
  });

  it("manual and routed invoices take no feedback", () => {
    for (const id of ["INV-3021", "INV-3025"]) {
      try {
        recordFeedback(store, { invoice_id: id, outcome: "used" });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(PackError);
        expect((err as PackError).status).toBe(400);
        expect((err as PackError).message).not.toMatch(/\b(model|deterministic|pipeline|API)\b/i);
      }
    }
  });

  it("an unknown invoice is 404 and an unreceived store is 409", async () => {
    try {
      recordFeedback(store, { invoice_id: "INV-3099", outcome: "used" });
      expect.unreachable();
    } catch (err) {
      expect((err as PackError).status).toBe(404);
    }
    const fresh = createStore(fixtureSeed());
    try {
      recordFeedback(fresh, { invoice_id: "INV-3007", outcome: "used" });
      expect.unreachable();
    } catch (err) {
      expect((err as PackError).status).toBe(409);
      expect((err as PackError).message).toBe("Press Receive invoices first.");
    }
  });
});

describe("sessionLines", () => {
  it("is empty before any feedback", () => {
    expect(sessionLines(store, "V-01")).toEqual([]);
  });

  it("writes the used line with the suggested code", () => {
    recordFeedback(store, { invoice_id: "INV-3007", outcome: "used" });
    expect(sessionLines(store, "V-01")).toEqual([
      { invoice_id: "INV-3007", outcome: "used", gl_code: "6320", gl_name: "Roofing repairs", text: "Recorded this session: INV-3007 used 6320 Roofing repairs as is." },
    ]);
    expect(sessionLines(store, "V-03")).toEqual([]);
  });

  it("writes the corrected line with the corrected code", () => {
    recordFeedback(store, { invoice_id: "INV-3030", outcome: "corrected", corrected_gl: "6520" });
    expect(sessionLines(store, "V-03")).toEqual([
      { invoice_id: "INV-3030", outcome: "corrected", gl_code: "6520", gl_name: "Plumbing capital", text: "Recorded this session: INV-3030 corrected to 6520 Plumbing capital." },
    ]);
  });

  it("keeps the lines in the order they were recorded, one per record", () => {
    recordFeedback(store, { invoice_id: "INV-3008", outcome: "used" });
    recordFeedback(store, { invoice_id: "INV-3007", outcome: "corrected", corrected_gl: "6310" });
    recordFeedback(store, { invoice_id: "INV-3007", outcome: "used" });
    expect(sessionLines(store, "V-01").map((l) => l.text)).toEqual([
      "Recorded this session: INV-3008 used 6320 Roofing repairs as is.",
      "Recorded this session: INV-3007 corrected to 6310 Repairs and maintenance.",
      "Recorded this session: INV-3007 used 6320 Roofing repairs as is.",
    ]);
  });

  it("used as is with no suggested code writes no session line", () => {
    recordFeedback(store, { invoice_id: "INV-3019", outcome: "used" });
    expect(store.feedback).toHaveLength(1);
    for (const v of ["V-01", "V-03", "V-14"]) expect(sessionLines(store, v)).toEqual([]);
  });

  it("a correction on the vendor with no history still shows as a session line", () => {
    recordFeedback(store, { invoice_id: "INV-3019", outcome: "corrected", corrected_gl: "6310" });
    expect(sessionLines(store, "V-14").map((l) => l.text)).toEqual(["Recorded this session: INV-3019 corrected to 6310 Repairs and maintenance."]);
  });
});
