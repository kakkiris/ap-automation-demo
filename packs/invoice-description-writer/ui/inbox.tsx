"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Mono, Panel, Stat, type Tone } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { cn } from "@/lib/utils";
import { postJson, useJson } from "@/lib/use-json";
import { screenHref } from "@/lib/registry";
import { invoiceDescriptionWriterPack as pack } from "@/packs/invoice-description-writer/module";
import type { InboxPayload, InboxSummary } from "@/packs/invoice-description-writer/lib/types";
import { errorText, fmtMoney } from "./format";
import { StatusBadge } from "./status-badge";

const TILES: { key: keyof InboxSummary; label: string; tone: Tone }[] = [
  { key: "received", label: "received", tone: "neutral" },
  { key: "ready", label: "ready to paste into Avid", tone: "paid" },
  { key: "manual", label: "needs manual entry", tone: "signal" },
  { key: "routed", label: "routed to utilities", tone: "lag" },
];

const TH = "px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function Inbox() {
  const { data, error } = useJson<InboxPayload>(`${pack.apiBase}/inbox`);
  const [received, setReceived] = useState<InboxPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const view = received ?? data;

  async function receive() {
    setBusy(true);
    setProblem(null);
    try {
      const payload = await postJson<InboxPayload>(`${pack.apiBase}/receive`);
      setReceived(payload);
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-sm text-risk">{errorText(error)}</p>;
  if (!view) return <p className="text-muted-foreground">Loading today&apos;s invoices.</p>;

  return (
    <div>
      <ScreenHeader
        screen="invoice-description-writer/receive-todays-invoices"
        title="Receive today's invoices"
        right={
          <div className="flex flex-col items-end gap-1">
            <Button onClick={receive} disabled={busy || view.received}>
              {busy ? "Receiving" : "Receive invoices"}
            </Button>
            {view.received && <span className="text-xs text-muted-foreground">Today&apos;s invoices are in.</span>}
          </div>
        }
      />
      {problem && <p className="mb-3 rounded-md border border-risk/30 bg-risk-soft p-2 text-sm text-risk">{problem}</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {TILES.map((t) => (
          <Stat key={t.key} tone={t.tone} value={<div data-testid={`summary-${t.key}`}>{view.summary[t.key]}</div>} label={t.label} />
        ))}
      </div>
      {view.items.length === 0 ? (
        <EmptyState title="No invoices received yet. Press Receive invoices to bring in today's post." />
      ) : (
        <>
          <Panel accent bodyClassName="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={TH}>Invoice</TableHead>
                  <TableHead className={TH}>Vendor</TableHead>
                  <TableHead className={TH}>Property</TableHead>
                  <TableHead className={TH}>Invoice number</TableHead>
                  <TableHead className={cn(TH, "text-right")}>Amount</TableHead>
                  <TableHead className={TH}>Status</TableHead>
                  <TableHead className={TH}>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.items.map((item) => (
                  <TableRow key={item.invoice_id} data-testid={`inbox-row-${item.invoice_id}`}>
                    <TableCell className="px-3 font-mono font-medium tabular-nums">
                      <Link className="hover:underline" href={`${screenHref(pack, "write-the-invoice-description")}?id=${item.invoice_id}`}>
                        {item.invoice_id}
                      </Link>
                    </TableCell>
                    <TableCell className="px-3">{item.vendor_name ?? <span className="text-muted-foreground">not read</span>}</TableCell>
                    <TableCell className="px-3">{item.property_code !== null ? <Mono>{item.property_code}</Mono> : <span className="text-muted-foreground">not read</span>}</TableCell>
                    <TableCell className="px-3 font-mono tabular-nums">{item.invoice_number ?? <span className="font-sans text-muted-foreground">not read</span>}</TableCell>
                    <TableCell className="px-3 text-right font-mono tabular-nums">
                      {item.amount !== null ? fmtMoney(item.amount) : <span className="font-sans text-muted-foreground">not read</span>}
                    </TableCell>
                    <TableCell className="px-3">
                      <StatusBadge status={item.status} data-testid={`status-${item.invoice_id}`} />
                    </TableCell>
                    <TableCell className="px-3 text-muted-foreground" data-testid={`note-${item.invoice_id}`}>
                      {item.note ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <p className="mt-2 text-xs text-muted-foreground">Example data: {view.summary.received} invoices in one day&apos;s folder.</p>
        </>
      )}
    </div>
  );
}
