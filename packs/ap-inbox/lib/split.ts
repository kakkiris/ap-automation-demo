import type { SumCheck } from "./types";

// Equal split in integer cents with the remainder on the first line, and the sum check.

export function equalSplit(totalCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + remainder : base));
}

export function sumCheck(lines: readonly { amount: number | null }[], totalCents: number): SumCheck {
  let linesTotal = 0;
  let complete = true;
  for (const line of lines) {
    if (line.amount === null || line.amount === undefined) complete = false;
    else linesTotal += line.amount;
  }
  return { linesTotal, invoiceTotal: totalCents, ok: complete && lines.length > 0 && linesTotal === totalCents };
}
