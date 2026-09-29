"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Panel, StatusPill, type Tone } from "@/components/shell/kit";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { postJson, useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { Bill, RunReport } from "@/packs/utility-bills-to-yardi/types";
import { fmtMoney, monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";
import { cn } from "@/lib/utils";
import { Td, Th } from "./table-bits";

interface Steps { run: boolean; exceptions: boolean; export: boolean; import: boolean; matches: boolean; done: boolean; open_exceptions: number; blocked: number }
interface CaptureData {
  demo_month: string;
  run: RunReport | null;
  counts: { total: number; unarrived: number; matched: number; surfaced: number; unmapped: number; blocked: number; exported: number };
  bills: (Bill & { property_name: string })[];
  steps: Steps;
  queue_length: number;
  undo_label: string | null;
}
interface FilesData { month: string; files: { name: string; property_id: string; provider: string; rows: number }[]; exported: boolean }

const STATUS_TEXT: Record<Bill["status"], string> = { unarrived: "not yet arrived", arrived: "arrived", matched: "matched to its account", surfaced: "account surfaced by the bill", unmapped: "account on no meter", blocked: "duplicate, blocked", exported: "exported to Yardi" };
// One tone per bill status: matched, surfaced and exported are done (a surfaced bill sits on its
// meter and goes out in the export like a matched one), an unmapped bill needs a hand,
// a duplicate is blocked, a bill not here yet lags.
const STATUS_TONE: Record<Bill["status"], Tone> = { unarrived: "lag", arrived: "neutral", matched: "paid", surfaced: "paid", unmapped: "signal", blocked: "risk", exported: "paid" };

function errorText(err: unknown): string {
  const raw = (err as Error).message;
  try {
    return (JSON.parse(raw) as { error?: string }).error ?? raw;
  } catch {
    return raw;
  }
}

const RUN_STEPS: { key: string; label: (r: RunReport) => string }[] = [
  { key: "received", label: (r) => `Bills received: ${r.received.emailed} emailed, ${r.received.downloaded} downloaded` },
  { key: "fields", label: (r) => `Fields read from each bill: ${r.fields_read} (account number, service address, service period, amount, meter number as printed)` },
  { key: "matched", label: (r) => `Matched to an account on record: ${r.matched}` },
  { key: "surfaced", label: (r) => `Account surfaced by bill, added to the master: ${r.surfaced}` },
  { key: "unmapped", label: (r) => `Unmapped, nothing on the master matches: ${r.unmapped}` },
  { key: "differs", label: (r) => `Meter on bill differs: ${r.meter_differs}` },
  { key: "dup", label: (r) => `Duplicate period, blocked from export: ${r.duplicates}` },
  { key: "unusual", label: (r) => `Unusual amount: ${r.unusual}` },
  { key: "rows", label: (r) => (r.exported ? `Upload rows built: ${r.upload_rows} in ${r.files.length} files` : "Upload rows built at export, per property per provider") },
];

export function Capture() {
  const { data, error, refetch } = useJson<CaptureData>(`${utilityBillsToYardiPack.apiBase}/capture`);
  const files = useJson<FilesData>(`${utilityBillsToYardiPack.apiBase}/export/files`);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [ticks, setTicks] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!data?.run) return;
    if (!running.current) setTicks(RUN_STEPS.length);
  }, [data?.run]);

  async function run() {
    setBusy(true);
    running.current = true;
    setTicks(0);
    try {
      await postJson(`${utilityBillsToYardiPack.apiBase}/run`);
      for (let i = 1; i <= RUN_STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 220));
        setTicks(i);
      }
      await refetch();
      await files.refetch();
      setNote(null);
    } catch (err) {
      setNote(errorText(err));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function importConfirmed() {
    setBusy(true);
    try {
      const r = await postJson<{ lines: number }>(`${utilityBillsToYardiPack.apiBase}/import`);
      setNote(`Yardi import confirmed: ${r.lines} ledger lines posted. The paid column filled itself; see Which bills are paid.`);
      await refetch();
    } catch (err) {
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function undo() {
    await postJson(`${utilityBillsToYardiPack.apiBase}/undo`);
    await refetch();
    await files.refetch();
  }
  async function markDone() {
    await postJson(`${utilityBillsToYardiPack.apiBase}/mechanisms/done`);
    await refetch();
  }
  async function drop(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    try {
      const r = await postJson<{ bill: Bill }>(`${utilityBillsToYardiPack.apiBase}/drop`, { filename: f.name });
      setNote(`${f.name}: bill ${r.bill.id} ${STATUS_TEXT[r.bill.status]}.`);
      await refetch();
    } catch (err) {
      setNote(`${f.name}: ${errorText(err)}`);
    }
  }
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading this month&apos;s bills.</p>;
  const s = data.steps;
  const checklist: { key: keyof Steps; label: string; href?: string }[] = [
    { key: "run", label: `Run ${monthLabel(data.demo_month)}` },
    { key: "exceptions", label: `Match bills to meters${s.open_exceptions ? ` (${s.open_exceptions} open)` : ""}`, href: utilRoutes.exceptions },
    { key: "export", label: "Export to Yardi" },
    { key: "import", label: "Yardi import confirmed" },
    { key: "matches", label: "Confirm which account a payment matched", href: utilRoutes.matches },
    { key: "done", label: "Done" },
  ];
  const exportBlocked = !data.run || s.blocked > 0;
  return (
    <div>
      <ScreenHeader
        screen="utility-bills-to-yardi/capture-this-months-bills"
        title={`Capture this month's bills, ${monthLabel(data.demo_month)}`}
        right={
          <div className="flex items-center gap-2">
            {data.undo_label && (
              <Button variant="outline" size="sm" onClick={undo} disabled={busy}>Undo: {data.undo_label}</Button>
            )}
            <LinkButton variant="outline" href={utilRoutes.strip}>Which bills are paid</LinkButton>
          </div>
        }
      />
      <ol className="mb-4 flex flex-wrap gap-2 text-sm">
        {checklist.map((c, i) => (
          <li key={c.key} className={cn("rounded-md px-3 py-1.5 ring-1 ring-inset", s[c.key] ? "bg-paid-soft text-paid ring-paid/25" : "bg-card text-muted-foreground ring-foreground/10")}>
            <span className="mr-1 font-medium">{i + 1}.</span>
            {c.href ? <Link className="hover:underline" href={c.href}>{c.label}</Link> : c.label}
            {s[c.key] && <span className="ml-1">done</span>}
          </li>
        ))}
      </ol>
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Panel accent>
          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={busy || Boolean(data.run)}>{data.run ? `${monthLabel(data.demo_month)} ran` : `Run ${monthLabel(data.demo_month)}`}</Button>
            <span className="text-sm text-muted-foreground">{data.counts.total} bills in the batch.</span>
          </div>
          {!data.run && <p className="mt-3 text-sm text-muted-foreground">No bills captured yet for {monthLabel(data.demo_month)}. Press Run {monthLabel(data.demo_month)} to capture this month&apos;s bills.</p>}
          {data.run && (
            <ol className="mt-3 space-y-1 text-sm">
              {RUN_STEPS.map((st, i) => (
                <li key={st.key} className={cn("flex items-start gap-2 transition-opacity", i < ticks ? "opacity-100" : "opacity-25")}>
                  <span className={cn("mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border text-center text-[10px] leading-4", i < ticks ? "border-paid bg-paid text-white" : "border-border")}>{i < ticks ? "✓" : ""}</span>
                  <span className="tabular-nums">{st.label(data.run!)}</span>
                </li>
              ))}
            </ol>
          )}
          {data.run && ticks >= RUN_STEPS.length && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LinkButton variant={exportBlocked ? "default" : "outline"} href={utilRoutes.exceptions}>Match bills to meters ({data.queue_length})</LinkButton>
              {exportBlocked ? (
                <Button variant="outline" disabled title={s.blocked ? "resolve the blocked duplicates first" : ""}>Export to Yardi{s.blocked ? ` (blocked: ${s.blocked} duplicate${s.blocked > 1 ? "s" : ""})` : ""}</Button>
              ) : (
                <a className={buttonVariants({ variant: data.run.exported ? "outline" : "default" })} href={`${utilityBillsToYardiPack.apiBase}/export`} download onClick={() => setTimeout(() => { void refetch(); void files.refetch(); }, 900)}>
                  {data.run.exported ? "Download the upload again" : "Export to Yardi"}
                </a>
              )}
              <Button onClick={importConfirmed} disabled={busy || !data.run.exported || data.run.imported} variant={data.run.exported && !data.run.imported ? "default" : "outline"}>
                {data.run.imported ? "Yardi import confirmed, done" : "Yardi import confirmed"}
              </Button>
              <LinkButton variant="outline" href={utilRoutes.matches}>Confirm which account a payment matched</LinkButton>
            </div>
          )}
          {note && <p className="mt-2 text-sm">{note}</p>}
        </Panel>
        <div className="space-y-3">
          <div className="rounded-lg border border-dashed bg-card/60 p-4 text-sm" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void drop(e.dataTransfer.files); }}>
            <div className="font-medium">Drop a bill PDF here</div>
            <p className="text-muted-foreground">Sample bills live in public/sample-bills. Only scripted bills are read this phase (A-5.pdf, B-4.pdf, B-6.pdf, B-7.pdf, clean.pdf).</p>
            <input ref={fileRef} type="file" accept="application/pdf" className="mt-2 text-xs" onChange={(e) => void drop(e.target.files)} />
          </div>
          {files.data && files.data.files.length > 0 && (
            <Panel title={`Upload files${files.data.exported ? ", exported" : ", ready"} (${files.data.files.length}, 13 columns, headerless)`} bodyClassName="p-4 text-sm">
              <ul className="max-h-40 overflow-auto font-mono text-xs tabular-nums">
                {files.data.files.map((f) => (
                  <li key={f.name} className="flex justify-between border-t py-0.5">
                    <a className="hover:underline" href={`${utilityBillsToYardiPack.apiBase}/export/files?name=${encodeURIComponent(f.name)}`}>{f.name}</a>
                    <span className="text-muted-foreground">{f.rows} rows</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">Plus bill-backs-{data.demo_month}.csv in the zip.</p>
            </Panel>
          )}
        </div>
      </div>
      <Panel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow><Th>Bill</Th><Th>Provider</Th><Th>Site</Th><Th>Account number</Th><Th>Service address</Th><Th>Service period</Th><Th right>Amount</Th><Th>Meter as printed</Th><Th>Route</Th><Th>Status</Th><Th>Invoice number</Th></TableRow>
          </TableHeader>
          <TableBody className="[&_td]:py-1">
            {data.bills.map((b) => (
              <TableRow key={b.id} className={cn(b.status === "unmapped" && "bg-signal-soft/70 hover:bg-signal-soft/70", b.status === "blocked" && "bg-risk-soft/70 hover:bg-risk-soft/70")}>
                <Td mono>{b.id}</Td><Td>{b.provider}</Td><Td>{b.property_name}</Td><Td mono>{b.account_number}</Td><Td className="whitespace-normal text-xs">{b.service_address}</Td>
                <Td>{b.service_start} to {b.service_end}</Td><Td right>{fmtMoney(b.amount)}</Td><Td mono>{b.meter_as_printed ?? ""}</Td><Td>{b.arrival_route}</Td>
                <Td><StatusPill tone={STATUS_TONE[b.status]}>{STATUS_TEXT[b.status]}</StatusPill></Td><Td mono className="text-xs">{b.invoice_number ?? ""}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <div className="mt-3 text-right">
        <Button variant="outline" size="sm" onClick={markDone} disabled={busy || !s.import || s.done}>{s.done ? "Month marked done" : "Mark the month done"}</Button>
      </div>
    </div>
  );
}
