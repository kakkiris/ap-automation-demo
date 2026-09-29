import type { Vendor, VendorHistoryEntry } from "./types";
import { historyNewestFirst } from "./defaults";
import { shiftMonths } from "./clock";

// Duplicate detection: the same vendor and invoice number in the twelve months before the demo date.

export function findDuplicate(vendor: Vendor | null | undefined, invoiceNumber: string | null | undefined, demoDate: string): VendorHistoryEntry | null {
  if (!vendor) return null;
  const wanted = (invoiceNumber ?? "").trim().toLowerCase();
  if (!wanted) return null;
  const from = shiftMonths(demoDate, -12);
  for (const h of historyNewestFirst(vendor)) {
    if (h.invoiceNumber.trim().toLowerCase() !== wanted) continue;
    if (h.date >= from && h.date <= demoDate) return h;
  }
  return null;
}
