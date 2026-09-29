// Name and address normalization for the vendor master sync.
// Pure functions, no clock, no randomness. Both the seed generator and the matcher use these,
// so the seed's scripted outcomes and the running matcher can never disagree.
//
// Normalization, per the pack: lowercase, strip punctuation, collapse whitespace, strip legal
// suffixes (llc, inc, corp, co, ltd) from the end, and drop a leading "the".
// Hyphens and slashes become spaces; every other punctuation mark is removed, so
// "P.W. Maintenance" and "PW Maintenance LLC" both become "pw maintenance".

const LEGAL_SUFFIXES = new Set(["llc", "inc", "corp", "co", "ltd"]);

/** Token overlap at or above this value holds a pair as a near match. */
export const NEAR_MATCH_THRESHOLD = 0.85;

/** Lowercase, punctuation stripped, whitespace collapsed. No suffix handling. */
export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[-/]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Full name normalization: normalizeText, then drop a leading "the" and trailing legal suffixes. */
export function normalizeName(raw: string): string {
  const tokens = normalizeText(raw).split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens[0] === "the") tokens.shift();
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

export function normalizeAddress(raw: string): string {
  return normalizeText(raw);
}

export function nameTokens(raw: string): string[] {
  const n = normalizeName(raw);
  return n ? n.split(" ") : [];
}

/** Shared tokens over the smaller token set. 1 when one name's tokens all appear in the other. */
export function tokenOverlap(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return Math.round((shared / Math.min(ta.size, tb.size)) * 100) / 100;
}

export function sameNormalizedName(a: string, b: string): boolean {
  const na = normalizeName(a);
  return na !== "" && na === normalizeName(b);
}

export function sameAddress(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b);
}

/** Same name once normalized, but the raw spellings differ (suffix or punctuation). */
export function suffixDiffers(a: string, b: string): boolean {
  return sameNormalizedName(a, b) && normalizeText(a) !== normalizeText(b);
}
