import { describe, it, expect } from "vitest";
import { runSync, latestRun, decide, createYardiVendor, setTaskDone, importCsv, deltaRows, statePayload, mastersPayload, runPayload, nearMatchesPayload } from "../sync";
import { SCOPE_LINE } from "../types";
import { fixtureStore } from "./fixture";

const HEADER = "# placeholder columns until the Avid import format is confirmed: name, address_line\nname,address_line\n";

function sumCounts(c: { skipped_exact: number; staged_or_created: number; held: number; skipped_inactive: number }) {
  return c.skipped_exact + c.staged_or_created + c.held + c.skipped_inactive;
}

describe("runSync", () => {
  it("mints R-001 on the demo clock and its counts add up", () => {
    const store = fixtureStore();
    const run = runSync(store);
    expect(run.run_id).toBe("R-001");
    expect(run.run_at).toBe("2026-09-01T23:30:00");
    expect(run.mode).toBe("assisted");
    expect(run.counts).toEqual({ compared: 5, skipped_exact: 1, staged_or_created: 1, held: 2, skipped_inactive: 1 });
    expect(sumCounts(run.counts)).toBe(run.counts.compared);
    expect(latestRun(store)).toEqual(run);
    expect(store.sync_runs).toHaveLength(1);
    expect(runSync(store).run_id).toBe("R-002");
  });

  it("in assisted mode yields import rows and tasks equal to the staged count", () => {
    const store = fixtureStore();
    const run = runSync(store);
    expect(store.import_rows).toEqual([{ run_id: "R-001", name: "Coral Ridge Pressure Washing", address_line: "9 Seagrass Ct" }]);
    expect(store.tasks).toEqual([{ task_id: "T-001", run_id: "R-001", text: "Create Coral Ridge Pressure Washing in Avid", done: false }]);
    expect(store.import_rows).toHaveLength(run.counts.staged_or_created);
    expect(store.avid_vendors).toHaveLength(3);
    const item = store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0121");
    expect(item?.action).toBe("stage");
    expect(item?.avid_vendor_id).toBeNull();
  });

  it("in automatic mode pushes synced Avid vendors with ids from V-A-0113", () => {
    const store = fixtureStore({ mode: "automatic" });
    const run = runSync(store);
    expect(run.mode).toBe("automatic");
    expect(run.counts.staged_or_created).toBe(1);
    expect(store.avid_vendors).toHaveLength(4);
    const synced = store.avid_vendors[3];
    expect(synced).toEqual({ avid_vendor_id: "V-A-0113", name: "Coral Ridge Pressure Washing", address_line: "9 Seagrass Ct", created_at: "2026-09-01", source: "synced", tax_id_last4: "2210" });
    expect(store.next_avid_number).toBe(114);
    const item = store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0121");
    expect(item?.action).toBe("create");
    expect(item?.avid_vendor_id).toBe("V-A-0113");
    // The next run finds the synced copy and skips it.
    const again = runSync(store);
    expect(again.counts).toEqual({ compared: 5, skipped_exact: 2, staged_or_created: 0, held: 2, skipped_inactive: 1 });
    expect(store.avid_vendors).toHaveLength(4);
  });

  it("keeps a stored decision when it upserts candidates", () => {
    const store = fixtureStore();
    store.match_candidates[0].decision = "later";
    runSync(store);
    expect(store.match_candidates).toHaveLength(2);
    expect(store.match_candidates[0].decision).toBe("later");
    expect(store.match_candidates[1].decision).toBe("none");
  });

  it("creates candidates that the seed did not carry", () => {
    const store = fixtureStore({ match_candidates: [] });
    runSync(store);
    expect(store.match_candidates.map((c) => [c.yardi_vendor_id, c.avid_vendor_id])).toEqual([["V-Y-0117", "V-A-0088"], ["V-Y-0119", "V-A-0092"]]);
  });

  it("replaces the delta with the latest run only", () => {
    const store = fixtureStore();
    runSync(store);
    runSync(store);
    expect(store.delta_items.every((d) => d.run_id === "R-002")).toBe(true);
    expect(store.delta_items).toHaveLength(5);
  });
});

describe("decide", () => {
  it("link never adds an import row and turns the delta item into skip_exact", () => {
    const store = fixtureStore();
    runSync(store);
    decide(store, "V-Y-0117", "V-A-0088", "link");
    expect(store.match_candidates[0].decision).toBe("link");
    const item = store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0117");
    expect(item?.action).toBe("skip_exact");
    expect(item?.avid_vendor_id).toBe("V-A-0088");
    expect(item?.reason).toBe("linked by hand to V-A-0088, same vendor");
    expect(store.import_rows).toHaveLength(1);
    expect(store.tasks).toHaveLength(1);
    expect(latestRun(store)?.counts).toEqual({ compared: 5, skipped_exact: 2, staged_or_created: 1, held: 1, skipped_inactive: 1 });
    expect(store.avid_vendors).toHaveLength(3);
  });

  it("a create decision adds one import row in assisted mode", () => {
    const store = fixtureStore();
    runSync(store);
    decide(store, "V-Y-0119", "V-A-0092", "create");
    const item = store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0119");
    expect(item?.action).toBe("stage");
    expect(item?.reason).toBe("different vendor, confirmed by hand");
    expect(store.import_rows).toHaveLength(2);
    // Rows follow the delta order, so the Tidewater row sits before Coral Ridge.
    expect(store.import_rows).toEqual([
      { run_id: "R-001", name: "Tidewater Plumbing Co", address_line: "18 Heron Cove Rd" },
      { run_id: "R-001", name: "Coral Ridge Pressure Washing", address_line: "9 Seagrass Ct" },
    ]);
    expect(store.tasks.map((t) => t.task_id)).toEqual(["T-002", "T-001"]);
    expect(store.tasks[0].text).toBe("Create Tidewater Plumbing Co in Avid");
    expect(latestRun(store)?.counts).toEqual({ compared: 5, skipped_exact: 1, staged_or_created: 2, held: 1, skipped_inactive: 1 });
    expect(store.avid_vendors).toHaveLength(3);
  });

  it("keeps a done task when the delta is rebuilt", () => {
    const store = fixtureStore();
    runSync(store);
    setTaskDone(store, "T-001", true);
    decide(store, "V-Y-0119", "V-A-0092", "create");
    const kept = store.tasks.find((t) => t.text === "Create Coral Ridge Pressure Washing in Avid");
    expect(kept).toEqual({ task_id: "T-001", run_id: "R-001", text: "Create Coral Ridge Pressure Washing in Avid", done: true });
    expect(store.tasks.find((t) => t.text === "Create Tidewater Plumbing Co in Avid")?.done).toBe(false);
  });

  it("a create decision in automatic mode mints the Avid vendor after a run", () => {
    const store = fixtureStore({ mode: "automatic" });
    runSync(store);
    decide(store, "V-Y-0119", "V-A-0092", "create");
    expect(store.avid_vendors).toHaveLength(5);
    expect(store.avid_vendors[4].avid_vendor_id).toBe("V-A-0114");
    expect(store.avid_vendors[4].name).toBe("Tidewater Plumbing Co");
    expect(store.avid_vendors[4].source).toBe("synced");
    const item = store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0119");
    expect(item?.action).toBe("create");
    expect(item?.avid_vendor_id).toBe("V-A-0114");
    // Deciding create again does not mint a second copy.
    decide(store, "V-Y-0119", "V-A-0092", "create");
    expect(store.avid_vendors).toHaveLength(5);
  });

  it("a create decision in automatic mode mints the Avid vendor even before a run", () => {
    const store = fixtureStore({ mode: "automatic" });
    decide(store, "V-Y-0119", "V-A-0092", "create");
    expect(store.avid_vendors).toHaveLength(4);
    expect(store.avid_vendors[3].avid_vendor_id).toBe("V-A-0113");
    expect(store.sync_runs).toHaveLength(0);
    expect(store.delta_items).toHaveLength(0);
  });

  it("later keeps the pair held", () => {
    const store = fixtureStore();
    runSync(store);
    decide(store, "V-Y-0117", "V-A-0088", "later");
    expect(store.match_candidates[0].decision).toBe("later");
    expect(store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0117")?.action).toBe("hold");
  });

  it("throws on an unknown pair", () => {
    const store = fixtureStore();
    expect(() => decide(store, "V-Y-0044", "V-A-0092", "link")).toThrow();
    expect(() => decide(store, "V-Y-9999", "V-A-0088", "link")).toThrow();
  });
});

describe("importCsv", () => {
  it("returns only the header lines before the first run", () => {
    const store = fixtureStore();
    expect(importCsv(store)).toEqual({ file_name: "vendor-import-none.csv", text: HEADER, row_count: 0 });
  });

  it("writes one quoted row per import row with a trailing newline", () => {
    const store = fixtureStore();
    runSync(store);
    const file = importCsv(store);
    expect(file.file_name).toBe("vendor-import-R-001.csv");
    expect(file.row_count).toBe(1);
    expect(file.text).toBe(`${HEADER}"Coral Ridge Pressure Washing","9 Seagrass Ct"\n`);
    expect(importCsv(store, "R-001")).toEqual(file);
  });

  it("doubles inner quotes", () => {
    const store = fixtureStore();
    createYardiVendor(store, { name: 'Bay "Quick" Cleaning', address_line: "5 Osprey Way", status: "active" });
    runSync(store);
    expect(importCsv(store).text).toContain('"Bay ""Quick"" Cleaning","5 Osprey Way"\n');
  });

  it("never carries the inactive vendor in either mode", () => {
    for (const mode of ["assisted", "automatic"] as const) {
      const store = fixtureStore({ mode });
      runSync(store);
      expect(importCsv(store).text).not.toContain("Old Harbor Fencing");
      expect(store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0130")?.action).toBe("skip_inactive");
    }
  });

  it("throws on an unknown run", () => {
    const store = fixtureStore();
    runSync(store);
    expect(() => importCsv(store, "R-009")).toThrow();
  });
});

describe("createYardiVendor", () => {
  it("mints V-Y-0125 and the next run includes it", () => {
    const store = fixtureStore();
    const created = createYardiVendor(store, { name: "  Marlin Bay Cleaning ", address_line: " 12 Marlin Bay Dr ", status: "active" });
    expect(created.yardi_vendor_id).toBe("V-Y-0125");
    expect(created.name).toBe("Marlin Bay Cleaning");
    expect(created.address_line).toBe("12 Marlin Bay Dr");
    expect(created.status).toBe("active");
    expect(created.created_at).toBe("2026-09-01");
    expect(created.tax_id_last4).toMatch(/^\d{4}$/);
    expect(store.next_yardi_number).toBe(126);
    expect(store.yardi_vendors).toHaveLength(6);
    expect(store.sync_runs).toHaveLength(0);
    const run = runSync(store);
    expect(run.counts).toEqual({ compared: 6, skipped_exact: 1, staged_or_created: 2, held: 2, skipped_inactive: 1 });
    expect(store.delta_items.find((d) => d.yardi_vendor_id === "V-Y-0125")?.action).toBe("stage");
    expect(store.import_rows.map((r) => r.name)).toContain("Marlin Bay Cleaning");
  });

  it("defaults the status to active and honours inactive", () => {
    const store = fixtureStore();
    expect(createYardiVendor(store, { name: "A", address_line: "B" } as never).status).toBe("active");
    expect(createYardiVendor(store, { name: "C", address_line: "D", status: "inactive" }).status).toBe("inactive");
  });

  it("throws when the name or the address line is missing", () => {
    const store = fixtureStore();
    expect(() => createYardiVendor(store, { name: "  ", address_line: "1 Somewhere", status: "active" })).toThrow();
    expect(() => createYardiVendor(store, { name: "Some Vendor", address_line: "", status: "active" })).toThrow();
    expect(store.yardi_vendors).toHaveLength(5);
  });
});

describe("setTaskDone", () => {
  it("flips the flag and throws on an unknown task", () => {
    const store = fixtureStore();
    runSync(store);
    setTaskDone(store, "T-001", true);
    expect(store.tasks[0].done).toBe(true);
    setTaskDone(store, "T-001", false);
    expect(store.tasks[0].done).toBe(false);
    expect(() => setTaskDone(store, "T-999", true)).toThrow();
  });
});

describe("payloads", () => {
  it("statePayload reads the live gap and held counts", () => {
    const store = fixtureStore();
    expect(statePayload(store)).toEqual({ mode: "assisted", demo_date: "2026-09-01", yardi_count: 5, yardi_active_count: 4, avid_count: 3, gap: 1, held: 2, last_run_id: null });
    runSync(store);
    expect(statePayload(store).last_run_id).toBe("R-001");
    const masters = mastersPayload(store);
    expect(masters.yardi).toHaveLength(5);
    expect(masters.avid).toHaveLength(3);
  });

  it("runPayload joins the delta and carries the scope line", () => {
    const store = fixtureStore();
    const before = runPayload(store);
    expect(before.run).toBeNull();
    expect(before.delta).toEqual([]);
    expect(before.import_file_name).toBeNull();
    expect(before.import_row_count).toBe(0);
    expect(before.scope_line).toBe(SCOPE_LINE);
    runSync(store);
    const after = runPayload(store);
    expect(after.run?.run_id).toBe("R-001");
    expect(after.import_file_name).toBe("vendor-import-R-001.csv");
    expect(after.import_row_count).toBe(1);
    expect(after.tasks).toHaveLength(1);
    const rows = deltaRows(store);
    expect(rows).toHaveLength(5);
    const pw = rows.find((r) => r.yardi_vendor_id === "V-Y-0117");
    expect(pw?.name).toBe("PW Maintenance LLC");
    expect(pw?.address_line).toBe("41 Marlin Bay Dr");
    expect(pw?.status).toBe("active");
    expect(pw?.avid_name).toBe("P.W. Maintenance");
    const coral = rows.find((r) => r.yardi_vendor_id === "V-Y-0121");
    expect(coral?.avid_name).toBeNull();
  });

  it("nearMatchesPayload splits held and decided pairs", () => {
    const store = fixtureStore();
    const boot = nearMatchesPayload(store);
    expect(boot.mode).toBe("assisted");
    expect(boot.held.map((p) => p.candidate.yardi_vendor_id)).toEqual(["V-Y-0117", "V-Y-0119"]);
    expect(boot.decided).toEqual([]);
    expect(boot.held[0].yardi.name).toBe("PW Maintenance LLC");
    expect(boot.held[0].avid.name).toBe("P.W. Maintenance");
    expect(boot.held[0].yardi_normalized).toBe("pw maintenance");
    expect(boot.held[0].avid_normalized).toBe("pw maintenance");
    decide(store, "V-Y-0117", "V-A-0088", "link");
    decide(store, "V-Y-0119", "V-A-0092", "later");
    const later = nearMatchesPayload(store);
    expect(later.held.map((p) => p.candidate.yardi_vendor_id)).toEqual(["V-Y-0119"]);
    expect(later.decided.map((p) => p.candidate.decision)).toEqual(["link"]);
  });
});
