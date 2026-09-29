"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, Panel } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import type { ApprovalsView } from "@/packs/ap-inbox/lib/types";
import { apiBase, ErrorLine, ExampleData, errorText, fmtWhen, href, Loading, money, reviewHref, SourceBadge, TD, TD_ID, TD_NUM, TH, TH_NUM, THEAD, TR } from "./shared";

export function Approvals() {
  const { data, error } = useJson<ApprovalsView>(`${apiBase}/approvals`);
  const [override, setOverride] = useState<ApprovalsView | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const view = override ?? data;

  async function run(path: string, body?: unknown, after?: (v: ApprovalsView & { approved?: number }) => string | null) {
    setBusy(true);
    try {
      const v = await postJson<ApprovalsView & { approved?: number }>(`${apiBase}/approvals/${path}`, body);
      setOverride(v);
      setNote(after ? after(v) : null);
      return true;
    } catch (err) {
      setNote(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ScreenHeader
        screen="ap-inbox/approve"
        title="Approve"
        right={
          <Button disabled={busy || !view || view.invoices.length === 0} onClick={() => void run("approve-all", undefined, (v) => `${v.approved ?? 0} approved`)}>
            Approve all
          </Button>
        }
      />
      <p className="mb-1 text-sm text-muted-foreground">Approver view. Approve or return each invoice as today.</p>
      <ExampleData />
      {error && <ErrorLine text={error} />}
      {!view && !error && <Loading what="the queue" />}
      {view && (
        <>
          {note && (
            <p className="mt-3 text-sm">
              {note}.{" "}
              <Link href={href("ready-for-yardi")} className="font-medium text-dept underline-offset-4 hover:underline">
                Open Ready for Yardi
              </Link>
            </p>
          )}
          {view.invoices.length === 0 ? (
            <EmptyState className="mt-3" title="Nothing to approve yet. Submit drafts from this week's arrivals and they wait here." action={{ href: href("this-weeks-arrivals"), label: "Open this week's arrivals" }} />
          ) : (
            <Panel className="mt-3" bodyClassName="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Item</th>
                    <th className={TH}>Source</th>
                    <th className={TH}>Payee</th>
                    <th className={TH}>Invoice number</th>
                    <th className={TH_NUM}>Amount</th>
                    <th className={TH}>Entity</th>
                    <th className={TH}>Ledger account</th>
                    <th className={TH}>Property</th>
                    <th className={TH_NUM}>Lines</th>
                    <th className={TH}>Submitted</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {view.invoices.map((r) => (
                    <tr key={r.itemId} data-testid={`approval-row-${r.itemId}`} className={TR}>
                      <td className={TD_ID}>
                        <Link href={reviewHref(r.itemId)} className="hover:underline">
                          {r.itemId}
                        </Link>
                      </td>
                      <td className={TD}>
                        <SourceBadge source={r.source} />
                      </td>
                      <td className={TD}>{r.payee}</td>
                      <td className={TD_ID}>{r.invoiceNumber}</td>
                      <td className={TD_NUM}>{money(r.amount)}</td>
                      <td className={TD_ID}>{r.entity}</td>
                      <td className={TD_ID}>{r.glAccount}</td>
                      <td className={cn(TD, "text-xs")}>{r.property ?? ""}</td>
                      <td className={TD_NUM}>{r.lineCount}</td>
                      <td className={cn(TD, "whitespace-nowrap text-xs text-muted-foreground tabular-nums")}>{fmtWhen(r.submittedAt)}</td>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" disabled={busy} onClick={() => void run(`${r.itemId}/approve`)}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              setReturnNote("");
                              setReturning(r.itemId);
                            }}
                          >
                            Return
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </>
      )}
      <Dialog open={returning !== null} onOpenChange={(open) => !open && setReturning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return {returning}</DialogTitle>
            <DialogDescription>The invoice goes back to the specialist with your note.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="return-note">Note</Label>
            <Textarea id="return-note" aria-label="Note" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturning(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!returning) return;
                const ok = await run(`${returning}/return`, { note: returnNote }, () => `Returned ${returning}`);
                if (ok) setReturning(null);
              }}
            >
              Return to specialist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
