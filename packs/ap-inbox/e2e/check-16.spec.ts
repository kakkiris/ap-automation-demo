import { test, expect } from "@playwright/test";
import { BASE, LOAD, lineRows, reset } from "./helpers";

// Check 16 of the AP Inbox module: the splitter has its own place in the sidebar, and
// that entry opens the scripted nine-lot invoice in the splitter.

test("check 16: the splitter entry opens the AP Inbox splitter", async ({ page, request }) => {
  await reset(request);
  await page.goto("/family-office-ap/multi-property-split");
  await page.waitForURL(`**${BASE}/split-across-properties/I-0007`, { timeout: LOAD });
  expect(page.url()).toMatch(/\/split-across-properties\/I-0007$/);
  await expect(page.getByTestId("state")).toBeVisible({ timeout: LOAD });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Split across properties: I-0007");
  await expect(lineRows(page)).toHaveCount(9);
  await expect(page.getByRole("button", { name: "Back to the single draft" })).toBeVisible();
});
