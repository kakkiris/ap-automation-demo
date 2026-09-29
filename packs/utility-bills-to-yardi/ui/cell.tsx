"use client";
import type { Cell, CellStatus } from "@/packs/utility-bills-to-yardi/types";
import { cn } from "@/lib/utils";
import { StatusPill, type Tone } from "@/components/shell/kit";
import { fmtMoney } from "@/packs/utility-bills-to-yardi/lib/dates";

export const STATUS_LABEL: Record<CellStatus, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  not_yet_billed: "Not yet billed",
  tenant_held: "Tenant-held",
  bill_back: "Bill-back candidate",
  transfer_needed: "Transfer needed",
  manual_split: "Manual split",
  no_account: "No account on record",
};

export const STATUS_SHORT: Record<CellStatus, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  not_yet_billed: "Not yet billed",
  tenant_held: "Tenant-held",
  bill_back: "Bill-back",
  transfer_needed: "Transfer",
  manual_split: "Manual split",
  no_account: "? No account",
};

// The grid palette, one meaning each. Strong fills where the workbook had them; the
// tenant-held cell stays white; manual split keeps its violet; no account is a dark neutral.
export const STATUS_CLASS: Record<CellStatus, string> = {
  paid: "bg-paid text-white border-paid",
  unpaid: "bg-risk text-white border-risk",
  not_yet_billed: "bg-lag-soft text-lag border-lag/40",
  tenant_held: "bg-card text-muted-foreground border-border",
  bill_back: "bg-signal text-white border-signal",
  transfer_needed: "bg-signal-soft text-signal border-signal border-2",
  manual_split: "bg-violet-50 text-violet-700 border-violet-200",
  no_account: "bg-foreground/80 text-white border-foreground/80",
};

/** The same meanings as a pill tone, for the status word where it appears as text. */
export const STATUS_TONE: Record<CellStatus, Tone> = {
  paid: "paid",
  unpaid: "risk",
  not_yet_billed: "lag",
  tenant_held: "neutral",
  bill_back: "signal",
  transfer_needed: "signal",
  manual_split: "neutral",
  no_account: "neutral",
};

/** The status label as a pill; manual split keeps its violet. */
export function StatusWord({ status, className }: { status: CellStatus; className?: string }) {
  return (
    <StatusPill tone={STATUS_TONE[status]} className={cn(status === "manual_split" && "bg-violet-50 text-violet-700 ring-violet-200", status === "no_account" && "bg-foreground/80 text-white ring-foreground/80", className)}>
      {STATUS_LABEL[status]}
    </StatusPill>
  );
}

export function StatusCell({ cell, onClick, compact, highlight }: { cell: Cell; onClick?: () => void; compact?: boolean; highlight?: boolean }) {
  const label = STATUS_LABEL[cell.status];
  const detail =
    cell.status === "bill_back" && cell.running_total !== null
      ? `${cell.months_since_move_in} mo, ${fmtMoney(cell.running_total)}`
      : cell.amount !== null && cell.status === "paid"
        ? `${fmtMoney(cell.amount)}${cell.match_kind === "partial" ? " partial" : cell.match_kind === "confirmed" ? " confirmed" : ""}`
        : null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}${detail ? `: ${detail}` : ""}. Click for why.`}
      className={cn("h-10 w-full rounded border px-1 text-left text-[11px] leading-tight tabular-nums transition-shadow", STATUS_CLASS[cell.status], onClick && "hover:ring-2 hover:ring-foreground/30", highlight && "ring-2 ring-paid ring-offset-2")}
    >
      <div className="truncate font-medium">{compact ? STATUS_SHORT[cell.status] : label}</div>
      {detail && <div className="truncate opacity-80">{detail}</div>}
    </button>
  );
}
