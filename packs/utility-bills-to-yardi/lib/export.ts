import { zipSync, strToU8 } from "fflate";
import type { Bill, BillBackRow, GlName, Store } from "../types";
import { addDays, fmtMMDD, mid, inRange } from "./dates";

export const YARDI_COLUMNS = ["record_type", "line_number", "vendor_code", "vendor_name", "invoice_date", "due_date", "invoice_number", "description", "property_code", "amount", "expense_gl", "ap_gl", "bank_gl"] as const;
export const AP_GL = "920000";
export const GL_CODE: Record<GlName, string> = {
  "Electricity non-recoverable": "950010",
  "Electricity recoverable": "950020",
  "Water recoverable": "950110",
  "Sewer recoverable": "950120",
  Stormwater: "950130",
  "Garbage recoverable": "950140",
  "Utility deposits": "912500",
  "Tenant charges": "940100",
};
const WATER_SPLIT: [GlName, number][] = [["Water recoverable", 0.6], ["Sewer recoverable", 0.3], ["Stormwater", 0.1]];

export interface UploadRow {
  record_type: "I";
  line_number: number;
  vendor_code: string;
  vendor_name: string;
  invoice_date: string;
  due_date: string;
  invoice_number: string;
  description: string;
  property_code: string;
  amount: number;
  expense_gl: string;
  ap_gl: string;
  bank_gl: string;
  bill_id: string;
  gl_name: GlName;
  property_id: string;
  provider: string;
}

export interface UploadFile {
  name: string;
  property_id: string;
  property_code: string;
  provider: string;
  rows: UploadRow[];
}

export function fmtDateUS(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
}

export function invoiceDateFor(bill: Bill): string {
  return addDays(bill.service_end, 1);
}

export function dueDateFor(bill: Bill): string {
  return addDays(invoiceDateFor(bill), 20);
}

// The rule the team applies by hand today: the last five digits of the account number and
// the due date, because the bills carry no invoice number of their own.
export function invoiceNumberFor(bill: Bill): string {
  const due = dueDateFor(bill);
  return `${bill.account_number.slice(-5)}-${due.slice(5, 7)}${due.slice(8, 10)}${due.slice(0, 4)}`;
}

// The house scheme: account number, service dates, meter number. The account number is the
// part that lets a payment be tied back to its meter, which is why it leads the line.
export function descriptionFor(store: Store, bill: Bill): string {
  const meter = bill.meter_id ? store.meters.find((m) => m.id === bill.meter_id) : null;
  const number = meter?.meter_number ?? bill.meter_as_printed ?? meter?.id ?? "";
  return `${bill.account_number} ${fmtMMDD(bill.service_start)} to ${fmtMMDD(bill.service_end)} ${number}`.trim();
}

function expenseGl(store: Store, bill: Bill): GlName {
  const meter = bill.meter_id ? store.meters.find((m) => m.id === bill.meter_id) : null;
  if (!meter || meter.service_type === "electric") {
    const unit = meter?.unit_id ? store.units.find((u) => u.id === meter.unit_id) : null;
    return unit && unit.occupancy[bill.arrival_month] === "occupied" ? "Electricity recoverable" : "Electricity non-recoverable";
  }
  return "Water recoverable";
}

function money(x: number): number {
  return Math.round(x * 100) / 100;
}

// One bill becomes one row (electric) or three rows (municipal water) under one invoice number.
export function rowsForBill(store: Store, bill: Bill, startLine: number): UploadRow[] {
  const property = store.properties.find((p) => p.id === bill.property_id)!;
  const provider = store.providers.find((p) => p.name === bill.provider)!;
  const meter = bill.meter_id ? store.meters.find((m) => m.id === bill.meter_id) : null;
  const base = {
    record_type: "I" as const,
    vendor_code: provider.vendor_code,
    vendor_name: provider.name,
    invoice_date: fmtDateUS(invoiceDateFor(bill)),
    due_date: fmtDateUS(dueDateFor(bill)),
    invoice_number: invoiceNumberFor(bill),
    description: descriptionFor(store, bill),
    property_code: property.code,
    ap_gl: AP_GL,
    bank_gl: property.bank_gl,
    bill_id: bill.id,
    property_id: property.id,
    provider: provider.name,
  };
  if (meter?.service_type === "water") {
    const a = money(bill.amount * WATER_SPLIT[0][1]);
    const b = money(bill.amount * WATER_SPLIT[1][1]);
    const amounts = [a, b, money(bill.amount - a - b)];
    return WATER_SPLIT.map(([gl], i) => ({ ...base, line_number: startLine + i, amount: amounts[i], expense_gl: GL_CODE[gl], gl_name: gl }));
  }
  const gl = expenseGl(store, bill);
  return [{ ...base, line_number: startLine, amount: bill.amount, expense_gl: GL_CODE[gl], gl_name: gl }];
}

export function exportableBills(store: Store, month: string): Bill[] {
  return store.bills.filter((b) => b.arrival_month === month && (b.status === "matched" || b.status === "surfaced" || b.status === "exported") && b.meter_id);
}

export function buildUpload(store: Store, month: string): { files: UploadFile[]; rows: UploadRow[] } {
  const groups = new Map<string, UploadFile>();
  for (const bill of exportableBills(store, month)) {
    const property = store.properties.find((p) => p.id === bill.property_id)!;
    const provider = store.providers.find((p) => p.name === bill.provider)!;
    const key = `${property.id}|${provider.name}`;
    let file = groups.get(key);
    if (!file) {
      file = { name: `${property.code}-${provider.vendor_code}-${month}.csv`, property_id: property.id, property_code: property.code, provider: provider.name, rows: [] };
      groups.set(key, file);
    }
    file.rows.push(...rowsForBill(store, bill, file.rows.length + 1));
  }
  const files = [...groups.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
  return { files, rows: files.flatMap((f) => f.rows) };
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function fileText(rows: UploadRow[]): string {
  return rows.map((r) => YARDI_COLUMNS.map((c) => csvEscape(c === "amount" ? r.amount.toFixed(2) : r[c])).join(",")).join("\n") + (rows.length ? "\n" : "");
}

export function billBacksCsv(store: Store, month: string): string {
  const header = "tenant,unit,property_code,account_number,months,amount,gl_code,gl_name";
  const rows = store.bill_backs.filter((r) => r.month === month).map((r) => {
    const property = store.properties.find((p) => p.id === r.property_id)!;
    const unit = store.units.find((u) => u.id === r.unit_id)!;
    return [r.tenant, unit.label, property.code, r.account_number, r.months, r.amount.toFixed(2), GL_CODE["Tenant charges"], "Tenant charges"].map(csvEscape).join(",");
  });
  return [header, ...rows].join("\n") + "\n";
}

export function buildZip(files: UploadFile[], billBacks: string, month: string): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = strToU8(fileText(f.rows));
  entries[`bill-backs-${month}.csv`] = strToU8(billBacks);
  return zipSync(entries, { level: 6 });
}

// Marks the batch's rows exported and writes the scheme invoice number and description onto each bill.
export function markExported(store: Store, month: string): { files: { name: string; rows: number }[]; rows: number } {
  const { files } = buildUpload(store, month);
  for (const f of files) {
    for (const r of f.rows) {
      const bill = store.bills.find((b) => b.id === r.bill_id)!;
      bill.status = "exported";
      bill.invoice_number = r.invoice_number;
      bill.description = r.description;
    }
  }
  const summary = files.map((f) => ({ name: f.name, rows: f.rows.length }));
  const run = store.runs[month];
  if (run) {
    run.files = summary;
    run.upload_rows = summary.reduce((n, f) => n + f.rows, 0);
    run.exported = true;
  }
  return { files: summary, rows: summary.reduce((n, f) => n + f.rows, 0) };
}

export function billBackRowFor(store: Store, month: string, meterId: string, account: string, months: number, amount: number): BillBackRow | null {
  const meter = store.meters.find((m) => m.id === meterId);
  const unit = meter?.unit_id ? store.units.find((u) => u.id === meter.unit_id) : null;
  if (!meter || !unit || !unit.tenant) return null;
  return { id: `BB-${store.bill_backs.length + 1}`, month, property_id: meter.property_id, unit_id: unit.id, tenant: unit.tenant, account_number: account, months, amount, gl_name: "Tenant charges" };
}

export function activeLandlordAccount(store: Store, meterId: string, month: string) {
  return store.accounts.find((a) => a.meter_id === meterId && a.holder === "landlord" && inRange(mid(month), a.active_from, a.active_to)) ?? null;
}
