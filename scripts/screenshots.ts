import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { resetPaths } from "../lib/registry";

// The README screenshots, taken from a running dev server: npm run dev, then npm run screenshots.
// Every demo is reset first, so the images always show the seeded story.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "screenshots");

// Opens a screen with the Next.js dev badge hidden, so it never sits on top of the sidebar.
async function go(page: Page, url: string) {
  await page.goto(url);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`wrote docs/screenshots/${name}.png`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
  for (const { path: p } of resetPaths()) await page.request.post(`${BASE}${p}`);

  await go(page, `${BASE}/`);
  await shot(page, "demo-home");

  await go(page, `${BASE}/family-office-ap/ap-inbox/split-across-properties/I-0007`);
  await page.getByText("Split across properties: I-0007").first().waitFor();
  await shot(page, "ap-inbox-splitter");

  await go(page, `${BASE}/industrial-ap/utility-bills-to-yardi/capture-this-months-bills`);
  await page.getByRole("button", { name: /^Run Aug 2026/ }).click();
  await page.getByText(/Duplicate period, blocked from export: 1/).waitFor({ timeout: 20_000 });
  await shot(page, "utility-bills-run");

  await go(page, `${BASE}/industrial-ap/utility-payment-reconciliation/one-property-month-by-month/P01`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot(page, "paid-or-not-grid");

  await go(page, `${BASE}/industrial-ap/invoice-description-writer/receive-todays-invoices`);
  await page.getByRole("button", { name: "Receive invoices", exact: true }).click();
  await page.getByText("Today's invoices are in.").waitFor();
  await go(page, `${BASE}/industrial-ap/invoice-description-writer/write-the-invoice-description?id=INV-3007`);
  await page.getByTestId("invoice-status").waitFor();
  await shot(page, "invoice-description-writer");

  await go(page, `${BASE}/industrial-ap/vendor-creator-to-avid/decide-the-near-matches`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot(page, "vendor-near-matches");

  for (const { path: p } of resetPaths()) await page.request.post(`${BASE}${p}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
