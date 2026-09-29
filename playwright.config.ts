import { defineConfig } from "@playwright/test";

// Suite specs live in e2e/; each pack keeps its own under packs/<slug>/e2e/.
// One worker: every pack runs against one dev server and its own in-memory store.
export default defineConfig({
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000/", reuseExistingServer: true, timeout: 120_000 },
  reporter: [["list"]],
  projects: [
    { name: "suite", testDir: "e2e", testMatch: "**/*.spec.ts" },
    { name: "packs", testDir: "packs", testMatch: "**/e2e/**/*.spec.ts" },
  ],
});
