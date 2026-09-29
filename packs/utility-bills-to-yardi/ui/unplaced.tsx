"use client";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Panel } from "@/components/shell/kit";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack } from "@/packs/utility-bills-to-yardi/module";
import type { LedgerLine } from "@/packs/utility-bills-to-yardi/types";
import { fmtMoney, monthLabel } from "@/packs/utility-bills-to-yardi/lib/dates";
import { Td, Th } from "./table-bits";

export function Unplaced() {
  const { data, error } = useJson<{ lines: (LedgerLine & { property_name: string })[] }>(`${utilityBillsToYardiPack.apiBase}/unplaced`);
  if (error) return <p className="text-risk">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading payments.</p>;
  return (
    <div>
      <ScreenHeader screen="utility-payment-reconciliation/payments-without-a-meter" title="Payments without a meter" />
      <p className="mb-3 text-sm text-muted-foreground">{data.lines.length === 0 ? "No payment without a meter. Every ledger line carries an account number that ties it to a meter." : `${data.lines.length} ledger lines whose invoice number and description carry no account number at all. They cannot be tied to a meter, so Which bills are paid cannot count them.`}</p>
      <Panel bodyClassName="p-0">
        <Table>
          <TableHeader><TableRow><Th>Line</Th><Th>Property</Th><Th>Payee</Th><Th>Post month</Th><Th right>Amount</Th><Th>Invoice number</Th><Th>Description</Th></TableRow></TableHeader>
          <TableBody>
            {data.lines.map((l) => (
              <TableRow key={l.id}><Td mono>{l.id}</Td><Td>{l.property_name}</Td><Td>{l.payee_name}</Td><Td>{monthLabel(l.post_month)}</Td><Td right>{fmtMoney(l.amount)}</Td><Td mono>{l.invoice_number || "(none)"}</Td><Td className="whitespace-normal font-medium">{l.description}</Td></TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
