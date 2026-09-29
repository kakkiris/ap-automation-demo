import { test, expect } from "@playwright/test";
import { BASE, LOAD, SOURCE_MIX, COUNTER_SLUGS, FIELD_SOURCES, counter, inboxRows, lineRows, openInbox, openReview, reset, submitButton } from "./helpers";

// Acceptance checks 1 to 7 of the AP Inbox module: this week's arrivals, Review an invoice, and Split across properties.

const REQUIRED_FIELDS = ["payee", "invoiceNumber", "expenseType", "invoiceDate", "postMonth", "cashAccount", "notes", "entity", "amount", "glAccount"];
const ALL_FIELDS = [...REQUIRED_FIELDS, "property"];

test("check 1: This week's arrivals shows 26 items, four badges in the seeded mix, counters sum to 26", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);

  await expect(inboxRows(page)).toHaveCount(26);
  await expect(page.getByText("26 arrivals this week")).toBeVisible();

  const badges = page.getByTestId("source-badge");
  for (const [label, count] of Object.entries(SOURCE_MIX)) {
    await expect(badges.filter({ hasText: new RegExp(`^${label}$`) }), `${label} badges`).toHaveCount(count);
  }
  await expect(badges).toHaveCount(26);

  let sum = 0;
  for (const slug of COUNTER_SLUGS) {
    const n = await counter(page, slug);
    expect(Number.isNaN(n), `counter-${slug} shows a number`).toBe(false);
    sum += n;
  }
  expect(sum).toBe(26);
});

test("check 2: I-0005 opens with ten fields filled, vendor at 0.94, a source tag on every field, Submit enabled", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openReview(page, "I-0005");

  for (const field of REQUIRED_FIELDS) {
    const input = page.getByTestId(`field-${field}`).locator("input, select").first();
    await expect(input, `${field} is filled`).not.toHaveValue("");
  }
  for (const field of ALL_FIELDS) {
    const source = page.getByTestId(`source-${field}`);
    await expect(source).toBeVisible();
    const text = (await source.innerText()).trim();
    expect(FIELD_SOURCES, `source tag on ${field} is one of the five words, saw "${text}"`).toContain(text);
  }

  const vendor = page.getByTestId("vendor-match");
  await expect(vendor).toContainText("Peoria Plumbing Company LLC");
  await expect(vendor).toContainText("Match score 0.94");
  await expect(submitButton(page)).toBeEnabled();
});

test("check 3: I-0005 property panel shows P-12003, the owner, entity, cash account, method parcel", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openReview(page, "I-0005");

  const panel = page.getByTestId("property-panel");
  await expect(panel).toContainText("P-12003");
  await expect(panel).toContainText("Lakeshore Lien Fund 2 LLC");
  await expect(panel).toContainText("Entity E-101");
  await expect(panel).toContainText("Cash account 1000-2201");
  await expect(page.getByTestId("resolution-method")).toHaveText("parcel");
});

test("check 4: I-0019 amount is highlighted below 0.60 and Submit stays disabled until the amount is confirmed", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openReview(page, "I-0019");

  const dot = page.getByTestId("confidence-amount");
  await expect(dot).toHaveAttribute("data-band", "low");
  const confidence = parseFloat((await dot.getAttribute("title")) ?? "1");
  expect(confidence).toBeLessThan(0.6);
  await expect(page.getByTestId("readiness")).toContainText("Confirm the amount");
  await expect(submitButton(page)).toBeDisabled();

  await page.getByRole("button", { name: "Confirm amount" }).click();
  await expect(submitButton(page)).toBeEnabled();
  await expect(page.getByTestId("readiness")).toHaveText("Ready to submit");
});

test("check 5: I-0007 in the splitter shows nine lines of 50.00, split method equal, sum 450.00 green", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openReview(page, "I-0007");

  await expect(lineRows(page)).toHaveCount(9);
  for (let n = 1; n <= 9; n++) {
    await expect(page.getByLabel(`Amount for line ${n}`, { exact: true })).toHaveValue("50.00");
  }
  const methods = page.getByTestId("split-method");
  await expect(methods).toHaveCount(9);
  await expect(methods.filter({ hasText: /^equal$/ })).toHaveCount(9);

  const sum = page.getByTestId("sum-check");
  await expect(sum).toHaveAttribute("data-state", "ok");
  await expect(sum).toContainText("450.00");
  await expect(sum).toContainText("matches the invoice total");
});

test("check 6: the I-0007 lot missing from the property list is flagged, Create property clears it", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openReview(page, "I-0007");

  const line1 = page.getByTestId("line-1");
  await expect(line1.getByTestId("line-flag")).toHaveText("Not in property list");
  await expect(page.getByTestId("line-flag")).toHaveCount(1);
  await expect(page.getByTestId("readiness")).toContainText("not in the property list");
  await expect(submitButton(page)).toBeDisabled();

  await line1.getByRole("button", { name: "Create property" }).click();
  await expect(page.getByTestId("line-flag")).toHaveCount(0);
  await expect(page.getByTestId("readiness")).toHaveText("Ready to submit");
  await expect(submitButton(page)).toBeEnabled();
});

test("check 7: I-0012 ten stated lines with differing ledgers sum 6,988.40; a 1.00 edit turns the sum red; I-0016 has 60, 50, 40", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openReview(page, "I-0012");

  await expect(lineRows(page)).toHaveCount(10);
  const methods = page.getByTestId("split-method");
  await expect(methods).toHaveCount(10);
  await expect(methods.filter({ hasText: /^stated$/ })).toHaveCount(10);

  const codes = new Set<string>();
  for (const text of await lineRows(page).allInnerTexts()) {
    for (const code of text.match(/\b9\d{3}-\d{4}\b/g) ?? []) codes.add(code);
  }
  expect(codes.size, `ledger codes across the lines: ${[...codes].join(", ")}`).toBeGreaterThanOrEqual(2);

  const sum = page.getByTestId("sum-check");
  await expect(sum).toHaveAttribute("data-state", "ok");
  await expect(sum).toContainText("6,988.40");
  await expect(submitButton(page)).toBeEnabled();

  const amount = page.getByLabel("Amount for line 1", { exact: true });
  const current = (await amount.inputValue()).replace(/,/g, "");
  const bumped = (Math.round(parseFloat(current) * 100) + 100) / 100;
  await amount.fill(bumped.toFixed(2));
  await amount.press("Enter");
  await expect(sum).toHaveAttribute("data-state", "bad");
  await expect(sum).toContainText("does not match the invoice total");
  await expect(submitButton(page)).toBeDisabled();

  await openReview(page, "I-0016");
  await expect(lineRows(page)).toHaveCount(3);
  await expect(page.getByLabel("Amount for line 1", { exact: true })).toHaveValue("60.00");
  await expect(page.getByLabel("Amount for line 2", { exact: true })).toHaveValue("50.00");
  await expect(page.getByLabel("Amount for line 3", { exact: true })).toHaveValue("40.00");
  const methods16 = page.getByTestId("split-method");
  await expect(methods16).toHaveCount(3);
  await expect(methods16.filter({ hasText: /^stated$/ })).toHaveCount(3);
  await expect(methods16.filter({ hasText: /equal/ })).toHaveCount(0);
  await expect(page.getByTestId("sum-check")).toHaveAttribute("data-state", "ok");
  expect(page.url()).toContain(`${BASE}/review-an-invoice/I-0016`);
  await expect(page.getByTestId("state")).toHaveText("Drafted", { timeout: LOAD });
});
