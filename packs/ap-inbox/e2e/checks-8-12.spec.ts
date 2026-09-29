import { test, expect } from "@playwright/test";
import { BASE, LOAD, getItem, getJson, importFileLines, inboxRows, openExceptions, openInbox, openReview, reset, submitButton } from "./helpers";

// Acceptance checks 8 to 12 of the AP Inbox module: the five exception cards.

test("check 8: I-0003 is Unknown vendor; Create vendor returns it to Drafted with the ledger account empty", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openExceptions(page);

  const card = page.getByTestId("exception-card-I-0003");
  await expect(card.locator("h2")).toHaveText("Unknown vendor");
  await card.getByRole("button", { name: "Create vendor" }).click();
  await expect(card).toHaveCount(0);

  const item = await getItem(request, "I-0003");
  expect(item.item.state).toBe("Drafted");
  expect(item.draft.vendorMatch).not.toBeNull();
  expect(item.draft.glAccount).toBeNull();
  expect(item.draft.fieldSources.glAccount).toBeNull();
  expect(item.readiness.reasons).toContain("Fill in the ledger account");

  await openInbox(page);
  await expect(page.getByTestId("inbox-row-I-0003").getByTestId("state")).toHaveText("Drafted");

  await openReview(page, "I-0003");
  await expect(page.getByTestId("vendor-match")).toContainText("Bluewater Tree Removal");
  await expect(page.getByLabel("Ledger account", { exact: true })).toHaveValue("");
});

test("check 9: I-0009 is Possible duplicate of 4471; Skip sets Skipped and keeps it out of Ready for Yardi", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openExceptions(page);

  const card = page.getByTestId("exception-card-I-0009");
  await expect(card.locator("h2")).toHaveText("Possible duplicate of 4471");
  await expect(card.getByTestId("duplicate-of")).toContainText("4471");
  await card.getByRole("button", { name: "Skip" }).click();
  await expect(card).toHaveCount(0);

  const item = await getItem(request, "I-0009");
  expect(item.item.state).toBe("Skipped");

  await openInbox(page);
  await expect(page.getByTestId("inbox-row-I-0009").getByTestId("state")).toHaveText("Skipped");

  // Move the rest of the drafted week through so Ready for Yardi has a batch to show.
  await page.getByRole("button", { name: "Submit all ready drafts" }).click();
  await expect(page.getByText(/^\d+ submitted$/)).toBeVisible();
  await page.goto(`${BASE}/approve`);
  await expect(page.getByRole("button", { name: "Approve all" })).toBeEnabled({ timeout: LOAD });
  await page.getByRole("button", { name: "Approve all" }).click();
  await expect(page.getByText(/^\d+ approved\./)).toBeVisible();

  await page.goto(`${BASE}/ready-for-yardi`);
  await expect(page.getByTestId("invoice-count")).toBeVisible({ timeout: LOAD });
  await expect(page.locator('tr[data-testid^="ready-row-"]').first()).toBeVisible();
  await expect(page.getByTestId("ready-row-I-0009")).toHaveCount(0);
  await expect(page.getByTestId("import-preview")).not.toContainText("I-0009");

  const ready = await getJson<{ invoices: { itemId: string }[] }>(request, "/ready");
  expect(ready.invoices.map((r) => r.itemId)).not.toContain("I-0009");
  const lines = await importFileLines(request);
  expect(lines.filter((l) => l.includes("I-0009"))).toHaveLength(0);
});

test("check 10: I-0018 is Unknown utility account 5520-118; mapping to a parcel resolves it and the crosswalk keeps it; I-0022 was already mapped", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openExceptions(page);

  const card = page.getByTestId("exception-card-I-0018");
  await expect(card.locator("h2")).toHaveText("Unknown utility account 5520-118");
  await card.getByLabel("Search parcels").fill("P-10777");
  const row = card.locator("li", { hasText: "P-10777" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Map to this parcel" }).click();
  await expect(card).toHaveCount(0);

  const mapped = await getItem(request, "I-0018");
  expect(mapped.item.state).toBe("Drafted");
  expect(mapped.draft.propertyResolution?.parcelId).toBe("P-10777");
  expect(mapped.draft.propertyResolution?.method).toBe("utilityAccount");
  expect(mapped.draft.entity).not.toBeNull();
  expect(mapped.readiness.canSubmit).toBe(true);

  // The account stays in the crosswalk: a second read still resolves and no card comes back.
  const again = await getItem(request, "I-0018");
  expect(again.draft.propertyResolution?.parcelId).toBe("P-10777");
  const exceptions = await getJson<{ cards: { itemId: string }[] }>(request, "/exceptions");
  expect(exceptions.cards.map((c) => c.itemId)).not.toContain("I-0018");

  const auto = await getItem(request, "I-0022");
  expect(auto.item.state).toBe("Drafted");
  expect(auto.draft.propertyResolution?.parcelId).toBe("P-10231");
  expect(auto.draft.propertyResolution?.method).toBe("utilityAccount");

  await openReview(page, "I-0018");
  await expect(page.getByTestId("property-panel")).toContainText("P-10777");
  await expect(page.getByTestId("resolution-method")).toHaveText("utility account");
  await openReview(page, "I-0022");
  await expect(page.getByTestId("property-panel")).toContainText("P-10231");
  await expect(page.getByTestId("resolution-method")).toHaveText("utility account");
});

test("check 11: I-0021 is Amount unreadable; entering 175.00 completes the draft", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openExceptions(page);

  const card = page.getByTestId("exception-card-I-0021");
  await expect(card.locator("h2")).toHaveText("Amount unreadable");
  await card.getByLabel("Amount", { exact: true }).fill("175.00");
  await card.getByRole("button", { name: "Save amount" }).click();
  await expect(card).toHaveCount(0);

  const item = await getItem(request, "I-0021");
  expect(item.item.state).toBe("Drafted");
  expect(item.draft.amount).toBe(17500);
  expect(item.readiness.canSubmit).toBe(true);

  await openReview(page, "I-0021");
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("175.00");
  await expect(page.getByTestId("readiness")).toHaveText("Ready to submit");
  await expect(submitButton(page)).toBeEnabled();
});

test("check 12: I-0026 is Ambiguous owner, 2 candidates; choosing one resolves it", async ({ page, request }) => {
  await reset(request);
  await openInbox(page);
  await openExceptions(page);

  const card = page.getByTestId("exception-card-I-0026");
  await expect(card.locator("h2")).toHaveText("Ambiguous owner, 2 candidates");
  const candidates = card.locator('[data-testid^="owner-candidate-"]');
  await expect(candidates).toHaveCount(2);
  await expect(card.getByTestId("owner-candidate-P-11702")).toContainText("IL");
  await expect(card.getByTestId("owner-candidate-P-11950")).toContainText("MO");
  const first = await card.getByTestId("owner-candidate-P-11702").innerText();
  const second = await card.getByTestId("owner-candidate-P-11950").innerText();
  expect(first).not.toBe(second);

  await card.getByTestId("owner-candidate-P-11702").getByRole("button", { name: "Choose this owner" }).click();
  await expect(card).toHaveCount(0);

  const item = await getItem(request, "I-0026");
  expect(item.item.state).toBe("Drafted");
  expect(item.draft.propertyResolution?.parcelId).toBe("P-11702");
  expect(item.readiness.canSubmit).toBe(true);

  await openInbox(page);
  await expect(page.getByTestId("inbox-row-I-0026").getByTestId("state")).toHaveText("Drafted");
  await expect(inboxRows(page)).toHaveCount(26);
});
