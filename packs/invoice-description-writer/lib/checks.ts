// Checks every reading passes before anything is built from it. Canned and live go through the same code.
import { EXTRACTION_FIELD_KEYS, type ExtractionFieldKey, type ExtractionFields, type ExtractionSource, type ExtractionStatus, type Vendor } from "./types";

export interface CheckResult {
  status: ExtractionStatus;
  missing: ExtractionFieldKey[];
  reasons: string[];
  resolved_vendor_id: string | null;
}

export const REASON_UNAVAILABLE = "extraction unavailable";

/** Lowercase, letters and digits only. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function resolveVendor(name: string | null, vendors: Vendor[]): Vendor | null {
  if (!name) return null;
  const key = normalizeName(name);
  if (key.length === 0) return null;
  return vendors.find((v) => normalizeName(v.name) === key) ?? null;
}

/** YYYY-MM-DD and a date that exists on the calendar. */
export function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function missingKeys(fields: ExtractionFields): ExtractionFieldKey[] {
  return EXTRACTION_FIELD_KEYS.filter((k) => fields[k] === null);
}

export function checkExtraction(fields: ExtractionFields, vendors: Vendor[], source: ExtractionSource = "canned"): CheckResult {
  const missing = missingKeys(fields);
  if (source === "unavailable") {
    return { status: "failed", missing, reasons: [REASON_UNAVAILABLE], resolved_vendor_id: null };
  }
  const reasons: string[] = [];
  if (!fields.vendor_name || fields.vendor_name.trim().length === 0) reasons.push("vendor name not found on the invoice");
  if (fields.amount === null) reasons.push("amount not found on the invoice");
  else if (!(fields.amount > 0)) reasons.push("amount is not greater than zero");
  if (fields.invoice_date !== null && !isRealDate(fields.invoice_date)) reasons.push("invoice date does not read as a date");
  if (fields.due_date !== null && !isRealDate(fields.due_date)) reasons.push("due date does not read as a date");
  const fromOk = fields.service_from === null || isRealDate(fields.service_from);
  const toOk = fields.service_to === null || isRealDate(fields.service_to);
  if (!fromOk || !toOk) reasons.push("service dates do not read as dates");
  else if (fields.service_from !== null && fields.service_to !== null && fields.service_from > fields.service_to) reasons.push("service from is later than service to");
  const vendor = resolveVendor(fields.vendor_name, vendors);
  return {
    status: reasons.length === 0 ? "read" : "failed",
    missing,
    reasons,
    resolved_vendor_id: vendor ? vendor.vendor_id : null,
  };
}
