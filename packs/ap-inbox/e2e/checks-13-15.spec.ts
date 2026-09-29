import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { API, BASE, LOAD, buildPdf, centsOf, counters, getItem, getJson, importFileLines, inboxRows, openInbox, reset, runScriptedWeek, submitButton } from "./helpers";

// Acceptance checks 13 to 15 of the AP Inbox module: the tracker after
// payment, the import file and Reset this demo, and the canned reader without a key.

interface TrackerJson {
  cards: { cardRef: string; itemIds: string[]; cameByEmailNotInTrackerBefore: boolean; updates: { itemId: string; reason: string }[] }[];
}
interface InboxJson {
  items: { item: { itemId: string }; state: string; propertyGuess: string | null }[];
}

test("check 13: after Mark batch paid, Property tracker updates has a paid message per paid property invoice, and the email filter shows I-0015", async ({ page, request }) => {
  test.setTimeout(300_000);
  const week = await runScriptedWeek(page, request);
  expect(week.batchPaidText).toContain("Batch paid");

  const inbox = await getJson<InboxJson>(request, "/inbox");
  const paidWithProperty = inbox.items.filter((r) => r.state === "Paid" && r.propertyGuess !== null).map((r) => r.item.itemId);
  expect(paidWithProperty.length).toBeGreaterThan(0);

  const tracker = await getJson<TrackerJson>(request, "/tracker");
  const paidUpdates = tracker.cards.flatMap((c) => c.updates.filter((u) => u.reason === "paid").map((u) => u.itemId));
  for (const itemId of paidWithProperty) {
    expect(paidUpdates, `a paid update for ${itemId}`).toContain(itemId);
  }

  await page.goto(`${BASE}/property-tracker-updates`);
  await expect(page.getByTestId("email-filter")).toBeVisible({ timeout: LOAD });
  const cards = page.locator('[data-testid^="tracker-card-"]');
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  expect(before).toBeGreaterThan(1);

  await page.getByTestId("email-filter").click();
  await expect(page.getByText(/^Showing \d+$/)).toBeVisible();
  const shown = await cards.count();
  expect(shown).toBeGreaterThanOrEqual(1);
  expect(shown).toBeLessThan(before);
  for (const text of await cards.allInnerTexts()) {
    expect(text).toContain("I-0015");
  }
  await expect(cards.first()).toContainText("New card");
  await expect(cards.first()).toContainText("Paid");
});

test("check 14: the import file has 15 columns per row and one row per line, totals match; Reset this demo returns 26 New and the week repeats", async ({ page, request }) => {
  test.setTimeout(600_000);
  const first = await runScriptedWeek(page, request);

  // The file the presenter downloads.
  const lines = await importFileLines(request);
  expect(lines.length).toBeGreaterThan(1);
  const header = lines[0].split("\t");
  expect(header).toHaveLength(15);
  expect(header[0]).toBe("Entity");
  expect(header[10]).toBe("Amount");
  const rows = lines.slice(1).map((l) => l.split("\t"));
  for (const [i, row] of rows.entries()) {
    expect(row, `row ${i + 1} has 15 fields`).toHaveLength(15);
  }
  expect(rows).toHaveLength(first.lineCount);
  expect(rows).toHaveLength(first.fileRows);
  expect(first.invoiceCount).toBe(24);
  expect(first.lineCount).toBe(44);

  const ready = await getJson<{ invoices: { itemId: string; lineCount: number; amount: number }[]; batch: { lineCount: number; totalAmount: number } | null }>(request, "/ready");
  const invoiceLines = ready.invoices.reduce((a, r) => a + r.lineCount, 0);
  expect(rows).toHaveLength(invoiceLines);
  const fileTotal = rows.reduce((a, r) => a + centsOf(r[10]), 0);
  expect(fileTotal).toBe(first.batchTotalCents);
  expect(ready.invoices.reduce((a, r) => a + r.amount, 0)).toBe(first.batchTotalCents);
  expect(new Set(rows.map((r) => r[14])).size).toBe(first.invoiceCount);

  // Reset this demo from the sidebar, capturing the reset response the button receives.
  await openInbox(page);
  let resetBody: { ok: boolean; items: number; states: Record<string, number> } | null = null;
  await page.route(`**${API}/reset`, async (route) => {
    const res = await route.fetch();
    resetBody = (await res.json()) as typeof resetBody;
    await route.fulfill({ response: res, body: JSON.stringify(resetBody) });
  });
  await page.getByRole("button", { name: "Reset this demo" }).click();
  await expect.poll(() => resetBody, { timeout: LOAD }).not.toBeNull();
  await page.unroute(`**${API}/reset`);
  expect(resetBody!.ok).toBe(true);
  expect(resetBody!.items).toBe(26);
  expect(resetBody!.states.New).toBe(26);

  // The page reloads and the week arrives again.
  await expect(page.getByTestId("counter-drafted")).toBeVisible({ timeout: LOAD });
  await expect(inboxRows(page)).toHaveCount(26);
  const after = await counters(page);
  expect(Object.values(after).reduce((a, n) => a + n, 0)).toBe(26);
  expect(after.new).toBe(0);

  // Checks 1 to 13 repeat: the whole script runs again and lands on the same numbers.
  const second = await runScriptedWeek(page, request);
  expect(second).toEqual(first);
});

test("check 15: without a key, scripted items open with their canned extraction and an unscripted PDF can be completed by hand", async ({ page, request }) => {
  test.setTimeout(300_000);
  await reset(request);
  await openInbox(page);

  // The scripted item reads exactly what its canned file says.
  const canned = JSON.parse(readFileSync(path.join(__dirname, "..", "seed", "canned", "I-0005.json"), "utf8")) as {
    invoiceNumber: string;
    invoiceDate: string;
    totalAmount: string;
  };
  const scripted = await getItem(request, "I-0005");
  expect(scripted.draft.invoiceNumber).toBe(canned.invoiceNumber);
  expect(scripted.draft.invoiceDate).toBe(canned.invoiceDate);
  expect(scripted.draft.amount).toBe(centsOf(canned.totalAmount));
  expect(scripted.draft.payee).toBe("Peoria Plumbing Company LLC");

  // An unscripted PDF added through this week's arrivals.
  await page.getByRole("button", { name: "Add a document" }).click();
  await page.getByLabel("Document file").setInputFiles({ name: "unscripted-invoice.pdf", mimeType: "application/pdf", buffer: await buildPdf() });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForURL(`**${BASE}/review-an-invoice/I-9001`, { timeout: LOAD });
  await expect(page.getByText("Could not read this document, enter fields by hand")).toBeVisible({ timeout: LOAD });
  await expect(page.getByTestId("state")).toHaveText("Drafted");
  await expect(submitButton(page)).toBeDisabled();

  const typed: [string, string][] = [
    ["payee", "Riverside Gutter Cleaning"],
    ["invoiceNumber", "77001"],
    ["invoiceDate", "2026-08-28"],
    ["amount", "125.00"],
    ["cashAccount", "1000-1001"],
    ["notes", "Gutter cleaning, entered by hand"],
  ];
  const labels: Record<string, string> = { payee: "Payee", invoiceNumber: "Invoice number", invoiceDate: "Invoice date", amount: "Amount", cashAccount: "Cash account", notes: "Notes" };
  for (const [field, value] of typed) {
    const input = page.getByTestId(`field-${field}`).getByLabel(labels[field], { exact: true });
    await input.fill(value);
    await input.press("Enter");
    await expect(page.getByTestId(`source-${field}`)).toHaveText("You");
  }
  await page.getByLabel("Entity", { exact: true }).selectOption("E-001");
  await expect(page.getByTestId("source-entity")).toHaveText("You");
  await page.getByLabel("Ledger account", { exact: true }).selectOption("9100-1100");
  await expect(page.getByTestId("source-glAccount")).toHaveText("You");

  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("125.00");
  await expect(page.getByTestId("readiness")).toHaveText("Ready to submit");
  await expect(submitButton(page)).toBeEnabled();
  await submitButton(page).click();
  await expect(page.getByTestId("state")).toHaveText("Submitted");

  const item = await getItem(request, "I-9001");
  expect(item.item.state).toBe("Submitted");
  expect(item.draft.amount).toBe(12500);
});
