import { resetPaths } from "../lib/registry";

// Posts to every module's reset route on the running dev server (shared stores once).
const port = process.env.PORT ?? "3000";

async function main() {
  let failed = 0;
  for (const r of resetPaths()) {
    const url = `http://localhost:${port}${r.path}`;
    try {
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      console.log(`reset done: ${r.label}`);
    } catch (err) {
      failed++;
      console.error(`reset failed for ${r.label} (is the dev server running on port ${port}?): ${(err as Error).message}`);
    }
  }
  if (failed > 0) process.exit(1);
}

void main();
