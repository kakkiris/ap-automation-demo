// Small display helpers shared by the screens. No arithmetic here; amounts are display only.

export function fmtMoney(amount: number): string {
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Route failures answer { error: "<plain sentence>" }; useJson and postJson surface the body text. Pull the sentence out. */
export function errorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    return typeof parsed.error === "string" ? parsed.error : raw;
  } catch {
    return raw;
  }
}
