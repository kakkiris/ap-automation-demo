import { test, expect } from "@playwright/test";

const BASE = "/family-office-ap/property-owner-lookup";

test("Look up an owner resolves a parcel number and a cleaned address", async ({ page }) => {
  await page.goto(`${BASE}/look-up-an-owner`);
  await expect(page.getByRole("heading", { name: "Look up an owner" })).toBeVisible();
  await page.getByRole("textbox", { name: "Address or parcel" }).fill("P-12003");
  await page.getByRole("button", { name: "Look up" }).click();
  const out = page.getByTestId("parcel-lookup-result");
  await expect(out).toContainText("P-12003");
  await expect(out).toContainText("Owner");
  await expect(out).toContainText("cash account");
  await page.getByRole("textbox", { name: "Address or parcel" }).fill("45 hillcrest drive unit 2, peoria il");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(out).toContainText("P-12003");
});

test("Owner to entity map lists every owner with one entity code and cash account", async ({ page, request }) => {
  await page.goto(`${BASE}/owner-to-entity-map`);
  await expect(page.getByRole("heading", { name: "Owner to entity map" })).toBeVisible();
  const entities = await request.get("/api/family-office-ap/property-owner-lookup/entities").then((r) => r.json());
  expect(entities.entities.length).toBeGreaterThan(20);
  await expect(page.locator("[data-entity=E-001]")).toBeVisible();
  await expect(page.locator("[data-entity=E-101]")).toContainText("1000-2201");
  expect(await page.locator("[data-entity]").count()).toBe(entities.entities.length);
});
