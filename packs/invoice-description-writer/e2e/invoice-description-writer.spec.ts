import { test, expect, request as apiRequest, type APIRequestContext, type Page } from "@playwright/test";

// Rehearsal of the invoice-description-writer module: one test per acceptance check, in the pack's order.
// Every test posts to the reset route first and then walks the real screens in the browser.
// The dev server on port 3000 runs without ANTHROPIC_API_KEY, so every reading is the canned one (check 10).

const API = "/api/industrial-ap/invoice-description-writer";
const BASE = "/industrial-ap/invoice-description-writer";
const RECEIVE = `${BASE}/receive-todays-invoices`;
const WRITE = `${BASE}/write-the-invoice-description`;
const HISTORY = `${BASE}/how-this-vendor-was-coded-before`;
const ROUTED_NOTE = "utility, handled by the capture pipeline";
const INV_3007_TEXT = "Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26";
const EMPTY_TODAY = "No invoices received yet. Press Receive invoices to bring in today's post.";
const NOT_OPEN = "Press Receive invoices first.";
const DATE = /\d{4}-\d{2}-\d{2}/;
const TILES = ["received", "ready", "manual", "routed"] as const;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

async function reset(request: APIRequestContext) {
  const res = await request.post(`${API}/reset`);
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toEqual({ ok: true });
}

async function getJson<T = Record<string, unknown>>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(`${API}${path}`);
  expect(res.ok(), `GET ${path}`).toBeTruthy();
  return (await res.json()) as T;
}

/** Beat 1: press Receive invoices on Receive today's invoices and wait for the day's post to land. */
async function receiveTodaysInvoices(page: Page) {
  await page.goto(RECEIVE);
  await page.getByRole("button", { name: "Receive invoices", exact: true }).click();
  await expect(page.getByText("Today's invoices are in.")).toBeVisible();
  await expect(page.getByTestId("summary-received")).toHaveText("30");
}

async function openDescription(page: Page, id: string) {
  await page.goto(`${WRITE}?id=${id}`);
  await expect(page.getByTestId("invoice-status")).toBeVisible();
  await expect(page.getByRole("img", { name: `Invoice ${id}` })).toBeAttached();
}

/** Clicks Copy description, waits for the Copied state, and returns what landed on the clipboard. */
async function copyDescription(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Copy description", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

async function summaryTiles(page: Page): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of TILES) out[key] = (await page.getByTestId(`summary-${key}`).innerText()).trim();
  return out;
}

async function glCardTexts(page: Page) {
  return {
    code: (await page.getByTestId("gl-code").innerText()).trim(),
    basis: (await page.getByTestId("gl-basis").innerText()).trim(),
    tier: (await page.getByTestId("gl-tier").innerText()).trim(),
    alternatives: (await page.getByTestId("gl-alternatives").getByRole("listitem").allInnerTexts()).map((t) => t.trim()),
  };
}

/** Beat 6: press Corrected, pick a code, record it, and wait for the note. */
async function recordCorrection(page: Page, code: string) {
  await page.getByRole("button", { name: "Corrected", exact: true }).click();
  const record = page.getByRole("button", { name: "Record correction", exact: true });
  await expect(record).toBeDisabled();
  await page.getByLabel("Corrected code").selectOption(code);
  await expect(record).toBeEnabled();
  await record.click();
  await expect(page.getByTestId("feedback-note")).toBeVisible();
}

test.afterAll(async () => {
  // Leave the store in the reset state for whoever uses the dev server next.
  const ctx = await apiRequest.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });
  await ctx.post(`${API}/reset`);
  await ctx.dispose();
});

test("check 1: Receive invoices shows 30 received, 27 ready, 1 manual, 2 routed; INV-3007 ready", async ({ page, request }) => {
  await reset(request);
  await page.goto(RECEIVE);
  await expect(page.getByText(EMPTY_TODAY)).toBeVisible();
  await page.getByRole("button", { name: "Receive invoices", exact: true }).click();
  await expect(page.getByText("Today's invoices are in.")).toBeVisible();
  await expect(page.getByTestId("summary-received")).toHaveText("30");
  await expect(page.getByTestId("summary-ready")).toHaveText("27");
  await expect(page.getByTestId("summary-manual")).toHaveText("1");
  await expect(page.getByTestId("summary-routed")).toHaveText("2");
  await expect(page.getByTestId("status-INV-3007")).toHaveText("ready");
  await expect(page.getByRole("button", { name: "Receive invoices", exact: true })).toBeDisabled();
  await expect(page.locator('[data-testid^="inbox-row-"]')).toHaveCount(30);
  await expect(page.getByText("Example data: 30 invoices in one day's folder.")).toBeVisible();
});

test("check 2: INV-3007 description reads exactly and the copy button puts it on the clipboard", async ({ page, request }) => {
  await reset(request);
  await receiveTodaysInvoices(page);
  await page.getByRole("link", { name: "INV-3007", exact: true }).click();
  await expect(page).toHaveURL(/\/write-the-invoice-description\?id=INV-3007$/);
  await expect(page.getByTestId("description-card")).toBeVisible();
  await expect(page.getByTestId("description-text")).toHaveText(INV_3007_TEXT);
  const clip = await copyDescription(page);
  expect(clip).toBe(INV_3007_TEXT);
});

test("check 3: INV-3007 GL card 6320 Roofing repairs, 14 of 16, strong; Used as is marks the row in today's invoices used", async ({ page, request }) => {
  await reset(request);
  await receiveTodaysInvoices(page);
  await openDescription(page, "INV-3007");
  await expect(page.getByTestId("gl-card")).toContainText("Suggested code");
  await expect(page.getByTestId("gl-code")).toHaveText("6320 Roofing repairs");
  await expect(page.getByTestId("gl-basis")).toContainText("14 of 16");
  await expect(page.getByTestId("gl-tier")).toHaveText("strong");
  await page.getByRole("button", { name: "Used as is", exact: true }).click();
  await expect(page.getByTestId("feedback-note")).toHaveText("Recorded: used as is.");
  await expect(page.getByTestId("invoice-status")).toHaveText("used");
  await page.goto(RECEIVE);
  await expect(page.getByTestId("status-INV-3007")).toHaveText("used");
  await expect(page.getByTestId("summary-ready")).toHaveText("27");
});

test("check 4: INV-3012 says dates not on invoice with no date values; GL 7410 strong", async ({ page, request }) => {
  await reset(request);
  await receiveTodaysInvoices(page);
  await openDescription(page, "INV-3012");
  const text = page.getByTestId("description-text");
  await expect(text).toContainText("dates not on invoice");
  await expect(text).not.toHaveText(DATE);
  await expect(page.getByTestId("marker-service_from")).toHaveText("not on invoice");
  await expect(page.getByTestId("marker-service_to")).toHaveText("not on invoice");
  await expect(page.getByTestId("gl-code")).toHaveText("7410 Pest control");
  await expect(page.getByTestId("gl-tier")).toHaveText("strong");
});

test("check 5: INV-3019 description assembled; GL card says no history for this vendor and shows no code", async ({ page, request }) => {
  await reset(request);
  await receiveTodaysInvoices(page);
  await openDescription(page, "INV-3019");
  await expect(page.getByTestId("vendor-link")).toHaveText("Keys Gate Fencing");
  await expect(page.getByTestId("description-card")).toBeVisible();
  const text = page.getByTestId("description-text");
  await expect(text).toHaveText(/^Keys Gate Fencing \S.* PR PR-\d+ \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/);
  const shown = (await text.innerText()).trim();
  const payload = await getJson<{ description: { text: string } }>(request, "/workbench?id=INV-3019");
  expect(shown).toBe(payload.description.text);
  await expect(page.getByTestId("gl-card")).toBeVisible();
  await expect(page.getByTestId("gl-none")).toHaveText("no history for this vendor");
  await expect(page.getByTestId("gl-code")).toHaveCount(0);
  await expect(page.getByTestId("gl-basis")).toHaveCount(0);
  await expect(page.getByTestId("gl-card")).not.toContainText(/\b\d{4}\b/);
  await expect(page.getByRole("button", { name: "Copy code", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Used as is", exact: true })).toBeDisabled();
});

test("check 6: INV-3021 is manual with no Description card and a manual-entry card listing the missing fields", async ({ page, request }) => {
  await reset(request);
  await receiveTodaysInvoices(page);
  await expect(page.getByTestId("status-INV-3021")).toHaveText("manual");
  await openDescription(page, "INV-3021");
  await expect(page.getByTestId("invoice-status")).toHaveText("manual");
  await expect(page.getByTestId("description-card")).toHaveCount(0);
  await expect(page.getByTestId("gl-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Used as is", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Corrected", exact: true })).toHaveCount(0);
  const card = page.getByTestId("manual-card");
  await expect(card).toContainText("Needs manual entry");
  await expect(card).toContainText("The reader could not find these fields:");
  const payload = await getJson<{ manual_entry: string[]; extraction: { missing: string[] } }>(request, "/workbench?id=INV-3021");
  expect(payload.manual_entry.length).toBeGreaterThan(0);
  await expect(page.getByTestId("manual-fields").getByRole("listitem")).toHaveText(payload.manual_entry);
  for (const key of payload.extraction.missing) await expect(page.getByTestId(`marker-${key}`)).toHaveText("not on invoice");
});

test("check 7: INV-3025 is routed with the utility note; its description screen shows no Description or GL card", async ({ page, request }) => {
  await reset(request);
  await receiveTodaysInvoices(page);
  await expect(page.getByTestId("status-INV-3025")).toHaveText("routed");
  await expect(page.getByTestId("note-INV-3025")).toHaveText(ROUTED_NOTE);
  await expect(page.getByTestId("note-INV-3007")).toHaveText("");
  await page.getByRole("link", { name: "INV-3025", exact: true }).click();
  await expect(page).toHaveURL(/\/write-the-invoice-description\?id=INV-3025$/);
  await expect(page.getByTestId("invoice-status")).toHaveText("routed");
  const routed = page.getByTestId("routed-note");
  await expect(routed).toContainText("Routed out");
  await expect(routed).toContainText(ROUTED_NOTE);
  await expect(routed).toContainText("Nothing to paste here.");
  await expect(page.getByTestId("description-card")).toHaveCount(0);
  await expect(page.getByTestId("gl-card")).toHaveCount(0);
  await expect(page.getByTestId("fields")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Used as is", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Corrected", exact: true })).toHaveCount(0);
});

test("check 8: INV-3030 weak 6510 with 6520 alternative; Corrected to 6520 marks today's invoices corrected and the V-03 coding history records it", async ({ page, request }) => {
  await reset(request);
  await receiveTodaysInvoices(page);
  await openDescription(page, "INV-3030");
  await expect(page.getByTestId("gl-code")).toHaveText("6510 Plumbing repairs");
  await expect(page.getByTestId("gl-tier")).toHaveText("weak");
  await expect(page.getByTestId("gl-basis")).toContainText("9 of 15");
  await expect(page.getByTestId("gl-alternatives").getByRole("listitem")).toHaveText(["also used: 6520 Plumbing capital, 6 of 15"]);
  await recordCorrection(page, "6520");
  await expect(page.getByTestId("feedback-note")).toHaveText("Recorded: corrected to 6520 Plumbing capital.");
  await expect(page.getByTestId("invoice-status")).toHaveText("corrected");
  await page.goto(RECEIVE);
  await expect(page.getByTestId("status-INV-3030")).toHaveText("corrected");
  await openDescription(page, "INV-3030");
  await page.getByTestId("vendor-link").click();
  await expect(page).toHaveURL(/\/how-this-vendor-was-coded-before\?vendor_id=V-03$/);
  await expect(page.getByTestId("vendor-picker")).toHaveValue("V-03");
  await expect(page.getByText("Tidewater Plumbing", { exact: true })).toBeVisible();
  await expect(page.getByTestId("session-line")).toHaveText(["Recorded this session: INV-3030 corrected to 6520 Plumbing capital."]);
  await expect(page.getByTestId("session-empty")).toHaveCount(0);
});

test("check 9: INV-3033 description begins with the account number segment", async ({ page, request }) => {
  await reset(request);
  await receiveTodaysInvoices(page);
  await openDescription(page, "INV-3033");
  await expect(page.getByTestId("marker-account_number")).toHaveText("read from PDF");
  const account = (await page.getByTestId("field-account_number").locator("span").nth(1).innerText()).trim();
  expect(account).toMatch(/^\d{10}$/);
  const text = page.getByTestId("description-text");
  await expect(text).toHaveText(new RegExp(`^${account} \\S`));
  await expect(text).toContainText("Brightline Landscaping");
  const payload = await getJson<{ description: { text: string }; extraction: { fields: { account_number: string } } }>(request, "/workbench?id=INV-3033");
  expect(payload.description.text.split(" ")[0]).toBe(payload.extraction.fields.account_number);
  expect((await text.innerText()).trim()).toBe(payload.description.text);
});

test("check 10: without a key every reading is canned (key set and network down is covered by lib/__tests__/model.test.ts)", async ({ request }) => {
  // The dev server runs with no ANTHROPIC_API_KEY, so checks 1 to 9 above ran on canned readings.
  // The key-present, fetch-failing path is a unit test: extractInvoice serves canned when fetch rejects, times out, or returns bad JSON.
  await reset(request);
  const receive = await request.post(`${API}/receive`);
  expect(receive.ok()).toBeTruthy();
  const inbox = (await receive.json()) as { summary: Record<string, number>; items: { invoice_id: string; status: string }[] };
  expect(inbox.summary).toEqual({ received: 30, ready: 27, manual: 1, routed: 2 });
  for (const id of ["INV-3007", "INV-3012", "INV-3019", "INV-3021", "INV-3030", "INV-3033"]) {
    const wb = await getJson<{ extraction: { source: string } | null }>(request, `/workbench?id=${id}`);
    expect(wb.extraction?.source, id).toBe("canned");
  }
  for (const item of inbox.items) {
    const wb = await getJson<{ extraction: { source: string } | null }>(request, `/workbench?id=${item.invoice_id}`);
    if (item.status === "routed") expect(wb.extraction, item.invoice_id).toBeNull();
    else expect(wb.extraction?.source, item.invoice_id).toBe("canned");
  }
});

/** Beats 1 to 7 of the presenter script, returning everything seen on screen and the payloads behind it. */
async function runScript(page: Page, request: APIRequestContext) {
  const seen: Record<string, unknown> = {};
  await receiveTodaysInvoices(page);
  seen.summary = await summaryTiles(page);

  await openDescription(page, "INV-3007");
  seen.desc3007 = (await page.getByTestId("description-text").innerText()).trim();
  seen.clip3007 = await copyDescription(page);
  seen.gl3007 = await glCardTexts(page);
  await page.getByRole("button", { name: "Used as is", exact: true }).click();
  await expect(page.getByTestId("feedback-note")).toBeVisible();
  seen.note3007 = (await page.getByTestId("feedback-note").innerText()).trim();
  seen.status3007 = (await page.getByTestId("invoice-status").innerText()).trim();

  await openDescription(page, "INV-3012");
  seen.desc3012 = (await page.getByTestId("description-text").innerText()).trim();
  seen.gl3012 = await glCardTexts(page);

  await openDescription(page, "INV-3019");
  seen.desc3019 = (await page.getByTestId("description-text").innerText()).trim();
  seen.gl3019 = (await page.getByTestId("gl-none").innerText()).trim();

  await openDescription(page, "INV-3021");
  seen.status3021 = (await page.getByTestId("invoice-status").innerText()).trim();
  seen.manual3021 = await page.getByTestId("manual-fields").getByRole("listitem").allInnerTexts();

  await openDescription(page, "INV-3030");
  seen.gl3030 = await glCardTexts(page);
  await recordCorrection(page, "6520");
  seen.note3030 = (await page.getByTestId("feedback-note").innerText()).trim();
  seen.status3030 = (await page.getByTestId("invoice-status").innerText()).trim();

  await page.goto(RECEIVE);
  await expect(page.getByTestId("status-INV-3030")).toHaveText("corrected");
  seen.inboxStatuses = {
    inv3007: (await page.getByTestId("status-INV-3007").innerText()).trim(),
    inv3025: (await page.getByTestId("status-INV-3025").innerText()).trim(),
    note3025: (await page.getByTestId("note-INV-3025").innerText()).trim(),
    inv3030: (await page.getByTestId("status-INV-3030").innerText()).trim(),
  };

  await page.goto(`${HISTORY}?vendor_id=V-03`);
  await expect(page.getByTestId("session-line")).toHaveCount(1);
  seen.sessionV03 = await page.getByTestId("session-line").allInnerTexts();
  await page.goto(`${HISTORY}?vendor_id=V-01`);
  await expect(page.getByTestId("session-line")).toHaveCount(1);
  seen.sessionV01 = await page.getByTestId("session-line").allInnerTexts();

  seen.payloads = {
    inbox: await getJson(request, "/inbox"),
    wb3007: await getJson(request, "/workbench?id=INV-3007"),
    wb3030: await getJson(request, "/workbench?id=INV-3030"),
    historyV01: await getJson(request, "/vendor-history?vendor_id=V-01"),
    historyV03: await getJson(request, "/vendor-history?vendor_id=V-03"),
  };
  return seen;
}

test("check 11: Reset this demo empties today's invoices, clears feedback and session lines, and the script replays identically", async ({ page, request }) => {
  test.setTimeout(240_000);
  await reset(request);
  const first = await runScript(page, request);
  expect(first.sessionV03).toEqual(["Recorded this session: INV-3030 corrected to 6520 Plumbing capital."]);

  // Beat 8: press Reset this demo in the sidebar while on Receive today's invoices; the page reloads into the empty state.
  await page.goto(RECEIVE);
  await expect(page.getByTestId("status-INV-3030")).toHaveText("corrected");
  await page.getByRole("button", { name: "Reset this demo", exact: true }).click();
  await expect(page.getByText(EMPTY_TODAY)).toBeVisible();
  for (const key of TILES) await expect(page.getByTestId(`summary-${key}`)).toHaveText("0");
  await expect(page.locator('[data-testid^="inbox-row-"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Receive invoices", exact: true })).toBeEnabled();
  expect(await getJson(request, "/inbox")).toEqual({ received: false, summary: { received: 0, ready: 0, manual: 0, routed: 0 }, items: [] });

  await page.goto(WRITE);
  await expect(page.getByText(NOT_OPEN)).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to today's invoices", exact: true })).toBeVisible();
  await page.goto(`${WRITE}?id=INV-3030`);
  await expect(page.getByText(NOT_OPEN)).toBeVisible();

  for (const vendor of ["V-03", "V-01"]) {
    await page.goto(`${HISTORY}?vendor_id=${vendor}`);
    await expect(page.getByTestId("session-empty")).toHaveText("No corrections or confirmations yet.");
    await expect(page.getByTestId("session-line")).toHaveCount(0);
    const history = await getJson<{ session: unknown[] }>(request, `/vendor-history?vendor_id=${vendor}`);
    expect(history.session).toEqual([]);
  }

  const second = await runScript(page, request);
  expect(second).toEqual(first);
});
