"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LinkButton } from "@/components/ui/link-button";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Mono, Panel } from "@/components/shell/kit";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { Account, Cell, LedgerLine, Meter, Property, Provider, RowFlags, Unit } from "@/packs/utility-bills-to-yardi/types";
import { fmtDate, fmtMoney, monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";
import { StatusCell, StatusWord } from "./cell";
import { FlagChips } from "./flags";
import { Td, Th } from "./table-bits";

interface MeterData {
  meter: Meter;
  unit: Unit | null;
  property: Property;
  provider: Provider | null;
  accounts: Account[];
  cells: Cell[];
  lines: Record<string, (LedgerLine & { kind: string })[]>;
  deposits: { account_number: string; amount: number; post_month: string; invoice_number: string }[];
  flags: RowFlags;
  months: string[];
  demo_month: string;
  exception: { id: string; type: string } | null;
  units_served: Unit[];
  why: { rule: string; rent_roll: string; account: string };
}

export function MeterDetail({ meterId }: { meterId: string }) {
  const params = useSearchParams();
  const focus = params.get("month");
  const { data, error } = useJson<MeterData>(`${utilityBillsToYardiPack.apiBase}/meter/${meterId}`);
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading the meter.</p>;
  const { meter, unit, property } = data;
  const kindLabel = meter.kind === "unit" ? `unit meter, unit ${unit?.label}` : meter.kind === "house" ? `${meter.service_type === "water" ? "water master" : "house meter"}${meter.location_note ? `, ${meter.location_note}` : ""}` : "shared meter";
  const focusCell = focus ? data.cells.find((c) => c.month === focus) : null;
  return (
    <div>
      <ScreenHeader
        screen="meter-register/one-meters-history"
        title={`One meter's history: ${meter.meter_number ?? "no meter number"}, ${kindLabel}`}
        right={
          <div className="flex gap-2">
            <LinkButton variant="outline" href={utilRoutes.grid(property.id)}>{property.name}, month by month</LinkButton>
            <LinkButton variant="outline" href={`${utilRoutes.master}?site=${property.id}`}>Every meter and its account</LinkButton>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Meter" bodyClassName="p-4 text-sm">
          <dl className="space-y-1">
            <div><dt className="inline text-muted-foreground">Master key: </dt><dd className="inline"><Mono>{meter.id}</Mono></dd></div>
            <div><dt className="inline text-muted-foreground">Meter number: </dt><dd className="inline">{meter.meter_number ? <Mono>{meter.meter_number}</Mono> : <span className="text-signal">blank on the master</span>}</dd></div>
            <div><dt className="inline text-muted-foreground">Site: </dt><dd className="inline">{property.name}, {property.city}, code {property.code}</dd></div>
            <div><dt className="inline text-muted-foreground">Service: </dt><dd className="inline">{meter.service_type}, {meter.provider}{data.provider?.billing_status === "behind" ? " (billing behind)" : ""}</dd></div>
            <div><dt className="inline text-muted-foreground">Kind: </dt><dd className="inline">{meter.kind}</dd></div>
            {meter.kind === "shared" && <div><dt className="inline text-muted-foreground">Units served: </dt><dd className="inline">{data.units_served.map((u) => `${u.label} (${u.square_feet} sq ft)`).join(", ")}. Split by hand on square feet.</dd></div>}
          </dl>
          <div className="mt-2"><FlagChips flags={data.flags} /></div>
          {data.exception && (
            <div className="mt-2 rounded-md bg-signal-soft px-2 py-1 ring-1 ring-inset ring-signal/30">
              An open exception ({data.exception.type.replace(/_/g, " ")}) raised this row.{" "}
              <Link className="font-medium text-dept underline underline-offset-4" href={`${utilRoutes.exceptions}?focus=${data.exception.id}`}>Open it in Match bills to meters</Link>
            </div>
          )}
          {meter.notes.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">{meter.notes.map((n, i) => <div key={i}>{n}</div>)}</div>
          )}
          {unit && (
            <>
              <h2 className="mb-2 mt-4 font-medium">Rent roll, unit {unit.label}</h2>
              <dl className="space-y-1">
                <div><dt className="inline text-muted-foreground">Tenant: </dt><dd className="inline">{unit.tenant ?? "vacant"}</dd></div>
                {unit.move_in && <div><dt className="inline text-muted-foreground">Move-in: </dt><dd className="inline">{fmtDate(unit.move_in)}</dd></div>}
                {unit.move_out && <div><dt className="inline text-muted-foreground">Move-out: </dt><dd className="inline">{fmtDate(unit.move_out)}</dd></div>}
                <div><dt className="inline text-muted-foreground">Who pays: </dt><dd className="inline">{unit.who_pays === "owner" ? "owner" : "tenant"}{unit.payer_source === "seller_workbook" ? " (carried over from the seller's workbook, unverified)" : unit.payer_source === "verified" ? " (verified on site)" : ""}</dd></div>
                <div><dt className="inline text-muted-foreground">Address: </dt><dd className="inline">{unit.address}</dd></div>
              </dl>
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                {data.months.map((m) => (
                  <span key={m} className={unit.occupancy[m] === "vacant" ? "rounded bg-card px-1.5 py-0.5 ring-1 ring-border" : "rounded bg-muted px-1.5 py-0.5"}>
                    {monthLabel(m)}: {unit.occupancy[m]}{unit.tenant_history[m] ? `, ${unit.tenant_history[m]}` : ""}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>
        <Panel accent title="Account history" className="lg:col-span-2" bodyClassName="p-4 text-sm">
          {data.accounts.length === 0 && <p className="text-muted-foreground">No account seen for this meter yet. A bill that surfaces one on Capture this month&apos;s bills, or the provider account list, adds it here.</p>}
          <Table>
            <TableHeader>
              <TableRow><Th className="px-2">Account number</Th><Th className="px-2">Holder</Th><Th className="px-2">Active from</Th><Th className="px-2">Active to</Th><Th className="px-2">Deposit held</Th></TableRow>
            </TableHeader>
            <TableBody>
              {data.accounts.map((a) => {
                const dep = data.deposits.find((d) => d.account_number === a.account_number);
                return (
                  <TableRow key={a.account_number}>
                    <Td mono className="px-2 py-1">{a.account_number}</Td>
                    <Td className="px-2 py-1">{a.holder === "landlord" ? "landlord" : `tenant, ${a.holder_name}`}</Td>
                    <Td className="px-2 py-1">{fmtDate(a.active_from)}</Td>
                    <Td className="px-2 py-1">{a.active_to ? fmtDate(a.active_to) : "open"}</Td>
                    <Td className="px-2 py-1 tabular-nums">{dep ? `${fmtMoney(dep.amount)} (${monthLabel(dep.post_month)})` : ""}</Td>
                  </TableRow>
                );
              })}
              {meter.notes.map((n, i) => (
                <TableRow key={`n${i}`} className="text-xs text-muted-foreground"><Td colSpan={5} className="whitespace-normal px-2 py-1">{n}</Td></TableRow>
              ))}
            </TableBody>
          </Table>
          <h2 className="mb-2 mt-4 font-medium">Months</h2>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {data.cells.map((c) => (
              <div key={c.month} className={c.month === focus ? "rounded ring-2 ring-dept ring-offset-2" : ""}>
                <div className="mb-1 text-xs text-muted-foreground">{monthLabel(c.month)}</div>
                <StatusCell cell={c} />
                <div className="mt-1 text-xs text-muted-foreground">{data.lines[c.month]?.length ? `${data.lines[c.month].length} line${data.lines[c.month].length > 1 ? "s" : ""}` : ""}</div>
              </div>
            ))}
          </div>
          {focusCell && (
            <div className="mt-4 rounded-md bg-muted/60 p-3">
              <div className="flex items-center gap-2 font-medium">{monthLabel(focusCell.month)}: <StatusWord status={focusCell.status} /></div>
              <div className="text-muted-foreground">{focusCell.account_number ? `Account ${focusCell.account_number} was active.` : "No landlord account active."}</div>
              {(data.lines[focusCell.month] ?? []).length > 0 ? (
                <Table className="mt-2 text-xs">
                  <TableHeader><TableRow><Th className="h-7 px-2">Invoice number</Th><Th className="h-7 px-2">GL</Th><Th right className="h-7 px-2">Amount</Th><Th className="h-7 px-2">Match</Th><Th className="h-7 px-2">Paid</Th></TableRow></TableHeader>
                  <TableBody>
                    {data.lines[focusCell.month].map((l) => (
                      <TableRow key={l.id}><Td mono className="px-2 py-1">{l.invoice_number || "(none)"}</Td><Td className="px-2 py-1">{l.gl_name}</Td><Td right className="px-2 py-1">{fmtMoney(l.amount)}</Td><Td className="px-2 py-1">{l.kind === "partial" ? "partial account number" : l.kind}</Td><Td className="px-2 py-1">{l.payment_date}</Td></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-muted-foreground">No ledger line matched for this month. Lines land after Yardi import confirmed on Capture this month&apos;s bills.</div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
