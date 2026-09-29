"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenHeader } from "@/components/shell/screen-header";
import { EmptyState, Mono, Panel, StatusPill } from "@/components/shell/kit";
import { postJson, useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { BillBackRow, Cell, Exception, Meter, Property, SiteChecklist, TransferDraft, Unit } from "@/packs/utility-bills-to-yardi/types";
import { fmtDate, fmtMoney, monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";
import { SitePicker } from "./site-picker";

interface Item { key: string; meter: Meter; unit: Unit | null; property: Property; cell: Cell; done: boolean }
interface SweepItem { account_number: string; meter: Meter; property: Property; provider: string; behind: boolean; last_bill_date: string | null; done: boolean; note: string | null }
interface ActionData {
  month: string;
  pay: (Item & { file: string | null })[];
  bill_back: Item[];
  transfer: (Item & { kind: "tenant_letter" | "provider_request" })[];
  call: { provider: string; behind: boolean; items: SweepItem[] }[];
  verify: { property: Property; meters: Meter[]; reasons: string[]; done: boolean }[];
  resolve: Exception[];
}

function where(i: Item): string {
  const place = i.meter.kind === "unit" ? `unit ${i.unit?.label}${i.unit?.tenant ? ` (${i.unit.tenant})` : " (vacant)"}` : i.meter.kind === "house" ? `${i.meter.service_type === "water" ? "water master" : "house meter"}${i.meter.location_note ? ` (${i.meter.location_note})` : ""}` : "shared meter";
  return `${i.property.name}, ${place}`;
}

function Section({ title, count, children, hint, empty, accent }: { title: string; count: number; children: React.ReactNode; hint?: string; empty: string; accent?: boolean }) {
  return (
    <Panel accent={accent} title={`${title} (${count})`}>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      {count === 0 ? <EmptyState title={empty} /> : children}
    </Panel>
  );
}

export function Actions() {
  const router = useRouter();
  const params = useSearchParams();
  const site = params.get("site") ?? "all";
  const { data, error, refetch } = useJson<ActionData>(`${utilityBillsToYardiPack.apiBase}/actions?site=${site}`);
  const [artifact, setArtifact] = useState<{ title: string; body: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function post<T>(path: string, body: unknown, show: (r: T) => { title: string; body: string }) {
    setBusy(true);
    try {
      const r = await postJson<T>(`${utilityBillsToYardiPack.apiBase}/${path}`, body);
      setArtifact(show(r));
      await refetch();
    } catch (err) {
      setArtifact({ title: "Could not do that", body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function undo() {
    await postJson(`${utilityBillsToYardiPack.apiBase}/undo`);
    setArtifact(null);
    await refetch();
  }
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading the bill-backs, transfers and calls.</p>;
  const meterLink = (i: Item) => <Link className="hover:underline" href={`${utilRoutes.meter(i.meter.id)}?month=${data.month}`}>{where(i)}</Link>;
  return (
    <div>
      <ScreenHeader
        screen="utility-payment-reconciliation/bill-backs-transfers-and-calls"
        title={`Bill-backs, transfers and calls, ${monthLabel(data.month)}`}
        right={
          <div className="flex items-center gap-2">
            <SitePicker value={site} allowAll onChange={(id) => router.push(`${utilRoutes.actions}?site=${id}`)} />
            <Button variant="outline" size="sm" onClick={undo} disabled={busy}>Undo last</Button>
            <Link className="text-sm font-medium text-dept underline underline-offset-4" href={utilRoutes.artifacts}>Files and notes produced</Link>
          </div>
        }
      />
      {artifact && (
        <div className="mb-4 rounded-lg bg-info-soft p-3 text-sm ring-1 ring-inset ring-info/25">
          <div className="flex items-center justify-between">
            <div className="font-medium">{artifact.title}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(artifact.body)}>Copy</Button>
              <Button size="sm" variant="ghost" onClick={() => setArtifact(null)}>Close</Button>
            </div>
          </div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs">{artifact.body}</pre>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Section accent title="Pay: in this batch's upload" count={data.pay.length} hint="Unpaid this month. Each row is a line in the upload file for its site and provider." empty="Nothing unpaid this month. Capture this month's bills first if the month has not run.">
          <ul>
            {data.pay.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3 border-t py-1.5 text-sm">
                {meterLink(i)}
                <span className="text-xs text-muted-foreground">{i.file ? <a className="font-mono underline" href={`${utilityBillsToYardiPack.apiBase}/export/files?name=${encodeURIComponent(i.file)}`}>{i.file}</a> : "not exported yet"}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Bill back the tenant" count={data.bill_back.length} hint="Creates a tenant charge row (GL Tenant charges) in the bill-backs export." empty="No tenant to bill back this month. An occupied unit still on the landlord's account, with a payment found, lands here.">
          <ul>
            {data.bill_back.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3 border-t py-1.5 text-sm">
                <span>{meterLink(i)} <span className="text-muted-foreground tabular-nums">{i.cell.months_since_move_in} months, {fmtMoney(i.cell.running_total ?? 0)}</span></span>
                <Button size="sm" variant={i.done ? "outline" : "default"} disabled={busy || i.done} onClick={() => post<{ row: BillBackRow }>("actions/billback", { meter_id: i.meter.id }, (r) => ({ title: `Tenant charge row for ${r.row.tenant}`, body: `${r.row.tenant}, unit ${i.unit?.label}, account ${r.row.account_number}, ${r.row.months} months, ${fmtMoney(r.row.amount)}, GL Tenant charges. Written to bill-backs-${data.month}.csv.` }))}>{i.done ? "In the bill-backs file" : "Bill back"}</Button>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Transfer: electric still in the landlord's name" count={data.transfer.length} hint="Drafts a request. Nothing is sent from here." empty="No electric account still in the landlord's name this month.">
          <ul>
            {data.transfer.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3 border-t py-1.5 text-sm">
                <span>{meterLink(i)} <span className="text-xs text-muted-foreground">{i.kind === "tenant_letter" ? "letter to the tenant" : "request to the provider"}</span></span>
                <Button size="sm" variant={i.done ? "outline" : "default"} disabled={busy} onClick={() => post<{ draft: TransferDraft }>("actions/transfer", { meter_id: i.meter.id }, (r) => ({ title: `Draft ${r.draft.kind === "tenant_letter" ? "letter to the tenant" : "request to the provider"}, transfer by ${fmtDate(r.draft.transfer_by)}`, body: r.draft.text }))}>{i.done ? "Draft again" : "Draft transfer"}</Button>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Call the provider: accounts with no bill in this batch" count={data.call.reduce((n, c) => n + c.items.length, 0)} hint="The missing-bill sweep, with the last bill date per account, before the due date." empty="Every account has a bill in this batch. No provider to call.">
          {data.call.map((c) => (
            <div key={c.provider} className="mb-2">
              <div className="text-sm font-medium">{c.provider}{c.behind ? " (billing behind)" : ""} <span className="text-xs text-muted-foreground">utility billing line</span></div>
              <ul>
                {c.items.map((i) => (
                  <li key={i.account_number} className="flex items-center justify-between gap-3 border-t py-1.5 text-sm">
                    <span><Link className="hover:underline" href={utilRoutes.meter(i.meter.id)}>{i.property.name}, {i.meter.meter_number ?? i.meter.id}</Link> <Mono className="text-xs">{i.account_number}</Mono> <span className="text-xs text-muted-foreground">last bill {i.last_bill_date ? fmtDate(i.last_bill_date) : "none on record"}</span></span>
                    {i.done ? <StatusPill tone="paid">called: {i.note}</StatusPill> : (
                      <span className="flex items-center gap-1">
                        <Input className="h-7 w-36 text-xs md:text-xs" placeholder="note" value={notes[i.account_number] ?? ""} onChange={(e) => setNotes({ ...notes, [i.account_number]: e.target.value })} />
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => post("actions/call", { account_number: i.account_number, provider: i.provider, note: notes[i.account_number] || "called, bill promised" }, () => ({ title: "Marked as called", body: `${i.provider}, account ${i.account_number}: ${notes[i.account_number] || "called, bill promised"}` }))}>Mark called</Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
        <Section title="Verify on site" count={data.verify.length} hint="Generates the site checklist: meters with no meter number on record, what to photograph." empty="No site visit needed. Every meter here has a number on record.">
          <ul>
            {data.verify.map((v) => (
              <li key={v.property.id} className="flex items-center justify-between gap-3 border-t py-1.5 text-sm">
                <span>{v.property.name}: {v.meters.length} meter{v.meters.length > 1 ? "s" : ""}{v.reasons.length ? `, ${v.reasons.join("; ")}` : ""}</span>
                <Button size="sm" variant={v.done ? "outline" : "default"} disabled={busy} onClick={() => post<{ checklist: SiteChecklist }>("actions/checklist", { site: v.property.id }, (r) => ({ title: `Site checklist, ${v.property.name} (${r.checklist.items.length} meters)`, body: r.checklist.items.map((it) => `${it.meter_id}: ${it.unit_label ? `unit ${it.unit_label}` : it.location_note ?? "house"}, photograph ${it.what_to_photograph}`).join("\n") }))}>{v.done ? "Checklist again" : "Generate checklist"}</Button>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Match bills to meters" count={data.resolve.length} empty="Nothing waiting in Match bills to meters.">
          <ul>
            {data.resolve.map((e) => (
              <li key={e.id} className="border-t py-1.5 text-sm">
                <Link className="hover:underline" href={`${utilRoutes.exceptions}?focus=${e.id}`}>{e.type.replace(/_/g, " ")}{e.bill_id ? `, ${e.bill_id}` : ""}{e.account_number ? `, account ${e.account_number}` : ""}</Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
