import type { Module, SystemRef } from "@/lib/registry";

// One code module, three entries in the sidebar: the pack built the three solutions
// as one system with one store and one reset. Screens are split by the step they serve.
const API = "/api/industrial-ap/utility-bills-to-yardi";
const RESET = `${API}/reset`;
const SHARED = ["utility-bills-to-yardi", "meter-register", "utility-payment-reconciliation"];

const PORTALS: SystemRef = { name: "Provider portals", role: "reads", note: "the bills, on each provider's own cadence" };
const YARDI_UPLOAD: SystemRef = { name: "Yardi", role: "receives", note: "the upload file, one per property per provider" };
const DRIVE: SystemRef = { name: "Shared drive", role: "receives", note: "every bill filed by property and account" };
const AVID_OUT: SystemRef = { name: "Avid", role: "unchanged", note: "utility bills leave it; the one check vendor stays" };
const WORKBOOKS: SystemRef = { name: "Utility workbooks", role: "replaces", note: "the tabs filled in by hand, one per service" };

export const utilityBillsToYardiPack: Module = {
  slug: "utility-bills-to-yardi",
  name: "Utility bills to Yardi",
  department: "industrial-ap",
  sentence: "A bill lands, gets read and checked, and becomes a Yardi row whose description carries the account number, so it can be matched later.",
  base: "/industrial-ap/utility-bills-to-yardi",
  apiBase: API,
  resetPath: RESET,
  seats: true,
  sharesStoreWith: SHARED,
  systems: [PORTALS, YARDI_UPLOAD, DRIVE, AVID_OUT],
  screens: [
    { slug: "capture-this-months-bills", label: "Capture this month's bills" },
    {
      slug: "match-bills-to-meters",
      label: "Match bills to meters",
      systems: [PORTALS, { name: "Yardi", role: "receives", note: "the upload, once every exception is settled" }],
    },
  ],
};

export const meterRegisterPack: Module = {
  slug: "meter-register",
  name: "Meter register",
  department: "industrial-ap",
  sentence: "Every meter, its kind, and the dated history of who held its account, kept on the meter number because account numbers change with every turnover.",
  base: "/industrial-ap/meter-register",
  apiBase: API,
  resetPath: RESET,
  sharesStoreWith: SHARED,
  systems: [
    { name: "Yardi", role: "reads", note: "the rent roll and its lease dates" },
    { name: "Provider bills", role: "reads", note: "a new account number the moment a bill surfaces one" },
    WORKBOOKS,
  ],
  screens: [
    { slug: "every-meter-and-its-account", label: "Every meter and its account" },
    { slug: "one-meters-history", label: "One meter's history", nav: false, param: "meterId" },
  ],
};

export const utilityPaymentReconciliationPack: Module = {
  slug: "utility-payment-reconciliation",
  name: "Paid-or-not reconciliation",
  department: "industrial-ap",
  sentence: "Every meter, every month, checked against the rent roll: paid, unpaid, not yet billed, or a bill-back, with the shut-off risk on top.",
  base: "/industrial-ap/utility-payment-reconciliation",
  apiBase: API,
  resetPath: RESET,
  sharesStoreWith: SHARED,
  systems: [
    { name: "Yardi", role: "reads", note: "the ledger lines and the rent roll behind every cell" },
    WORKBOOKS,
    DRIVE,
  ],
  screens: [
    { slug: "which-bills-are-paid", label: "Which bills are paid" },
    { slug: "one-property-month-by-month", label: "One property, month by month", nav: false, param: "siteId" },
    {
      slug: "confirm-which-account-a-payment-matched",
      label: "Confirm which account a payment matched",
      systems: [{ name: "Yardi", role: "reads", note: "the legacy payment whose description carries no account number" }],
    },
    {
      slug: "payments-without-a-meter",
      label: "Payments without a meter",
      systems: [{ name: "Yardi", role: "reads", note: "ledger lines that name no account the register knows" }],
    },
    {
      slug: "bill-backs-transfers-and-calls",
      label: "Bill-backs, transfers and calls",
      systems: [
        { name: "Yardi", role: "receives", note: "the tenant charge rows, through the file the team imports" },
        { name: "Provider portals", role: "unchanged", note: "calls and transfers are made by a person, as today" },
      ],
    },
    { slug: "files-and-notes-produced", label: "Files and notes produced", systems: [YARDI_UPLOAD, DRIVE] },
    {
      slug: "the-tracker-as-kept-today",
      label: "The tracker as kept today",
      systems: [WORKBOOKS, { name: "Yardi", role: "reads", note: "the rent roll tab and the discrepancy list beside it" }],
    },
  ],
};

/** Hrefs for the utility screens, used by the shared ui across the three modules. */
export const utilRoutes = {
  strip: `${utilityPaymentReconciliationPack.base}/which-bills-are-paid`,
  grid: (siteId: string) => `${utilityPaymentReconciliationPack.base}/one-property-month-by-month/${encodeURIComponent(siteId)}`,
  matches: `${utilityPaymentReconciliationPack.base}/confirm-which-account-a-payment-matched`,
  unplaced: `${utilityPaymentReconciliationPack.base}/payments-without-a-meter`,
  actions: `${utilityPaymentReconciliationPack.base}/bill-backs-transfers-and-calls`,
  artifacts: `${utilityPaymentReconciliationPack.base}/files-and-notes-produced`,
  today: `${utilityPaymentReconciliationPack.base}/the-tracker-as-kept-today`,
  master: `${meterRegisterPack.base}/every-meter-and-its-account`,
  meter: (meterId: string) => `${meterRegisterPack.base}/one-meters-history/${encodeURIComponent(meterId)}`,
  capture: `${utilityBillsToYardiPack.base}/capture-this-months-bills`,
  exceptions: `${utilityBillsToYardiPack.base}/match-bills-to-meters`,
};
