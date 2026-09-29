import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

// Shared by the AP Inbox specs. Playwright only runs *.spec.ts, so this
// file carries the constants, the scripted week, and the small readers the checks share.

export const API = "/api/family-office-ap/ap-inbox";
export const BASE = "/family-office-ap/ap-inbox";

/** The first assertion after a navigation waits this long: the dev server compiles on first load. */
export const LOAD = 30_000;

export const SOURCE_MIX: Record<string, number> = { Email: 8, "Monday.com approved": 12, "Utility portal": 4, "Mail scan": 2 };
export const COUNTER_SLUGS = ["new", "drafted", "needs-attention", "submitted", "approved", "paid", "skipped"] as const;
export const FIELD_SOURCES = ["Read from document", "Vendor history", "Resolved from property", "Default", "You"];

export async function reset(request: APIRequestContext) {
  const res = await request.post(`${API}/reset`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { ok: boolean; items: number; states: Record<string, number> };
}

/** Open this week's arrivals and wait for the week to arrive; the counters only render once every item is drafted. */
export async function openInbox(page: Page) {
  await page.goto(`${BASE}/this-weeks-arrivals`);
  await expect(page.getByTestId("counter-drafted")).toBeVisible({ timeout: LOAD });
}

export async function counter(page: Page, slug: string): Promise<number> {
  const text = await page.getByTestId(`counter-${slug}`).innerText();
  const m = text.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : NaN;
}

export async function counters(page: Page): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const slug of COUNTER_SLUGS) out[slug] = await counter(page, slug);
  return out;
}

export async function getJson<T = Record<string, unknown>>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(`${API}${path}`);
  expect(res.ok(), `${path} answered ${res.status()}`).toBeTruthy();
  return (await res.json()) as T;
}

// Payload shapes the specs read; kept minimal on purpose.
export interface ItemJson {
  item: { itemId: string; state: string };
  draft: {
    payee: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    amount: number | null;
    glAccount: string | null;
    entity: string | null;
    fieldSources: Record<string, string | null>;
    vendorMatch: { vendorId: string; score: number } | null;
    propertyResolution: { parcelId: string; method: string } | null;
  };
  readiness: { canSubmit: boolean; reasons: string[] };
}

export const getItem = (request: APIRequestContext, itemId: string) => getJson<ItemJson>(request, `/items/${itemId}`);

/** Open Review an invoice for an item and wait for its state badge. */
export async function openReview(page: Page, itemId: string) {
  await page.goto(`${BASE}/review-an-invoice/${itemId}`);
  await expect(page.getByTestId("state")).toBeVisible({ timeout: LOAD });
}

export const submitButton = (page: Page) => page.getByRole("button", { name: "Submit", exact: true });

export async function submitReview(page: Page) {
  await expect(submitButton(page)).toBeEnabled();
  await submitButton(page).click();
  await expect(page.getByTestId("state")).toHaveText("Submitted");
}

export function lineRows(page: Page) {
  return page.locator('tr[data-testid^="line-"]');
}

export function inboxRows(page: Page) {
  return page.locator('tr[data-testid^="inbox-row-"]');
}

export function exceptionCards(page: Page) {
  return page.locator('[data-testid^="exception-card-"]');
}

/** The exception titles on the screen, in card order. */
export async function exceptionTitles(page: Page): Promise<string[]> {
  return exceptionCards(page).locator("h2").allInnerTexts();
}

export async function openExceptions(page: Page) {
  await page.goto(`${BASE}/needs-a-person`);
  await expect(page.getByTestId("open-count")).toBeVisible({ timeout: LOAD });
}

/** The tab-separated import file, split into non-empty lines. */
export async function importFileLines(request: APIRequestContext): Promise<string[]> {
  const res = await request.get(`${API}/ready/file`);
  expect(res.ok()).toBeTruthy();
  const text = await res.text();
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** "Total 14,523.10" or "14,523.10" to cents. */
export function centsOf(text: string): number {
  const m = text.replace(/,/g, "").match(/(\d+)\.(\d{2})/);
  if (!m) throw new Error(`No amount in "${text}"`);
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
}

export function firstNumber(text: string): number {
  const m = text.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
}

/** A small valid PDF for the unscripted upload in check 15. */
export async function buildPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText("Invoice, added during the demo", { x: 50, y: 740, size: 16, font });
  page.drawText("Total 125.00", { x: 50, y: 700, size: 12, font });
  return Buffer.from(await doc.save());
}

export interface WeekSummary {
  arrivalCounters: Record<string, number>;
  inboxRows: number;
  exceptionTitles: string[];
  submittedAll: number;
  approvedAll: number;
  invoiceCount: number;
  lineCount: number;
  batchTotalCents: number;
  fileRows: number;
  batchPaidText: string;
}

/**
 * The presenter script from beat 1 to Mark batch paid, through the real screens.
 * Starts with a reset through the request fixture. Returns a plain summary so a
 * second run can be compared with the first.
 */
export async function runScriptedWeek(page: Page, request: APIRequestContext): Promise<WeekSummary> {
  await reset(request);

  // Beat 1, this week's arrivals.
  await openInbox(page);
  const arrivalCounters = await counters(page);
  const rows = await inboxRows(page).count();

  // Beat 2 and 3, single invoices.
  await openReview(page, "I-0005");
  await submitReview(page);
  await openReview(page, "I-0011");
  await submitReview(page);

  // Beat 4, splitter.
  await openReview(page, "I-0007");
  const line1 = page.getByTestId("line-1");
  await expect(line1.getByTestId("line-flag")).toBeVisible();
  await line1.getByRole("button", { name: "Create property" }).click();
  await expect(page.getByTestId("line-flag")).toHaveCount(0);
  await submitReview(page);
  await openReview(page, "I-0012");
  await submitReview(page);

  // Beat 5, Needs a person.
  await openExceptions(page);
  await expect(exceptionCards(page).first()).toBeVisible();
  const titles = await exceptionTitles(page);

  const unknownVendor = page.getByTestId("exception-card-I-0003");
  await unknownVendor.getByRole("button", { name: "Create vendor" }).click();
  await expect(unknownVendor).toHaveCount(0);

  const utility = page.getByTestId("exception-card-I-0018");
  await utility.getByLabel("Search parcels").fill("P-10777");
  await utility.locator("li", { hasText: "P-10777" }).getByRole("button", { name: "Map to this parcel" }).click();
  await expect(utility).toHaveCount(0);

  const duplicate = page.getByTestId("exception-card-I-0009");
  await duplicate.getByRole("button", { name: "Skip" }).click();
  await expect(duplicate).toHaveCount(0);

  const ambiguous = page.getByTestId("exception-card-I-0026");
  await ambiguous.getByTestId("owner-candidate-P-11702").getByRole("button", { name: "Choose this owner" }).click();
  await expect(ambiguous).toHaveCount(0);

  // The new vendor has no history, so the ledger account is picked by hand.
  await openReview(page, "I-0003");
  await page.getByLabel("Ledger account", { exact: true }).selectOption("9200-3600");
  await expect(page.getByTestId("source-glAccount")).toHaveText("You");
  await submitReview(page);

  // The grey mail scan: confirm the amount, then submit.
  await openReview(page, "I-0019");
  await page.getByRole("button", { name: "Confirm amount" }).click();
  await submitReview(page);

  // The rest of the drafted week.
  await openInbox(page);
  await page.getByRole("button", { name: "Submit all ready drafts" }).click();
  const submittedNote = page.getByText(/^\d+ submitted$/);
  await expect(submittedNote).toBeVisible();
  const submittedAll = firstNumber(await submittedNote.innerText());

  // Beat 6, Approve then Ready for Yardi.
  await page.goto(`${BASE}/approve`);
  await expect(page.getByRole("button", { name: "Approve all" })).toBeEnabled({ timeout: LOAD });
  await page.getByRole("button", { name: "Approve all" }).click();
  const approvedNote = page.getByText(/^\d+ approved\./);
  await expect(approvedNote).toBeVisible();
  const approvedAll = firstNumber(await approvedNote.innerText());

  await page.goto(`${BASE}/ready-for-yardi`);
  await expect(page.getByTestId("invoice-count")).toBeVisible({ timeout: LOAD });
  const invoiceCount = firstNumber(await page.getByTestId("invoice-count").innerText());
  const lineCount = firstNumber(await page.getByTestId("line-count").innerText());
  const batchTotalCents = centsOf(await page.getByTestId("batch-total").innerText());
  const fileLines = await importFileLines(request);
  const fileRows = fileLines.length - 1;

  await page.getByRole("button", { name: "Mark batch paid" }).click();
  await expect(page.getByTestId("batch-paid")).toBeVisible();
  const batchPaidText = (await page.getByTestId("batch-paid").innerText()).trim();

  return { arrivalCounters, inboxRows: rows, exceptionTitles: titles, submittedAll, approvedAll, invoiceCount, lineCount, batchTotalCents, fileRows, batchPaidText };
}
