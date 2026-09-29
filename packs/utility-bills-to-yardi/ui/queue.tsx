"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Mono, Panel, StatusPill } from "@/components/shell/kit";
import { postJson, useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { Bill, Exception } from "@/packs/utility-bills-to-yardi/types";
import { fmtMoney, monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";
import type { ExceptionAction } from "@/packs/utility-bills-to-yardi/lib/exceptions";

interface Item extends Exception {
  bill: Bill | null;
  property_name: string;
  suggestion_label: string | null;
  meter_label: string | null;
  candidates: { id: string; label: string; has_account: boolean }[];
}
interface QueueData { demo_month: string; items: Item[]; total: number; resolved: number; undo_label: string | null; blocked: number }

function errorText(err: unknown): string {
  const raw = (err as Error).message;
  try {
    return (JSON.parse(raw) as { error?: string }).error ?? raw;
  } catch {
    return raw;
  }
}

const TYPE_LABEL: Record<Exception["type"], string> = { unmapped: "Unmapped bill", meter_differs: "Meter on bill differs", duplicate: "Duplicate period", unusual_amount: "Unusual amount", ambiguous_import: "Provider list row, address unclear" };

export function Queue() {
  const params = useSearchParams();
  const focus = params.get("focus");
  const { data, error, refetch } = useJson<QueueData>(`${utilityBillsToYardiPack.apiBase}/queue`);
  const [picker, setPicker] = useState(false);
  const [choice, setChoice] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = data?.items ?? [];
  const current = (focus && items.find((i) => i.id === focus)) || items[0] || null;

  async function act(action: ExceptionAction) {
    if (!current) return;
    setBusy(true);
    try {
      await postJson(`${utilityBillsToYardiPack.apiBase}/queue/resolve`, { id: current.id, action });
      setNote(`${TYPE_LABEL[current.type]} ${current.bill?.id ?? current.account_number ?? ""}: ${action.kind.replace(/_/g, " ")}.`);
      setPicker(false);
      setChoice("");
      await refetch();
    } catch (err) {
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function undo() {
    await postJson(`${utilityBillsToYardiPack.apiBase}/undo`);
    setNote("Undone.");
    await refetch();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (!current || busy) return;
      const k = e.key.toLowerCase();
      if (k === "u") { e.preventDefault(); void undo(); return; }
      if (k === "n") { e.preventDefault(); void act({ kind: "skip" }); return; }
      if (current.type === "unmapped" || current.type === "ambiguous_import") {
        if (e.key === "Enter" && current.suggestion) { e.preventDefault(); void act({ kind: "accept" }); }
        if (k === "m") { e.preventDefault(); setPicker(true); }
      } else if (current.type === "meter_differs") {
        if (k === "s" || e.key === "Enter") { e.preventDefault(); void act({ kind: "swap" }); }
        if (k === "k") { e.preventDefault(); void act({ kind: "keep_master" }); }
      } else if (current.type === "duplicate") {
        if (k === "f" || e.key === "Enter") { e.preventDefault(); void act({ kind: "drop_second" }); }
        if (k === "b") { e.preventDefault(); void act({ kind: "keep_both", note: "kept both on purpose" }); }
      } else if (current.type === "unusual_amount") {
        if (k === "1" || e.key === "Enter") { e.preventDefault(); void act({ kind: "acknowledge", reason: "vacant but in use" }); }
        if (k === "2") { e.preventDefault(); void act({ kind: "acknowledge", reason: "rate change" }); }
        if (k === "3") { e.preventDefault(); void act({ kind: "acknowledge", reason: "meter issue" }); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading the bills to match.</p>;
  const position = current ? items.indexOf(current) + 1 : 0;
  return (
    <div>
      <ScreenHeader
        screen="utility-bills-to-yardi/match-bills-to-meters"
        title={`Match bills to meters, ${monthLabel(data.demo_month)}`}
        right={
          <div className="flex items-center gap-2">
            {data.undo_label && <Button variant="outline" size="sm" onClick={undo} disabled={busy}>Undo (U): {data.undo_label}</Button>}
            <LinkButton variant="outline" href={utilRoutes.capture}>Capture this month&apos;s bills</LinkButton>
          </div>
        }
      />
      <p className="mb-3 text-sm text-muted-foreground">
        {items.length === 0
          ? data.total === 0
            ? `No bills to match yet for ${monthLabel(data.demo_month)}. Press Run ${monthLabel(data.demo_month)} on Capture this month's bills; the bills that need a meter land here.`
            : `All ${data.total} exceptions resolved for ${monthLabel(data.demo_month)}. Back to Capture this month's bills to export.`
          : `${position} of ${items.length} open, ${data.resolved} resolved.`}
        {data.blocked > 0 && ` ${data.blocked} duplicate${data.blocked > 1 ? "s" : ""} still block the export.`}
        {items.length > 0 && " Keys: Enter accepts the suggestion, N skips, M opens the full picker, U undoes the last action."}
      </p>
      {note && <p className="mb-3 rounded-md bg-info-soft px-3 py-2 text-sm ring-1 ring-inset ring-info/25">{note}</p>}
      {current && (
        <Panel accent bodyClassName="p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{TYPE_LABEL[current.type]}</h2>
            <StatusPill tone={current.status === "skipped" ? "lag" : "signal"}>{current.status === "skipped" ? "skipped earlier" : "open"}</StatusPill>
          </div>
          <dl className="grid gap-x-6 gap-y-1 md:grid-cols-2">
            <div><dt className="inline text-muted-foreground">Site: </dt><dd className="inline">{current.property_name}</dd></div>
            {current.bill && <div><dt className="inline text-muted-foreground">Bill: </dt><dd className="inline"><Mono>{current.bill.id}</Mono></dd></div>}
            {current.account_number && <div><dt className="inline text-muted-foreground">Account number: </dt><dd className="inline"><Mono>{current.account_number}</Mono></dd></div>}
            {current.bill && <div><dt className="inline text-muted-foreground">Service address: </dt><dd className="inline">{current.bill.service_address}</dd></div>}
            {current.bill && <div><dt className="inline text-muted-foreground">Period and amount: </dt><dd className="inline tabular-nums">{current.bill.service_start} to {current.bill.service_end}, {fmtMoney(current.bill.amount)}</dd></div>}
            {current.bill && <div><dt className="inline text-muted-foreground">Meter as printed: </dt><dd className="inline"><Mono>{current.bill.meter_as_printed ?? "blank"}</Mono></dd></div>}
            {Object.entries(current.details).filter(([k]) => !["service_address", "meter_as_printed", "amount"].includes(k)).map(([k, v]) => (
              <div key={k}><dt className="inline text-muted-foreground">{k.replace(/_/g, " ")}: </dt><dd className="inline"><Mono>{String(v ?? "")}</Mono></dd></div>
            ))}
          </dl>
          <div className="mt-4 rounded-md bg-muted/60 p-3">
            {(current.type === "unmapped" || current.type === "ambiguous_import") && (
              <>
                <div className="font-medium">Suggested meter: {current.suggestion_label ?? "none found"}</div>
                {current.suggestion && <div className="text-xs text-muted-foreground">Why: {current.suggestion.reason} (plain address matching, no guessing).</div>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button onClick={() => act({ kind: "accept" })} disabled={busy || !current.suggestion}>Enter: accept</Button>
                  <Button variant="outline" onClick={() => act({ kind: "skip" })} disabled={busy}>N: skip</Button>
                  <Button variant="outline" onClick={() => setPicker(true)} disabled={busy}>M: pick from all meters</Button>
                </div>
                {picker && (
                  <div className="mt-2 flex items-center gap-2">
                    <select className="h-8 rounded-lg border border-input bg-card px-2 text-sm" value={choice} onChange={(e) => setChoice(e.target.value)} autoFocus>
                      <option value="">Pick the meter at {current.property_name} (no-account meters first)</option>
                      {current.candidates.map((c) => <option key={c.id} value={c.id}>{c.label}{c.has_account ? "" : " (no account on record)"}</option>)}
                    </select>
                    <Button size="sm" onClick={() => act({ kind: "pick", meter_id: choice })} disabled={!choice || busy}>Match to this meter</Button>
                  </div>
                )}
              </>
            )}
            {current.type === "meter_differs" && (
              <>
                <div className="font-medium">Master has <Mono>{String(current.details.master)}</Mono>; the bill prints <Mono>{String(current.details.printed)}</Mono>. Meter: {current.meter_label}</div>
                <div className="mt-2 flex gap-2">
                  <Button onClick={() => act({ kind: "swap" })} disabled={busy}>S: confirm the swap (adds a history row)</Button>
                  <Button variant="outline" onClick={() => act({ kind: "keep_master" })} disabled={busy}>K: keep the master</Button>
                  <Button variant="outline" onClick={() => act({ kind: "skip" })} disabled={busy}>N: skip</Button>
                </div>
              </>
            )}
            {current.type === "duplicate" && (
              <>
                <div className="font-medium">Same account and service period as bill <Mono>{String(current.details.first_bill)}</Mono>. Blocked from export until resolved.</div>
                <div className="mt-2 flex gap-2">
                  <Button onClick={() => act({ kind: "drop_second" })} disabled={busy}>F: keep the first, drop this one</Button>
                  <Button variant="outline" onClick={() => act({ kind: "keep_both", note: "kept both on purpose" })} disabled={busy}>B: keep both with a note</Button>
                  <Button variant="outline" onClick={() => act({ kind: "skip" })} disabled={busy}>N: skip</Button>
                </div>
              </>
            )}
            {current.type === "unusual_amount" && (
              <>
                <div className="font-medium tabular-nums">{fmtMoney(Number(current.details.amount))} is {String(current.details.ratio)} times the trailing three-month average of {fmtMoney(Number(current.details.trailing_average))}.</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button onClick={() => act({ kind: "acknowledge", reason: "vacant but in use" })} disabled={busy}>1: vacant but in use, verify the unit</Button>
                  <Button variant="outline" onClick={() => act({ kind: "acknowledge", reason: "rate change" })} disabled={busy}>2: rate change</Button>
                  <Button variant="outline" onClick={() => act({ kind: "acknowledge", reason: "meter issue" })} disabled={busy}>3: meter issue</Button>
                  <Button variant="outline" onClick={() => act({ kind: "skip" })} disabled={busy}>N: skip</Button>
                </div>
              </>
            )}
          </div>
        </Panel>
      )}
      {items.length > 1 && (
        <ul className="mt-4 text-xs text-muted-foreground">
          {items.slice(0, 12).map((i, idx) => (
            <li key={i.id} className={i === current ? "font-medium text-foreground" : ""}>{idx + 1}. {TYPE_LABEL[i.type]}, {i.property_name}{i.bill ? `, ${i.bill.id}` : ""}{i.status === "skipped" ? " (skipped)" : ""}</li>
          ))}
          {items.length > 12 && <li>and {items.length - 12} more</li>}
        </ul>
      )}
    </div>
  );
}
