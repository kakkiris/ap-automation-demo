"use client";
import { STATUS_CLASS, STATUS_LABEL } from "./cell";
import type { CellStatus } from "@/packs/utility-bills-to-yardi/types";
import { Eyebrow } from "@/components/shell/kit";
import { cn } from "@/lib/utils";

const ORDER: CellStatus[] = ["paid", "unpaid", "not_yet_billed", "no_account", "tenant_held", "bill_back", "transfer_needed", "manual_split"];
const NOTE: Record<CellStatus, string> = {
  paid: "landlord expected, ledger lines under the account sum to the bill",
  unpaid: "landlord expected, no payment, provider billing current. Shut-off risk.",
  not_yet_billed: "landlord expected, no payment, provider billing behind. Not an alert.",
  no_account: "landlord expected, no landlord account on record, so the check cannot run",
  tenant_held: "tenant expected, no landlord account active",
  bill_back: "unit occupied, landlord account still active, payment found",
  transfer_needed: "unit occupied, landlord account still active, no payment this month",
  manual_split: "shared meter, split by hand on square feet",
};

export function Legend() {
  return (
    <aside className="rounded-lg bg-card p-3 text-xs ring-1 ring-foreground/10">
      <Eyebrow className="mb-2">Legend</Eyebrow>
      <p className="mb-2 text-muted-foreground">The rent roll sets what is expected. Vacant unit or owner-paid row: the landlord pays. Occupied unit: the tenant pays. Water and sewer masters: the landlord always.</p>
      <ul className="space-y-1.5">
        {ORDER.map((s) => (
          <li key={s} className="flex items-start gap-2">
            <span className={cn("mt-0.5 inline-block h-3.5 w-6 shrink-0 rounded border", STATUS_CLASS[s])} />
            <span>
              <span className="font-medium">{STATUS_LABEL[s]}:</span> {NOTE[s]}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t pt-2 text-muted-foreground">Row flags: Meter on bill differs, Check payer, Payer carried over, Transfer needed, No account history, Manual split. Amounts are example data.</div>
    </aside>
  );
}
