import type { NormalizedAddress } from "./types";

// Address normalisation shared by the Family Office AP modules. Pure: same text in, same
// NormalizedAddress out. Street suffixes are read in both their long and short forms
// and written short; unit designators become a bare unit; the tail is read as
// "city, ST zip", "city ST", "city, ST" or "city". Cities may have two words.

const SUFFIXES: Record<string, string> = {
  street: "st",
  st: "st",
  avenue: "ave",
  ave: "ave",
  av: "ave",
  drive: "dr",
  dr: "dr",
  court: "ct",
  ct: "ct",
  lane: "ln",
  ln: "ln",
  road: "rd",
  rd: "rd",
  place: "pl",
  pl: "pl",
  way: "way",
  boulevard: "blvd",
  blvd: "blvd",
};

const UNIT_WORDS = new Set(["unit", "apt", "apartment", "ste", "suite", "lot"]);

/** Midwest states the registry uses plus its neighbours. Kept small so no suffix (ct, st, ln) reads as a state. */
const STATES = new Set(["IL", "IN", "MO", "OH", "MI", "WI", "KY", "IA", "MN"]);

/** The registry's city list (packs/property-owner-lookup/lib/generate.ts), lower case, longest first so two-word names win. */
export const KNOWN_CITIES: readonly string[] = [
  "terre haute",
  "fort wayne",
  "south bend",
  "marion",
  "peoria",
  "hammond",
  "decatur",
  "springfield",
  "gary",
  "kokomo",
  "rockford",
  "anderson",
  "muncie",
  "danville",
  "joliet",
  "toledo",
  "dayton",
  "flint",
  "saginaw",
];

function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/#\s*/g, " unit ")
    .replace(/[.'"()]/g, "")
    .replace(/,/g, " , ")
    .replace(/[^a-z0-9,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.split(" ") : [];
}

export function normalizeAddress(text: string): NormalizedAddress {
  const raw = text;
  const tokens = tokenize(text ?? "");

  // Trailing zip, then trailing state.
  let zip: string | null = null;
  let state: string | null = null;
  const dropTrailingCommas = () => {
    while (tokens.length && tokens[tokens.length - 1] === ",") tokens.pop();
  };
  dropTrailingCommas();
  const last = tokens[tokens.length - 1] ?? "";
  if (/^\d{5}(-\d{4})?$/.test(last)) {
    zip = last.slice(0, 5);
    tokens.pop();
    dropTrailingCommas();
  }
  const maybeState = (tokens[tokens.length - 1] ?? "").toUpperCase();
  if (tokens.length > 1 && STATES.has(maybeState)) {
    state = maybeState;
    tokens.pop();
    dropTrailingCommas();
  }

  // House number, street words up to the suffix, unit, then the city.
  let i = 0;
  let houseNumber: string | null = null;
  if (i < tokens.length && /^\d+[a-z]?$/.test(tokens[i])) {
    houseNumber = tokens[i];
    i++;
  }

  const streetWords: string[] = [];
  let sawSuffix = false;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === ",") {
      i++;
      break;
    }
    if (UNIT_WORDS.has(t)) break;
    if (SUFFIXES[t] && streetWords.length > 0) {
      streetWords.push(SUFFIXES[t]);
      sawSuffix = true;
      i++;
      break;
    }
    // No suffix yet: stop if the remaining tokens spell a known city.
    if (!sawSuffix && streetWords.length > 0 && cityAt(tokens, i) !== null) break;
    streetWords.push(t);
    i++;
  }

  let unit: string | null = null;
  while (i < tokens.length && tokens[i] === ",") i++;
  if (i < tokens.length && UNIT_WORDS.has(tokens[i])) {
    const value = tokens[i + 1];
    if (value && value !== ",") {
      unit = value;
      i += 2;
    } else {
      i += 1;
    }
  }
  while (i < tokens.length && tokens[i] === ",") i++;

  const rest = tokens.slice(i).filter((t) => t !== ",");
  const city = rest.length ? rest.join(" ") : null;

  const street = streetWords.join(" ");
  const key = `${houseNumber ?? ""} ${street}|${unit ?? ""}|${city ?? ""}|${state ?? ""}`;
  return { raw, houseNumber, street, unit, city, state, zip, key };
}

function cityAt(tokens: string[], i: number): string | null {
  const rest = tokens.slice(i).filter((t) => t !== ",").join(" ");
  for (const c of KNOWN_CITIES) if (rest === c) return c;
  return null;
}
