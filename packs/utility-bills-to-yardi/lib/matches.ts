import type { Account, LineMatch, Store } from "../types";
import { logEvent, snapshot } from "./run";
import { indexStore } from "./status";

export interface AmbiguousItem {
  match: LineMatch;
  candidates: { account: Account; meter_id: string; unit_label: string | null; location_note: string | null }[];
}

// Legacy lines that matched by suffix with more than one account on the property.
export function ambiguousQueue(store: Store, upTo: string): AmbiguousItem[] {
  const ix = indexStore(store);
  return ix.ledger.ambiguous
    .filter((m) => m.line.post_month <= upTo)
    .sort((a, b) => (a.line.post_month < b.line.post_month ? -1 : a.line.post_month > b.line.post_month ? 1 : a.line.id < b.line.id ? -1 : 1))
    .map((match) => ({
      match,
      candidates: match.candidates.map((n) => {
        const account = store.accounts.find((a) => a.account_number === n)!;
        const meter = ix.meterById.get(account.meter_id)!;
        const unit = meter.unit_id ? ix.unitById.get(meter.unit_id) : null;
        return { account, meter_id: meter.id, unit_label: unit?.label ?? null, location_note: meter.location_note };
      }),
    }));
}

export function confirmMatch(store: Store, lineId: string, account_number: string): void {
  const line = store.ledger_lines.find((l) => l.id === lineId);
  if (!line) throw new Error(`line ${lineId} not found`);
  if (!store.accounts.some((a) => a.account_number === account_number)) throw new Error("account not on the master");
  snapshot(store, `confirm match ${lineId}`);
  line.confirmed_account = account_number;
  logEvent(store, { month: store.demo_month, mechanism: "confirm_matches", kind: "account_confirmed", count: 1, note: `${lineId} confirmed to ${account_number}` });
}
