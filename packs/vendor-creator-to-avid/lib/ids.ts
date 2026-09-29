// Identifier formats for the vendor master sync. Every id minted at run time comes from a
// counter in the store, never from the clock or from randomness.

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** V-Y-0125 shape: the Yardi vendor id for a counter value. */
export function yardiId(n: number): string {
  return `V-Y-${pad(n, 4)}`;
}

/** V-A-0113 shape: the Avid vendor id for a counter value. */
export function avidId(n: number): string {
  return `V-A-${pad(n, 4)}`;
}

/** R-001 shape. */
export function runId(n: number): string {
  return `R-${pad(n, 3)}`;
}

/** T-001 shape. */
export function taskId(n: number): string {
  return `T-${pad(n, 3)}`;
}

/** Four fake tax digits for a vendor created in the form, derived from its counter value. */
export function fakeTaxLast4(n: number): string {
  return pad((n * 7919) % 10000, 4);
}
