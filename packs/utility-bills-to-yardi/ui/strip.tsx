"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Mono, Panel, Stat, StatusPill, type Tone } from "@/components/shell/kit";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { postJson, useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { MonthCounts, RunReport, SiteCounts, SiteSummary } from "@/packs/utility-bills-to-yardi/types";
import { monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";
import { cn } from "@/lib/utils";
import { Td, Th } from "./table-bits";

interface StepperMonth {
  month: string;
  counts: MonthCounts | null;
  deltas: Partial<Record<keyof MonthCounts, number>> | null;
  contributions: { mechanism: string; kind: string; count: number }[];
  current: boolean;
  future: boolean;
}
interface StripData {
  demo_month: string;
  summaries: SiteSummary[];
  totals: SiteCounts;
  stepper: StepperMonth[];
  run: RunReport | null;
  provider_import_done: boolean;
  site_visit_done: boolean;
  can_step: boolean;
  undo_label: string | null;
}

// One tone per column, by meaning: unpaid is the shut-off risk, no account is the dark
// neutral of the grid, the three that need a hand are signal, not yet billed lags.
const COLS: { key: keyof SiteCounts; label: string; tone: Tone; cls: string }[] = [
  { key: "unpaid", label: "Unpaid", tone: "risk", cls: "text-risk" },
  { key: "no_account", label: "No account on record", tone: "neutral", cls: "text-foreground/80" },
  { key: "bill_back", label: "Bill-back", tone: "signal", cls: "text-signal" },
  { key: "transfer_needed", label: "Transfer needed", tone: "signal", cls: "text-signal" },
  { key: "not_yet_billed", label: "Not yet billed", tone: "lag", cls: "text-lag" },
  { key: "unmapped", label: "Unmapped", tone: "signal", cls: "text-signal" },
];
const MECH_LABEL: Record<string, string> = { bills: "bills in the run", exceptions: "exceptions resolved", provider_import: "provider account list", site_visit: "site visit", yardi_import: "Yardi import", confirm_matches: "matches confirmed" };
const KIND_LABEL: Record<string, string> = { account_added: "accounts added", meter_number_filled: "meter numbers filled", payer_verified: "payers verified", lines_created: "ledger lines posted", account_confirmed: "matches confirmed" };

function Delta({ v, good }: { v: number | undefined; good: "down" | "up" }) {
  if (v === undefined || v === 0) return <span className="text-muted-foreground">no change</span>;
  const better = good === "down" ? v < 0 : v > 0;
  return <span className={better ? "text-paid" : "text-risk"}>{v > 0 ? `+${v}` : v} since last month</span>;
}

export function Strip() {
  const { data, error, refetch } = useJson<StripData>(`${utilityBillsToYardiPack.apiBase}/strip`);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function act(path: string, label: string) {
    setBusy(true);
    try {
      const r = await postJson<Record<string, number | string>>(`${utilityBillsToYardiPack.apiBase}/${path}`);
      setNote(`${label}: ${Object.entries(r).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}.`);
      await refetch();
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading sites.</p>;
  const current = data.stepper.find((s) => s.current);
  return (
    <div>
      <ScreenHeader
        screen="utility-payment-reconciliation/which-bills-are-paid"
        title={`Which bills are paid, ${monthLabel(data.demo_month)}`}
        right={
          <div className="flex items-center gap-2">
            {data.undo_label && (
              <Button variant="outline" size="sm" onClick={() => act("undo", "Undone")} disabled={busy}>
                Undo: {data.undo_label}
              </Button>
            )}
            <LinkButton variant="outline" href={utilRoutes.capture}>Capture this month&apos;s bills</LinkButton>
          </div>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {data.stepper.map((s) => (
          <Panel
            key={s.month}
            accent={s.current}
            className={cn(s.current && "ring-dept/40", s.future && "opacity-60")}
            bodyClassName="p-3"
            title={monthLabel(s.month)}
            right={<StatusPill tone={s.current ? "dept" : s.future ? "lag" : "neutral"}>{s.current ? "this month" : s.future ? "not yet" : "closed"}</StatusPill>}
          >
            {s.counts ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {(["unpaid", "no_account", "bill_back", "transfer_needed", "not_yet_billed", "unmapped", "blank_meters"] as (keyof MonthCounts)[]).map((k) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k === "blank_meters" ? "Blank meter numbers" : COLS.find((c) => c.key === k)?.label ?? k}</dt>
                    <dd className="tabular-nums">
                      {String(s.counts![k])} {s.deltas && <Delta v={s.deltas[k]} good={k === "bill_back" ? "up" : "down"} />}
                    </dd>
                  </div>
                ))}
                <dt className="text-muted-foreground">Exact match share</dt>
                <dd className="tabular-nums">
                  {s.counts.matched_lines ? `${Math.round((100 * s.counts.exact_lines) / s.counts.matched_lines)} of 100 lines` : "no ledger lines yet"} <span className="text-muted-foreground">(example data)</span>
                </dd>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">No counts yet for {monthLabel(s.month)}. Press Step to {monthLabel(s.month)} below once Yardi import is confirmed.</p>
            )}
            {s.contributions.length > 0 && (
              <div className="mt-2 border-t pt-2 text-xs">
                <div className="text-muted-foreground">What changed since last month</div>
                <ul>
                  {s.contributions.map((c) => (
                    <li key={`${c.mechanism}-${c.kind}`}>
                      {c.count} {KIND_LABEL[c.kind] ?? c.kind} from {MECH_LABEL[c.mechanism] ?? c.mechanism}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        ))}
      </div>
      <Panel className="mb-4" bodyClassName="p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Fill the master between months:</span>
          <LinkButton variant="outline" size="sm" href={utilRoutes.exceptions}>1. Match bills to meters</LinkButton>
          <Button variant="outline" size="sm" onClick={() => act("mechanisms/provider-import", "Provider account list imported")} disabled={busy || data.provider_import_done}>
            2. Provider account list import{data.provider_import_done ? ", done" : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={() => act("mechanisms/site-visit", "Site visit results applied")} disabled={busy || data.site_visit_done}>
            3. Site visit results{data.site_visit_done ? ", done" : ""}
          </Button>
          <Button size="sm" onClick={() => act("mechanisms/step", "Stepped")} disabled={busy || !data.can_step || !data.run?.imported}>
            Step to {current ? monthLabel(nextMonth(current.month)) : "next month"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Step 2 is our suggestion rather than something you asked for: the accounts already exist at the provider, the meter register just does not have them yet. The step button unlocks after Yardi import confirmed.</p>
        {note && <p className="mt-2 text-sm">{note}</p>}
      </Panel>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        {COLS.map((c) => (
          <Stat key={c.key} value={data.totals[c.key]} label={c.label} tone={c.tone} />
        ))}
      </div>
      <Panel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <Th>Site</Th>
              <Th>City</Th>
              <Th right>Units</Th>
              {COLS.map((c) => (
                <Th key={c.key} right>
                  {c.label}
                </Th>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.summaries.map((s) => (
              <TableRow key={s.property.id}>
                <Td className="py-2">
                  <Link className="font-medium hover:underline" href={utilRoutes.grid(s.property.id)}>
                    {s.property.name}
                  </Link>
                  <Mono className="ml-2 text-xs text-muted-foreground">{s.property.code}</Mono>
                </Td>
                <Td className="py-2 text-muted-foreground">{s.property.city}</Td>
                <Td right className="py-2">{s.property.unit_count}</Td>
                {COLS.map((c) => (
                  <Td key={c.key} right className={cn("py-2", s.counts[c.key] > 0 ? c.cls + " font-medium" : "text-muted-foreground/40")}>
                    {s.counts[c.key]}
                  </Td>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}

function nextMonth(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  const idx = y * 12 + mm;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}
