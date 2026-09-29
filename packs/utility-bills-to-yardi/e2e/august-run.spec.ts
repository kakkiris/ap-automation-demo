import { test, expect } from "@playwright/test";

const API = "/api/industrial-ap/utility-bills-to-yardi";
const PAID = "/industrial-ap/utility-payment-reconciliation/which-bills-are-paid";
const CAPTURE = "/industrial-ap/utility-bills-to-yardi/capture-this-months-bills";
const MATCH = "/industrial-ap/utility-bills-to-yardi/match-bills-to-meters";

test("the August run through Yardi import confirmed", async ({ page, request }) => {
  await request.post(`${API}/reset`);
  await page.goto(PAID);
  await expect(page.getByRole("heading", { name: /Which bills are paid, Aug 2026/ })).toBeVisible();

  await page.goto(CAPTURE);
  await expect(page.getByRole("heading", { name: /Capture this month's bills, Aug 2026/ })).toBeVisible();
  await page.getByRole("button", { name: /^Run Aug 2026/ }).click();
  await expect(page.getByText(/Bills received:/)).toBeVisible();
  await expect(page.getByText(/Duplicate period, blocked from export: 1/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Export to Yardi \(blocked/ })).toBeDisabled();

  // The bills carry no invoice number of their own, so the run builds one from what it read:
  // the last five digits of the account number and the due date.
  const firstRow = page.locator("tbody tr").first();
  const account = ((await firstRow.locator("td").nth(3).textContent()) ?? "").trim();
  expect(account).toMatch(/^99\d{8}$/);
  await expect(firstRow.locator("td").last()).toHaveText(new RegExp(`^${account.slice(-5)}-\\d{8}$`));

  await page.goto(MATCH);
  await expect(page.getByRole("heading", { name: /Match bills to meters, Aug 2026/ })).toBeVisible();
  await expect(page.getByText(/of \d+ open/)).toBeVisible();
  for (let i = 0; i < 40; i++) {
    const open = await page.getByText(/All \d+ exceptions resolved/).count();
    if (open > 0) break;
    const heading = (await page.locator("main h2").first().textContent()) ?? "";
    if (heading.includes("Unmapped") || heading.includes("Provider list")) {
      const accept = page.getByRole("button", { name: /Enter: accept/ });
      if (await accept.isEnabled()) await accept.click();
      else await page.getByRole("button", { name: /N: skip/ }).click();
    } else if (heading.includes("Meter on bill differs")) await page.getByRole("button", { name: /S: confirm the swap/ }).click();
    else if (heading.includes("Duplicate")) await page.getByRole("button", { name: /F: keep the first/ }).click();
    else if (heading.includes("Unusual")) await page.getByRole("button", { name: /1: vacant but in use/ }).click();
    else break;
    await page.waitForTimeout(150);
  }
  const queue = await request.get(`${API}/queue`).then((r) => r.json());
  expect(queue.blocked).toBe(0);

  const exportRes = await request.get(`${API}/export`);
  expect(exportRes.ok()).toBeTruthy();
  expect(exportRes.headers()["content-type"]).toContain("zip");

  await page.goto(CAPTURE);
  await page.getByRole("button", { name: /^Yardi import confirmed$/ }).click();
  await expect(page.getByText(/ledger lines posted/)).toBeVisible();

  const strip = await request.get(`${API}/strip`).then((r) => r.json());
  expect(strip.totals.unpaid).toBeGreaterThanOrEqual(3);
  expect(strip.totals.unpaid).toBeLessThanOrEqual(8);
  const grid = await request.get(`${API}/grid?site=P02`).then((r) => r.json());
  const b5 = grid.rows.find((r: { meter: { id: string } }) => r.meter.id === "M9100087");
  expect(b5.cells[b5.cells.length - 1].status).toBe("paid");
  expect(b5.cells[b5.cells.length - 1].line_ids).toHaveLength(3);
});
