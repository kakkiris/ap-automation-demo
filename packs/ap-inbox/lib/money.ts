// Money is integer cents everywhere. Text in, cents out; cents in, text out.

/** "6,988.40" or "$1,900.00" or "175" to integer cents; null when the text is not an amount. */
export function parseMoney(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const cleaned = String(text).replace(/[$,\s]/g, "");
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const dollars = parseInt(m[2], 10);
  const cents = m[3] ? parseInt(m[3].padEnd(2, "0"), 10) : 0;
  const value = dollars * 100 + cents;
  return m[1] ? -value : value;
}

/** What the specialist types into an amount box. */
export function dollarsToCents(text: string | null | undefined): number | null {
  return parseMoney(text);
}

/** Integer cents to "6,988.40": en-US grouping, two decimals, no currency sign. */
export function fmtCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}.${String(rem).padStart(2, "0")}`;
}

/** Integer cents to "6988.40": the form the import file carries. */
export function fmtCentsPlain(cents: number): string {
  return fmtCents(cents).replace(/,/g, "");
}
