import type { Vendor, VendorCandidate } from "./types";

// Vendor matching: normalised name plus the alias table, then token similarity with a
// 0.85 threshold. Scores are two-decimal numbers computed in integer hundredths.

export const VENDOR_THRESHOLD = 0.85;

const LEGAL = new Set(["company", "llc", "inc", "corp", "ltd"]);
const EXPAND: Record<string, string> = { co: "company", svc: "services", svcs: "services" };

export function normaliseVendorName(name: string): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => EXPAND[t] ?? t)
    .join(" ");
}

function parts(normalised: string): { core: Set<string>; legal: Set<string> } {
  const core = new Set<string>();
  const legal = new Set<string>();
  for (const t of normalised.split(" ").filter(Boolean)) (LEGAL.has(t) ? legal : core).add(t);
  return { core, legal };
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function bigrams(s: string): Map<string, number> {
  const text = s.replace(/\s+/g, "");
  const out = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const g = text.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

function dice(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  let total = 0;
  let shared = 0;
  for (const [g, n] of ga) {
    total += n;
    shared += Math.min(n, gb.get(g) ?? 0);
  }
  for (const n of gb.values()) total += n;
  return total === 0 ? 0 : (2 * shared) / total;
}

/** Similarity of a document name to a master name, in hundredths. */
function similarityHundredths(docNorm: string, masterNorm: string): number {
  const d = parts(docNorm);
  const m = parts(masterNorm);
  if (d.core.size > 0 && m.core.size > 0 && (isSubset(d.core, m.core) || isSubset(m.core, d.core))) {
    let omittedLegal = 0;
    for (const t of m.legal) if (!d.legal.has(t)) omittedLegal++;
    let omittedCore = 0;
    for (const t of m.core) if (!d.core.has(t)) omittedCore++;
    let extraCore = 0;
    for (const t of d.core) if (!m.core.has(t)) extraCore++;
    return Math.max(0, 100 - 6 * omittedLegal - 20 * omittedCore - 10 * extraCore);
  }
  let shared = 0;
  for (const t of d.core) if (m.core.has(t)) shared++;
  const union = d.core.size + m.core.size - shared;
  const jaccard = union === 0 ? 0 : shared / union;
  // Token overlap scaled to stay below the threshold; the bigram share only orders the near misses.
  return Math.round(jaccard * 80 + dice(docNorm, masterNorm) * 4);
}

export function scoreVendor(documentName: string, vendor: Vendor): number {
  const doc = normaliseVendorName(documentName);
  const master = normaliseVendorName(vendor.name);
  let h = similarityHundredths(doc, master);
  const exact = doc.length > 0 && (doc === master || vendor.aliases.some((a) => normaliseVendorName(a) === doc));
  if (exact) h = Math.max(h, 85);
  return h / 100;
}

export interface VendorMatchResult {
  match: VendorCandidate | null;
  candidates: VendorCandidate[];
}

/** The best master vendor for a document name at or above the threshold, plus the three closest names. */
export function matchVendor(documentName: string | null | undefined, vendors: Vendor[]): VendorMatchResult {
  const text = (documentName ?? "").trim();
  if (!text) return { match: null, candidates: [] };
  const scored: VendorCandidate[] = vendors.map((v) => ({ vendorId: v.vendorId, name: v.name, score: scoreVendor(text, v) }));
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const top = scored[0];
  const match = top && top.score >= VENDOR_THRESHOLD ? top : null;
  return { match, candidates: scored.slice(0, 3) };
}
