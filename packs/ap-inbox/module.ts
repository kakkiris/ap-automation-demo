import type { Module, SystemRef } from "@/lib/registry";

const MONDAY_IN: SystemRef = { name: "Monday.com", role: "reads", note: "the card the asset team approved, and its attachment" };
const MAILBOX: SystemRef = { name: "AP mailbox", role: "reads", note: "invoices that arrive by email" };
const PORTALS: SystemRef = { name: "Utility portals", role: "reads", note: "the bill that follows the bill-ready notice" };
const POST: SystemRef = { name: "Post", role: "reads", note: "paper invoices scanned into the inbox" };
const YARDI_READ: SystemRef = { name: "Yardi", role: "reads", note: "the vendor list and how this vendor was coded before" };
const PARCEL_DB: SystemRef = { name: "Parcel database", role: "reads", note: "the owner, entity and cash account behind the property" };

export const apInboxPack: Module = {
  slug: "ap-inbox",
  name: "AP Inbox",
  department: "family-office-ap",
  sentence: "Every invoice lands in one inbox with its source shown, its vendor matched, its accounts defaulted from history, and its property resolved to the owning entity; the specialist reviews a pre-filled draft instead of typing.",
  base: "/family-office-ap/ap-inbox",
  apiBase: "/api/family-office-ap/ap-inbox",
  resetPath: "/api/family-office-ap/ap-inbox/reset",
  systems: [
    MONDAY_IN,
    MAILBOX,
    PORTALS,
    YARDI_READ,
    PARCEL_DB,
    { name: "Shared drive", role: "receives", note: "a copy of every document, filed on arrival" },
  ],
  screens: [
    { slug: "this-weeks-arrivals", label: "This week's arrivals", systems: [MONDAY_IN, MAILBOX, PORTALS, POST] },
    { slug: "review-an-invoice", label: "Review an invoice", param: "itemId", systems: [YARDI_READ, PARCEL_DB] },
    {
      slug: "split-across-properties",
      label: "Split across properties",
      param: "itemId",
      systems: [PARCEL_DB, { name: "Yardi", role: "reads", note: "the property list; a property it does not have is flagged" }],
    },
    {
      slug: "needs-a-person",
      label: "Needs a person",
      systems: [{ name: "Yardi", role: "reads", note: "the vendor list behind an unknown payee" }, { name: "Parcel database", role: "reads", note: "the candidate owners for an unclear address" }],
    },
    {
      slug: "approve",
      label: "Approve",
      systems: [
        { name: "Yardi", role: "unchanged", note: "approval stays exactly where it is today" },
        { name: "Monday.com", role: "unchanged", note: "the asset team already approved on the card" },
      ],
    },
    { slug: "ready-for-yardi", label: "Ready for Yardi", systems: [{ name: "Yardi", role: "receives", note: "the same import file the team runs today" }] },
    { slug: "property-tracker-updates", label: "Property tracker updates", systems: [{ name: "Monday.com", role: "receives", note: "a message on the property card, on submit and on paid" }] },
    { slug: "document-archive", label: "Document archive", systems: [{ name: "Shared drive", role: "receives", note: "every document filed on arrival, by week" }] },
  ],
};

// A mode of AP Inbox with its own place in the sidebar: the entry opens the splitter.
export const multiPropertySplitPack: Module = {
  slug: "multi-property-split",
  name: "Multi-property invoice splitter",
  department: "family-office-ap",
  sentence: "An invoice naming several properties becomes one line per property, split equally only when the invoice gives no amounts, with the lines checked against the total and missing properties flagged.",
  base: "/family-office-ap/multi-property-split",
  apiBase: apInboxPack.apiBase,
  resetPath: apInboxPack.resetPath,
  entry: `${apInboxPack.base}/split-across-properties`,
  systems: [
    PARCEL_DB,
    { name: "Yardi", role: "receives", note: "one line per property, through the import the team already runs" },
  ],
  screens: [{ slug: "split-one-invoice-across-properties", label: "Split one invoice across properties" }],
};
