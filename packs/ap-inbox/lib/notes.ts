import type { Extraction } from "./types";

// The notes template: one line under twenty words, in the specialist's words.

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** Number words for two to twelve, digits above. */
export function numberWord(n: number): string {
  return n >= 2 && n <= 12 ? WORDS[n] : String(n);
}

function capitalise(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function cap(s: string, maxWords: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

export function isOfficeExtraction(extraction: Extraction): boolean {
  const hasAddress = extraction.serviceAddressLines.some((l) => l.trim().length > 0);
  const hasLines = extraction.lineItems.some((l) => l.address);
  return !hasAddress && extraction.parcelRefs.length === 0 && !extraction.utilityAccountNumber && !hasLines;
}

export function notesTemplate(extraction: Extraction, lineCount: number): string {
  const hint = (extraction.notesHint ?? "").trim();
  if (lineCount >= 2) {
    const noun = extraction.kind === "list" ? "lots" : "properties";
    const head = hint ? cap(hint, 12) : extraction.kind === "statement" ? "Monthly statement" : "Service";
    // A hint that already says how many ("Lawn service, three lots") is kept as it is.
    if (/,\s*\S+\s+(lots|properties)$/i.test(head)) return capitalise(head);
    return capitalise(`${head}, ${numberWord(lineCount)} ${noun}`);
  }
  if (hint) return capitalise(cap(hint, 19));
  if (isOfficeExtraction(extraction)) return "Office supplies";
  if (extraction.utilityAccountNumber) return "Utility service";
  return "Property service";
}
