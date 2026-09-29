import fs from "node:fs";
import path from "node:path";

// The run sheet page reads docs/walkthrough.md. Workers cannot read repo files at runtime, so the
// walkthrough is staged as a static asset that the page fetches.
const root = process.cwd();
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.copyFileSync(path.join(root, "docs", "walkthrough.md"), path.join(root, "public", "run-sheet.md"));
console.log("staged public/run-sheet.md from docs/walkthrough.md");
