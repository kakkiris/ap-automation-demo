"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Panel } from "@/components/shell/kit";
import { useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { Discrepancy, Property, RunReport } from "@/packs/utility-bills-to-yardi/types";
import type { RentRollRow, TrackerTab } from "@/packs/utility-bills-to-yardi/lib/today";
import { cn } from "@/lib/utils";

interface Data {
  demo_month: string;
  sites: { id: string; name: string }[];
  tab: TrackerTab;
  rent_roll: RentRollRow[];
  discrepancies: { summary: { property: Property; count: number; cleared: boolean; by_category: Record<string, number> }[]; detail: Discrepancy[] };
  manual_steps: string[];
  demo_steps: string[];
  run: RunReport | null;
}
const MONTH_HEADS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The workbook as the client keeps it, so its colors keep their spreadsheet meanings on the
// tokens: typed-by-hand amounts in the info blue, a missing account number on the signal
// yellow, the common-area band on the signal tint, tenant-pays rows on the paid green.
const WB_HEAD = "border bg-muted px-1 py-0.5 text-left text-[11px]";

export function Today() {
  const router = useRouter();
  const params = useSearchParams();
  const site = params.get("site") ?? "";
  const { data, error } = useJson<Data>(`${utilityBillsToYardiPack.apiBase}/today${site ? `?site=${site}` : ""}`);
  const [view, setView] = useState<"tracker" | "rentroll" | "discrepancies">("tracker");
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading the workbook.</p>;
  const t = data.tab;
  const cellCls = "border px-1 py-0.5 text-[11px] whitespace-nowrap";
  const Row = ({ r, tone }: { r: TrackerTab["common"][number]; tone: string }) => (
    <tr className={tone}>
      <td className={cellCls}>{r.unit}</td><td className={cellCls}>{r.tenant_or_description}</td><td className={cellCls}>{r.address_or_serves}</td><td className={cellCls}>{r.lease_from}</td><td className={cellCls}>{r.lease_to}</td>
      <td className={cn(cellCls, "font-mono tabular-nums", r.meter_missing && "bg-card")}>{r.meter_number}</td>
      <td className={cn(cellCls, "font-mono tabular-nums", r.account_missing && "bg-signal/25")}>{r.account_number}</td>
      <td className={cellCls}>{r.who_pays}</td><td className={cellCls}>{r.deposit}</td><td className={cellCls}>{r.bill_freq}</td><td className={cellCls}>{r.due_date}</td>
      {r.months.map((m, i) => <td key={i} className={cn(cellCls, "text-right text-info tabular-nums")}>{m === null ? "" : m.toFixed(2)}</td>)}
      <td className={cn(cellCls, "text-right font-medium tabular-nums")}>{r.ytd ? r.ytd.toFixed(2) : ""}</td><td className={cellCls}>{r.last_paid}</td><td className={cellCls}>{r.notes}</td>
    </tr>
  );
  const head = ["Unit", "Tenant / Description", "Address / What It Serves", "Lease From", "Lease To", "Meter #", "Account #", "Who Pays", "Deposit", "Bill Freq", "Due Date", ...MONTH_HEADS, "YTD", "Last Paid", "Notes"];
  return (
    <div>
      <ScreenHeader
        screen="utility-payment-reconciliation/the-tracker-as-kept-today"
        title="The tracker as kept today"
        right={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Tab</span>
              <select className="h-8 rounded-lg border border-input bg-card px-2 text-sm" value={t.property.id} onChange={(e) => router.push(`${utilRoutes.today}?site=${e.target.value}`)}>{data.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </label>
            <LinkButton variant="outline" href={`${utilRoutes.master}?site=${t.property.id}`}>Every meter and its account</LinkButton>
            <LinkButton variant="outline" href={utilRoutes.unplaced}>Payments without a meter</LinkButton>
          </div>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <Panel title="Steps this month, as kept today" bodyClassName="p-4 text-sm">
          <ol className="list-decimal space-y-0.5 pl-5 text-xs">{data.manual_steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </Panel>
        <Panel accent title="Steps this month, here" bodyClassName="p-4 text-sm">
          <ol className="list-decimal space-y-0.5 pl-5 text-xs">{data.demo_steps.map((s, i) => <li key={s} className={i === 0 && data.run ? "text-paid" : i === 2 && data.run?.exported ? "text-paid" : i === 3 && data.run?.imported ? "text-paid" : ""}>{s}</li>)}</ol>
        </Panel>
      </div>
      <div className="mb-2 flex gap-1 text-sm">
        {(["tracker", "rentroll", "discrepancies"] as const).map((v) => (
          <Button key={v} size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>{v === "tracker" ? "Tracker tab" : v === "rentroll" ? "Rent roll tab" : "Discrepancies"}</Button>
        ))}
      </div>
      {view === "tracker" && (
        <Panel bodyClassName="overflow-x-auto p-2">
          <div className="mb-2 grid grid-cols-4 gap-2 text-xs">
            <div><span className="text-muted-foreground">Utility:</span> {t.header.utility}</div><div><span className="text-muted-foreground">Vendor:</span> {t.header.vendor}</div><div><span className="text-muted-foreground">Property:</span> {t.header.property_code} {t.header.property_name}</div><div><span className="text-muted-foreground">Tracking year:</span> {t.header.tracking_year}</div>
          </div>
          <table className="border-collapse">
            <thead><tr>{head.map((h) => <th key={h} className={WB_HEAD}>{h}</th>)}</tr></thead>
            <tbody>
              <tr><td colSpan={head.length} className="border bg-signal-soft px-1 py-0.5 text-[11px] font-medium">Common area / master meters</td></tr>
              {t.none_identified ? <tr><td colSpan={head.length} className="border bg-signal-soft/50 px-1 py-0.5 text-[11px] italic">(none identified in source)</td></tr> : t.common.map((r, i) => <Row key={i} r={r} tone="bg-signal-soft/50" />)}
              <tr><td colSpan={head.length} className="border bg-muted px-1 py-0.5 text-[11px] font-medium">Tenant units</td></tr>
              {t.tenants.map((r, i) => <Row key={i} r={r} tone={r.who_pays === "Tenant" ? "bg-paid-soft/60" : "bg-card"} />)}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Blue: typed by hand each month. Yellow: account number missing. Blank meter number: not collected yet. Green rows: tenant pays. White rows: owner pays. Amounts are example data.</p>
        </Panel>
      )}
      {view === "rentroll" && (
        <Panel bodyClassName="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted text-left"><tr>{["Property Code", "Property", "Unit", "Current Tenant", "Lease From", "Lease To", "Status", "Prior-Month Tenant", "Change Flag"].map((h) => <th key={h} className="border px-1 py-0.5">{h}</th>)}</tr></thead>
            <tbody>{data.rent_roll.map((r) => <tr key={r.unit}><td className="border px-1 font-mono">{r.property_code}</td><td className="border px-1">{r.property}</td><td className="border px-1">{r.unit}</td><td className="border px-1">{r.current_tenant}</td><td className="border px-1">{r.lease_from}</td><td className="border px-1">{r.lease_to}</td><td className="border px-1">{r.status}</td><td className="border px-1 text-info">{r.prior_month_tenant}</td><td className={cn("border px-1 font-medium", r.change_flag && "text-risk")}>{r.change_flag}</td></tr>)}</tbody>
          </table>
        </Panel>
      )}
      {view === "discrepancies" && (
        <div className="grid gap-3 md:grid-cols-[320px_1fr]">
          <Panel bodyClassName="overflow-auto p-0 text-xs">
            <table className="w-full"><thead className="bg-muted text-left"><tr><th className="border px-1">Property</th><th className="border px-1 text-right">Lines</th><th className="border px-1">Cleared</th></tr></thead>
              <tbody>{data.discrepancies.summary.map((s) => <tr key={s.property.id} className={s.property.id === t.property.id ? "bg-dept-soft" : ""}><td className="border px-1">{s.property.name}</td><td className="border px-1 text-right tabular-nums">{s.count}</td><td className="border px-1">{s.cleared ? "Yes" : "No"}</td></tr>)}</tbody></table>
          </Panel>
          <Panel bodyClassName="overflow-auto p-0 text-xs">
            <table className="w-full"><thead className="bg-muted text-left"><tr><th className="border px-1">Category</th><th className="border px-1">Unit</th><th className="border px-1">Property tab</th><th className="border px-1">Rent roll</th></tr></thead>
              <tbody>{data.discrepancies.detail.map((d) => <tr key={d.id}><td className="border px-1">{d.category}</td><td className="border px-1">{d.unit_label}</td><td className="border px-1">{d.tracker_value}</td><td className="border px-1">{d.rent_roll_value}</td></tr>)}</tbody></table>
          </Panel>
        </div>
      )}
    </div>
  );
}
