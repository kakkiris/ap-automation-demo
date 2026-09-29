"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Mono, Panel, Stat, StatusPill, type Tone } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { screenHref } from "@/lib/registry";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { vendorCreatorToAvidPack as pack } from "@/packs/vendor-creator-to-avid/module";
import { ACTION_LABELS, SCOPE_LINE, type DeltaAction, type DeltaRow, type RunPayload } from "@/packs/vendor-creator-to-avid/lib/types";
import { errorText, useMode } from "./mode";

/** Rows to act on first, exact matches last. */
const ORDER: Record<DeltaAction, number> = { stage: 0, create: 0, hold: 1, skip_inactive: 2, skip_exact: 3 };

/** One tone per outcome: something gets made, a person is needed, or nothing happens. */
const ACTION_TONE: Record<DeltaAction, Tone> = { stage: "paid", create: "paid", hold: "signal", skip_exact: "lag", skip_inactive: "lag" };

const TH = "text-xs uppercase tracking-wide text-muted-foreground";
const LINK = "font-medium text-dept underline-offset-4 hover:underline";

export function SyncRun() {
  const { version, saving } = useMode();
  const { data, error, refetch } = useJson<RunPayload>(`${pack.apiBase}/run`);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showExact, setShowExact] = useState(false);
  /** Ticks shown at once while the save is in flight; the fetched list confirms them. */
  const [pendingDone, setPendingDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (version > 0) void refetch();
  }, [version, refetch]);

  async function run() {
    setBusy(true);
    setProblem(null);
    setPendingDone({});
    try {
      await postJson<RunPayload>(`${pack.apiBase}/run`);
      await refetch();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function markTask(task_id: string, done: boolean) {
    setProblem(null);
    setPendingDone((p) => ({ ...p, [task_id]: done }));
    try {
      await postJson<RunPayload>(`${pack.apiBase}/tasks/done`, { task_id, done });
      await refetch();
    } catch (err) {
      setPendingDone((p) => ({ ...p, [task_id]: !done }));
      setProblem(errorText(err));
    }
  }

  const run_ = data?.run ?? null;
  const sorted = data ? [...data.delta].sort((a, b) => ORDER[a.action] - ORDER[b.action] || a.yardi_vendor_id.localeCompare(b.yardi_vendor_id)) : [];
  const main = sorted.filter((r) => r.action !== "skip_exact");
  const exact = sorted.filter((r) => r.action === "skip_exact");

  return (
    <div>
      <ScreenHeader screen="vendor-creator-to-avid/run-the-nightly-sync-to-avid" title="Run the nightly sync to Avid" />
      <p className="mb-4 text-sm text-muted-foreground">
        One night&apos;s work. Every active Yardi vendor is compared with Avid; the reason for each outcome is shown on its row.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy || saving}>
          {busy ? "Running" : "Run nightly sync"}
        </Button>
        {run_ && (
          <span className="text-sm tabular-nums text-muted-foreground">
            Run {run_.run_id}, {run_.mode}
          </span>
        )}
      </div>
      {error && <p className="mb-4 text-sm text-risk">{error}</p>}
      {problem && <p className="mb-4 text-sm text-risk">{problem}</p>}
      {data && !run_ && <EmptyState title="No run yet. Press Run nightly sync to compare the two masters." />}
      {data && run_ && (
        <>
          <dl data-testid="run-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryItem label="Compared" value={run_.counts.compared} testId="count-compared" tone="neutral" />
            <SummaryItem label="Skipped exact" value={run_.counts.skipped_exact} testId="count-skipped-exact" tone="lag" />
            <SummaryItem label={run_.mode === "automatic" ? "Created" : "Staged"} value={run_.counts.staged_or_created} testId="count-staged-or-created" tone="paid" />
            <SummaryItem label="Held" value={run_.counts.held} testId="count-held" tone="signal" />
            <SummaryItem label="Skipped inactive" value={run_.counts.skipped_inactive} testId="count-skipped-inactive" tone="lag" />
          </dl>

          <Panel accent className="mt-6" bodyClassName="p-0">
            <Table data-testid="delta-table">
              <TableHeader>
                <TableRow>
                  <TableHead className={TH}>Yardi id</TableHead>
                  <TableHead className={TH}>Name</TableHead>
                  <TableHead className={TH}>Action</TableHead>
                  <TableHead className={TH}>Reason</TableHead>
                  <TableHead className={TH}>Avid id</TableHead>
                  <TableHead className={TH}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {main.map((r) => (
                  <DeltaRowView key={r.yardi_vendor_id} row={r} />
                ))}
                {showExact && exact.map((r) => <DeltaRowView key={r.yardi_vendor_id} row={r} />)}
              </TableBody>
            </Table>
            {exact.length > 0 && (
              <div className="border-t px-2 py-1.5">
                <Button variant="ghost" size="sm" onClick={() => setShowExact((s) => !s)}>
                  {showExact ? "Hide exact matches" : `Show ${exact.length} exact match${exact.length === 1 ? "" : "es"}`}
                </Button>
              </div>
            )}
          </Panel>

          {run_.mode === "assisted" && (
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <Panel title="Import file">
                <p className="mb-3 text-sm text-muted-foreground">
                  Name and address line, one row per vendor to create. The columns are placeholders until the Avid import layout is confirmed.
                </p>
                <div className="flex items-center gap-3">
                  <a data-testid="download-import" href={`${pack.apiBase}/import`} download className={cn(buttonVariants({ variant: "outline" }))}>
                    Download import file
                  </a>
                  <span className="text-sm">
                    <span data-testid="import-row-count" className="font-semibold tabular-nums">
                      {data.import_row_count}
                    </span>{" "}
                    rows
                  </span>
                </div>
              </Panel>
              <Panel title={"Tomorrow morning's tasks"}>
                <p className="mb-3 text-sm text-muted-foreground">One line per vendor to key in Avid by hand. Tick each one as it is done.</p>
                {data.tasks.length === 0 && <EmptyState title="Nothing to key in Avid by hand tonight." className="py-5" />}
                <ul data-testid="task-list" className="space-y-1.5 text-sm">
                  {data.tasks.map((t) => {
                    const done = pendingDone[t.task_id] ?? t.done;
                    return (
                      <li key={t.task_id} className="flex items-center gap-2">
                        <input type="checkbox" id={`task-${t.task_id}`} className="accent-dept" checked={done} onChange={(e) => void markTask(t.task_id, e.target.checked)} />
                        <label htmlFor={`task-${t.task_id}`} className={cn(done && "text-muted-foreground line-through")}>
                          {t.text}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </section>
          )}

          {run_.mode === "automatic" && (
            <section className="mt-6 rounded-lg bg-paid-soft p-4 text-sm ring-1 ring-inset ring-paid/25">
              <p data-testid="created-count">
                Created in Avid tonight:{" "}
                <span data-testid="created-count-value" className="font-semibold tabular-nums text-paid">
                  {run_.counts.staged_or_created}
                </span>
              </p>
              <p className="mt-1 text-muted-foreground">
                Avid creates them directly. They show marked synced in the Avid list on{" "}
                <Link className={LINK} href={screenHref(pack, "create-the-vendor-once-in-yardi")}>
                  Create the vendor once in Yardi
                </Link>
                .
              </p>
            </section>
          )}
        </>
      )}
      <p data-testid="scope-line" className="mt-8 border-t pt-3 text-sm text-muted-foreground">
        {SCOPE_LINE}
      </p>
    </div>
  );
}

/** A run count as a Stat. The label stays a dt and the number a dd so the summary reads as a list of terms. */
function SummaryItem({ label, value, testId, tone }: { label: string; value: number; testId: string; tone: Tone }) {
  return <Stat tone={tone} value={<dd data-testid={testId}>{value}</dd>} label={<dt>{label}</dt>} />;
}

function DeltaRowView({ row: r }: { row: DeltaRow }) {
  const id = r.yardi_vendor_id;
  return (
    <TableRow
      data-testid={`delta-${id}`}
      className={cn("border-border/70", (r.action === "stage" || r.action === "create") && "bg-paid-soft/50", r.action === "hold" && "bg-signal-soft/60", r.action === "skip_exact" && "text-muted-foreground")}
    >
      <TableCell>
        <Mono className="text-xs">{id}</Mono>
      </TableCell>
      <TableCell>{r.name}</TableCell>
      <TableCell>
        <StatusPill tone={ACTION_TONE[r.action]} className="font-mono" data-testid={`delta-${id}-action`}>
          {r.action}
        </StatusPill>{" "}
        <span className="text-muted-foreground">{ACTION_LABELS[r.action]}</span>
      </TableCell>
      <TableCell className="whitespace-normal" data-testid={`delta-${id}-reason`}>
        {r.reason}
      </TableCell>
      <TableCell>
        <Mono className="text-xs">{r.avid_vendor_id ?? ""}</Mono>
      </TableCell>
      <TableCell>
        {r.action === "hold" && (
          <Link className={LINK} href={`${screenHref(pack, "decide-the-near-matches")}?pair=${id}`}>
            Open near match
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
}
