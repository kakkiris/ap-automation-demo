import { describe, it, expect } from "vitest";
import annotations from "@/data/annotations.json";
import { modules } from "./registry";

type Entry = { screen: string; audience: string; purpose: string; panel: { today: string; here: string; protects: string } | null };
const entries = annotations as Entry[];

describe("narration", () => {
  it("gives every screen in the registry a client purpose line and a three-part narration", () => {
    const missing: string[] = [];
    for (const m of modules) {
      for (const s of m.screens) {
        const key = `${m.slug}/${s.slug}`;
        const e = entries.find((x) => x.screen === key && x.audience === "client");
        if (!e || !e.purpose.trim() || !e.panel || !e.panel.today.trim() || !e.panel.here.trim() || !e.panel.protects.trim()) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });
  it("uses the client's words on every narration: no system words, no em dashes", () => {
    const banned = /\b(model|deterministic|pipeline|API)\b/;
    const offenders: string[] = [];
    for (const e of entries) {
      const text = [e.purpose, e.panel?.today, e.panel?.here, e.panel?.protects].filter(Boolean).join(" ");
      if (text.includes("\u2014")) offenders.push(`${e.screen}: em dash`);
      if (banned.test(text) && !text.includes("capture pipeline")) offenders.push(`${e.screen}: system word`);
    }
    expect(offenders).toEqual([]);
  });
});
