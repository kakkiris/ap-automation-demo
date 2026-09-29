"use client";
import Link from "next/link";
import { useState } from "react";
import { LinkButton } from "@/components/ui/link-button";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Panel } from "@/components/shell/kit";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { GridRow, Property } from "@/packs/utility-bills-to-yardi/types";
import { monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";
import { StatusCell } from "./cell";
import { Legend } from "./legend";
import { FlagChips } from "./flags";
import { WhyPopover } from "./why";
import { ROW_TINT, Td, Th } from "./table-bits";
import { cn } from "@/lib/utils";

interface GridData {
  property: Property;
  months: string[];
  demo_month: string;
  rows: GridRow[];
  unmapped: { id: string; account_number: string | null; bill_id: string | null }[];
  imported: boolean;
}

function rowLabel(r: GridRow): string {
  if (r.meter.kind === "unit") return `Unit ${r.unit?.label ?? ""}`;
  if (r.meter.kind === "shared") return "Shared meter";
  return `${r.meter.service_type === "water" ? "Water master" : "House meter"}${r.meter.location_note ? `, ${r.meter.location_note}` : ""}`;
}

export function SiteGrid({ siteId }: { siteId: string }) {
  const { data, error } = useJson<GridData>(`${utilityBillsToYardiPack.apiBase}/grid?site=${siteId}`);
  const [why, setWhy] = useState<{ meter: string; month: string } | null>(null);
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading the grid.</p>;
  return (
    <div>
      <ScreenHeader
        screen="utility-payment-reconciliation/one-property-month-by-month"
        title={`One property, month by month: ${data.property.name}, ${monthLabel(data.demo_month)}`}
        right={
          <div className="flex gap-2">
            <LinkButton variant="outline" href={utilRoutes.strip}>Which bills are paid</LinkButton>
            <LinkButton href={`${utilRoutes.actions}?site=${data.property.id}`}>Bill-backs, transfers and calls</LinkButton>
            <LinkButton variant="outline" href={utilRoutes.unplaced}>Payments without a meter</LinkButton>
          </div>
        }
      />
      <p className="mb-3 text-sm text-muted-foreground">
        The rent roll sets what is expected. {data.property.unit_count} units, {data.property.city}, property code {data.property.code}. Click any cell for why.
      </p>
      {data.unmapped.length > 0 && (
        <div className="mb-3 rounded-md bg-signal-soft px-3 py-2 text-sm ring-1 ring-inset ring-signal/30">
          {data.unmapped.length === 1 ? "One bill carries" : `${data.unmapped.length} bills carry`} an account number linked to no meter at this site.{" "}
          <Link className="font-medium text-dept underline underline-offset-4" href={utilRoutes.exceptions}>
            Match bills to meters
          </Link>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <Panel bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <Th className="sticky left-0 bg-card">Meter</Th>
                <Th>Service</Th>
                <Th>Flags</Th>
                {data.months.map((m) => (
                  <Th key={m} className={cn("px-1 text-center", m === data.demo_month && "text-foreground")}>
                    {monthLabel(m)}
                  </Th>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.meter.id} className={cn(r.meter.kind === "house" && ROW_TINT.house, r.meter.kind === "shared" && ROW_TINT.shared)}>
                  <Td className="sticky left-0 bg-inherit">
                    <Link className="font-medium hover:underline" href={utilRoutes.meter(r.meter.id)}>
                      {rowLabel(r)}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.meter.meter_number ? <span className="font-mono tabular-nums">{r.meter.meter_number}</span> : <span className="text-signal">no meter number</span>}
                      {r.unit?.tenant ? `, ${r.unit.tenant}` : r.meter.kind === "unit" ? ", vacant" : ""}
                    </div>
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {r.meter.service_type}, {r.meter.provider}
                  </Td>
                  <Td className="whitespace-normal">
                    <FlagChips flags={r.flags} />
                  </Td>
                  {r.cells.map((c) => (
                    <Td key={c.month} className="w-28 px-1 py-1">
                      <StatusCell cell={c} compact highlight={data.imported && c.month === data.demo_month && c.status === "paid"} onClick={() => setWhy({ meter: r.meter.id, month: c.month })} />
                    </Td>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <Legend />
      </div>
      {why && <WhyPopover meterId={why.meter} month={why.month} onClose={() => setWhy(null)} />}
    </div>
  );
}
