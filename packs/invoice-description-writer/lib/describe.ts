// Description assembly by fixed template. Pure: same input, same output.
import { DESCRIPTION_MAX_LENGTH, type Description, type InvoiceType, type SchemeTemplate, type TemplateId } from "./types";

export interface DescribeInput {
  invoice_type: InvoiceType;
  /** The resolved seed vendor's name, or the name as read for an unseen vendor. */
  vendor_name: string;
  service_short: string | null;
  property_code: string | null;
  unit_label: string | null;
  service_from: string | null;
  service_to: string | null;
  account_number: string | null;
  meter_number: string | null;
}

export const SERVICE_TEMPLATE = "{account number, when the invoice prints one} {vendor} {service} {property} {unit} {service from} to {service to}";
export const UTILITY_TEMPLATE = "{account number} {service} {service from} to {service to} meter {meter number}";

export const SERVICE_NOT_ON_INVOICE = "service not on invoice";
export const DATES_NOT_ON_INVOICE = "dates not on invoice";
export const NO_UNIT = "no unit";
export const NO_ACCOUNT_NUMBER = "no account number";
export const METER_NOT_ON_INVOICE = "meter number not on invoice";

/** What each placeholder renders when the invoice does not print it. null means the segment is left out. */
export const SERVICE_SEGMENTS: SchemeTemplate["segments"] = [
  { placeholder: "{account number, when the invoice prints one}", when_missing: null },
  { placeholder: "{vendor}", when_missing: null },
  { placeholder: "{service}", when_missing: SERVICE_NOT_ON_INVOICE },
  { placeholder: "{property}", when_missing: null },
  { placeholder: "{unit}", when_missing: NO_UNIT },
  { placeholder: "{service from} to {service to}", when_missing: DATES_NOT_ON_INVOICE },
];

export const UTILITY_SEGMENTS: SchemeTemplate["segments"] = [
  { placeholder: "{account number}", when_missing: NO_ACCOUNT_NUMBER },
  { placeholder: "{service}", when_missing: SERVICE_NOT_ON_INVOICE },
  { placeholder: "{service from} to {service to}", when_missing: DATES_NOT_ON_INVOICE },
  { placeholder: "meter {meter number}", when_missing: METER_NOT_ON_INVOICE },
];

export function templateFor(template_id: TemplateId): string {
  return template_id === "utility" ? UTILITY_TEMPLATE : SERVICE_TEMPLATE;
}

/** Trims a read value; empty or whitespace counts as not on the invoice. */
function clean(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function describeInvoice(input: DescribeInput): Omit<Description, "invoice_id"> {
  const missing: string[] = [];
  const segments: string[] = [];
  const account = clean(input.account_number);
  const service = clean(input.service_short);
  const from = clean(input.service_from);
  const to = clean(input.service_to);
  let serviceIndex = -1;

  const pushService = () => {
    serviceIndex = segments.length;
    if (service) segments.push(service);
    else {
      missing.push("service_short");
      segments.push(SERVICE_NOT_ON_INVOICE);
    }
  };
  const pushDates = () => {
    if (from && to) segments.push(`${from} to ${to}`);
    else {
      if (!from) missing.push("service_from");
      if (!to) missing.push("service_to");
      segments.push(DATES_NOT_ON_INVOICE);
    }
  };

  const template_id: TemplateId = input.invoice_type === "utility" ? "utility" : "service";
  if (template_id === "utility") {
    if (account) segments.push(account);
    else {
      missing.push("account_number");
      segments.push(NO_ACCOUNT_NUMBER);
    }
    pushService();
    pushDates();
    const meter = clean(input.meter_number);
    if (meter) segments.push(`meter ${meter}`);
    else {
      missing.push("meter_number");
      segments.push(METER_NOT_ON_INVOICE);
    }
  } else {
    if (account) segments.push(account);
    segments.push(input.vendor_name.trim());
    pushService();
    const property = clean(input.property_code);
    if (property) segments.push(property);
    else missing.push("property_code");
    const unit = clean(input.unit_label);
    if (unit) segments.push(unit);
    else {
      missing.push("unit_label");
      segments.push(NO_UNIT);
    }
    pushDates();
  }

  // Length limit: drop the service segment's last word (then its last characters) until the
  // text fits; if the service segment is gone and the text is still too long, cut at the limit.
  const join = () => segments.filter((s) => s.length > 0).join(" ");
  let text = join();
  let truncated = false;
  const serviceTrimmable = service !== null;
  while (text.length > DESCRIPTION_MAX_LENGTH) {
    const current = serviceTrimmable && serviceIndex >= 0 ? segments[serviceIndex] : "";
    if (current.length > 0) {
      const words = current.split(" ");
      segments[serviceIndex] = words.length > 1 ? words.slice(0, -1).join(" ") : words[0].slice(0, -1);
      truncated = true;
      text = join();
    } else {
      text = text.slice(0, DESCRIPTION_MAX_LENGTH);
      truncated = true;
    }
  }

  return { text, template_id, missing_fields: missing, truncated };
}
