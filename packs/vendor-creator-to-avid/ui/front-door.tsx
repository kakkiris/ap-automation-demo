"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Mono, Panel, StatusPill, type Tone } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { screenHref } from "@/lib/registry";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { vendorCreatorToAvidPack as pack } from "@/packs/vendor-creator-to-avid/module";
import type { FrontDoorPayload, InvoiceFlag, InvoiceRow } from "@/packs/vendor-creator-to-avid/lib/types";
import { errorText, useMode } from "./mode";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** One tone per flag: known is settled, first seen and near match need a person, Yardi only is informational. */
const FLAG_TONE: Record<InvoiceFlag, Tone> = {
  known: "paid",
  first_seen: "signal",
  yardi_only: "info",
  near_match: "signal",
};

const TH = "text-xs uppercase tracking-wide text-muted-foreground";
const LINK = "font-medium text-dept underline-offset-4 hover:underline";

export function FrontDoor() {
  const { version, saving } = useMode();
  const { data, error, refetch } = useJson<FrontDoorPayload>(`${pack.apiBase}/front-door`);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (version > 0) void refetch();
  }, [version, refetch]);

  async function receive() {
    setBusy(true);
    setProblem(null);
    try {
      await postJson<FrontDoorPayload>(`${pack.apiBase}/front-door/receive`);
      await refetch();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ScreenHeader screen="vendor-creator-to-avid/catch-unknown-payees-on-arrival" title="Catch unknown payees on arrival" />
      <p className="mb-4 text-sm text-muted-foreground">Every payee is checked against both masters the moment the invoice lands.</p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={receive} disabled={busy || saving}>
          {busy ? "Receiving" : "Receive invoices"}
        </Button>
        {data?.received && (
          <span className="text-sm text-muted-foreground">
            {data.invoices.length} invoices arrived on {data.demo_date}. Example data.
          </span>
        )}
      </div>
      {error && <p className="mb-4 text-sm text-risk">{error}</p>}
      {problem && <p className="mb-4 text-sm text-risk">{problem}</p>}
      {data && !data.received && <EmptyState title={"No invoices received yet. Press Receive invoices to check today's payees against both masters."} />}
      {data && data.received && (
        <Panel accent bodyClassName="p-0">
          <Table data-testid="invoice-table">
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Invoice</TableHead>
                <TableHead className={TH}>Payee</TableHead>
                <TableHead className={cn(TH, "text-right")}>Amount</TableHead>
                <TableHead className={TH}>Matched vendor</TableHead>
                <TableHead className={TH}>Flag</TableHead>
                <TableHead className={cn(TH, "text-right")}>Days in queue</TableHead>
                <TableHead className={TH}>Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.invoices.map((inv) => (
                <InvoiceRowView key={inv.invoice_id} inv={inv} />
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

function InvoiceRowView({ inv }: { inv: InvoiceRow }) {
  const id = inv.invoice_id;
  return (
    <TableRow data-testid={`invoice-${id}`} className={cn("border-border/70", inv.flag === "first_seen" && "bg-signal-soft/60", inv.flag === "near_match" && "bg-signal-soft/40")}>
      <TableCell>
        <Mono className="text-xs">{id}</Mono>
      </TableCell>
      <TableCell>{inv.payee_name}</TableCell>
      <TableCell className="text-right">
        <Mono>{money.format(inv.amount)}</Mono>
      </TableCell>
      <TableCell>
        {inv.matched_yardi_vendor_id ? (
          <>
            <Mono className="text-xs">{inv.matched_yardi_vendor_id}</Mono> {inv.matched_yardi_name}
          </>
        ) : (
          <span className="text-muted-foreground">none</span>
        )}
      </TableCell>
      <TableCell>
        <StatusPill tone={FLAG_TONE[inv.flag]}>{inv.flag_label}</StatusPill>{" "}
        <span className="font-mono text-xs text-muted-foreground" data-testid={`invoice-${id}-flag`}>
          {inv.flag}
        </span>
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", inv.days_in_queue > 0 && "font-semibold text-risk")} data-testid={`invoice-${id}-days`}>
        {inv.days_in_queue}
      </TableCell>
      <TableCell>
        {inv.flag === "first_seen" && (
          <Link className={LINK} href={`${screenHref(pack, "create-the-vendor-once-in-yardi")}?name=${encodeURIComponent(inv.payee_name)}`}>
            Create vendor in Yardi
          </Link>
        )}
        {inv.flag === "near_match" && inv.matched_yardi_vendor_id && (
          <Link className={LINK} href={`${screenHref(pack, "decide-the-near-matches")}?pair=${inv.matched_yardi_vendor_id}`}>
            Open near match
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
}
