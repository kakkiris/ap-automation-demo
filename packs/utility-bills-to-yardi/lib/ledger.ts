import type { Account, Bill, LedgerLine, LineMatch, MatchKind, Store } from "../types";

export const ACCOUNT_RE = /\b(99\d{8})\b/;
const LEADING_DIGITS = /^(\d+)/;

// Scheme-era invoice number: the full account number, a hyphen, and the bill date.
export function schemeInvoice(account_number: string, invoiceDate: string): string {
  return `${account_number}-${invoiceDate.replace(/-/g, "")}`;
}

export function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

// Match one ledger line against the accounts on its property.
export function matchLine(line: LedgerLine, accountsOnProperty: Account[]): LineMatch {
  const numbers = accountsOnProperty.map((a) => a.account_number);
  if (line.confirmed_account) {
    return { line, kind: "confirmed", account_number: line.confirmed_account, candidates: [line.confirmed_account] };
  }
  const full = ACCOUNT_RE.exec(line.invoice_number) ?? ACCOUNT_RE.exec(line.description);
  if (full) {
    const acct = full[1];
    return { line, kind: "exact", account_number: acct, candidates: [acct] };
  }
  const lead = LEADING_DIGITS.exec(line.invoice_number);
  if (lead && (lead[1].length === 5 || lead[1].length === 4)) {
    const suffix = lead[1];
    const candidates = numbers.filter((n) => n.endsWith(suffix));
    if (candidates.length === 1) return { line, kind: "partial", account_number: candidates[0], candidates };
    if (candidates.length > 1) return { line, kind: "needs_confirmation", account_number: null, candidates };
  }
  return { line, kind: "unplaced", account_number: null, candidates: [] };
}

export interface LedgerIndex {
  matches: LineMatch[];
  byAccountMonth: Map<string, LineMatch[]>;
  byInvoice: Map<string, LedgerLine[]>;
  unplaced: LedgerLine[];
  ambiguous: LineMatch[];
}

export function indexLedger(store: Pick<Store, "ledger_lines" | "accounts">): LedgerIndex {
  const accountsByProperty = new Map<string, Account[]>();
  for (const a of store.accounts) {
    const list = accountsByProperty.get(propertyOfAccount(a)) ?? [];
    list.push(a);
    accountsByProperty.set(propertyOfAccount(a), list);
  }
  const matches: LineMatch[] = [];
  const byAccountMonth = new Map<string, LineMatch[]>();
  const byInvoice = new Map<string, LedgerLine[]>();
  const unplaced: LedgerLine[] = [];
  const ambiguous: LineMatch[] = [];
  for (const line of store.ledger_lines) {
    if (line.gl_name === "Utility deposits") continue;
    const m = matchLine(line, accountsByProperty.get(line.property_id) ?? []);
    matches.push(m);
    const inv = byInvoice.get(line.invoice_number) ?? [];
    inv.push(line);
    byInvoice.set(line.invoice_number, inv);
    if (m.kind === "unplaced") unplaced.push(line);
    else if (m.kind === "needs_confirmation") ambiguous.push(m);
    else {
      const key = `${m.account_number}|${line.post_month}`;
      const list = byAccountMonth.get(key) ?? [];
      list.push(m);
      byAccountMonth.set(key, list);
    }
  }
  return { matches, byAccountMonth, byInvoice, unplaced, ambiguous };
}

// Accounts do not carry a property id; the index needs one, so callers pass
// accounts whose meter ids resolve through the store. To keep this module pure we
// accept an accounts array that already carries `property_id` via a side map.
const propertyByAccount = new WeakMap<Account, string>();
export function tagAccountProperty(account: Account, property_id: string): Account {
  propertyByAccount.set(account, property_id);
  return account;
}
function propertyOfAccount(a: Account): string {
  return propertyByAccount.get(a) ?? "";
}

export function linesFor(ix: LedgerIndex, account_number: string, month: string): LineMatch[] {
  return ix.byAccountMonth.get(`${account_number}|${month}`) ?? [];
}

// Paid means the lines under the bill's invoice number sum to the bill amount.
// With no bill on record, any matched line for the month counts.
export function paidState(bill: Bill | null, lines: LineMatch[], ix: LedgerIndex): { paid: boolean; sum: number; kind: MatchKind | null } {
  if (bill?.invoice_number) {
    const under = ix.byInvoice.get(bill.invoice_number) ?? [];
    const sum = Math.round(under.reduce((n, l) => n + l.amount, 0) * 100) / 100;
    return { paid: under.length > 0 && sameAmount(sum, bill.amount), sum, kind: under.length > 0 ? "exact" : null };
  }
  const sum = Math.round(lines.reduce((n, m) => n + m.line.amount, 0) * 100) / 100;
  const kinds = lines.map((m) => m.kind);
  const kind: MatchKind | null = kinds.length === 0 ? null : kinds.includes("partial") ? "partial" : kinds.includes("confirmed") ? "confirmed" : "exact";
  return { paid: lines.length > 0, sum, kind };
}

// Deposit lines for an account, read straight from the ledger (never part of the payment index).
export function depositsFor(store: Pick<Store, "ledger_lines">, account_number: string): LedgerLine[] {
  return store.ledger_lines.filter((l) => l.gl_name === "Utility deposits" && (l.description.includes(account_number) || l.invoice_number.endsWith(account_number.slice(-5))));
}
