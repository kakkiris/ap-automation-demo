import { describe, it, expect } from "vitest";
import { departments, modules, findModule, locate, moduleHref, navScreens, screenHref, resetPaths, systemsFor } from "./registry";

describe("registry", () => {
  it("has the two departments in order with the client-facing labels", () => {
    expect(departments.map((d) => d.slug)).toEqual(["family-office-ap", "industrial-ap"]);
    expect(departments.map((d) => d.label)).toEqual(["Family Office AP", "Industrial AP"]);
  });
  it("lists the modules in the order of the naming table", () => {
    expect(departments[0].modules.map((m) => m.slug)).toEqual(["property-owner-lookup", "multi-property-split", "ap-inbox"]);
    expect(departments[1].modules.map((m) => m.slug)).toEqual([
      "utility-bills-to-yardi",
      "meter-register",
      "utility-payment-reconciliation",
      "invoice-description-writer",
      "vendor-creator-to-avid",
    ]);
  });
  it("routes every module under its department slug and its own slug", () => {
    for (const m of modules) {
      expect(m.base).toBe(`/${m.department}/${m.slug}`);
      for (const s of m.screens) expect(s.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
  it("shows no letter-number solution code in any name or label", () => {
    const words = modules.flatMap((m) => [m.name, ...m.screens.map((s) => s.label)]);
    for (const w of words) expect(w).not.toMatch(/\b(U[0-9]|CO[0-9]|V[0-9]|L[0-9])\b/);
  });
  it("opens the splitter entry inside AP Inbox", () => {
    const split = findModule("multi-property-split")!;
    expect(moduleHref(split)).toBe("/family-office-ap/ap-inbox/split-across-properties");
    expect(split.resetPath).toBe(findModule("ap-inbox")!.resetPath);
  });
  it("locates a screen from its pathname and builds hrefs", () => {
    const here = locate("/industrial-ap/utility-payment-reconciliation/one-property-month-by-month/0999001")!;
    expect(here.department.slug).toBe("industrial-ap");
    expect(here.module.slug).toBe("utility-payment-reconciliation");
    expect(here.screen?.label).toBe("One property, month by month");
    expect(navScreens(here.module).map((s) => s.slug)).not.toContain("one-property-month-by-month");
    expect(screenHref(here.module, "which-bills-are-paid")).toBe("/industrial-ap/utility-payment-reconciliation/which-bills-are-paid");
    expect(locate("/nowhere")).toBeNull();
  });
  it("names the connected systems on every module and every screen", () => {
    const roles = new Set(["reads", "receives", "replaces", "unchanged"]);
    for (const m of modules) {
      expect(m.systems.length, `${m.slug} names no system`).toBeGreaterThan(0);
      for (const s of [...m.systems, ...m.screens.flatMap((sc) => sc.systems ?? [])]) {
        expect(s.name.trim(), `${m.slug} has a system with no name`).not.toBe("");
        expect(roles.has(s.role), `${m.slug}: ${s.name} has role ${s.role}`).toBe(true);
        expect(s.note.trim(), `${m.slug}: ${s.name} has no note`).not.toBe("");
      }
      for (const screen of m.screens) {
        expect(systemsFor(m, screen).length, `${m.slug}/${screen.slug} shows no system`).toBeGreaterThan(0);
      }
    }
  });
  it("names Monday.com on the property tracker screen and Avid on the vendor sync", () => {
    const inbox = findModule("ap-inbox")!;
    const tracker = inbox.screens.find((s) => s.slug === "property-tracker-updates")!;
    expect(systemsFor(inbox, tracker).map((s) => s.name)).toContain("Monday.com");
    const vendor = findModule("vendor-creator-to-avid")!;
    expect(vendor.systems.map((s) => s.name)).toEqual(["Yardi", "Avid"]);
  });
  it("resets each store once", () => {
    const paths = resetPaths().map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter((p) => p.includes("utility-bills-to-yardi"))).toHaveLength(1);
  });
});
