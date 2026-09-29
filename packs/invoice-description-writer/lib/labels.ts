import type { ExtractionFieldKey } from "./types";

/** The one place the routed note is spelled; acceptance check 7 fixes the wording. */
export const ROUTED_NOTE = "utility, handled by the capture pipeline";

/** Display order of the extracted fields on Write the invoice description. */
export const FIELD_ORDER: ExtractionFieldKey[] = [
  "vendor_name",
  "invoice_number",
  "invoice_date",
  "due_date",
  "amount",
  "property_hint",
  "unit_hint",
  "service_short",
  "service_from",
  "service_to",
  "account_number",
  "meter_number",
];

/** Plain labels for the field readings and the manual-entry card. */
export const FIELD_LABELS: Record<ExtractionFieldKey, string> = {
  vendor_name: "Vendor",
  invoice_number: "Invoice number",
  invoice_date: "Invoice date",
  due_date: "Due date",
  amount: "Amount",
  property_hint: "Property",
  unit_hint: "Unit",
  service_short: "Service",
  service_from: "Service from",
  service_to: "Service to",
  account_number: "Account number",
  meter_number: "Meter number",
};
