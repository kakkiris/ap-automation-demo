import { describe, it, expect } from "vitest";
import { matchLine, indexLedger, tagAccountProperty, paidState, schemeInvoice, linesFor } from "../lib/ledger";
import type { Account, Bill, LedgerLine } from "../types";

const acct = (n: string, meter = "M9100001"): Account =>
  tagAccountProperty({ account_number: n, provider: "Fairshore Power", meter_id: meter, holder: "landlord", holder_name: null, active_from: "2026-01-01", active_to: null }, "P01");
const line = (o: Partial<LedgerLine>): LedgerLine => ({
  id: "LL-1", payee_code: "v990001", payee_name: "Fairshore Power", description: "07/01 to 07/31", control_number: "C1", property_code: "0999001", property_id: "P01",
  invoice_date: "2026-08-01", payment_method: "Check", post_month: "2026-08", gl_code: "950010", gl_name: "Electricity non-recoverable",
  invoice_number: "", amount: 100, due_date: "2026-08-20", unpaid_amount: 0, payment_number: "PN1", payment_date: "2026-08-15", confirmed_account: null, ...o,
});

describe("matchLine", () => {
  const accounts = [acct("9912345678"), acct("9955554321", "M9100002"), acct("9977774321", "M9100003")];
  it("matches scheme-era invoice numbers exactly", () => {
    expect(schemeInvoice("9912345678", "2026-08-01")).toBe("9912345678-20260801");
    const m = matchLine(line({ invoice_number: "9912345678-20260801" }), accounts);
    expect(m.kind).toBe("exact");
    expect(m.account_number).toBe("9912345678");
  });
  it("matches a full account inside the description", () => {
    const m = matchLine(line({ invoice_number: "JUL26-ELEC", description: "9912345678 07/01 to 07/31" }), accounts);
    expect(m.kind).toBe("exact");
  });
  it("matches a five digit suffix as partial", () => {
    const m = matchLine(line({ invoice_number: "45678-080126" }), accounts);
    expect(m).toMatchObject({ kind: "partial", account_number: "9912345678" });
  });
  it("flags a shared four digit suffix as needs confirmation", () => {
    const m = matchLine(line({ invoice_number: "4321-080126" }), accounts);
    expect(m.kind).toBe("needs_confirmation");
    expect(m.candidates).toEqual(["9955554321", "9977774321"]);
    expect(m.account_number).toBeNull();
  });
  it("honours a confirmed account", () => {
    const m = matchLine(line({ invoice_number: "4321-080126", confirmed_account: "9977774321" }), accounts);
    expect(m).toMatchObject({ kind: "confirmed", account_number: "9977774321" });
  });
  it("leaves bare lines unplaced", () => {
    expect(matchLine(line({ invoice_number: "", description: "Electric" }), accounts).kind).toBe("unplaced");
    expect(matchLine(line({ invoice_number: "0000-080126" }), accounts).kind).toBe("unplaced");
  });
});

describe("indexLedger and paidState", () => {
  const accounts = [acct("9912345678")];
  const bill: Bill = {
    id: "BILL-1", provider: "City water", account_number: "9912345678", service_address: "x", service_start: "2026-07-01", service_end: "2026-07-31", amount: 300, meter_as_printed: null,
    arrival_month: "2026-08", arrival_route: "downloaded", status: "exported", property_id: "P01", meter_id: "M9100001", description: null, invoice_number: "9912345678-20260801", exception_id: null, duplicate_of: null,
  };
  it("pays a three line water bill only when the lines sum", () => {
    const lines = [
      line({ id: "a", invoice_number: bill.invoice_number!, amount: 180, gl_name: "Water recoverable" }),
      line({ id: "b", invoice_number: bill.invoice_number!, amount: 90, gl_name: "Sewer recoverable" }),
    ];
    let ix = indexLedger({ ledger_lines: lines, accounts });
    expect(paidState(bill, linesFor(ix, "9912345678", "2026-08"), ix).paid).toBe(false);
    ix = indexLedger({ ledger_lines: [...lines, line({ id: "c", invoice_number: bill.invoice_number!, amount: 30, gl_name: "Stormwater" })], accounts });
    const state = paidState(bill, linesFor(ix, "9912345678", "2026-08"), ix);
    expect(state.paid).toBe(true);
    expect(state.sum).toBe(300);
  });
  it("counts any matched line for a month with no bill on record", () => {
    const ix = indexLedger({ ledger_lines: [line({ invoice_number: "45678-050126", post_month: "2026-05" })], accounts });
    const state = paidState(null, linesFor(ix, "9912345678", "2026-05"), ix);
    expect(state).toMatchObject({ paid: true, kind: "partial" });
    expect(paidState(null, linesFor(ix, "9912345678", "2026-06"), ix).paid).toBe(false);
  });
});
