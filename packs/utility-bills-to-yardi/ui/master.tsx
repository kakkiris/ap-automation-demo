"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LinkButton } from "@/components/ui/link-button";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Panel } from "@/components/shell/kit";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { Account, Cell, Meter, Property, RowFlags, Unit } from "@/packs/utility-bills-to-yardi/types";
import { fmtDate } from "@/packs/utility-bills-to-yardi/lib/dates";
import { SitePicker } from "./site-picker";
import { StatusCell } from "./cell";
import { FlagChips } from "./flags";
import { WhyPopover } from "./why";
import { ROW_TINT, Td, Th } from "./table-bits";
import { cn } from "@/lib/utils";

interface MasterRow { meter: Meter; unit: Unit | null; flags: RowFlags; current: Account | null; history_count: number; cell: Cell }
interface MasterData { property: Property; rows: MasterRow[]; unmapped: number; demo_month: string; blank_meters: number }

export function Master() {
  const router = useRouter();
  const params = useSearchParams();
  const site = params.get("site") ?? "";
  const { data, error } = useJson<MasterData>(`${utilityBillsToYardiPack.apiBase}/master${site ? `?site=${site}` : ""}`);
  const [why, setWhy] = useState<{ meter: string; month: string } | null>(null);
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading the meters.</p>;
  const water = data.rows.filter((r) => r.meter.service_type === "water").length;
  return (
    <div>
      <ScreenHeader
        screen="meter-register/every-meter-and-its-account"
        title={`Every meter and its account, ${data.property.name}`}
        right={
          <div className="flex items-center gap-2">
            <SitePicker value={data.property.id} onChange={(id) => router.push(`${utilRoutes.master}?site=${id}`)} />
            <LinkButton variant="outline" href={`${utilRoutes.today}?site=${data.property.id}`}>The tracker as kept today</LinkButton>
            <LinkButton variant="outline" href={utilRoutes.grid(data.property.id)}>One property, month by month</LinkButton>
          </div>
        }
      />
      <p className="mb-3 text-sm text-muted-foreground">
        {data.rows.length} meters on record: {data.rows.length - water} electric, {water} water. {data.blank_meters} with no meter number yet, {data.rows.filter((r) => r.flags.no_account_history).length} with no account seen.
      </p>
      {data.unmapped > 0 && (
        <div className="mb-3 rounded-md bg-signal-soft px-3 py-2 text-sm ring-1 ring-inset ring-signal/30">
          {data.unmapped === 1 ? "One bill carries" : `${data.unmapped} bills carry`} an account number linked to no meter here.{" "}
          <Link className="font-medium text-dept underline underline-offset-4" href={utilRoutes.exceptions}>Match bills to meters</Link>
        </div>
      )}
      <Panel bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <Th>Meter number</Th><Th>Kind</Th><Th>Service</Th><Th>Provider</Th><Th>Unit</Th><Th>Account holder now</Th><Th>Account number</Th><Th>Since</Th><Th>Flags</Th><Th>This month</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.meter.id} className={cn(r.meter.kind === "house" && ROW_TINT.house, r.meter.kind === "shared" && ROW_TINT.shared)}>
                <Td mono>
                  <Link className="hover:underline" href={utilRoutes.meter(r.meter.id)}>{r.meter.meter_number ?? <span className="font-sans text-signal">blank</span>}</Link>
                  <div className="text-[10px] text-muted-foreground">{r.meter.id}</div>
                </Td>
                <Td>{r.meter.kind === "house" ? (r.meter.service_type === "water" ? "water master" : "house") : r.meter.kind}{r.meter.location_note ? `, ${r.meter.location_note}` : ""}</Td>
                <Td>{r.meter.service_type}</Td>
                <Td>{r.meter.provider}</Td>
                <Td>{r.unit ? `${r.unit.label}${r.unit.tenant ? "" : " (vacant)"}` : r.meter.kind === "shared" ? `${r.meter.units_served.length} units` : ""}</Td>
                <Td>{r.current ? (r.current.holder === "landlord" ? "landlord" : `tenant, ${r.current.holder_name}`) : ""}</Td>
                <Td mono>{r.current?.account_number ?? ""}</Td>
                <Td className="text-muted-foreground">{r.current ? fmtDate(r.current.active_from) : ""}</Td>
                <Td className="whitespace-normal"><FlagChips flags={r.flags} />{r.history_count > 1 && <span className="ml-1 text-xs text-muted-foreground">{r.history_count} accounts in history</span>}</Td>
                <Td className="w-32 px-2 py-1"><StatusCell cell={r.cell} compact onClick={() => setWhy({ meter: r.meter.id, month: data.demo_month })} /></Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      {why && <WhyPopover meterId={why.meter} month={why.month} onClose={() => setWhy(null)} />}
    </div>
  );
}
