"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, StatusPill, type Tone } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import type { ExceptionCard, ExceptionKind, ExceptionsView, ItemState, ItemView, ParcelLookupView, ParcelRecord } from "@/packs/ap-inbox/lib/types";
import { fmtCents } from "@/packs/ap-inbox/lib/money";
import { apiBase, COUNT_CHIP, COUNT_NUM, ErrorLine, ExampleData, errorText, href, Loading, money, reviewHref, SourceBadge, StateBadge } from "./shared";

type Act = (itemId: string, path: string, body?: unknown) => Promise<void>;

// The kind of each card as a short word and a tone: a risk when money could go wrong,
// a signal when the draft is only waiting on a person.
const KIND_LABEL: Record<ExceptionKind, string> = {
  unknown_vendor: "Vendor",
  ambiguous_owner: "Owner",
  unknown_utility_account: "Utility account",
  unreadable_amount: "Amount",
  possible_duplicate: "Duplicate",
  lines_not_summing: "Lines",
  sent_by_specialist: "Held",
};
const KIND_TONE: Record<ExceptionKind, Tone> = {
  unknown_vendor: "signal",
  ambiguous_owner: "signal",
  unknown_utility_account: "signal",
  unreadable_amount: "risk",
  possible_duplicate: "risk",
  lines_not_summing: "risk",
  sent_by_specialist: "signal",
};

export function Exceptions() {
  const { data, error, refetch } = useJson<ExceptionsView>(`${apiBase}/exceptions`);
  const [last, setLast] = useState<{ itemId: string; state: ItemState } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act: Act = async (itemId, path, body) => {
    setBusy(true);
    try {
      const v = await postJson<ItemView>(`${apiBase}/items/${itemId}/${path}`, body);
      setLast({ itemId: v.item.itemId, state: v.item.state });
      setNote(null);
      await refetch();
    } catch (err) {
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ScreenHeader screen="ap-inbox/needs-a-person" title="Needs a person" />
      <p className="mb-1 text-sm text-muted-foreground">The invoices that need a person this week. Each card offers the one fix it needs.</p>
      <ExampleData />
      {error && <ErrorLine text={error} />}
      {!data && !error && <Loading what="the cards" />}
      {data && (
        <>
          <div className="mt-3 mb-3 flex flex-wrap items-center gap-4">
            <span data-testid="open-count" className={COUNT_CHIP}>
              <span className={cn(COUNT_NUM, data.open > 0 ? "text-signal" : "text-foreground")}>{data.open}</span> open
            </span>
            {last && (
              <span className="text-sm text-paid">
                Fixed {last.itemId}, back to {last.state}
              </span>
            )}
          </div>
          <ErrorLine text={note} />
          {data.cards.length === 0 ? (
            <EmptyState title="Nothing needs a person right now. Every draft in this week's arrivals has what it needs." action={{ href: href("this-weeks-arrivals"), label: "Open this week's arrivals" }} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {data.cards.map((card) => (
                <ExceptionCardView key={`${card.itemId}-${card.exception.kind}`} card={card} busy={busy} act={act} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExceptionCardView({ card, busy, act }: { card: ExceptionCard; busy: boolean; act: Act }) {
  const ex = card.exception;
  return (
    <Card data-testid={`exception-card-${card.itemId}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>
            <h2 className="text-base font-semibold">{ex.title}</h2>
          </CardTitle>
          <StatusPill tone={KIND_TONE[ex.kind]} className="shrink-0">
            {KIND_LABEL[ex.kind]}
          </StatusPill>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={reviewHref(card.itemId)} className="font-mono tabular-nums hover:underline">
            {card.itemId}
          </Link>
          <SourceBadge source={card.source} />
          <StateBadge state={card.state} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
          <span>{card.vendorGuess ?? "Vendor not read"}</span>
          <span className={cn(card.amount !== null && "font-mono tabular-nums")}>{card.amount === null ? "Amount not read" : money(card.amount)}</span>
          <span>{card.propertyGuess ?? "No property yet"}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{ex.detail}</p>
        <Fix card={card} busy={busy} act={act} />
      </CardContent>
    </Card>
  );
}

function Fix({ card, busy, act }: { card: ExceptionCard; busy: boolean; act: Act }) {
  const ex = card.exception;
  const id = card.itemId;
  switch (ex.kind) {
    case "unknown_vendor":
      return (
        <div className="space-y-3">
          <Button disabled={busy} onClick={() => void act(id, "create-vendor")}>
            Create vendor
          </Button>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Match to existing</div>
            <ul className="space-y-1">
              {ex.candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
                  <span>
                    {c.label} <span className="font-mono text-xs text-muted-foreground tabular-nums">{c.score === null ? "" : c.score.toFixed(2)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{c.detail}</span>
                  </span>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(id, "match-vendor", { vendorId: c.id })}>
                    Use {c.label}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "possible_duplicate":
      return (
        <div className="space-y-3">
          {ex.duplicateOf && (
            <div data-testid="duplicate-of" className="rounded-md bg-muted px-3 py-2 text-sm">
              <div className="text-xs font-medium text-muted-foreground">Earlier invoice</div>
              <div className="flex flex-wrap gap-x-4">
                <span>
                  Number <span className="font-mono tabular-nums">{ex.duplicateOf.invoiceNumber}</span>
                </span>
                <span>Paid {ex.duplicateOf.date}</span>
                <span className="font-mono tabular-nums">{fmtCents(ex.duplicateOf.amount)}</span>
                <span>
                  Ledger <span className="font-mono tabular-nums">{ex.duplicateOf.glAccount}</span>
                </span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void act(id, "skip")}>
              Skip
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void act(id, "keep")}>
              Keep
            </Button>
          </div>
        </div>
      );
    case "unknown_utility_account":
      return <ParcelSearch busy={busy} onPick={(parcelId) => act(id, "map-utility-account", { parcelId })} />;
    case "unreadable_amount":
      return <EnterAmount busy={busy} onSave={(amount) => act(id, "enter-amount", { amount })} />;
    case "ambiguous_owner":
      if (ex.candidates.length > 0) {
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {ex.candidates.map((c) => (
              <div key={c.id} data-testid={`owner-candidate-${c.id}`} className="rounded-md border px-3 py-2 text-sm">
                <div className="font-mono font-medium tabular-nums">{c.id}</div>
                <div>{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.detail}</div>
                <Button size="sm" className="mt-2" disabled={busy} onClick={() => void act(id, "choose-owner", { parcelId: c.id })}>
                  Choose this owner
                </Button>
              </div>
            ))}
          </div>
        );
      }
      return <ResolveProperty busy={busy} onResolve={(query) => act(id, "resolve-property", { query })} />;
    case "sent_by_specialist":
      return (
        <Button disabled={busy} onClick={() => void act(id, "clear-sent")}>
          Clear
        </Button>
      );
    case "lines_not_summing":
      return (
        <Link href={reviewHref(id)} className="text-sm font-medium text-dept underline-offset-4 hover:underline">
          Open the lines and fix the amounts
        </Link>
      );
    default:
      return null;
  }
}

function EnterAmount({ busy, onSave }: { busy: boolean; onSave: (amount: string) => Promise<void> }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) void onSave(text.trim());
      }}
    >
      <Input aria-label="Amount" placeholder="0.00" value={text} onChange={(e) => setText(e.target.value)} className="w-32 bg-card text-right font-mono tabular-nums" />
      <Button type="submit" disabled={busy || !text.trim()}>
        Save amount
      </Button>
    </form>
  );
}

function ResolveProperty({ busy, onResolve }: { busy: boolean; onResolve: (query: string) => Promise<void> }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) void onResolve(text.trim());
      }}
    >
      <Input aria-label="Parcel or address" placeholder="Parcel or address" value={text} onChange={(e) => setText(e.target.value)} className="bg-card" />
      <Button type="submit" disabled={busy || !text.trim()}>
        Resolve
      </Button>
    </form>
  );
}

type LookupResult = ParcelLookupView & { matches: ParcelRecord[] };

function ParcelSearch({ busy, onPick }: { busy: boolean; onPick: (parcelId: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParcelRecord[]>([]);
  const [searching, setSearching] = useState(false);

  const q = text.trim();
  const shown = q ? rows : [];

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${apiBase}/parcel-lookup?q=${encodeURIComponent(q)}&limit=8`, { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const v = (await res.json()) as LookupResult;
        const seen = new Set<string>();
        const merged: ParcelRecord[] = [];
        const push = (p: ParcelRecord) => {
          if (!seen.has(p.parcelId)) {
            seen.add(p.parcelId);
            merged.push(p);
          }
        };
        if (v.result.kind === "one") push(v.result.parcel);
        if (v.result.kind === "many") v.result.candidates.forEach(push);
        v.matches.forEach(push);
        if (!cancelled) setRows(merged);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q]);

  return (
    <div className="space-y-2">
      <Input aria-label="Search parcels" placeholder="Search parcels by id or address" value={text} onChange={(e) => setText(e.target.value)} className="bg-card" />
      {searching && <p className="text-xs text-muted-foreground">Searching.</p>}
      {shown.length > 0 && (
        <ul className="divide-y rounded-md border">
          {shown.map((p) => (
            <li key={p.parcelId} className={cn("flex items-center justify-between gap-2 px-2 py-1.5 text-sm")}>
              <span>
                <span className="font-mono font-medium tabular-nums">{p.parcelId}</span> {p.address}, {p.city}, {p.state}
                <span className="ml-2 text-xs text-muted-foreground">{p.holdingCompany}</span>
              </span>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void onPick(p.parcelId)}>
                Map to this parcel
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!searching && q && shown.length === 0 && <p className="text-xs text-muted-foreground">No parcel found</p>}
    </div>
  );
}
