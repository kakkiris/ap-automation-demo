"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mono } from "@/components/shell/kit";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { RowFlags } from "@/packs/utility-bills-to-yardi/types";
import { fmtMoney, monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";
import { StatusWord } from "./cell";
import { FlagChips } from "./flags";
import type { CellStatus } from "@/packs/utility-bills-to-yardi/types";

interface Why {
  status: CellStatus;
  rule: string;
  rent_roll: string;
  account: string;
  lines: { id: string; invoice_number: string; amount: number; gl_name: string; kind: string }[];
  flags: RowFlags;
}

const DT = "text-xs uppercase tracking-wide text-muted-foreground";

export function WhyPopover({ meterId, month, onClose }: { meterId: string; month: string; onClose: () => void }) {
  const [why, setWhy] = useState<Why | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${utilityBillsToYardiPack.apiBase}/why?meter=${meterId}&month=${month}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Why) => {
        if (!cancelled) setWhy(d);
      });
    return () => {
      cancelled = true;
    };
  }, [meterId, month]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose} role="dialog" aria-label="why this status">
      <div className="w-full max-w-lg rounded-lg bg-card p-4 text-sm shadow-lg ring-1 ring-foreground/10" onClick={(e) => e.stopPropagation()}>
        {!why ? (
          <p className="text-muted-foreground">Reading the rule.</p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold">
                {monthLabel(month)}: <StatusWord status={why.status} />
              </h3>
              <Button variant="ghost" size="xs" onClick={onClose}>
                close
              </Button>
            </div>
            <dl className="space-y-1.5">
              <div>
                <dt className={DT}>Rule</dt>
                <dd>{why.rule}.</dd>
              </div>
              <div>
                <dt className={DT}>Rent roll on the 15th</dt>
                <dd>{why.rent_roll}.</dd>
              </div>
              <div>
                <dt className={DT}>Account active on the 15th</dt>
                <dd><Mono className="text-xs">{why.account}</Mono></dd>
              </div>
              <div>
                <dt className={DT}>Ledger lines matched</dt>
                <dd>
                  {why.lines.length === 0 ? (
                    <span className="text-muted-foreground">none</span>
                  ) : (
                    <ul className="font-mono text-xs tabular-nums">
                      {why.lines.map((l) => (
                        <li key={l.id}>
                          {l.invoice_number || "(no invoice number)"} {fmtMoney(l.amount)} {l.gl_name}, {l.kind === "exact" ? "exact" : l.kind === "partial" ? "matched by partial account number" : l.kind}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
              <div>
                <dt className={DT}>Flags on the row</dt>
                <dd>
                  <FlagChips flags={why.flags} /> {!Object.values(why.flags).some(Boolean) && <span className="text-muted-foreground">none</span>}
                </dd>
              </div>
            </dl>
            <div className="mt-3 text-xs">
              <Link className="font-medium text-dept underline underline-offset-4" href={`${utilRoutes.meter(meterId)}?month=${month}`}>
                Open this meter&apos;s history
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
