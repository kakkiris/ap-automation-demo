import type { Module } from "@/lib/registry";

export const invoiceDescriptionWriterPack: Module = {
  slug: "invoice-description-writer",
  name: "Invoice description writer",
  department: "industrial-ap",
  sentence: "An invoice lands, its fields are read, the description is written in the house order, and a code is suggested from the vendor's own history; the coder pastes the words and keeps the judgment.",
  base: "/industrial-ap/invoice-description-writer",
  apiBase: "/api/industrial-ap/invoice-description-writer",
  resetPath: "/api/industrial-ap/invoice-description-writer/reset",
  systems: [
    { name: "Avid", role: "receives", note: "the description and the code, pasted into the fields that are typed today" },
    { name: "Yardi", role: "reads", note: "how this vendor was coded before" },
  ],
  screens: [
    { slug: "receive-todays-invoices", label: "Receive today's invoices", systems: [{ name: "Avid", role: "reads", note: "the day's captured invoices and their documents" }] },
    { slug: "write-the-invoice-description", label: "Write the invoice description" },
    { slug: "how-this-vendor-was-coded-before", label: "How this vendor was coded before", systems: [{ name: "Yardi", role: "reads", note: "every code this vendor was given before, and how often" }] },
    { slug: "the-house-description-order", label: "The house description order", systems: [{ name: "Avid", role: "receives", note: "descriptions in this order, in the field typed by hand today" }] },
  ],
};
