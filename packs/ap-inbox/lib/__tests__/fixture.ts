import type { DraftField, FieldSource, InboxItem, InvoiceDraft, Store, Vendor } from "../types";
import { DRAFT_FIELDS } from "../types";

// A small in-memory store for the pure-function tests. The arrival test uses the real seed instead.

export function makeVendor(vendorId: string, name: string, over: Partial<Vendor> = {}): Vendor {
  return {
    vendorId,
    name,
    aliases: [],
    lastGlAccount: "9200-3100",
    lastCashAccount: "1000-2201",
    lastEntityCode: "E-101",
    history: [],
    createdInDemo: false,
    ...over,
  };
}

export function makeItem(itemId: string, over: Partial<InboxItem> = {}): InboxItem {
  return {
    itemId,
    source: "email",
    receivedAt: "2026-08-31T08:12:00Z",
    fileName: `${itemId.toLowerCase()}.pdf`,
    documentKind: "pdf",
    trackerCardRef: null,
    noticeText: null,
    state: "New",
    scripted: true,
    returnNote: null,
    ...over,
  };
}

const fields = <T>(value: T): Record<DraftField, T> => Object.fromEntries(DRAFT_FIELDS.map((f) => [f, value])) as Record<DraftField, T>;

export function makeDraft(itemId: string, over: Partial<InvoiceDraft> = {}): InvoiceDraft {
  const sources = fields<FieldSource | null>("Read from document");
  const confidence = fields<number | null>(0.95);
  return {
    itemId,
    payee: "Prairie Fence Co",
    invoiceNumber: "2291",
    expenseType: "expense",
    invoiceDate: "2026-08-28",
    postMonth: "2026-09",
    cashAccount: "1000-2209",
    notes: "Fence repair",
    entity: "E-109",
    amount: 72500,
    glAccount: "9200-3100",
    property: "88 Mill Pond Dr, Decatur, IL 62521",
    fieldSources: sources,
    fieldConfidence: confidence,
    vendorMatch: { vendorId: "V-010", score: 1 },
    vendorCandidates: [],
    propertyResolution: {
      parcelId: "P-11348",
      address: "88 Mill Pond Dr, Decatur, IL 62521",
      owner: "Sangamon Deed Company LLC",
      entityCode: "E-109",
      cashAccount: "1000-2209",
      method: "address",
      confidence: 0.9,
    },
    mode: "single",
    lines: [],
    sumCheck: null,
    exceptions: [],
    ledgerChoices: null,
    confirmed: [],
    readFailed: false,
    extraction: null,
    submittedAt: null,
    approvedAt: null,
    paidAt: null,
    ...over,
  };
}

export function makeStore(over: Partial<Store> = {}): Store {
  return {
    demoDate: "2026-09-03",
    postMonth: "2026-09",
    weekStart: "2026-08-31",
    weekEnd: "2026-09-03",
    items: [],
    vendors: [makeVendor("V-010", "Prairie Fence Co"), makeVendor("V-002", "Greenway Lawn Care", { lastGlAccount: "9200-3300" })],
    entities: [
      { entityCode: "E-001", name: "Lakeshore Lien Partners", cashAccount: "1000-1001", kind: "operating" },
      { entityCode: "E-101", name: "Lakeshore Lien Fund 2 LLC", cashAccount: "1000-2201", kind: "holding" },
      { entityCode: "E-106", name: "Birchline Holdings LLC", cashAccount: "1000-2206", kind: "holding" },
      { entityCode: "E-109", name: "Sangamon Deed Company LLC", cashAccount: "1000-2209", kind: "holding" },
    ],
    ledgerAccounts: [
      { glAccount: "9200-3100", name: "Repairs and maintenance" },
      { glAccount: "9200-3300", name: "Grounds" },
      { glAccount: "9100-1100", name: "Office expense" },
    ],
    systemProperties: [{ propertyCode: "SP-20001", parcelId: "P-11348", address: "88 Mill Pond Dr, Decatur, IL 62521", createdInDemo: false }],
    utilityAccounts: [],
    trackerCards: [{ cardRef: "T-8812", parcelId: "P-11020", createdInDemo: false }],
    clock: 0,
    drafts: {},
    trackerUpdates: [],
    batches: [],
    uploads: {},
    nextCardNumber: 8801,
    nextItemNumber: 9001,
    nextVendorNumber: 41,
    nextPropertyNumber: 21601,
    nextUpdateNumber: 1,
    ...over,
  };
}
