import type { Exception, Store } from "../types";
import { accountStart, createLandlordAccount, logEvent, snapshot } from "./run";

export type ExceptionAction =
  | { kind: "accept" }
  | { kind: "pick"; meter_id: string }
  | { kind: "skip" }
  | { kind: "swap" }
  | { kind: "keep_master" }
  | { kind: "keep_first" }
  | { kind: "drop_second" }
  | { kind: "keep_both"; note?: string }
  | { kind: "acknowledge"; reason: "vacant but in use" | "rate change" | "meter issue" };

const ORDER: Record<Exception["type"], number> = { unmapped: 0, meter_differs: 1, duplicate: 2, unusual_amount: 3, ambiguous_import: 4 };

export function queue(store: Store, month: string): Exception[] {
  return store.exceptions
    .filter((e) => e.month === month && (e.status === "open" || e.status === "skipped"))
    .sort((a, b) => (a.status !== b.status ? (a.status === "open" ? -1 : 1) : ORDER[a.type] !== ORDER[b.type] ? ORDER[a.type] - ORDER[b.type] : a.id < b.id ? -1 : 1));
}

export function blockedDuplicates(store: Store, month: string): Exception[] {
  return store.exceptions.filter((e) => e.month === month && e.type === "duplicate" && e.status === "open");
}

export function resolveException(store: Store, id: string, action: ExceptionAction): Exception {
  const ex = store.exceptions.find((e) => e.id === id);
  if (!ex) throw new Error(`exception ${id} not found`);
  if (ex.status === "resolved") throw new Error(`exception ${id} is already resolved`);
  snapshot(store, `resolve ${ex.type} ${ex.id}`);
  const bill = ex.bill_id ? store.bills.find((b) => b.id === ex.bill_id) ?? null : null;
  if (action.kind === "skip") {
    ex.status = "skipped";
    return ex;
  }
  switch (ex.type) {
    case "unmapped":
    case "ambiguous_import": {
      const meterId = action.kind === "pick" ? action.meter_id : action.kind === "accept" ? ex.suggestion?.meter_id : null;
      if (!meterId) throw new Error("pick a meter or accept the suggestion");
      const meter = store.meters.find((m) => m.id === meterId);
      if (!meter) throw new Error(`meter ${meterId} not found`);
      if (meter.property_id !== ex.property_id) throw new Error("pick a meter at the bill's site");
      if (!store.accounts.some((a) => a.account_number === ex.account_number)) {
        createLandlordAccount(store, meterId, ex.account_number!, accountStart(store, meterId, bill?.service_start ?? `${ex.month}-01`));
        logEvent(store, { month: ex.month, mechanism: "exceptions", kind: "account_added", count: 1, note: `${ex.account_number} placed on ${meterId} from the queue` });
      }
      if (bill) {
        bill.meter_id = meterId;
        bill.status = "matched";
      }
      const printed = String(ex.details.meter_as_printed ?? "");
      if (printed && !meter.meter_number) {
        meter.meter_number = printed;
        logEvent(store, { month: ex.month, mechanism: "exceptions", kind: "meter_number_filled", count: 1, note: `${meterId} meter number from bill` });
      }
      ex.resolution = `matched to ${meterId}`;
      break;
    }
    case "meter_differs": {
      const meter = store.meters.find((m) => m.id === ex.meter_id)!;
      if (action.kind === "swap") {
        const from = meter.meter_number;
        meter.meter_number = String(ex.details.printed);
        meter.notes.push(`Meter swapped: ${from ?? "blank"} replaced by ${meter.meter_number}, confirmed from bill ${ex.bill_id} (${ex.month})`);
        ex.resolution = "swap confirmed";
      } else if (action.kind === "keep_master") {
        ex.resolution = "master kept";
      } else throw new Error("confirm the swap or keep the master");
      break;
    }
    case "duplicate": {
      if (!bill) throw new Error("duplicate exception without a bill");
      if (action.kind === "keep_first" || action.kind === "drop_second") {
        bill.status = "blocked";
        ex.resolution = "second copy dropped";
      } else if (action.kind === "keep_both") {
        const first = store.bills.find((b) => b.id === bill.duplicate_of);
        bill.meter_id = first?.meter_id ?? bill.meter_id;
        bill.status = "matched";
        ex.resolution = `both kept${action.note ? `: ${action.note}` : ""}`;
      } else throw new Error("keep first, drop second, or keep both");
      break;
    }
    case "unusual_amount": {
      if (action.kind !== "acknowledge") throw new Error("acknowledge with a reason");
      ex.resolution = action.reason;
      if (action.reason === "vacant but in use" && ex.meter_id) {
        store.verify_items.push({ id: `VI-${store.verify_items.length + 1}`, month: ex.month, meter_id: ex.meter_id, property_id: ex.property_id, reason: "vacant but in use, verify the unit" });
      }
      break;
    }
  }
  ex.status = "resolved";
  return ex;
}
