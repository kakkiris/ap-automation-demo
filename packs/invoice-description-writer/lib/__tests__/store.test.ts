import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createStore, getStore, resetStore, loadSeed } from "../../store";
import { fixtureSeed } from "./fixture";

const SEED_PATH = path.join(process.cwd(), "packs", "invoice-description-writer", "seed", "seed.json");

describe("createStore", () => {
  it("clones the seed and starts with nothing received", () => {
    const seed = fixtureSeed();
    const store = createStore(seed);
    expect(store.received).toBe(false);
    expect(store.extractions).toEqual({});
    expect(store.descriptions).toEqual({});
    expect(store.suggestions).toEqual({});
    expect(store.feedback).toEqual([]);
    expect(store.invoices).toEqual(seed.invoices);
    store.invoices[0].status = "used";
    expect(seed.invoices[0].status).toBe("ready");
  });
});

describe.skipIf(!fs.existsSync(SEED_PATH))("getStore and resetStore on the real seed", () => {
  it("keeps one store on globalThis and drops session state on reset", () => {
    const a = getStore();
    expect(getStore()).toBe(a);
    a.received = true;
    a.feedback.push({ invoice_id: "INV-3007", outcome: "used", corrected_gl: null, at: 1 });
    const b = resetStore();
    expect(b).not.toBe(a);
    expect(getStore()).toBe(b);
    expect(b.received).toBe(false);
    expect(b.feedback).toEqual([]);
    expect(b.invoices).toHaveLength(30);
    expect(loadSeed().invoices).toHaveLength(30);
  });
});
