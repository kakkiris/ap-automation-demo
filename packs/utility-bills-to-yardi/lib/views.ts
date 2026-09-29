import type { Bill, Exception, Store } from "../types";
import { cellFor, gridRows, indexStore, rowFlags, siteSummaries, totalCounts, whyStatus, windowMonths, unplacedLines, activeAccount } from "./status";
import { depositsFor, linesFor } from "./ledger";
import { inRange, mid } from "./dates";
import { monthStepper } from "./mechanisms";
import { queue, blockedDuplicates } from "./exceptions";
import { ambiguousQueue } from "./matches";

export function operatorSteps(store: Store, month: string) {
  const run = store.runs[month] ?? null;
  const open = queue(store, month).filter((e) => e.status === "open").length;
  return {
    run: Boolean(run),
    exceptions: Boolean(run) && open === 0,
    export: Boolean(run?.exported),
    import: Boolean(run?.imported),
    matches: Boolean(run?.imported) && ambiguousQueue(store, month).length === 0,
    done: Boolean(store.operator_steps.done),
    open_exceptions: open,
    blocked: blockedDuplicates(store, month).length,
  };
}

export function stripView(store: Store) {
  const ix = indexStore(store);
  const summaries = siteSummaries(ix, store.demo_month);
  return {
    demo_month: store.demo_month,
    summaries,
    totals: totalCounts(summaries),
    stepper: monthStepper(store),
    run: store.runs[store.demo_month] ?? null,
    provider_import_done: store.provider_import_done,
    site_visit_done: store.site_visit_done,
    can_step: store.months.includes(nextMonth(store.demo_month)),
    undo_label: store.undo_label,
  };
}

function nextMonth(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  const idx = y * 12 + mm;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function exceptionView(store: Store, e: Exception) {
  const bill = e.bill_id ? store.bills.find((b) => b.id === e.bill_id) ?? null : null;
  const property = store.properties.find((p) => p.id === e.property_id)!;
  const unitById = new Map(store.units.map((u) => [u.id, u]));
  const label = (id: string | null) => {
    if (!id) return null;
    const m = store.meters.find((x) => x.id === id);
    if (!m) return id;
    const u = m.unit_id ? unitById.get(m.unit_id) : null;
    return `${m.id}${u ? `, unit ${u.label}` : m.location_note ? `, ${m.location_note}` : ""}${m.meter_number ? `, meter ${m.meter_number}` : ", no meter number"}`;
  };
  const candidates = store.meters
    .filter((m) => m.property_id === e.property_id && m.kind !== "shared" && (!bill || store.providers.find((p) => p.name === bill.provider)?.service_type === m.service_type))
    .sort((x, y) => {
      const xa = store.accounts.some((a) => a.meter_id === x.id) ? 1 : 0;
      const ya = store.accounts.some((a) => a.meter_id === y.id) ? 1 : 0;
      if (xa !== ya) return xa - ya;
      return (x.unit_id ?? "") < (y.unit_id ?? "") ? -1 : 1;
    })
    .map((m) => ({ id: m.id, label: label(m.id)!, has_account: store.accounts.some((a) => a.meter_id === m.id) }));
  return { ...e, bill, property_name: property.name, suggestion_label: label(e.suggestion?.meter_id ?? null), meter_label: label(e.meter_id), candidates };
}

export function gridView(store: Store, propertyId: string) {
  const ix = indexStore(store);
  const property = ix.propertyById.get(propertyId);
  if (!property) return null;
  const month = store.demo_month;
  return {
    property,
    months: windowMonths(ix, month),
    demo_month: month,
    rows: gridRows(ix, propertyId, month),
    unmapped: ix.openExceptions.filter((e) => e.type === "unmapped" && e.property_id === propertyId).map((e) => exceptionView(store, e)),
    imported: Boolean(store.runs[month]?.imported),
  };
}

export function whyView(store: Store, meterId: string, month: string) {
  const ix = indexStore(store);
  const meter = ix.meterById.get(meterId);
  if (!meter) return null;
  return whyStatus(ix, meter, month);
}

export function meterView(store: Store, meterId: string) {
  const ix = indexStore(store);
  const meter = store.meters.find((m) => m.id === meterId);
  if (!meter) return null;
  const month = store.demo_month;
  const months = windowMonths(ix, month);
  const unit = meter.unit_id ? (ix.unitById.get(meter.unit_id) ?? null) : null;
  const accounts = [...(ix.accountsByMeter.get(meter.id) ?? [])].sort((a, b) => (a.active_from < b.active_from ? -1 : 1));
  const cells = months.map((m) => cellFor(ix, meter, m));
  const lineById = new Map(store.ledger_lines.map((l) => [l.id, l]));
  const kindByLine = new Map(ix.ledger.matches.map((m) => [m.line.id, m.kind]));
  const lines = Object.fromEntries(cells.map((c) => [c.month, c.line_ids.map((id) => ({ ...lineById.get(id)!, kind: kindByLine.get(id) ?? "exact" }))]));
  const deposits = accounts.flatMap((a) => depositsFor(store, a.account_number).map((l) => ({ account_number: a.account_number, amount: l.amount, post_month: l.post_month, invoice_number: l.invoice_number })));
  const exception = store.exceptions.find((e) => e.status !== "resolved" && (e.meter_id === meter.id || (e.suggestion?.meter_id === meter.id))) ?? null;
  return {
    meter, unit, property: ix.propertyById.get(meter.property_id)!, provider: store.providers.find((p) => p.name === meter.provider) ?? null,
    accounts, cells, lines, deposits, flags: rowFlags(ix, meter, month), months, demo_month: month, exception: exception ? exceptionView(store, exception) : null,
    units_served: meter.units_served.map((id) => ix.unitById.get(id)!).filter(Boolean),
    why: whyStatus(ix, meter, month),
  };
}

export function masterView(store: Store, propertyId: string) {
  const ix = indexStore(store);
  const property = ix.propertyById.get(propertyId);
  if (!property) return null;
  const month = store.demo_month;
  const d = mid(month);
  const rows = gridRows(ix, propertyId, month).map((r) => {
    const accounts = ix.accountsByMeter.get(r.meter.id) ?? [];
    const current = accounts.find((a) => inRange(d, a.active_from, a.active_to)) ?? null;
    return { meter: r.meter, unit: r.unit, flags: r.flags, current, history_count: accounts.length, cell: r.cells[r.cells.length - 1] };
  });
  return { property, rows, unmapped: ix.openExceptions.filter((e) => e.type === "unmapped" && e.property_id === propertyId).length, demo_month: month, blank_meters: rows.filter((r) => !r.meter.meter_number && r.meter.kind !== "shared").length };
}

export function captureView(store: Store) {
  const month = store.demo_month;
  const batch = store.bills.filter((b) => b.arrival_month === month);
  const byId = new Map(store.properties.map((p) => [p.id, p.name]));
  const count = (s: Bill["status"]) => batch.filter((b) => b.status === s).length;
  const run = store.runs[month] ?? null;
  return {
    demo_month: month,
    run,
    counts: { total: batch.length, unarrived: count("unarrived"), matched: count("matched"), surfaced: count("surfaced"), unmapped: count("unmapped"), blocked: count("blocked"), exported: count("exported") },
    bills: batch.map((b) => ({ ...b, property_name: byId.get(b.property_id) ?? b.property_id })),
    steps: operatorSteps(store, month),
    queue_length: queue(store, month).length,
    undo_label: store.undo_label,
  };
}

export function queueView(store: Store) {
  const month = store.demo_month;
  const items = queue(store, month).map((e) => exceptionView(store, e));
  const total = store.exceptions.filter((e) => e.month === month).length;
  return { demo_month: month, items, total, resolved: total - items.length, undo_label: store.undo_label, blocked: blockedDuplicates(store, month).length };
}

export function matchesView(store: Store) {
  const month = store.demo_month;
  const items = ambiguousQueue(store, month).map((x) => ({
    line: x.match.line,
    candidates: x.candidates.map((c) => ({ account_number: c.account.account_number, holder: c.account.holder, holder_name: c.account.holder_name, meter_id: c.meter_id, unit_label: c.unit_label, location_note: c.location_note, property_name: store.properties.find((p) => p.id === store.meters.find((m) => m.id === c.meter_id)!.property_id)!.name })),
  }));
  return { demo_month: month, items, undo_label: store.undo_label };
}

export function unplacedView(store: Store) {
  const ix = indexStore(store);
  const byId = new Map(store.properties.map((p) => [p.id, p.name]));
  return { lines: unplacedLines(ix).map((l) => ({ ...l, property_name: byId.get(l.property_id) ?? l.property_id })) };
}

export function artifactsView(store: Store) {
  const month = store.demo_month;
  return {
    demo_month: month,
    bill_backs: store.bill_backs,
    transfer_drafts: store.transfer_drafts,
    call_notes: store.call_notes,
    checklists: store.checklists,
    files: store.runs[month]?.files ?? [],
  };
}

export function accountsActive(store: Store, meterId: string) {
  const accounts = store.accounts.filter((a) => a.meter_id === meterId);
  return activeAccount(accounts, store.demo_month);
}

export { linesFor };
