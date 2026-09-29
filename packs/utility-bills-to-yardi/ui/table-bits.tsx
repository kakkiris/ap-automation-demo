"use client";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// The two cell shapes every table in this module uses: a quiet uppercase header cell and a
// compact body cell. Amounts sit right with tabular figures; ids and account numbers in mono.

export function Th({ className, right, ...props }: React.ComponentProps<"th"> & { right?: boolean }) {
  return <TableHead className={cn("h-9 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground", right && "text-right", className)} {...props} />;
}

export function Td({ className, mono, right, ...props }: React.ComponentProps<"td"> & { mono?: boolean; right?: boolean }) {
  return <TableCell className={cn("px-3 py-1.5", mono && "font-mono tabular-nums", right && "text-right tabular-nums", className)} {...props} />;
}

// The workbook feel of the meter grids: house and water master rows sit on the signal tint,
// shared meters on the manual-split violet, unit rows on white. Hover keeps the tint.
export const ROW_TINT = { house: "bg-signal-soft hover:bg-signal-soft", shared: "bg-violet-50/40 hover:bg-violet-50/40" } as const;
