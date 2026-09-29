// Display formatting only. This pack does no arithmetic on amounts, but the formatter
// still works in integer cents so float noise never reaches the screen.

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** "$2,400.00" style, en-US grouping, always two decimals. */
export function formatAmount(amount: number): string {
  const cents = toCents(amount);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${String(rem).padStart(2, "0")}`;
}
