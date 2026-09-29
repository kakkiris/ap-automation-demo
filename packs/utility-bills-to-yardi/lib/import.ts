import type { LedgerLine, Store } from "../types";
import { buildUpload, invoiceDateFor, dueDateFor } from "./export";
import { logEvent, snapshot } from "./run";

// Yardi import confirmed: the import and the payment run, simulated by writing one
// scheme-era ledger line per exported upload row.
export function yardiImport(store: Store, month: string): { lines: number } {
  const run = store.runs[month];
  if (!run || !run.exported) throw new Error("export the batch first");
  if (run.imported) return { lines: 0 };
  snapshot(store, `Yardi import ${month}`);
  const { rows } = buildUpload(store, month);
  let n = 0;
  for (const r of rows) {
    const bill = store.bills.find((b) => b.id === r.bill_id)!;
    const line: LedgerLine = {
      id: `LL-${month.replace("-", "")}-${String(store.ledger_lines.length + 1).padStart(5, "0")}`,
      payee_code: r.vendor_code,
      payee_name: r.vendor_name,
      description: r.description,
      control_number: `C${month.replace("-", "")}${String(n + 1).padStart(4, "0")}`,
      property_code: r.property_code,
      property_id: r.property_id,
      invoice_date: invoiceDateFor(bill),
      payment_method: "ACH",
      post_month: month,
      gl_code: r.expense_gl,
      gl_name: r.gl_name,
      invoice_number: r.invoice_number,
      amount: r.amount,
      due_date: dueDateFor(bill),
      unpaid_amount: 0,
      payment_number: `PN${month.replace("-", "")}${String(n + 1).padStart(4, "0")}`,
      payment_date: `${month}-25`,
      confirmed_account: null,
    };
    store.ledger_lines.push(line);
    n++;
  }
  run.imported = true;
  store.operator_steps.import = true;
  logEvent(store, { month, mechanism: "yardi_import", kind: "lines_created", count: n, note: `${n} ledger lines posted for ${month}` });
  return { lines: n };
}
