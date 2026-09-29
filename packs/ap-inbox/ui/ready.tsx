"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import type { ImportRow, ReadyView } from "@/packs/ap-inbox/lib/types";
import { fmtCents } from "@/packs/ap-inbox/lib/money";
import { apiBase, COUNT_CHIP, COUNT_NUM, ErrorLine, ExampleData, errorText, href, Loading, money, reviewHref, StateBadge, TD, TD_ID, TD_NUM, TH, TH_NUM, THEAD, TR } from "./shared";

const ROW_KEYS: (keyof ImportRow)[] = [
  "entity",
  "vendorCode",
  "payee",
  "invoiceNumber",
  "invoiceDate",
  "postMonth",
  "dueDate",
  "expenseType",
  "cashAccount",
  "glAccount",
  "amount",
  "description",
  "notes",
  "line",
  "reference",
];

export function Ready() {
  const { data, error } = useJson<ReadyView>(`${apiBase}/ready`);
  const [override, setOverride] = useState<ReadyView | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const view = override ?? data;

  async function markPaid() {
    setBusy(true);
    try {
      setOverride(await postJson<ReadyView>(`${apiBase}/ready/paid`));
      setNote(null);
    } catch (err) {
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const paidCount = view?.batch?.invoiceCount ?? view?.invoiceCount ?? 0;
  const paidLines = view?.batch?.lineCount ?? view?.lineCount ?? 0;
  const paidTotal = view?.batch?.totalAmount ?? view?.totalAmount ?? 0;

  return (
    <div>
      <ScreenHeader
        screen="ap-inbox/ready-for-yardi"
        title="Ready for Yardi"
        right={
          view ? (
            <div className="flex items-center gap-2">
              <a className={buttonVariants({ variant: "outline" })} href={`${apiBase}/ready/file`} download={view.fileName}>
                Download import file
              </a>
              <Button disabled={busy || view.invoiceCount === 0 || view.paid} onClick={markPaid}>
                Mark batch paid
              </Button>
            </div>
          ) : undefined
        }
      />
      <p className="mb-1 text-sm text-muted-foreground">Approved invoices for this week&apos;s batch. The file is the shape Yardi takes; the import itself stays outside this demo.</p>
      <ExampleData />
      {error && <ErrorLine text={error} />}
      {!view && !error && <Loading what="the batch" />}
      {view && (
        <>
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
            <div data-testid="invoice-count" className={COUNT_CHIP}>
              <span className={cn(COUNT_NUM, view.paid && "text-paid")}>{view.invoiceCount}</span> invoices
            </div>
            <div data-testid="line-count" className={COUNT_CHIP}>
              <span className={cn(COUNT_NUM, view.paid && "text-paid")}>{view.lineCount}</span> lines
            </div>
            <div data-testid="batch-total" className={COUNT_CHIP}>
              Total <span className={cn("font-mono", COUNT_NUM, view.paid && "text-paid")}>{fmtCents(view.totalAmount)}</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{view.fileName}</span>
          </div>
          <ErrorLine text={note} />
          {view.paid && (
            <div className="mb-4 rounded-lg bg-paid-soft px-4 py-2.5 text-sm text-paid ring-1 ring-inset ring-paid/25">
              <span data-testid="batch-paid" className="font-medium">
                Batch paid: {paidCount} invoices, {paidLines} lines, {fmtCents(paidTotal)}
              </span>{" "}
              <Link href={href("property-tracker-updates")} className="underline-offset-4 hover:underline">
                Open Property tracker updates
              </Link>
            </div>
          )}
          {view.invoiceCount === 0 && !view.paid && <EmptyState className="mb-4" title="Nothing is ready for Yardi yet. Approve submitted invoices to build the batch." action={{ href: href("approve"), label: "Open Approve" }} />}

          <Panel title="Import file preview, 15 columns" accent className="mb-6" bodyClassName="overflow-x-auto p-0">
            <table data-testid="import-preview" className="w-max min-w-full font-mono text-xs tabular-nums">
              <thead className={THEAD}>
                <tr>
                  {view.columns.map((c) => (
                    <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r, i) => (
                  <tr key={`${r.reference}-${r.line}-${i}`} className={TR}>
                    {ROW_KEYS.map((k) => (
                      <td key={k} className={cn("px-2 py-1 whitespace-nowrap", k === "amount" && "text-right")}>
                        {r[k]}
                      </td>
                    ))}
                  </tr>
                ))}
                {view.rows.length === 0 && (
                  <tr className={TR}>
                    <td colSpan={view.columns.length} className="px-2 py-3 text-center text-muted-foreground">
                      No rows yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>

          <Panel title="Invoices in the batch" bodyClassName="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Item</th>
                  <th className={TH}>Payee</th>
                  <th className={TH}>Invoice number</th>
                  <th className={TH_NUM}>Amount</th>
                  <th className={TH_NUM}>Lines</th>
                  <th className={TH}>Property</th>
                  <th className={TH}>State</th>
                </tr>
              </thead>
              <tbody>
                {view.invoices.map((r) => (
                  <tr key={r.itemId} data-testid={`ready-row-${r.itemId}`} className={TR}>
                    <td className={TD_ID}>
                      <Link href={reviewHref(r.itemId)} className="hover:underline">
                        {r.itemId}
                      </Link>
                    </td>
                    <td className={TD}>{r.payee}</td>
                    <td className={TD_ID}>{r.invoiceNumber}</td>
                    <td className={TD_NUM}>{money(r.amount)}</td>
                    <td className={TD_NUM}>{r.lineCount}</td>
                    <td className={cn(TD, "text-xs")}>{r.property ?? ""}</td>
                    <td className={TD}>
                      <StateBadge state={r.state} testId="ready-state" />
                    </td>
                  </tr>
                ))}
                {view.invoices.length === 0 && (
                  <tr className={TR}>
                    <td colSpan={7} className="px-3 py-3 text-center text-sm text-muted-foreground">
                      No invoices in the batch
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
