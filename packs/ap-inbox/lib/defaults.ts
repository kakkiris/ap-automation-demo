import type { LedgerAccount, LedgerChoice, Vendor, VendorHistoryEntry } from "./types";

// Defaults from vendor history: the most recent invoice wins; when the last three
// disagree on the ledger account the draft shows all three and asks.

export interface VendorDefaults {
  glAccount: string | null;
  cashAccount: string | null;
  entityCode: string | null;
  ledgerChoices: LedgerChoice[] | null;
}

/** History most recent first, whatever order the record arrived in. */
export function historyNewestFirst(vendor: Vendor): VendorHistoryEntry[] {
  return [...vendor.history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function ledgerName(glAccount: string, ledgerAccounts: LedgerAccount[]): string {
  return ledgerAccounts.find((l) => l.glAccount === glAccount)?.name ?? glAccount;
}

export function vendorDefaults(vendor: Vendor | null | undefined, ledgerAccounts: LedgerAccount[] = []): VendorDefaults {
  if (!vendor) return { glAccount: null, cashAccount: null, entityCode: null, ledgerChoices: null };
  const history = historyNewestFirst(vendor);
  if (history.length === 0) {
    return { glAccount: vendor.lastGlAccount, cashAccount: vendor.lastCashAccount, entityCode: vendor.lastEntityCode, ledgerChoices: null };
  }
  const latest = history[0];
  const lastThree = history.slice(0, 3);
  const distinct = new Set(lastThree.map((h) => h.glAccount));
  if (lastThree.length === 3 && distinct.size === 3) {
    const ledgerChoices: LedgerChoice[] = lastThree.map((h) => ({
      glAccount: h.glAccount,
      name: ledgerName(h.glAccount, ledgerAccounts),
      date: h.date,
      invoiceNumber: h.invoiceNumber,
    }));
    return { glAccount: null, cashAccount: latest.cashAccount, entityCode: latest.entityCode, ledgerChoices };
  }
  return { glAccount: latest.glAccount, cashAccount: latest.cashAccount, entityCode: latest.entityCode, ledgerChoices: null };
}

/** The most recent history entry's ledger account for that charge type, else the vendor default. */
export function ledgerForChargeType(vendor: Vendor | null | undefined, chargeType: string | null, ledgerAccounts: LedgerAccount[] = []): string | null {
  if (!vendor) return null;
  const wanted = (chargeType ?? "").trim().toLowerCase();
  if (wanted) {
    const hit = historyNewestFirst(vendor).find((h) => (h.chargeType ?? "").trim().toLowerCase() === wanted);
    if (hit) return hit.glAccount;
  }
  return vendorDefaults(vendor, ledgerAccounts).glAccount;
}
