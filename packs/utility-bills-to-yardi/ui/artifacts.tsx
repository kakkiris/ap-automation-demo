"use client";
import { ScreenHeader } from "@/components/shell/screen-header";
import { EmptyState, Mono, Panel } from "@/components/shell/kit";
import { LinkButton } from "@/components/ui/link-button";
import { useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { BillBackRow, CallNote, SiteChecklist, TransferDraft } from "@/packs/utility-bills-to-yardi/types";
import { fmtMoney, monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";

interface Data { demo_month: string; bill_backs: BillBackRow[]; transfer_drafts: TransferDraft[]; call_notes: CallNote[]; checklists: SiteChecklist[]; files: { name: string; rows: number }[] }

export function Artifacts() {
  const { data, error } = useJson<Data>(`${utilityBillsToYardiPack.apiBase}/artifacts`);
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading the files and notes.</p>;
  const month = monthLabel(data.demo_month);
  return (
    <div>
      <ScreenHeader screen="utility-payment-reconciliation/files-and-notes-produced" title={`Files and notes produced, ${month}`} right={<LinkButton variant="outline" href={utilRoutes.actions}>Bill-backs, transfers and calls</LinkButton>} />
      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <Panel accent title={`Upload files (${data.files.length})`}>
          {data.files.length === 0 ? (
            <EmptyState title={`No upload file yet for ${month}. Export to Yardi on Capture this month's bills to build them.`} />
          ) : (
            <ul className="font-mono text-xs tabular-nums">{data.files.map((f) => <li key={f.name}>{f.name}, {f.rows} rows</li>)}</ul>
          )}
        </Panel>
        <Panel title={`Bill-backs (${data.bill_backs.length})`}>
          {data.bill_backs.length === 0 ? (
            <EmptyState title="No bill-back yet. Press Bill back on Bill-backs, transfers and calls to add a tenant charge row." />
          ) : (
            <ul className="text-xs">{data.bill_backs.map((r) => <li key={r.id}>{r.tenant}, account <Mono>{r.account_number}</Mono>, {r.months} months, <Mono>{fmtMoney(r.amount)}</Mono></li>)}</ul>
          )}
        </Panel>
        <Panel title={`Transfer drafts (${data.transfer_drafts.length})`}>
          {data.transfer_drafts.length === 0 ? (
            <EmptyState title="No transfer draft yet. Press Draft transfer on Bill-backs, transfers and calls." />
          ) : (
            data.transfer_drafts.map((d) => <pre key={d.id} className="mb-2 whitespace-pre-wrap border-t pt-2 font-sans text-xs">{d.text}</pre>)
          )}
        </Panel>
        <Panel title={`Calls (${data.call_notes.length})`}>
          {data.call_notes.length === 0 ? (
            <EmptyState title="No call logged yet. Press Mark called on Bill-backs, transfers and calls." />
          ) : (
            <ul className="text-xs">{data.call_notes.map((c) => <li key={c.id}>{c.provider}, <Mono>{c.account_number}</Mono>: {c.note}</li>)}</ul>
          )}
        </Panel>
        <Panel className="md:col-span-2" title={`Site checklists (${data.checklists.length})`}>
          {data.checklists.length === 0 ? (
            <EmptyState title="No site checklist yet. Press Generate checklist on Bill-backs, transfers and calls." />
          ) : (
            data.checklists.map((c) => (
              <div key={`${c.property_id}-${c.month}`} className="mb-2 text-xs">
                <div className="font-medium">{c.property_id}, {c.items.length} meters</div>
                <ul>{c.items.map((it) => <li key={it.meter_id}><Mono>{it.meter_id}</Mono>: {it.unit_label ? `unit ${it.unit_label}` : it.location_note ?? "house"}, photograph {it.what_to_photograph}</li>)}</ul>
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}
