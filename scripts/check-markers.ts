import fs from "node:fs";
import path from "node:path";

// Suite-wide synthetic markers (the utility pack's patterns, applied to the whole repo):
// account numbers start 99, meter ids start M9, vendor codes start v99, property codes
// start 0999, GL codes (in JSON fields named *gl*) start 9.
//
// Per-pack markers: every packs/<slug>/markers.json adds rules for that pack's own
// identifiers, applied only inside the pack's scope directories. Shape:
// {
//   "pack": "<slug>",
//   "scope": ["packs/<slug>", "app/api/<leg>/<slug>", "app/<leg>/<slug>", "public/demo/<slug>"],
//   "rules": [{ "name": "invoice numbers", "match": "\\bINV\\d{6}\\b", "require": "^INV9" }],
//   "allow": ["literal tokens exempt from every rule inside the scope"]
// }
// "match" is a regular expression run over every text file in scope; each match must
// satisfy "require" unless the exact token is listed in "allow". The allow list also
// exempts tokens from the suite-wide rules inside that pack's scope, nowhere else.

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report", ".open-next", ".wrangler"]);
const SKIP_FILES = new Set(["package-lock.json"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".json", ".md", ".css", ".mjs", ".js", ".sh", ".txt", ".csv", ".svg"]);

type Rule = { name: string; match: RegExp; require: RegExp };
type PackMarkers = { pack: string; scope: string[]; rules: Rule[]; allow: Set<string> };

const GLOBAL_RULES: Rule[] = [
  { name: "account-like number", match: /\b\d{10}\b/g, require: /^99/ },
  { name: "meter-like id", match: /\bM\d{6,}\b/g, require: /^M9/ },
  { name: "vendor-like code", match: /\bv\d{4,}\b/g, require: /^v99/ },
  { name: "property-like code", match: /\b0\d{6}\b/g, require: /^0999/ },
];
const GL_FIELD = /"([a-z_]*gl[a-z_]*)"\s*:\s*"?(\d+)"?/g;

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (!SKIP_FILES.has(entry.name) && TEXT_EXT.has(path.extname(entry.name))) {
      yield path.join(dir, entry.name);
    }
  }
}

let bad = 0;
const report = (file: string, msg: string) => {
  console.log(`${path.relative(ROOT, file)}: ${msg}`);
  bad++;
};

function loadPackMarkers(): PackMarkers[] {
  const packsDir = path.join(ROOT, "packs");
  if (!fs.existsSync(packsDir)) return [];
  const out: PackMarkers[] = [];
  for (const entry of fs.readdirSync(packsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(packsDir, entry.name, "markers.json");
    if (!fs.existsSync(file)) continue;
    let raw: { pack?: unknown; scope?: unknown; rules?: unknown; allow?: unknown };
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      report(file, `not valid JSON: ${(err as Error).message}`);
      continue;
    }
    const pack = typeof raw.pack === "string" ? raw.pack : entry.name;
    const scope = Array.isArray(raw.scope) ? raw.scope.filter((s): s is string => typeof s === "string") : [];
    if (scope.length === 0) report(file, `"scope" must list at least one directory`);
    const rules: Rule[] = [];
    for (const r of Array.isArray(raw.rules) ? raw.rules : []) {
      const rr = r as { name?: unknown; match?: unknown; require?: unknown };
      if (typeof rr.match !== "string" || typeof rr.require !== "string") {
        report(file, `rule ${JSON.stringify(r)} needs string "match" and "require"`);
        continue;
      }
      try {
        rules.push({ name: typeof rr.name === "string" ? rr.name : rr.match, match: new RegExp(rr.match, "g"), require: new RegExp(rr.require) });
      } catch (err) {
        report(file, `rule ${rr.name ?? rr.match}: ${(err as Error).message}`);
      }
    }
    const allow = new Set(Array.isArray(raw.allow) ? raw.allow.filter((a): a is string => typeof a === "string") : []);
    out.push({ pack, scope: scope.map((s) => s.replace(/\/+$/, "")), rules, allow });
  }
  return out;
}

const packs = loadPackMarkers();

function packFor(file: string): PackMarkers | undefined {
  const rel = path.relative(ROOT, file);
  return packs.find((p) => p.scope.some((s) => rel === s || rel.startsWith(`${s}${path.sep}`)));
}

function applyRule(file: string, text: string, rule: Rule, allow: Set<string>, label: string) {
  for (const m of text.matchAll(rule.match)) {
    if (allow.has(m[0])) continue;
    if (!rule.require.test(m[0])) report(file, `${label}${rule.name} ${m[0]} does not match ${rule.require}`);
  }
}

const NONE = new Set<string>();
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, "utf8");
  const pack = packFor(file);
  const allow = pack?.allow ?? NONE;
  for (const rule of GLOBAL_RULES) applyRule(file, text, rule, allow, "");
  if (file.endsWith(".json")) {
    for (const m of text.matchAll(GL_FIELD)) {
      if (allow.has(m[2])) continue;
      if (!m[2].startsWith("9")) report(file, `GL field ${m[1]} value ${m[2]} does not start with 9`);
    }
  }
  if (pack) for (const rule of pack.rules) applyRule(file, text, rule, allow, `[${pack.pack}] `);
}

if (bad > 0) {
  console.log(`check:markers found ${bad} problem(s)`);
  process.exit(1);
}
const packNote = packs.length ? ` plus ${packs.length} pack marker file(s): ${packs.map((p) => p.pack).join(", ")}` : "";
console.log(`check:markers clean (suite rules${packNote})`);
