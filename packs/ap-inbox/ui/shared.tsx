"use client";
import Link from "next/link";
import { StatusPill, type Tone } from "@/components/shell/kit";
import { cn } from "@/lib/utils";
import { screenHref } from "@/lib/registry";
import { apInboxPack } from "@/packs/ap-inbox/module";
import { SOURCE_LABELS, type ItemState, type Source } from "@/packs/ap-inbox/lib/types";
import { fmtCents } from "@/packs/ap-inbox/lib/money";

export const pack = apInboxPack;
export const apiBase = apInboxPack.apiBase;
export const base = apInboxPack.base;

/** A page of this module by screen slug, with the item id when the screen takes one. */
export const href = (slug: string, itemId?: string) => screenHref(apInboxPack, slug, itemId);
export const reviewHref = (itemId: string) => href("review-an-invoice", itemId);
export const splitHref = (itemId: string) => href("split-across-properties", itemId);

// The four doors. Violet is kept for the mail scan alone; the other doors use the shared tones.
const SOURCE_TONE: Record<Source, Tone> = {
  email: "neutral",
  trackerApproved: "info",
  utilityPortal: "signal",
  mailScan: "neutral",
};
const MAIL_SCAN_CLASS = "bg-violet-100 text-violet-900 ring-violet-300/60";

export function SourceBadge({ source, className }: { source: Source; className?: string }) {
  return (
    <StatusPill data-testid="source-badge" tone={SOURCE_TONE[source]} className={cn(source === "mailScan" && MAIL_SCAN_CLASS, className)}>
      {SOURCE_LABELS[source]}
    </StatusPill>
  );
}

const STATE_TONE: Record<ItemState, Tone> = {
  New: "neutral",
  Drafted: "info",
  "Needs attention": "signal",
  Submitted: "dept",
  Approved: "paid",
  Paid: "paid",
  Skipped: "lag",
};

export function StateBadge({ state, testId = "state", className }: { state: ItemState; testId?: string; className?: string }) {
  return (
    <StatusPill data-testid={testId} tone={STATE_TONE[state]} className={className}>
      {state}
    </StatusPill>
  );
}

export function ItemLink({ itemId, className }: { itemId: string; className?: string }) {
  return (
    <Link href={reviewHref(itemId)} className={cn("font-mono text-sm tabular-nums hover:underline", className)}>
      {itemId}
    </Link>
  );
}

/** The route handlers fail with { error } as text; show the words, not the wrapper. */
export function errorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    return (JSON.parse(raw) as { error?: string }).error ?? raw;
  } catch {
    return raw;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-27" or "2026-08-27T07:04:00Z" to "Aug 27, 2026". */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const [d] = iso.split("T");
  const [y, m, day] = d.split("-");
  const mi = parseInt(m, 10) - 1;
  if (!MONTHS[mi] || !day) return iso;
  return `${MONTHS[mi]} ${parseInt(day, 10)}, ${y}`;
}

/** "2026-08-27T07:04:00Z" to "Aug 27, 2026 07:04". */
export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, t] = iso.split("T");
  const day = fmtDay(iso);
  return t ? `${day} ${t.slice(0, 5)}` : day;
}

export function money(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : fmtCents(cents);
}

export function Loading({ what = "" }: { what?: string }) {
  return <p className="text-sm text-muted-foreground">{what ? `Loading ${what}.` : "Loading."}</p>;
}

export function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="rounded-lg bg-risk-soft px-3 py-2 text-sm text-risk ring-1 ring-inset ring-risk/25" role="alert">
      {text}
    </p>
  );
}

export function ExampleData() {
  return <p className="text-xs text-muted-foreground">Example data.</p>;
}

// One table shape for the module: quiet uppercase headers, a hairline between rows,
// ids in the mono face, amounts right-aligned with tabular figures.
export const THEAD = "bg-muted/40";
export const TH = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
export const TH_NUM = cn(TH, "text-right");
export const TD = "px-3 py-1.5 align-top";
export const TD_ID = cn(TD, "font-mono tabular-nums");
export const TD_NUM = cn(TD, "text-right font-mono tabular-nums");
export const TR = "border-t";

// The small counters at the top of a screen: a word and its number on one line.
export const COUNT_CHIP = "rounded-lg bg-card px-3 py-1.5 text-sm ring-1 ring-foreground/10";
export const COUNT_NUM = "font-semibold tabular-nums";
