import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import type {
  FrontDoorPayload,
  MastersPayload,
  NearMatchesPayload,
  RunPayload,
  StatePayload,
} from "@/packs/vendor-creator-to-avid/lib/types";

// One test per acceptance check in the pack, in the pack's order.
// Every test posts to the pack's reset route first and walks the real screens.
// Files are read through the request fixture, never through a browser download event.

const API = "/api/industrial-ap/vendor-creator-to-avid";
const BASE = "/industrial-ap/vendor-creator-to-avid";
const MASTERS = `${BASE}/create-the-vendor-once-in-yardi`;
const SYNC = `${BASE}/run-the-nightly-sync-to-avid`;
const NEAR = `${BASE}/decide-the-near-matches`;
const DOOR = `${BASE}/catch-unknown-payees-on-arrival`;

const MARLIN = { name: "Marlin Bay Cleaning", address: "12 Marlin Bay Dr" };
const PW = "pair-V-Y-0117-V-A-0088";
const TIDEWATER = "pair-V-Y-0119-V-A-0092";
const STAGED_NAMES = [
  "Marlin Bay Cleaning",
  "Coral Ridge Pressure Washing",
  "Spoonbill Sound Roofing",
  "Sandbar Grove Pressure Washing",
  "Tarpon Grove Cleaning LLC",
  "Bayberry Hammock Landscaping",
];

type Mode = "assisted" | "automatic";

async function reset(request: APIRequestContext) {
  const res = await request.post(`${API}/reset`);
  expect(res.ok()).toBeTruthy();
}

async function getJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(`${API}${path}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as T;
}

/** Data rows of the import CSV: every line after the placeholder comment and the header, trailing newline ignored. */
function csvRows(text: string): string[] {
  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  expect(lines[0]).toMatch(/^# placeholder columns/);
  expect(lines[1]).toBe("name,address_line");
  return lines.slice(2);
}

async function importRows(request: APIRequestContext, run?: string): Promise<string[]> {
  const res = await request.get(`${API}/import${run ? `?run=${run}` : ""}`);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("text/csv");
  return csvRows(await res.text());
}

async function waitForMode(page: Page) {
  await expect(page.getByTestId("mode-label")).toHaveText(/^(assisted|automatic)$/);
}

/** Flips the mode toggle in the module bar when needed and waits for the label to read the new mode. */
async function setMode(page: Page, mode: Mode) {
  await waitForMode(page);
  const label = page.getByTestId("mode-label");
  if ((await label.textContent())?.trim() === mode) return;
  await page.getByRole("switch", { name: "Automatic mode" }).click();
  await expect(label).toHaveText(mode);
}

/** Beat 1: the presenter types the live vendor once, in the Yardi stand-in form. */
async function createMarlin(page: Page) {
  await page.goto(MASTERS);
  await waitForMode(page);
  await page.locator("#vendor-name").fill(MARLIN.name);
  await page.locator("#vendor-address").fill(MARLIN.address);
  await page.getByRole("button", { name: "Create vendor in Yardi" }).click();
  await expect(page.getByTestId("create-note")).toContainText("V-Y-0125");
  await expect(page.getByTestId("create-note")).toContainText(`${MARLIN.name} created in Yardi. It syncs tonight.`);
}

/** Opens Run the nightly sync to Avid, sets the mode, presses Run nightly sync, and waits for the summary. */
async function runSync(page: Page, mode: Mode) {
  await page.goto(SYNC);
  await expect(page.getByText("No run yet. Press Run nightly sync to compare the two masters.").or(page.getByTestId("run-summary"))).toBeVisible();
  await setMode(page, mode);
  const label = page.getByText(/^Run R-\d{3}, (assisted|automatic)$/);
  const previous = (await label.count()) > 0 ? Number((await label.first().textContent())?.match(/R-(\d{3})/)?.[1] ?? 0) : 0;
  const next = `R-${String(previous + 1).padStart(3, "0")}`;
  await page.getByRole("button", { name: "Run nightly sync" }).click();
  await expect(page.getByTestId("run-summary")).toBeVisible();
  await expect(page.getByText(`Run ${next}, ${mode}`, { exact: true })).toBeVisible();
}

async function decide(page: Page, pairId: string, choice: "Same vendor, link" | "Different, create" | "Decide later") {
  await page.goto(NEAR);
  await waitForMode(page);
  const card = page.getByTestId(pairId);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: choice }).click();
  await expect(page.getByTestId("decision-note")).toBeVisible();
}

async function receiveInvoices(page: Page) {
  await page.goto(DOOR);
  await waitForMode(page);
  await page.getByRole("button", { name: "Receive invoices" }).click();
  await expect(page.getByTestId("invoice-table")).toBeVisible();
}

function summaryLabel(page: Page, testId: string) {
  return page.getByTestId("run-summary").locator("div", { has: page.locator(`[data-testid="${testId}"]`) }).locator("dt");
}

test.afterAll(async ({ request }) => {
  await reset(request);
});

test("check 1: gap counter reads 5 at boot and V-Y-0121 is only in Yardi", async ({ page, request }) => {
  await reset(request);
  await page.goto(MASTERS);
  await expect(page.getByTestId("gap-counter")).toHaveText("In Yardi, not in Avid: 5");
  await expect(page.getByTestId("gap-counter")).toHaveAttribute("href", SYNC);
  await expect(page.getByTestId("held-counter")).toHaveText("Near matches waiting for a decision: 2");
  await expect(page.getByTestId("yardi-count")).toHaveText("119");
  await expect(page.getByTestId("avid-count")).toHaveText("112");
  const yardiRow = page.getByTestId("yardi-list").getByTestId("yardi-V-Y-0121");
  await expect(yardiRow).toBeVisible();
  await expect(yardiRow).toContainText("Coral Ridge Pressure Washing");
  await expect(page.getByTestId("avid-list").locator("[data-testid^='avid-']", { hasText: "Coral Ridge Pressure Washing" })).toHaveCount(0);
  await expect(page.getByTestId("avid-list").locator("[data-testid^='avid-']")).toHaveCount(112);
});

test("check 2: assisted run counts, 6 import rows, 6 task lines", async ({ page, request }) => {
  await reset(request);
  await createMarlin(page);
  await runSync(page, "assisted");
  await expect(page.getByTestId("count-compared")).toHaveText("120");
  await expect(page.getByTestId("count-skipped-exact")).toHaveText("110");
  await expect(page.getByTestId("count-staged-or-created")).toHaveText("6");
  await expect(page.getByTestId("count-held")).toHaveText("2");
  await expect(page.getByTestId("count-skipped-inactive")).toHaveText("2");
  await expect(summaryLabel(page, "count-staged-or-created")).toHaveText("Staged");
  await expect(page.getByText("Run R-001, assisted")).toBeVisible();

  const link = page.getByRole("link", { name: "Download import file" });
  await expect(link).toBeVisible();
  await expect(page.getByTestId("download-import")).toHaveAttribute("href", `${API}/import`);
  await expect(page.getByTestId("download-import")).toHaveAttribute("download", /.*/);
  await expect(page.getByTestId("import-row-count")).toHaveText("6");
  const rows = await importRows(request);
  expect(rows).toHaveLength(6);
  expect(rows).toContain(`"${MARLIN.name}","${MARLIN.address}"`);

  await expect(page.getByTestId("task-list").locator("li")).toHaveCount(6);
  await expect(page.getByTestId("task-list").locator("li", { hasText: `Create ${MARLIN.name} in Avid` })).toHaveCount(1);
  await expect(page.getByTestId("task-list").locator("li input[type=checkbox]")).toHaveCount(6);
  await expect(page.getByTestId("scope-line")).toHaveText("This sync moves vendor names one way. Coding and reclasses are out of scope.");
});

test("check 3: PW pair shows its reasons and nothing was created for V-Y-0117", async ({ page, request }) => {
  await reset(request);
  await createMarlin(page);
  await runSync(page, "assisted");
  await page.goto(NEAR);
  const card = page.getByTestId(PW);
  await expect(card).toBeVisible();
  const reasons = card.getByTestId(`${PW}-reasons`).locator("li");
  await expect(reasons.filter({ hasText: /^same normalized name$/ })).toHaveCount(1);
  await expect(reasons.filter({ hasText: /^same address$/ })).toHaveCount(1);
  await expect(card.getByTestId(`${PW}-yardi-normalized`)).toHaveText("normalized: pw maintenance");
  await expect(card.getByTestId(`${PW}-avid-normalized`)).toHaveText("normalized: pw maintenance");
  await expect(card).toContainText("score 1.00");

  const masters = await getJson<MastersPayload>(request, "/masters");
  expect(masters.avid_count).toBe(112);
  expect(masters.avid.some((v) => v.name === "PW Maintenance LLC")).toBe(false);
  expect(masters.avid.some((v) => v.source === "synced")).toBe(false);
  await page.goto(MASTERS);
  await expect(page.getByTestId("avid-count")).toHaveText("112");
  await expect(page.getByTestId("avid-list").locator("[data-testid^='avid-']", { hasText: "PW Maintenance LLC" })).toHaveCount(0);
});

test("check 4: linking the PW pair makes V-Y-0117 skip_exact and keeps 6 import rows", async ({ page, request }) => {
  await reset(request);
  await createMarlin(page);
  await runSync(page, "assisted");
  await decide(page, PW, "Same vendor, link");
  await expect(page.getByTestId("decision-note")).toContainText("Linked V-Y-0117 to V-A-0088. Nothing was created.");
  await expect(page.getByTestId("decided-V-Y-0117-V-A-0088")).toBeVisible();
  await expect(page.getByTestId("decided-V-Y-0117-V-A-0088")).toContainText("Same vendor, linked by hand");
  await expect(page.getByTestId(PW)).toHaveCount(0);
  await expect(page.getByTestId(TIDEWATER)).toBeVisible();

  const run = await getJson<RunPayload>(request, "/run");
  const item = run.delta.find((d) => d.yardi_vendor_id === "V-Y-0117");
  expect(item).toBeTruthy();
  expect(item?.action).toBe("skip_exact");
  expect(item?.avid_vendor_id).toBe("V-A-0088");
  expect(run.import_row_count).toBe(6);
  expect(await importRows(request)).toHaveLength(6);

  await page.goto(SYNC);
  await expect(page.getByTestId("run-summary")).toBeVisible();
  await page.getByRole("button", { name: /^Show \d+ exact matches$/ }).click();
  await expect(page.getByTestId("delta-V-Y-0117-action")).toHaveText("skip_exact");
  await expect(page.getByTestId("delta-V-Y-0117")).toContainText("V-A-0088");
  await expect(page.getByTestId("import-row-count")).toHaveText("6");
  await expect(page.getByTestId("task-list").locator("li")).toHaveCount(6);
});

test("check 5: Tidewater pair reasons, Different create adds a row or an Avid vendor", async ({ page, request }) => {
  // Assisted: the import file regenerates with 7 rows.
  await reset(request);
  await createMarlin(page);
  await runSync(page, "assisted");
  await page.goto(NEAR);
  const card = page.getByTestId(TIDEWATER);
  await expect(card).toBeVisible();
  const reasons = card.getByTestId(`${TIDEWATER}-reasons`).locator("li");
  await expect(reasons.filter({ hasText: /^similar name$/ })).toHaveCount(1);
  await expect(reasons.filter({ hasText: /^different address$/ })).toHaveCount(1);
  await decide(page, TIDEWATER, "Different, create");
  await expect(page.getByTestId("decided-V-Y-0119-V-A-0092")).toContainText("Different vendor, created");
  await expect(page.getByTestId(TIDEWATER)).toHaveCount(0);
  const rows = await importRows(request);
  expect(rows).toHaveLength(7);
  expect(rows.some((r) => r.startsWith('"Tidewater Plumbing Co"'))).toBe(true);
  await page.goto(SYNC);
  await expect(page.getByTestId("import-row-count")).toHaveText("7");
  await expect(page.getByTestId("task-list").locator("li")).toHaveCount(7);
  await expect(page.getByTestId("delta-V-Y-0119-action")).toHaveText("stage");

  // Automatic: the Avid list gains V-Y-0119's name.
  await reset(request);
  await createMarlin(page);
  await runSync(page, "automatic");
  await decide(page, TIDEWATER, "Different, create");
  await expect(page.getByTestId("decided-V-Y-0119-V-A-0092")).toContainText("Different vendor, created");
  await page.goto(MASTERS);
  await expect(page.getByTestId("avid-count")).toHaveText("119");
  const added = page.getByTestId("avid-list").locator("[data-testid^='avid-']", { hasText: "Tidewater Plumbing Co" });
  await expect(added).toHaveCount(1);
  await expect(added).toContainText("synced");
  const masters = await getJson<MastersPayload>(request, "/masters");
  const avid = masters.avid.find((v) => v.name === "Tidewater Plumbing Co");
  expect(avid).toBeTruthy();
  expect(avid?.source).toBe("synced");
});

test("check 6: automatic run creates the staged names in Avid marked synced", async ({ page, request }) => {
  await reset(request);
  await createMarlin(page);
  await runSync(page, "assisted");
  await expect(summaryLabel(page, "count-staged-or-created")).toHaveText("Staged");
  await setMode(page, "automatic");
  await page.getByRole("button", { name: "Run nightly sync" }).click();
  await expect(page.getByText("Run R-002, automatic")).toBeVisible();
  await expect(summaryLabel(page, "count-staged-or-created")).toHaveText("Created");
  await expect(page.getByTestId("count-staged-or-created")).toHaveText("6");
  await expect(page.getByTestId("created-count-value")).toHaveText("6");
  await expect(page.getByTestId("download-import")).toHaveCount(0);
  await expect(page.getByTestId("task-list")).toHaveCount(0);

  const masters = await getJson<MastersPayload>(request, "/masters");
  await page.goto(MASTERS);
  await expect(page.getByTestId("avid-count")).toHaveText("118");
  await expect(page.getByTestId("gap-counter")).toHaveText("In Yardi, not in Avid: 0");
  for (const name of STAGED_NAMES) {
    const vendor = masters.avid.find((v) => v.name === name);
    expect(vendor, `Avid vendor named ${name}`).toBeTruthy();
    expect(vendor?.source).toBe("synced");
    const row = page.getByTestId("avid-list").getByTestId(`avid-${vendor?.avid_vendor_id}`);
    await expect(row).toContainText(name);
    await expect(row).toContainText("synced");
  }
  expect(masters.avid.filter((v) => v.source === "synced")).toHaveLength(6);
});

test("check 7: V-Y-0130 is skipped as inactive and never reaches the import file", async ({ page, request }) => {
  await reset(request);
  await createMarlin(page);
  await runSync(page, "assisted");
  await expect(page.getByTestId("delta-V-Y-0130-action")).toHaveText("skip_inactive");
  await expect(page.getByTestId("delta-V-Y-0130-reason")).toContainText(/inactive/i);
  await expect(page.getByTestId("delta-V-Y-0130")).toContainText("Old Harbor Fencing");
  const assisted = await importRows(request, "R-001");
  expect(assisted).toHaveLength(6);
  expect(assisted.join("\n")).not.toContain("Old Harbor Fencing");

  await setMode(page, "automatic");
  await page.getByRole("button", { name: "Run nightly sync" }).click();
  await expect(page.getByText("Run R-002, automatic")).toBeVisible();
  await expect(page.getByTestId("delta-V-Y-0130-action")).toHaveText("skip_inactive");
  const automatic = await importRows(request, "R-002");
  expect(automatic.join("\n")).not.toContain("Old Harbor Fencing");
  const latest = await importRows(request);
  expect(latest.join("\n")).not.toContain("Old Harbor Fencing");
  const run = await getJson<RunPayload>(request, "/run");
  expect(run.delta.find((d) => d.yardi_vendor_id === "V-Y-0130")?.action).toBe("skip_inactive");
});

test("check 8: Marlin Bay Cleaning appears in the delta as stage or create", async ({ page, request }) => {
  await reset(request);
  await createMarlin(page);
  await runSync(page, "assisted");
  await expect(page.getByTestId("delta-V-Y-0125")).toBeVisible();
  await expect(page.getByTestId("delta-V-Y-0125")).toContainText(MARLIN.name);
  await expect(page.getByTestId("delta-V-Y-0125-action")).toHaveText("stage");

  await setMode(page, "automatic");
  await page.getByRole("button", { name: "Run nightly sync" }).click();
  await expect(page.getByText("Run R-002, automatic")).toBeVisible();
  await expect(page.getByTestId("delta-V-Y-0125-action")).toHaveText("create");
  await expect(page.getByTestId("delta-V-Y-0125")).toContainText("V-A-");
});

test("check 9: INV-5007 is first_seen at day 0 and its shortcut pre-fills the form", async ({ page, request }) => {
  await reset(request);
  await receiveInvoices(page);
  await expect(page.getByRole("columnheader", { name: "Days in queue" })).toBeVisible();
  const row = page.getByTestId("invoice-INV-5007");
  await expect(row).toContainText("Keys Gate Fencing");
  await expect(page.getByTestId("invoice-INV-5007-flag")).toHaveText("first_seen");
  await expect(page.getByTestId("invoice-INV-5007-days")).toHaveText("0");
  await expect(row).toContainText("none");
  await row.getByRole("link", { name: "Create vendor in Yardi" }).click();
  await expect(page).toHaveURL(/\/vendor-creator-to-avid\/create-the-vendor-once-in-yardi\?name=/);
  await expect(page.locator("#vendor-name")).toHaveValue("Keys Gate Fencing");
});

test("check 10: INV-5009 is near_match at day 7 and links to the V-Y-0117 pair", async ({ page, request }) => {
  // As the pack states it, from a fresh store.
  await reset(request);
  await receiveInvoices(page);
  const row = page.getByTestId("invoice-INV-5009");
  await expect(row).toContainText("PW Maintenance");
  await expect(page.getByTestId("invoice-INV-5009-flag")).toHaveText("near_match");
  await expect(page.getByTestId("invoice-INV-5009-days")).toHaveText("7");
  await expect(row).toContainText("V-Y-0117");
  const open = row.getByRole("link", { name: "Open near match" });
  await expect(open).toHaveAttribute("href", /pair=V-Y-0117/);
  await open.click();
  await expect(page).toHaveURL(/decide-the-near-matches\?pair=V-Y-0117/);
  await expect(page.getByTestId(PW)).toBeVisible();
  await expect(page.getByTestId(PW)).toHaveClass(/ring-2/);

  // In script order, after the PW pair has been linked by hand, the flag still reads near_match
  // (the front door checks the two masters only) and the link lands on the decided entry.
  await reset(request);
  await createMarlin(page);
  await runSync(page, "assisted");
  await runSync(page, "automatic");
  await decide(page, PW, "Same vendor, link");
  await decide(page, TIDEWATER, "Different, create");
  await receiveInvoices(page);
  await expect(page.getByTestId("invoice-INV-5009-flag")).toHaveText("near_match");
  await expect(page.getByTestId("invoice-INV-5009-days")).toHaveText("7");
  const again = page.getByTestId("invoice-INV-5009").getByRole("link", { name: "Open near match" });
  await expect(again).toHaveAttribute("href", /pair=V-Y-0117/);
  await again.click();
  await expect(page).toHaveURL(/decide-the-near-matches\?pair=V-Y-0117/);
  await expect(page.getByTestId("decided-V-Y-0117-V-A-0088")).toBeVisible();
});

/** The whole presenter script, beat 1 to beat 5, on the real screens. */
async function presenterScript(page: Page, request: APIRequestContext) {
  await createMarlin(page);
  await runSync(page, "assisted");
  expect(await importRows(request)).toHaveLength(6);
  await setMode(page, "automatic");
  await page.getByRole("button", { name: "Run nightly sync" }).click();
  await expect(page.getByText("Run R-002, automatic")).toBeVisible();
  await page.goto(MASTERS);
  await expect(page.getByTestId("avid-count")).toHaveText("118");
  await decide(page, PW, "Same vendor, link");
  await decide(page, TIDEWATER, "Different, create");
  await receiveInvoices(page);
  await page.goto(SYNC);
  await expect(page.getByTestId("scope-line")).toHaveText("This sync moves vendor names one way. Coding and reclasses are out of scope.");
}

/** Everything the script changes, read through the routes, in a stable order. */
async function snapshot(request: APIRequestContext) {
  const state = await getJson<StatePayload>(request, "/state");
  const run = await getJson<RunPayload>(request, "/run");
  const near = await getJson<NearMatchesPayload>(request, "/near-matches");
  const door = await getJson<FrontDoorPayload>(request, "/front-door");
  const masters = await getJson<MastersPayload>(request, "/masters");
  const byId = (a: { yardi_vendor_id: string }, b: { yardi_vendor_id: string }) => a.yardi_vendor_id.localeCompare(b.yardi_vendor_id);
  return {
    state,
    run: run.run,
    delta: [...run.delta].sort(byId).map((d) => ({ id: d.yardi_vendor_id, action: d.action, reason: d.reason, avid: d.avid_vendor_id })),
    tasks: run.tasks.map((t) => ({ id: t.task_id, run: t.run_id, text: t.text, done: t.done })),
    import_row_count: run.import_row_count,
    import_file_name: run.import_file_name,
    import_rows: await importRows(request),
    held: near.held.map((p) => `${p.candidate.yardi_vendor_id}-${p.candidate.avid_vendor_id}`),
    decided: near.decided.map((p) => ({ pair: `${p.candidate.yardi_vendor_id}-${p.candidate.avid_vendor_id}`, decision: p.candidate.decision })),
    received: door.received,
    invoices: door.invoices.map((i) => ({
      id: i.invoice_id,
      flag: i.flag,
      days: i.days_in_queue,
      yardi: i.matched_yardi_vendor_id,
      avid: i.matched_avid_vendor_id,
    })),
    yardi: masters.yardi.map((v) => ({ id: v.yardi_vendor_id, name: v.name, status: v.status })),
    avid: masters.avid.map((v) => ({ id: v.avid_vendor_id, name: v.name, source: v.source })),
  };
}

test("check 11: Reset demo restores boot and the script repeats identically", async ({ page, request }) => {
  await reset(request);
  await presenterScript(page, request);
  const first = await snapshot(request);
  expect(first.state.avid_count).toBe(119);
  expect(first.decided).toHaveLength(2);
  expect(first.received).toBe(true);

  // Beat 5: the presenter presses Reset this demo in the sidebar; the page reloads.
  await page.goto(MASTERS);
  await expect(page.getByTestId("avid-count")).toHaveText("119");
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reset this demo" }).click()]);
  await expect(page.getByTestId("avid-count")).toHaveText("112");
  await expect(page.getByTestId("yardi-count")).toHaveText("119");
  await expect(page.getByTestId("gap-counter")).toHaveText("In Yardi, not in Avid: 5");
  await expect(page.getByTestId("held-counter")).toHaveText("Near matches waiting for a decision: 2");
  await expect(page.getByTestId("yardi-V-Y-0125")).toHaveCount(0);
  await expect(page.getByTestId("avid-list").locator("[data-testid^='avid-']", { hasText: "synced" })).toHaveCount(0);
  await expect(page.getByTestId("mode-label")).toHaveText("assisted");
  await page.goto(NEAR);
  await expect(page.getByTestId(PW)).toBeVisible();
  await expect(page.getByTestId(TIDEWATER)).toBeVisible();
  await expect(page.getByTestId("decided-list")).toContainText("Nothing decided yet.");
  await page.goto(SYNC);
  await expect(page.getByText("No run yet. Press Run nightly sync to compare the two masters.")).toBeVisible();
  await page.goto(DOOR);
  await expect(page.getByText("No invoices received yet. Press Receive invoices to check today's payees against both masters.")).toBeVisible();
  await expect(page.getByTestId("invoice-table")).toHaveCount(0);
  const boot = await getJson<StatePayload>(request, "/state");
  expect(boot).toMatchObject({ mode: "assisted", yardi_count: 119, avid_count: 112, gap: 5, held: 2, last_run_id: null });

  // Beat 1 again, without touching the reset route: the button did the reset.
  await presenterScript(page, request);
  const second = await snapshot(request);
  expect(second).toEqual(first);
});
