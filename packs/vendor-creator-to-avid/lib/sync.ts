// The nightly sync and everything the screens read from it. Pure functions over a Store
// value; they mutate the store they are handed and the store module owns the instance.
// The run clock is the demo date at 23:30, never the wall clock.

import type {
  AvidVendor,
  CreateVendorBody,
  DeltaItem,
  DeltaRow,
  ImportRow,
  MastersPayload,
  MatchCandidate,
  NearMatchesPayload,
  PairView,
  RunPayload,
  StatePayload,
  Store,
  SyncRun,
  SyncRunCounts,
  Task,
  YardiVendor,
} from "./types";
import { SCOPE_LINE } from "./types";
import { normalizeName } from "./normalize";
import { computeGap, computeHeld, findCandidate, matchVendor, outcomeFor, type Outcome } from "./match";
import { avidId, fakeTaxLast4, runId, taskId, yardiId } from "./ids";

export const IMPORT_COMMENT_LINE = "# placeholder columns until the Avid import format is confirmed: name, address_line";
export const IMPORT_HEADER_LINE = "name,address_line";

export function runClock(store: Pick<Store, "demo_date">): string {
  return `${store.demo_date}T23:30:00`;
}

export function importFileName(runIdValue: string | null): string {
  return `vendor-import-${runIdValue ?? "none"}.csv`;
}

function yardiById(store: Store, id: string): YardiVendor | undefined {
  return store.yardi_vendors.find((v) => v.yardi_vendor_id === id);
}

function avidById(store: Store, id: string): AvidVendor | undefined {
  return store.avid_vendors.find((v) => v.avid_vendor_id === id);
}

/** Mint the Avid copy of a Yardi vendor: name and address line travel, the tax digits come along. */
function mintAvidVendor(store: Store, yardi: YardiVendor): AvidVendor {
  const vendor: AvidVendor = {
    avid_vendor_id: avidId(store.next_avid_number),
    name: yardi.name,
    address_line: yardi.address_line,
    created_at: store.demo_date,
    source: "synced",
    tax_id_last4: yardi.tax_id_last4,
  };
  store.next_avid_number += 1;
  store.avid_vendors.push(vendor);
  return vendor;
}

/** Keep the stored decision; refresh the score and reasons from the matcher. */
function upsertCandidate(store: Store, candidate: MatchCandidate): void {
  const existing = findCandidate(store.match_candidates, candidate.yardi_vendor_id, candidate.avid_vendor_id);
  if (existing) {
    existing.score = candidate.score;
    existing.reasons = [...candidate.reasons];
    return;
  }
  store.match_candidates.push({ ...candidate, reasons: [...candidate.reasons], decision: "none" });
}

function countItems(items: DeltaItem[]): SyncRunCounts {
  const counts: SyncRunCounts = { compared: items.length, skipped_exact: 0, staged_or_created: 0, held: 0, skipped_inactive: 0 };
  for (const d of items) {
    if (d.action === "skip_exact") counts.skipped_exact += 1;
    else if (d.action === "stage" || d.action === "create") counts.staged_or_created += 1;
    else if (d.action === "hold") counts.held += 1;
    else counts.skipped_inactive += 1;
  }
  return counts;
}

function itemFor(runIdValue: string, yardi: YardiVendor, outcome: Outcome): DeltaItem {
  return { run_id: runIdValue, yardi_vendor_id: yardi.yardi_vendor_id, action: outcome.action, reason: outcome.reason, avid_vendor_id: outcome.avid_vendor_id };
}

/** In automatic mode a create outcome makes the Avid vendor now and points the outcome at it. */
function settleCreate(store: Store, yardi: YardiVendor, outcome: Outcome): Outcome {
  if (outcome.action !== "create") return outcome;
  const created = mintAvidVendor(store, yardi);
  return { ...outcome, avid_vendor_id: created.avid_vendor_id };
}

/** One import row and one task per staged or created delta item. Tasks already on the list keep their id and done flag. */
function rebuildImportAndTasks(store: Store, run: SyncRun): void {
  const rows: ImportRow[] = [];
  const tasks: Task[] = [];
  const previous = store.tasks;
  const used = new Set<string>();
  for (const d of store.delta_items) {
    if (d.action !== "stage" && d.action !== "create") continue;
    const yardi = yardiById(store, d.yardi_vendor_id);
    if (!yardi) continue;
    rows.push({ run_id: run.run_id, name: yardi.name, address_line: yardi.address_line });
    const text = `Create ${yardi.name} in Avid`;
    const kept = previous.find((t) => t.run_id === run.run_id && t.text === text && !used.has(t.task_id));
    if (kept) {
      used.add(kept.task_id);
      tasks.push(kept);
    } else {
      const task: Task = { task_id: taskId(store.next_task_number), run_id: run.run_id, text, done: false };
      store.next_task_number += 1;
      used.add(task.task_id);
      tasks.push(task);
    }
  }
  store.import_rows = rows;
  store.tasks = tasks;
}

/** Run the nightly sync in the store's mode over every Yardi vendor in the store right now. */
export function runSync(store: Store): SyncRun {
  const run: SyncRun = {
    run_id: runId(store.next_run_number),
    run_at: runClock(store),
    mode: store.mode,
    counts: { compared: 0, skipped_exact: 0, staged_or_created: 0, held: 0, skipped_inactive: 0 },
  };
  store.next_run_number += 1;
  // Compare against the Avid list as it stood when the run started, so a vendor created
  // during this run never changes the outcome of the vendors after it.
  const view = { yardi_vendors: store.yardi_vendors, avid_vendors: [...store.avid_vendors], match_candidates: store.match_candidates, mode: store.mode };
  const items: DeltaItem[] = [];
  for (const yardi of store.yardi_vendors) {
    const outcome = settleCreate(store, yardi, outcomeFor(view, yardi));
    if (outcome.action === "hold" && outcome.candidate) upsertCandidate(store, outcome.candidate);
    items.push(itemFor(run.run_id, yardi, outcome));
  }
  run.counts = countItems(items);
  store.sync_runs.push(run);
  store.delta_items = items;
  rebuildImportAndTasks(store, run);
  return run;
}

export function latestRun(store: Store): SyncRun | null {
  return store.sync_runs.length > 0 ? store.sync_runs[store.sync_runs.length - 1] : null;
}

/** Record a human decision on a near match pair and carry it into the latest run. */
export function decide(store: Store, yardiVendorId: string, avidVendorId: string, decision: "link" | "create" | "later"): void {
  const yardi = yardiById(store, yardiVendorId);
  const avid = avidById(store, avidVendorId);
  if (!yardi || !avid) throw new Error(`no near match pair for ${yardiVendorId} and ${avidVendorId}`);
  let candidate = findCandidate(store.match_candidates, yardiVendorId, avidVendorId);
  if (!candidate) {
    const computed = matchVendor(yardi, store.avid_vendors, store.mode).candidate;
    if (!computed || computed.avid_vendor_id !== avidVendorId) {
      throw new Error(`${yardiVendorId} and ${avidVendorId} are not a near match pair`);
    }
    candidate = { ...computed, decision: "none" };
    store.match_candidates.push(candidate);
  }
  candidate.decision = decision;

  const outcome = settleCreate(store, yardi, outcomeFor(store, yardi));
  const run = latestRun(store);
  if (!run) return;
  const index = store.delta_items.findIndex((d) => d.run_id === run.run_id && d.yardi_vendor_id === yardiVendorId);
  if (index < 0) return;
  store.delta_items[index] = itemFor(run.run_id, yardi, outcome);
  run.counts = countItems(store.delta_items);
  rebuildImportAndTasks(store, run);
}

/** The Yardi stand-in form. Creates the vendor once; the next run picks it up. */
export function createYardiVendor(store: Store, body: CreateVendorBody): YardiVendor {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const addressLine = typeof body?.address_line === "string" ? body.address_line.trim() : "";
  if (!name || !addressLine) throw new Error("name and address line are both required");
  const number = store.next_yardi_number;
  const vendor: YardiVendor = {
    yardi_vendor_id: yardiId(number),
    name,
    address_line: addressLine,
    status: body.status === "inactive" ? "inactive" : "active",
    created_at: store.demo_date,
    tax_id_last4: fakeTaxLast4(number),
  };
  store.next_yardi_number += 1;
  store.yardi_vendors.push(vendor);
  return vendor;
}

export function setTaskDone(store: Store, taskIdValue: string, done: boolean): Task {
  const task = store.tasks.find((t) => t.task_id === taskIdValue);
  if (!task) throw new Error(`no task ${taskIdValue}`);
  task.done = done;
  return task;
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** The assisted-mode import file for the latest run, or a named run. Header lines only before the first run. */
export function importCsv(store: Store, runIdValue?: string): { file_name: string; text: string; row_count: number } {
  let run: SyncRun | null;
  if (runIdValue) {
    run = store.sync_runs.find((r) => r.run_id === runIdValue) ?? null;
    if (!run) throw new Error(`no sync run ${runIdValue}`);
  } else {
    run = latestRun(store);
  }
  const rows = run ? store.import_rows.filter((r) => r.run_id === run.run_id) : [];
  const lines = [IMPORT_COMMENT_LINE, IMPORT_HEADER_LINE, ...rows.map((r) => `${csvField(r.name)},${csvField(r.address_line)}`)];
  return { file_name: importFileName(run ? run.run_id : null), text: `${lines.join("\n")}\n`, row_count: rows.length };
}

/** The latest run's delta, each item joined to its Yardi vendor and the Avid name when there is one. */
export function deltaRows(store: Store): DeltaRow[] {
  const run = latestRun(store);
  if (!run) return [];
  const rows: DeltaRow[] = [];
  for (const d of store.delta_items) {
    if (d.run_id !== run.run_id) continue;
    const yardi = yardiById(store, d.yardi_vendor_id);
    if (!yardi) continue;
    const avid = d.avid_vendor_id ? avidById(store, d.avid_vendor_id) : undefined;
    rows.push({ ...d, name: yardi.name, address_line: yardi.address_line, status: yardi.status, avid_name: avid ? avid.name : null });
  }
  return rows;
}

export function statePayload(store: Store): StatePayload {
  return {
    mode: store.mode,
    demo_date: store.demo_date,
    yardi_count: store.yardi_vendors.length,
    yardi_active_count: store.yardi_vendors.filter((v) => v.status === "active").length,
    avid_count: store.avid_vendors.length,
    gap: computeGap(store),
    held: computeHeld(store),
    last_run_id: latestRun(store)?.run_id ?? null,
  };
}

export function mastersPayload(store: Store): MastersPayload {
  return { ...statePayload(store), yardi: store.yardi_vendors, avid: store.avid_vendors };
}

export function runPayload(store: Store): RunPayload {
  const run = latestRun(store);
  const file = importCsv(store);
  return {
    mode: store.mode,
    run,
    delta: deltaRows(store),
    tasks: store.tasks,
    import_row_count: file.row_count,
    import_file_name: run ? file.file_name : null,
    scope_line: SCOPE_LINE,
  };
}

function pairView(store: Store, candidate: MatchCandidate): PairView | null {
  const yardi = yardiById(store, candidate.yardi_vendor_id);
  const avid = avidById(store, candidate.avid_vendor_id);
  if (!yardi || !avid) return null;
  return { candidate, yardi, avid, yardi_normalized: normalizeName(yardi.name), avid_normalized: normalizeName(avid.name) };
}

export function nearMatchesPayload(store: Store): NearMatchesPayload {
  const sorted = [...store.match_candidates].sort((a, b) => a.yardi_vendor_id.localeCompare(b.yardi_vendor_id));
  const held: PairView[] = [];
  const decided: PairView[] = [];
  for (const c of sorted) {
    const view = pairView(store, c);
    if (!view) continue;
    if (c.decision === "link" || c.decision === "create") decided.push(view);
    else held.push(view);
  }
  return { mode: store.mode, held, decided };
}
