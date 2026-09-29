"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Panel } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { ITEM_STATES, type InboxView, type ItemState, type ItemView } from "@/packs/ap-inbox/lib/types";
import { apiBase, COUNT_CHIP, COUNT_NUM, ErrorLine, ExampleData, errorText, fmtWhen, Loading, money, reviewHref, SourceBadge, StateBadge, TD, TD_ID, TD_NUM, TH, TH_NUM, THEAD, TR } from "./shared";

function counterSlug(state: ItemState): string {
  return state.toLowerCase().replace(/\s+/g, "-");
}

// The number in each counter takes the tone of its state; the label stays quiet.
const COUNTER_NUM_CLASS: Record<ItemState, string> = {
  New: "text-foreground",
  Drafted: "text-info",
  "Needs attention": "text-signal",
  Submitted: "text-dept",
  Approved: "text-paid",
  Paid: "text-paid",
  Skipped: "text-lag",
};

export function Inbox() {
  const router = useRouter();
  const { data, error } = useJson<InboxView>(`${apiBase}/inbox`);
  const [override, setOverride] = useState<InboxView | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const arriving = useRef(false);

  // The week arrives on open: every New item gets its draft, once.
  useEffect(() => {
    if (!data || data.counters.New === 0 || arriving.current) return;
    arriving.current = true;
    postJson<InboxView>(`${apiBase}/arrive`)
      .then((v) => {
        setOverride(v);
        setNote(null);
      })
      .catch((err) => setNote(errorText(err)))
      .finally(() => {
        arriving.current = false;
      });
  }, [data]);

  const view = override ?? (data && data.counters.New === 0 ? data : null);

  async function submitAll() {
    setBusy(true);
    try {
      const v = await postJson<InboxView & { submitted: number }>(`${apiBase}/inbox/submit-all`);
      setOverride(v);
      setNote(`${v.submitted} submitted`);
    } catch (err) {
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function addDocument() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setUploadError("Pick a PDF first.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${apiBase}/upload`, { method: "POST", body });
      if (!res.ok) throw new Error(await res.text());
      const v = (await res.json()) as ItemView;
      setAddOpen(false);
      router.push(reviewHref(v.item.itemId));
    } catch (err) {
      setUploadError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ScreenHeader
        screen="ap-inbox/this-weeks-arrivals"
        title="This week's arrivals"
        right={
          <div className="flex items-center gap-2">
            <Button onClick={submitAll} disabled={busy || !view || view.readyToSubmit === 0}>
              Submit all ready drafts
            </Button>
            <Button variant="outline" onClick={() => setAddOpen(true)} disabled={busy}>
              Add a document
            </Button>
          </div>
        }
      />
      <p className="mb-1 text-sm text-muted-foreground">Four doors, one inbox: email, Monday.com, utility portals, and the post.</p>
      <ExampleData />
      {error && <ErrorLine text={error} />}
      {!view && !error && <Loading what="the week" />}
      {view && (
        <>
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">
            {ITEM_STATES.map((state) => (
              <div key={state} data-testid={`counter-${counterSlug(state)}`} className={COUNT_CHIP}>
                <span className="text-muted-foreground">{state}</span> <span className={cn("ml-1", COUNT_NUM, COUNTER_NUM_CLASS[state])}>{view.counters[state]}</span>
              </div>
            ))}
            <div className="ml-2 text-sm text-muted-foreground">{view.total} arrivals this week</div>
            {view.readyToSubmit > 0 && <div className="text-sm text-muted-foreground">{view.readyToSubmit} ready to submit</div>}
          </div>
          {note && <p className="mb-3 text-sm">{note}</p>}
          <Panel bodyClassName="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Item</th>
                  <th className={TH}>Received</th>
                  <th className={TH}>Source</th>
                  <th className={TH}>Vendor</th>
                  <th className={TH_NUM}>Amount</th>
                  <th className={TH}>Property</th>
                  <th className={TH}>State</th>
                  <th className={TH}>Needs</th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((row) => (
                  <tr key={row.item.itemId} data-testid={`inbox-row-${row.item.itemId}`} className={cn(TR, row.state === "Needs attention" && "bg-signal-soft/50", row.state === "Skipped" && "text-muted-foreground")}>
                    <td className={TD_ID}>
                      <Link href={reviewHref(row.item.itemId)} className="hover:underline">
                        {row.item.itemId}
                      </Link>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground tabular-nums")}>{fmtWhen(row.item.receivedAt)}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <SourceBadge source={row.item.source} />
                        {row.item.trackerCardRef && <span className="font-mono text-xs text-muted-foreground tabular-nums">{row.item.trackerCardRef}</span>}
                      </div>
                      {row.item.noticeText && <div className="mt-1 max-w-xs text-xs text-muted-foreground">{row.item.noticeText}</div>}
                    </td>
                    <td className={TD}>{row.vendorGuess ?? ""}</td>
                    <td className={TD_NUM}>{money(row.amount)}</td>
                    <td className={cn(TD, "text-xs")}>{row.propertyGuess ?? (row.lineCount > 1 ? `${row.lineCount} lines` : "")}</td>
                    <td className={TD}>
                      <StateBadge state={row.state} />
                    </td>
                    <td className={cn(TD, "text-xs text-signal")}>{row.exceptionTitles.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a document</DialogTitle>
            <DialogDescription>A PDF that did not come through one of the four doors. It joins this week&apos;s arrivals as an email item.</DialogDescription>
          </DialogHeader>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" aria-label="Document file" className="text-sm" onChange={() => setUploadError(null)} />
          {uploadError && <p className="text-sm text-risk">{uploadError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={addDocument} disabled={busy}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
