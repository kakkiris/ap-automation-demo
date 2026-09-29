import { describe, it, expect } from "vitest";
import { indexStore, cellFor, rowFlags, whyStatus, siteCounts, missingBillSweep, monthCounts } from "../lib/status";
import { schemeInvoice } from "../lib/ledger";
import { store, unit, meter, account, line, bill } from "./fixture";

function build() {
  const u01 = unit("P01-U01", { tenant: null, move_in: null, move_out: "2026-06-10", who_pays: "owner", occupancy: { "2026-01": "occupied", "2026-02": "occupied", "2026-03": "occupied", "2026-04": "occupied", "2026-05": "occupied", "2026-06": "vacant", "2026-07": "vacant", "2026-08": "vacant", "2026-09": "vacant" } });
  const u02 = unit("P01-U02", { tenant: "Heron Tile", move_in: "2026-04-01", previous_move_out: "2026-02-15", who_pays: "tenant" });
  const u03 = unit("P01-U03", { tenant: null, move_in: null, move_out: "2025-12-01", who_pays: "owner", payer_source: "seller_workbook" });
  const u04 = unit("P01-U04", { tenant: "Osprey Signs", who_pays: "owner", payer_source: "seller_workbook" });
  const u05 = unit("P01-U05", { tenant: "Coral Glass", tenant_history: { "2026-06": "Sable Storage", "2026-07": "Sable Storage", "2026-08": "Coral Glass" } });
  const meters = [
    meter("M9000001", { unit_id: u01.id }),
    meter("M9000002", { unit_id: u02.id }),
    meter("M9000003", { unit_id: u03.id, meter_number: null }),
    meter("M9000004", { unit_id: u04.id }),
    meter("M9000005", { unit_id: u05.id }),
    meter("M9000006", { kind: "house", service_type: "water", provider: "City of Rivermouth", location_note: "irrigation" }),
    meter("M9000007", { kind: "house", service_type: "water", provider: "City of Westhaven", location_note: "fire line" }),
  ];
  const accounts = [
    account("9900000001", "M9000001", { active_from: "2026-06-11" }),
    account("9900000002", "M9000002", { active_from: "2026-02-16" }),
    account("9900004321", "M9000005", { holder: "tenant", holder_name: "Coral Glass" }),
    account("9900014321", "M9000004", { holder: "tenant", holder_name: "Osprey Signs" }),
    account("9900000006", "M9000006"),
    account("9900000007", "M9000007"),
  ];
  const ledger = [
    line({ id: "L-jul-1", invoice_number: schemeInvoice("9900000001", "2026-07-01"), post_month: "2026-07", amount: 74 }),
    ...["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"].map((m, i) => line({ id: `L-bb-${i}`, invoice_number: schemeInvoice("9900000002", `${m}-01`), post_month: m, amount: 50 + i })),
    line({ id: "L-w-1", invoice_number: schemeInvoice("9900000007", "2026-08-01"), post_month: "2026-08", amount: 180, gl_name: "Water recoverable" }),
    line({ id: "L-w-2", invoice_number: schemeInvoice("9900000007", "2026-08-01"), post_month: "2026-08", amount: 90, gl_name: "Sewer recoverable" }),
    line({ id: "L-w-3", invoice_number: schemeInvoice("9900000007", "2026-08-01"), post_month: "2026-08", amount: 30, gl_name: "Stormwater" }),
    line({ id: "L-amb", invoice_number: "4321-070126", post_month: "2026-07", amount: 40 }),
  ];
  const bills = [
    bill({ id: "BILL-w", provider: "City of Westhaven", account_number: "9900000007", amount: 300, invoice_number: schemeInvoice("9900000007", "2026-08-01"), meter_id: "M9000007" }),
    bill({ id: "BILL-aug-u02", account_number: "9900000002", amount: 54, invoice_number: schemeInvoice("9900000002", "2026-08-01"), meter_id: "M9000002" }),
  ];
  const s = store({ units: [u01, u02, u03, u04, u05], meters, accounts, ledger_lines: ledger, bills });
  return { s, ix: indexStore(s), meters };
}

describe("statuses", () => {
  const { s, ix, meters } = build();
  it("vacant unit with a landlord account and no August line is Unpaid; July is Paid", () => {
    expect(cellFor(ix, meters[0], "2026-08").status).toBe("unpaid");
    expect(cellFor(ix, meters[0], "2026-07")).toMatchObject({ status: "paid", match_kind: "exact", amount: 74 });
    expect(cellFor(ix, meters[0], "2026-05").status).toBe("tenant_held");
  });
  it("occupied unit with the landlord account still active and lines is Bill-back with a running total", () => {
    const c = cellFor(ix, meters[1], "2026-08");
    expect(c.status).toBe("bill_back");
    expect(c.months_since_move_in).toBe(5);
    expect(c.running_total).toBe(50 + 51 + 52 + 53 + 54);
    expect(rowFlags(ix, meters[1], "2026-08").transfer_needed).toBe(true);
  });
  it("vacant unit with no landlord account is No account on record and never Paid", () => {
    expect(cellFor(ix, meters[2], "2026-08").status).toBe("no_account");
    expect(rowFlags(ix, meters[2], "2026-08")).toMatchObject({ no_account_history: true, transfer_needed: true, payer_carried_over: false });
  });
  it("occupied unit marked owner-paid by the seller with no landlord account carries Payer carried over", () => {
    expect(cellFor(ix, meters[3], "2026-08").status).toBe("no_account");
    expect(rowFlags(ix, meters[3], "2026-08").payer_carried_over).toBe(true);
  });
  it("occupied tenant-paid unit is Tenant-held and Check payer fires on a tenant change", () => {
    expect(cellFor(ix, meters[4], "2026-08").status).toBe("tenant_held");
    expect(rowFlags(ix, meters[4], "2026-08").check_payer).toBe(true);
    expect(rowFlags(ix, meters[4], "2026-07").check_payer).toBe(false);
  });
  it("water master on a behind provider is Not yet billed; three-line water bill is Paid", () => {
    expect(cellFor(ix, meters[5], "2026-08").status).toBe("not_yet_billed");
    const c = cellFor(ix, meters[6], "2026-08");
    expect(c.status).toBe("paid");
    expect(c.line_ids).toHaveLength(3);
    expect(c.amount).toBe(300);
  });
  it("an ambiguous suffix line stays unassigned until confirmed", () => {
    expect(ix.ledger.ambiguous.map((m) => m.line.id)).toEqual(["L-amb"]);
    const confirmed = { ...s, ledger_lines: s.ledger_lines.map((l) => (l.id === "L-amb" ? { ...l, confirmed_account: "9900004321" } : l)) };
    const ix2 = indexStore(confirmed);
    expect(ix2.ledger.ambiguous).toHaveLength(0);
    expect(ix2.ledger.byAccountMonth.get("9900004321|2026-07")?.[0].kind).toBe("confirmed");
  });
  it("explains a status in plain words", () => {
    const why = whyStatus(ix, meters[6], "2026-08");
    expect(why.rule).toContain("sum to the bill");
    expect(why.lines).toHaveLength(3);
    expect(why.lines.map((l) => l.gl_name)).toEqual(["Water recoverable", "Sewer recoverable", "Stormwater"]);
  });
  it("counts the site and the month", () => {
    expect(siteCounts(ix, "P01", "2026-08")).toEqual({ unpaid: 1, bill_back: 1, transfer_needed: 0, not_yet_billed: 1, unmapped: 0, no_account: 2 });
    const mc = monthCounts(ix, "2026-08");
    expect(mc.blank_meters).toBe(1);
    expect(mc.matched_lines).toBe(4);
    expect(mc.exact_lines).toBe(4);
  });
  it("sweeps accounts with no bill in the batch", () => {
    const sweep = missingBillSweep(ix, "2026-08");
    expect(sweep.map((x) => x.account_number)).toEqual(["9900000006", "9900000001"]);
    expect(sweep.find((x) => x.account_number === "9900000001")?.last_bill_date).toBe("2026-07-01");
    expect(sweep.find((x) => x.account_number === "9900000006")?.behind).toBe(true);
  });
});
