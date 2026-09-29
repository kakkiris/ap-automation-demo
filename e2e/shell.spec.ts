import { test, expect } from "@playwright/test";

// The suite shell: Demo home, the sidebar, the breadcrumb, the keys.
test("Demo home lists every module by department with Start and reset controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /The work, shown being done/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Family Office AP" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Industrial AP" })).toBeVisible();
  for (const name of ["Property Owner Lookup", "Multi-property invoice splitter", "AP Inbox", "Utility bills to Yardi", "Meter register", "Paid-or-not reconciliation", "Invoice description writer", "Vendor Creator to Avid"]) {
    await expect(page.locator(`[data-module-card]`).filter({ hasText: name }).first()).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Reset all demos" })).toBeVisible();
  expect(await page.getByRole("button", { name: "Reset this demo" }).count()).toBeGreaterThanOrEqual(8);
});

test("Start opens the module's first screen and the sidebar expands only that module", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-module-card=vendor-creator-to-avid]").getByRole("link", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/industrial-ap\/vendor-creator-to-avid\/create-the-vendor-once-in-yardi$/);
  const sidebar = page.locator('[data-slot="sidebar"]').first();
  await expect(sidebar.locator("[data-screen=create-the-vendor-once-in-yardi]")).toBeVisible();
  await expect(sidebar.locator("[data-screen=run-the-nightly-sync-to-avid]")).toBeVisible();
  await expect(sidebar.locator("[data-screen=receive-todays-invoices]")).toHaveCount(0);
  await sidebar.locator("[data-module=invoice-description-writer]").click();
  await expect(page).toHaveURL(/\/industrial-ap\/invoice-description-writer\/receive-todays-invoices$/);
  await expect(sidebar.locator("[data-screen=receive-todays-invoices]")).toBeVisible();
  await expect(sidebar.locator("[data-screen=run-the-nightly-sync-to-avid]")).toHaveCount(0);
});

test("the breadcrumb reads department, module, screen and is clickable at every level", async ({ page }) => {
  await page.goto("/industrial-ap/meter-register/every-meter-and-its-account");
  const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumb).toContainText("Industrial AP");
  await expect(crumb).toContainText("Meter register");
  await expect(crumb).toContainText("Every meter and its account");
  await crumb.getByRole("link", { name: "Industrial AP" }).click();
  await expect(page).toHaveURL(/\/\?department=industrial-ap$/);
  await expect(page.getByRole("heading", { name: "Industrial AP" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Family Office AP" })).toHaveCount(0);
});

test("[ and ] move between the open module's screens in order", async ({ page }) => {
  await page.goto("/industrial-ap/vendor-creator-to-avid/create-the-vendor-once-in-yardi");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("]");
  await expect(page).toHaveURL(/run-the-nightly-sync-to-avid$/);
  await page.keyboard.press("]");
  await expect(page).toHaveURL(/decide-the-near-matches$/);
  await page.keyboard.press("[");
  await expect(page).toHaveURL(/run-the-nightly-sync-to-avid$/);
});

test("the sidebar state survives a reload", async ({ page }) => {
  await page.goto("/industrial-ap/invoice-description-writer/receive-todays-invoices");
  const sidebar = page.locator('[data-slot="sidebar"]').first();
  await expect(sidebar.locator("[data-screen=write-the-invoice-description]")).toBeVisible();
  await page.goto("/");
  await expect(sidebar.locator("[data-screen=write-the-invoice-description]")).toBeVisible();
  await page.reload();
  await expect(sidebar.locator("[data-screen=write-the-invoice-description]")).toBeVisible();
});

test("the Property Owner Lookup button opens the lookup on a Family Office screen and not on an Industrial one", async ({ page }) => {
  await page.goto("/family-office-ap/ap-inbox/this-weeks-arrivals");
  await page.locator("header").getByRole("button", { name: "Property Owner Lookup" }).click();
  await page.getByRole("textbox", { name: "Address or parcel" }).fill("P-12003");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByTestId("parcel-lookup-result")).toContainText("P-12003");
  await expect(page.getByTestId("parcel-lookup-result")).toContainText("Entity");
  await page.goto("/industrial-ap/meter-register/every-meter-and-its-account");
  await expect(page.locator("header").getByRole("button", { name: "Property Owner Lookup" })).toHaveCount(0);
});

test("every screen opens with its narration, and a hides and shows it", async ({ page }) => {
  await page.goto("/industrial-ap/vendor-creator-to-avid/create-the-vendor-once-in-yardi");
  const note = page.getByRole("note", { name: "narration" });
  await expect(note).toBeVisible();
  await expect(note).toContainText("Today");
  await expect(note).toContainText("With this screen");
  await expect(note).toContainText("What it protects");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("a");
  await expect(note).toHaveCount(0);
  await page.getByRole("button", { name: "Show narration" }).click();
  await expect(note).toBeVisible();
  await page.goto("/family-office-ap/property-owner-lookup/owner-to-entity-map");
  await expect(page.getByRole("note", { name: "narration" })).toBeVisible();
});

test("every screen names the systems it connects to", async ({ page }) => {
  await page.goto("/family-office-ap/ap-inbox/property-tracker-updates");
  const strip = page.getByLabel("Connected systems");
  await expect(strip).toBeVisible();
  await expect(strip.locator('[data-system="Monday.com"]')).toContainText("receives");
  await expect(strip).toContainText("nothing is connected in the demo");

  await page.goto("/industrial-ap/vendor-creator-to-avid/run-the-nightly-sync-to-avid");
  await expect(page.getByLabel("Connected systems").locator('[data-system="Yardi"]')).toContainText("reads");
  await expect(page.getByLabel("Connected systems").locator('[data-system="Avid"]')).toContainText("receives");

  await page.goto("/family-office-ap/property-owner-lookup/look-up-an-owner");
  const lookup = page.getByLabel("Connected systems");
  await expect(lookup.locator('[data-system="Parcel database"]')).toContainText("reads");
  await expect(lookup.locator('[data-system="Legacy property system"]')).toContainText("replaces");

  await page.goto("/");
  await expect(page.locator("[data-module-card=ap-inbox]")).toContainText("Monday.com");
});
