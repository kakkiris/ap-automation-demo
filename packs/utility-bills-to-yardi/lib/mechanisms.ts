import type { Exception, MonthCounts, SiteChecklist, Store } from "../types";
import { addDays, addMonths } from "./dates";
import { accountStart, createLandlordAccount, logEvent, snapshot } from "./run";
import { indexStore, monthCounts } from "./status";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// Provider account list import (consultant hypothesis): accounts in the owner's name at
// the provider, mapped to units by service address.
export function providerImport(store: Store, month: string): { mapped: number; ambiguous: number; already: number; meters_filled: number } {
  snapshot(store, "provider account list import");
  let mapped = 0, ambiguous = 0, already = 0, meters_filled = 0;
  const onMaster = new Set(store.accounts.map((a) => a.account_number));
  for (const row of store.provider_account_list) {
    if (onMaster.has(row.account_number)) { already++; continue; }
    const target = normalize(row.service_address);
    const unit = store.units.find((u) => normalize(u.address) === target);
    const property = unit ? store.properties.find((p) => p.id === unit.property_id)! : store.properties.find((p) => target.startsWith(normalize(p.street)));
    const meter = unit
      ? store.meters.find((m) => m.unit_id === unit.id && m.service_type === "electric")
      : property
        ? store.meters.find((m) => m.property_id === property.id && m.kind === "house" && m.service_type === "electric" && (m.location_note ? target.endsWith(normalize(m.location_note)) : false))
        : undefined;
    if (meter) {
      createLandlordAccount(store, meter.id, row.account_number, accountStart(store, meter.id, `${month}-01`));
      onMaster.add(row.account_number);
      mapped++;
      if (!meter.meter_number && row.meter_number) { meter.meter_number = row.meter_number; meters_filled++; }
    } else if (property) {
      const ex: Exception = { id: `EX-IMPORT-${store.exceptions.length + 1}`, type: "ambiguous_import", month, bill_id: null, meter_id: null, account_number: row.account_number, property_id: property.id, suggestion: null, details: { service_address: row.service_address, meter_number: row.meter_number }, status: "open", resolution: null };
      store.exceptions.push(ex);
      ambiguous++;
    } else {
      ambiguous++;
    }
  }
  store.provider_import_done = true;
  if (mapped) logEvent(store, { month, mechanism: "provider_import", kind: "account_added", count: mapped, note: `${mapped} accounts mapped from the provider list by service address` });
  if (meters_filled) logEvent(store, { month, mechanism: "provider_import", kind: "meter_number_filled", count: meters_filled, note: `${meters_filled} meter numbers from the provider list` });
  return { mapped, ambiguous, already, meters_filled };
}

export function siteChecklist(store: Store, propertyId: string, month: string): SiteChecklist {
  const items = store.meters
    .filter((m) => m.property_id === propertyId && m.kind !== "shared" && !m.meter_number)
    .map((m) => {
      const unit = m.unit_id ? store.units.find((u) => u.id === m.unit_id) : null;
      return { meter_id: m.id, unit_label: unit?.label ?? null, location_note: m.location_note, what_to_photograph: m.service_type === "electric" ? "meter face with the number, and the panel label" : "meter face with the number, and the shutoff" };
    });
  const checklist = { property_id: propertyId, month, items };
  const existing = store.checklists.findIndex((c) => c.property_id === propertyId && c.month === month);
  if (existing >= 0) store.checklists[existing] = checklist; else store.checklists.push(checklist);
  return checklist;
}

export function applySiteVisit(store: Store, month: string): { filled: number; verified: number } {
  snapshot(store, "site visit results");
  let filled = 0, verified = 0;
  for (const row of store.site_visit_results) {
    const meter = store.meters.find((m) => m.id === row.meter_id);
    if (!meter) continue;
    if (row.meter_number && !meter.meter_number) { meter.meter_number = row.meter_number; filled++; }
    if (row.who_pays_found && meter.unit_id) {
      const unit = store.units.find((u) => u.id === meter.unit_id)!;
      if (unit.who_pays !== row.who_pays_found || unit.payer_source !== "verified") {
        unit.who_pays = row.who_pays_found;
        unit.payer_source = "verified";
        verified++;
      }
    }
  }
  store.site_visit_done = true;
  if (filled) logEvent(store, { month, mechanism: "site_visit", kind: "meter_number_filled", count: filled, note: `${filled} meter numbers from the site visit` });
  if (verified) logEvent(store, { month, mechanism: "site_visit", kind: "payer_verified", count: verified, note: `${verified} rows verified as tenant-paid on site` });
  return { filled, verified };
}

export function stepMonth(store: Store): string {
  const ix = indexStore(store);
  store.snapshots[store.demo_month] = monthCounts(ix, store.demo_month);
  const next = addMonths(store.demo_month, 1);
  if (!store.months.includes(next)) throw new Error("no further month in the seed");
  store.demo_month = next;
  store.operator_steps = {};
  store.undo = null;
  store.undo_label = null;
  return next;
}

export interface StepperMonth {
  month: string;
  counts: MonthCounts | null;
  deltas: Partial<Record<keyof MonthCounts, number>> | null;
  contributions: { mechanism: string; kind: string; count: number }[];
  current: boolean;
  future: boolean;
}

export function monthStepper(store: Store): StepperMonth[] {
  const ix = indexStore(store);
  const months = ["2026-07", "2026-08", "2026-09"];
  const out: StepperMonth[] = [];
  let prev: MonthCounts | null = null;
  for (const m of months) {
    const future = m > store.demo_month;
    const counts = future ? null : store.snapshots[m] ?? monthCounts(ix, m);
    const deltas: Partial<Record<keyof MonthCounts, number>> | null = counts && prev ? {} : null;
    if (counts && prev && deltas) {
      for (const k of ["unpaid", "bill_back", "transfer_needed", "not_yet_billed", "unmapped", "no_account", "blank_meters", "matched_lines", "exact_lines"] as (keyof MonthCounts)[]) {
        deltas[k] = (counts[k] as number) - (prev[k] as number);
      }
    }
    const contributions = Object.values(
      store.events.filter((e) => e.month === addMonths(m, -1) || (e.month === m && m === store.demo_month && false)).reduce((acc, e) => {
        const key = `${e.mechanism}|${e.kind}`;
        acc[key] = acc[key] ?? { mechanism: e.mechanism, kind: e.kind, count: 0 };
        acc[key].count += e.count;
        return acc;
      }, {} as Record<string, { mechanism: string; kind: string; count: number }>),
    );
    out.push({ month: m, counts, deltas, contributions, current: m === store.demo_month, future });
    if (counts) prev = counts;
  }
  return out;
}

export function transferByDate(month: string): string {
  return addDays(`${month}-01`, 45);
}
