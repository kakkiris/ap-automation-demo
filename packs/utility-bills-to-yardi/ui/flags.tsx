"use client";
import type { RowFlags } from "@/packs/utility-bills-to-yardi/types";
import { StatusPill, type Tone } from "@/components/shell/kit";

export function FlagChips({ flags }: { flags: RowFlags }) {
  const chips: { text: string; tone: Tone; cls?: string }[] = [];
  if (flags.meter_differs) chips.push({ text: "Meter on bill differs", tone: "risk" });
  if (flags.check_payer) chips.push({ text: "Check payer", tone: "info" });
  if (flags.payer_carried_over) chips.push({ text: "Payer carried over", tone: "signal" });
  if (flags.transfer_needed) chips.push({ text: "Transfer needed", tone: "signal" });
  if (flags.no_account_history) chips.push({ text: "No account history, verify on site", tone: "lag" });
  if (flags.manual_split) chips.push({ text: `Manual split: units ${flags.manual_split.units.map((u) => u.label).join(", ")} on ${flags.manual_split.basis}`, tone: "neutral", cls: "bg-violet-50 text-violet-700 ring-violet-200" });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <StatusPill key={c.text} tone={c.tone} className={c.cls}>
          {c.text}
        </StatusPill>
      ))}
    </div>
  );
}
