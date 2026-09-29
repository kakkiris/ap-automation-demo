"use client";
import type { ComponentProps } from "react";
import { StatusPill, type Tone } from "@/components/shell/kit";
import type { InvoiceStatus, SuggestionTier } from "@/packs/invoice-description-writer/lib/types";

type PillProps = Omit<ComponentProps<"span">, "children">;

// One tone per status word: ready and used are done, manual needs attention, routed went elsewhere, corrected is a note.
const STATUS_TONE: Record<InvoiceStatus, Tone> = {
  ready: "paid",
  manual: "signal",
  routed: "lag",
  used: "paid",
  corrected: "info",
};

/** The status word, exactly as the pack writes it, in a light pill. */
export function StatusBadge({ status, ...props }: PillProps & { status: InvoiceStatus }) {
  return (
    <StatusPill tone={STATUS_TONE[status]} {...props}>
      {status}
    </StatusPill>
  );
}

// The suggestion tier: strong is a sure match, weak wants a second look, none has no history behind it.
const TIER_TONE: Record<SuggestionTier, Tone> = {
  strong: "paid",
  weak: "signal",
  none: "lag",
};

export function TierBadge({ tier, ...props }: PillProps & { tier: SuggestionTier }) {
  return (
    <StatusPill tone={TIER_TONE[tier]} {...props}>
      {tier}
    </StatusPill>
  );
}
