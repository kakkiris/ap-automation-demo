"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel, StatusPill, type Tone } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE,
  DRAFT_FIELDS,
  FIELD_LABELS,
  METHOD_LABELS,
  type DraftField,
  type FieldSource,
  type ItemView,
  type SplitLine,
} from "@/packs/ap-inbox/lib/types";
import { fmtCents } from "@/packs/ap-inbox/lib/money";
import { apiBase, ErrorLine, ExampleData, errorText, fmtWhen, href, Loading, money, reviewHref, SourceBadge, splitHref, StateBadge, TD, TD_ID, TD_NUM, TH, TH_NUM, THEAD, TR } from "./shared";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

type Band = "high" | "mid" | "low" | "none";

function bandFor(conf: number | null): Band {
  if (conf === null) return "none";
  if (conf >= CONFIDENCE.HIGH) return "high";
  if (conf >= CONFIDENCE.CONFIRM) return "mid";
  return "low";
}

// The confidence dot: sure is paid, check it is signal, below the line is risk, empty is lag.
const BAND_CLASS: Record<Band, string> = {
  high: "bg-paid",
  mid: "bg-signal",
  low: "bg-risk",
  none: "bg-lag",
};

// Where each field came from, as a tone: the document is the surest, a person's typing is a signal.
const FIELD_SOURCE_TONE: Record<FieldSource, Tone> = {
  "Read from document": "paid",
  "Vendor history": "info",
  "Resolved from property": "dept",
  Default: "neutral",
  You: "dept",
};

/** A text box that saves on blur or Enter and follows the value the server sends back. */
function TextField({
  id,
  label,
  value,
  onSave,
  readOnly,
  mono,
  className,
  placeholder,
}: {
  id?: string;
  label: string;
  value: string;
  onSave: (text: string) => Promise<unknown> | void;
  readOnly?: boolean;
  mono?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }
  function commit() {
    if (readOnly) return;
    if (text !== value) void onSave(text);
  }
  return (
    <Input
      id={id}
      aria-label={label}
      value={text}
      readOnly={readOnly}
      placeholder={placeholder}
      className={cn("bg-card", mono && "font-mono tabular-nums", readOnly && "bg-muted text-muted-foreground", className)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}

/**
 * One invoice's draft. Two routes share it: Review an invoice (screen "review") and
 * Split across properties (screen "split"), which the splitter page puts in splitter
 * mode before this renders. The mode buttons move between the two routes.
 */
export function Review({ itemId, screen = "review" }: { itemId: string; screen?: "review" | "split" }) {
  const router = useRouter();
  const { data, error } = useJson<ItemView>(`${apiBase}/items/${itemId}`);
  const [override, setOverride] = useState<ItemView | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendNote, setSendNote] = useState("");
  const [resolveQuery, setResolveQuery] = useState("");
  const view = override ?? data;

  async function act(path: string, body?: unknown): Promise<ItemView | null> {
    setBusy(true);
    try {
      const v = await postJson<ItemView>(`${apiBase}/items/${itemId}/${path}`, body);
      setOverride(v);
      setNote(null);
      return v;
    } catch (err) {
      setNote(errorText(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorLine text={error} />;
  if (!view) return <Loading what="the invoice" />;

  const { item, draft, readiness } = view;
  const splitter = draft.mode === "splitter";
  const canSubmit = readiness.canSubmit && item.state === "Drafted";
  const canSwitchMode = item.state === "Drafted" || item.state === "Needs attention";

  async function toSplitter() {
    const v = await act("mode", { mode: "splitter" });
    if (v) router.push(splitHref(itemId));
  }

  async function toSingle() {
    const v = await act("mode", { mode: "single" });
    if (v) router.push(reviewHref(itemId));
  }
  const ledgerName = (code: string | null) => (code ? (view.ledgerAccounts.find((l) => l.glAccount === code)?.name ?? "") : "");
  const openPropertyException = draft.exceptions.find((e) => !e.resolved && (e.kind === "ambiguous_owner" || e.kind === "unknown_utility_account"));
  const fields: DraftField[] = splitter ? DRAFT_FIELDS.filter((f) => f !== "entity" && f !== "cashAccount") : [...DRAFT_FIELDS];

  function fieldText(field: DraftField): string {
    switch (field) {
      case "amount":
        return draft.amount === null ? "" : fmtCents(draft.amount);
      case "expenseType":
        return draft.expenseType;
      default: {
        const v = draft[field];
        return typeof v === "string" ? v : "";
      }
    }
  }

  function control(field: DraftField) {
    const label = FIELD_LABELS[field];
    const id = `field-input-${field}`;
    if (field === "expenseType") return <TextField id={id} label={label} value={draft.expenseType} onSave={() => undefined} readOnly />;
    if (field === "entity") {
      return (
        <select id={id} aria-label={label} className={SELECT_CLASS} value={draft.entity ?? ""} disabled={busy} onChange={(e) => void act("field", { field, value: e.target.value || null })}>
          <option value="">Pick an entity</option>
          {view!.entities.map((en) => (
            <option key={en.entityCode} value={en.entityCode}>
              {en.entityCode} {en.name}
            </option>
          ))}
        </select>
      );
    }
    if (field === "glAccount") {
      if (draft.glAccount === null && draft.ledgerChoices) return null;
      if (draft.glAccount === null) {
        return (
          <select id={id} aria-label={label} className={SELECT_CLASS} value="" disabled={busy} onChange={(e) => void act("field", { field, value: e.target.value || null })}>
            <option value="">Pick a ledger account</option>
            {view!.ledgerAccounts.map((l) => (
              <option key={l.glAccount} value={l.glAccount}>
                {l.glAccount} {l.name}
              </option>
            ))}
          </select>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <TextField id={id} label={label} value={draft.glAccount} mono className="w-32 shrink-0" onSave={(text) => act("field", { field, value: text || null })} />
          <span className="truncate text-xs text-muted-foreground">{ledgerName(draft.glAccount)}</span>
        </div>
      );
    }
    if (field === "property") {
      return <TextField id={id} label={label} value={fieldText(field)} readOnly={splitter} onSave={(text) => act("field", { field, value: text || null })} />;
    }
    const mono = field === "cashAccount" || field === "invoiceNumber" || field === "invoiceDate" || field === "postMonth" || field === "amount";
    return (
      <TextField
        id={id}
        label={label}
        value={fieldText(field)}
        mono={mono}
        className={field === "amount" ? "text-right" : undefined}
        placeholder={field === "postMonth" ? "YYYY-MM" : field === "invoiceDate" ? "YYYY-MM-DD" : undefined}
        onSave={(text) => act("field", { field, value: text || null })}
      />
    );
  }

  return (
    <div>
      <ScreenHeader
        screen={screen === "split" ? "ap-inbox/split-across-properties" : "ap-inbox/review-an-invoice"}
        title={`${screen === "split" ? "Split across properties" : "Review an invoice"}: ${itemId}`}
        right={
          <div className="flex items-center gap-2 text-sm">
            <Link href={href("this-weeks-arrivals")} className="text-muted-foreground underline-offset-4 hover:text-dept hover:underline">
              Back to this week&apos;s arrivals
            </Link>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="rounded-lg bg-muted p-2 ring-1 ring-foreground/10">
          {item.documentKind === "svg" ? (
            <div className="flex min-h-[700px] items-start justify-center overflow-auto rounded-md bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-testid="document" src={view.documentUrl} alt={`Document ${item.itemId}, ${item.fileName}`} className="max-h-[900px] w-full object-contain" />
            </div>
          ) : (
            <iframe data-testid="document" src={view.documentUrl} title={`Document ${item.itemId}, ${item.fileName}`} className="min-h-[700px] w-full rounded-md bg-card" />
          )}
          <div className="mt-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{item.fileName}</span>
            <a href={view.documentUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-dept hover:underline">
              Open in a new tab
            </a>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
            <span className="font-mono font-semibold tabular-nums">{item.itemId}</span>
            <SourceBadge source={item.source} />
            <StateBadge state={item.state} />
            {item.trackerCardRef && (
              <span className="text-muted-foreground">
                Tracker card <span className="font-mono text-foreground tabular-nums">{item.trackerCardRef}</span>
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">Received {fmtWhen(item.receivedAt)}</span>
          </div>
          {item.noticeText && <p className="rounded-lg bg-signal-soft px-3 py-2 text-xs ring-1 ring-inset ring-signal/30">{item.noticeText}</p>}
          {item.returnNote && (
            <p className="rounded-lg bg-info-soft px-3 py-2 text-sm ring-1 ring-inset ring-info/25">
              Returned by the approver: {item.returnNote}
            </p>
          )}
          {draft.readFailed && (
            <p className="rounded-lg bg-risk-soft px-3 py-2 text-sm text-risk ring-1 ring-inset ring-risk/25" role="alert">
              Could not read this document, enter fields by hand
            </p>
          )}
          <ErrorLine text={note} />

          <div className="grid gap-3 md:grid-cols-2">
            <Panel data-testid="vendor-match" title="Vendor" bodyClassName="p-4 text-sm">
              {draft.vendorMatch && view.vendor ? (
                <>
                  <div className="font-medium">{view.vendor.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">Match score {draft.vendorMatch.score.toFixed(2)}</div>
                  {draft.payee && draft.payee !== view.vendor.name && <div className="text-xs text-muted-foreground">Printed as {draft.payee}</div>}
                  {view.vendor.history[0] && (
                    <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                      Last invoice {view.vendor.history[0].invoiceNumber} on {view.vendor.history[0].date}, ledger {view.vendor.history[0].glAccount}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-medium text-signal">No match in the vendor master</div>
                  {draft.payee && <div className="text-xs text-muted-foreground">Printed as {draft.payee}</div>}
                  {draft.vendorCandidates.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {draft.vendorCandidates.map((c) => (
                        <li key={c.vendorId}>
                          {c.name} <span className="font-mono tabular-nums">{c.score.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={href("needs-a-person")} className="mt-1 inline-block text-xs font-medium text-dept underline-offset-4 hover:underline">
                    Work it under Needs a person
                  </Link>
                </>
              )}
            </Panel>

            <Panel data-testid="property-panel" title="Property" bodyClassName="p-4 text-sm">
              {draft.propertyResolution ? (
                <>
                  <div className="font-medium">
                    <span className="font-mono tabular-nums">{draft.propertyResolution.parcelId}</span> {draft.propertyResolution.address}
                  </div>
                  <div>{draft.propertyResolution.owner}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    Entity {draft.propertyResolution.entityCode}, Cash account {draft.propertyResolution.cashAccount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Method: <span data-testid="resolution-method">{METHOD_LABELS[draft.propertyResolution.method]}</span>
                  </div>
                </>
              ) : splitter ? (
                <div className="font-medium">{draft.lines.length} properties, see the lines</div>
              ) : openPropertyException ? (
                <>
                  <div className="font-medium text-signal">Property not resolved yet</div>
                  <Link href={href("needs-a-person")} className="text-xs font-medium text-dept underline-offset-4 hover:underline">
                    {openPropertyException.title}, work it under Needs a person
                  </Link>
                </>
              ) : (
                <div className="font-medium">No property, office item</div>
              )}
              {!draft.propertyResolution && !splitter && (
                <form
                  className="mt-2 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (resolveQuery.trim()) void act("resolve-property", { query: resolveQuery.trim() });
                  }}
                >
                  <Input aria-label="Parcel or address" placeholder="Parcel or address" value={resolveQuery} onChange={(e) => setResolveQuery(e.target.value)} className="h-7 bg-card text-xs" />
                  <Button type="submit" size="sm" variant="outline" disabled={busy || !resolveQuery.trim()}>
                    Resolve
                  </Button>
                </form>
              )}
            </Panel>
          </div>

          <Panel accent title={`Draft, ${splitter ? "the lines carry entity and cash account" : "ten fields"}`} right={<ExampleData />} bodyClassName="p-3">
            <div className="grid gap-2 md:grid-cols-2">
              {fields.map((field) => {
                const label = FIELD_LABELS[field];
                const source = draft.fieldSources[field];
                const conf = draft.fieldConfidence[field];
                const band = bandFor(conf);
                const needsConfirm = conf !== null && conf < CONFIDENCE.CONFIRM && !draft.confirmed.includes(field);
                const c = control(field);
                return (
                  <div key={field} data-testid={`field-${field}`} className={cn("rounded-md border bg-card p-2", needsConfirm && "border-signal/50 bg-signal-soft", field === "notes" && "md:col-span-2", field === "glAccount" && draft.ledgerChoices && "md:col-span-2")}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Label htmlFor={`field-input-${field}`}>{label}</Label>
                      <div className="flex items-center gap-2">
                        <StatusPill data-testid={`source-${field}`} tone={source ? FIELD_SOURCE_TONE[source] : "neutral"}>
                          {source ?? "Empty"}
                        </StatusPill>
                        <span
                          data-testid={`confidence-${field}`}
                          data-band={band}
                          title={conf === null ? "Empty" : conf.toFixed(2)}
                          aria-label={conf === null ? `${label} confidence empty` : `${label} confidence ${conf.toFixed(2)}`}
                          className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", BAND_CLASS[band])}
                        />
                      </div>
                    </div>
                    {c}
                    {field === "glAccount" && draft.ledgerChoices && (
                      <div data-testid="ledger-choices" className="mt-2 rounded-md bg-signal-soft p-2 text-xs ring-1 ring-inset ring-signal/30">
                        <div className="mb-1">
                          {draft.glAccount === null ? "The last three invoices used different ledger accounts, pick one" : "The last three invoices used different ledger accounts"}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {draft.ledgerChoices.map((ch) => (
                            <Button key={ch.glAccount} size="sm" variant={draft.glAccount === ch.glAccount ? "default" : "outline"} disabled={busy} onClick={() => void act("ledger", { glAccount: ch.glAccount })} title={`Invoice ${ch.invoiceNumber} on ${ch.date}`}>
                              {ch.glAccount} {ch.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    {needsConfirm && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-signal">
                        <span>Below {CONFIDENCE.CONFIRM.toFixed(2)}, check it against the document</span>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("confirm", { field })}>
                          Confirm {label.toLowerCase()}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          {splitter && <Lines view={view} busy={busy} act={act} ledgerName={ledgerName} />}

          <div data-testid="readiness" className={cn("rounded-lg px-4 py-2.5 text-sm ring-1 ring-inset", readiness.canSubmit ? "bg-paid-soft font-medium text-paid ring-paid/25" : "bg-signal-soft ring-signal/30 shadow-[inset_3px_0_0_var(--signal)]")}>
            {readiness.canSubmit ? (
              "Ready to submit"
            ) : (
              <ul className="list-disc pl-5">
                {readiness.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy || !canSubmit} onClick={() => void act("submit")}>
              Submit
            </Button>
            {item.state !== "Drafted" && item.state !== "New" && (
              <span className="text-sm">
                {item.state === "Needs attention" ? "Fix what needs a person first." : `${item.state}.`}{" "}
                {item.state === "Submitted" && (
                  <Link href={href("approve")} className="font-medium text-dept underline-offset-4 hover:underline">
                    Next step: Approve
                  </Link>
                )}
              </span>
            )}
            <Button variant="outline" disabled={busy || item.state !== "Drafted"} onClick={() => setSendOpen(true)}>
              Send to Needs a person
            </Button>
            {splitter ? (
              <Button variant="ghost" disabled={busy || !canSwitchMode} onClick={() => void toSingle()}>
                Back to the single draft
              </Button>
            ) : (
              <Button variant="ghost" disabled={busy || !canSwitchMode} onClick={() => void toSplitter()}>
                Split across properties
              </Button>
            )}
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href={href("needs-a-person")} className="underline-offset-4 hover:text-dept hover:underline">
              Needs a person
            </Link>
            <Link href={href("ready-for-yardi")} className="underline-offset-4 hover:text-dept hover:underline">
              Ready for Yardi
            </Link>
          </div>
        </div>
      </div>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Needs a person</DialogTitle>
            <DialogDescription>Say what needs a second look. The item waits under Needs a person until it is cleared.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="send-note">Note</Label>
            <Textarea id="send-note" aria-label="Note" value={sendNote} onChange={(e) => setSendNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const v = await act("send-to-exceptions", { note: sendNote });
                if (v) {
                  setSendOpen(false);
                  setSendNote("");
                }
              }}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Lines({ view, busy, act, ledgerName }: { view: ItemView; busy: boolean; act: (path: string, body?: unknown) => Promise<ItemView | null>; ledgerName: (code: string | null) => string }) {
  const { draft } = view;
  const lines = draft.lines;
  const allEqual = lines.length > 0 && lines.every((l) => l.splitMethod === "equal");
  const allStated = lines.length > 0 && lines.every((l) => l.splitMethod === "stated");
  const sum = draft.sumCheck;
  return (
    <Panel title="Lines, one per property" right={<span className="text-sm text-muted-foreground">{allEqual ? "Equal split, the invoice gives no prices" : allStated ? "Amounts as stated on the invoice" : "Some amounts as stated, the rest split equally"}</span>} bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Line</th>
              <th className={TH}>Address</th>
              <th className={TH}>Owner and entity</th>
              <th className={TH}>Cash account</th>
              <th className={TH_NUM}>Amount</th>
              <th className={TH}>Ledger account</th>
              <th className={TH}>Split</th>
              <th className={TH}>Property list</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <LineRow key={line.lineNumber} line={line} busy={busy} act={act} ledgerName={ledgerName} />
            ))}
          </tbody>
        </table>
      </div>
      {sum && (
        <div data-testid="sum-check" data-state={sum.ok ? "ok" : "bad"} className={cn("border-t px-4 py-2 text-sm font-medium tabular-nums", sum.ok ? "bg-paid-soft text-paid" : "bg-risk-soft text-risk")}>
          Sum {fmtCents(sum.linesTotal)} of {fmtCents(sum.invoiceTotal)} {sum.ok ? "matches the invoice total" : "does not match the invoice total"}
        </div>
      )}
    </Panel>
  );
}

function LineRow({ line, busy, act, ledgerName }: { line: SplitLine; busy: boolean; act: (path: string, body?: unknown) => Promise<ItemView | null>; ledgerName: (code: string | null) => string }) {
  const [parcel, setParcel] = useState("");
  const n = line.lineNumber;
  return (
    <tr data-testid={`line-${n}`} className={cn(TR, !line.systemPropertyExists && "bg-signal-soft/50")}>
      <td className={cn(TD_ID, "text-muted-foreground")}>{n}</td>
      <td className={TD}>
        <div>{line.address}</div>
        {line.description && <div className="text-xs text-muted-foreground">{line.description}</div>}
      </td>
      <td className={TD}>
        {line.parcelId ? (
          <>
            <div>{line.owner}</div>
            <div className="text-xs text-muted-foreground">
              Entity {line.entityCode} <span className="font-mono tabular-nums">{line.parcelId}</span>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <div className="text-signal">Not resolved</div>
            <div className="flex items-center gap-1">
              <Input aria-label={`Parcel for line ${n}`} placeholder="P-10000" value={parcel} onChange={(e) => setParcel(e.target.value)} className="h-7 w-28 bg-card font-mono text-xs" />
              <Button size="sm" variant="outline" disabled={busy || !parcel.trim()} onClick={() => void act("line-parcel", { lineNumber: n, parcelId: parcel.trim() })}>
                Use parcel
              </Button>
            </div>
          </div>
        )}
      </td>
      <td className={TD_ID}>{line.cashAccount ?? ""}</td>
      <td className={TD_NUM}>
        <TextField label={`Amount for line ${n}`} value={money(line.amount)} mono className="w-28 text-right" onSave={(text) => act("line", { lineNumber: n, amount: text })} />
      </td>
      <td className={TD}>
        <span className="font-mono tabular-nums">{line.glAccount ?? ""}</span>
        {line.glAccount && <div className="text-xs text-muted-foreground">{ledgerName(line.glAccount)}</div>}
        {line.chargeType && <div className="text-xs text-muted-foreground">{line.chargeType}</div>}
      </td>
      <td className={TD}>
        <span data-testid="split-method" className="text-xs">
          {line.splitMethod}
        </span>
      </td>
      <td className={TD}>
        {line.systemPropertyExists ? (
          <span className="text-xs text-muted-foreground">In the list</span>
        ) : (
          <div className="flex items-center gap-2">
            <StatusPill data-testid="line-flag" tone="signal">
              Not in property list
            </StatusPill>
            <Button size="sm" variant="outline" disabled={busy || !line.parcelId} onClick={() => void act("create-property", { lineNumber: n })}>
              Create property
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
