import fs from "node:fs";
import path from "node:path";

// Workers have no filesystem, so the canned model outputs ship as one bundled JSON map
// per pack instead of a directory read at runtime. Regenerate after changing the seed:
// npm run seed:canned
const PACKS = ["ap-inbox", "invoice-description-writer"];
const root = process.cwd();

for (const pack of PACKS) {
  const dir = path.join(root, "packs", pack, "seed", "canned");
  if (!fs.existsSync(dir)) continue;
  const out: Record<string, unknown> = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    out[file.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  }
  const target = path.join(root, "packs", pack, "seed", "canned.json");
  fs.writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, target)}: ${Object.keys(out).length} canned outputs`);
}
