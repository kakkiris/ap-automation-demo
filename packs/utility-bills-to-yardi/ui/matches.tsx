"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Mono, Panel } from "@/components/shell/kit";
import { postJson, useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack, utilRoutes } from "@/packs/utility-bills-to-yardi/module";
import type { LedgerLine } from "@/packs/utility-bills-to-yardi/types";
import { fmtMoney, monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";

interface Candidate { account_number: string; holder: string; holder_name: string | null; meter_id: string; unit_label: string | null; location_note: string | null; property_name: string }
interface MatchesData { demo_month: string; items: { line: LedgerLine; candidates: Candidate[] }[]; undo_label: string | null }

export function Matches() {
  const { data, error, refetch } = useJson<MatchesData>(`${utilityBillsToYardiPack.apiBase}/matches`);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const current = data?.items[0] ?? null;
  async function confirm(account: string) {
    if (!current) return;
    setBusy(true);
    try {
      await postJson(`${utilityBillsToYardiPack.apiBase}/matches/confirm`, { line_id: current.line.id, account_number: account });
      setNote(`${current.line.id} confirmed to ${account}.`);
      await refetch();
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current || busy) return;
      const n = Number(e.key);
      if (n >= 1 && n <= current.candidates.length) { e.preventDefault(); void confirm(current.candidates[n - 1].account_number); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading the payments to confirm.</p>;
  return (
    <div>
      <ScreenHeader screen="utility-payment-reconciliation/confirm-which-account-a-payment-matched" title={`Confirm which account a payment matched, through ${monthLabel(data.demo_month)}`} right={<LinkButton variant="outline" href={utilRoutes.capture}>Capture this month&apos;s bills</LinkButton>} />
      <p className="mb-3 text-sm text-muted-foreground">Legacy ledger lines that matched by a partial account number shared by two accounts on the same site. Nothing is assigned until you confirm. Keys: 1, 2, 3 pick a candidate. {data.items.length === 0 ? `Nothing left to confirm through ${monthLabel(data.demo_month)}. Every payment through this month sits on one account.` : `${data.items.length} to confirm.`}</p>
      {note && <p className="mb-3 rounded-md bg-paid-soft px-3 py-2 text-sm text-paid ring-1 ring-inset ring-paid/25">{note}</p>}
      {current && (
        <Panel accent bodyClassName="p-4 text-sm">
          <div className="font-medium">Line <Mono>{current.line.id}</Mono>, {current.line.payee_name}, posted {monthLabel(current.line.post_month)}</div>
          <div className="text-muted-foreground">Invoice number <Mono>{current.line.invoice_number}</Mono>, description &quot;{current.line.description}&quot;, <Mono>{fmtMoney(current.line.amount)}</Mono>, {current.line.gl_name}.</div>
          <ul className="mt-3 space-y-2">
            {current.candidates.map((c, i) => (
              <li key={c.account_number} className="flex items-center justify-between rounded-md border p-2">
                <span><Mono>{c.account_number}</Mono>, {c.holder}{c.holder_name ? ` (${c.holder_name})` : ""}, {c.property_name}, {c.unit_label ? `unit ${c.unit_label}` : c.location_note ?? "house"}</span>
                <Button size="sm" onClick={() => confirm(c.account_number)} disabled={busy}>{i + 1}: this one</Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {data.items.length > 1 && <p className="mt-3 text-xs text-muted-foreground">{data.items.length - 1} more after this one.</p>}
    </div>
  );
}
