import { parcelById } from "@/packs/property-owner-lookup/lib";
import type { ImportRow, InvoiceDraft, Store } from "./types";
import { IMPORT_COLUMNS } from "./types";
import { fmtCentsPlain } from "./money";
import { shiftDays } from "./clock";
import { oneLineAddress } from "./draft";

// The import file writer: the 15-column layout, one row per invoice line, the property
// in the description as "address, charge". Tab-separated text with a header row.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function capitalise(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function describe(address: string | null, charge: string | null): string {
  const a = (address ?? "").trim();
  const c = (charge ?? "").trim();
  if (a && c) return `${a}, ${c}`;
  return a || c;
}

function baseRow(draft: InvoiceDraft): Omit<ImportRow, "entity" | "cashAccount" | "glAccount" | "amount" | "description" | "line"> {
  const invoiceDate = draft.invoiceDate ?? "";
  return {
    vendorCode: draft.vendorMatch?.vendorId ?? "",
    payee: draft.payee ?? "",
    invoiceNumber: draft.invoiceNumber ?? "",
    invoiceDate,
    postMonth: draft.postMonth,
    dueDate: DATE.test(invoiceDate) ? shiftDays(invoiceDate, 30) : "",
    expenseType: draft.expenseType,
    notes: draft.notes ?? "",
    reference: draft.itemId,
  };
}

/** The rows for one draft: one for a single invoice, one per line for a split invoice. */
export function rowsForDraft(draft: InvoiceDraft): ImportRow[] {
  const base = baseRow(draft);
  if (draft.mode !== "splitter") {
    const address = draft.propertyResolution?.address ?? draft.property;
    return [
      {
        ...base,
        entity: draft.entity ?? "",
        cashAccount: draft.cashAccount ?? "",
        glAccount: draft.glAccount ?? "",
        amount: fmtCentsPlain(draft.amount ?? 0),
        description: describe(address, draft.notes),
        line: "1",
      },
    ];
  }
  const hint = draft.extraction?.notesHint ?? draft.notes;
  return draft.lines.map((line, i) => {
    const parcel = line.parcelId ? parcelById(line.parcelId) : undefined;
    const address = parcel ? oneLineAddress(parcel) : line.address;
    const charge = line.chargeType ? capitalise(line.chargeType) : line.description && line.description !== line.address ? line.description : hint;
    return {
      ...base,
      entity: line.entityCode ?? "",
      cashAccount: line.cashAccount ?? "",
      glAccount: line.glAccount ?? "",
      amount: fmtCentsPlain(line.amount ?? 0),
      description: describe(address, charge),
      line: String(i + 1),
    };
  });
}

/** Rows for the named items, in item id then line order. */
export function importRowsFor(store: Store, itemIds: string[]): ImportRow[] {
  const ids = [...itemIds].sort();
  const rows: ImportRow[] = [];
  for (const id of ids) {
    const draft = store.drafts[id];
    if (draft) rows.push(...rowsForDraft(draft));
  }
  return rows;
}

/** Rows for every Approved item. Skipped and Needs attention items never reach the file. */
export function importRows(store: Store): ImportRow[] {
  return importRowsFor(
    store,
    store.items.filter((i) => i.state === "Approved").map((i) => i.itemId),
  );
}

export function rowsTotal(rows: ImportRow[]): number {
  return rows.reduce((sum, r) => sum + Math.round(parseFloat(r.amount || "0") * 100), 0);
}

const ROW_ORDER: (keyof ImportRow)[] = [
  "entity",
  "vendorCode",
  "payee",
  "invoiceNumber",
  "invoiceDate",
  "postMonth",
  "dueDate",
  "expenseType",
  "cashAccount",
  "glAccount",
  "amount",
  "description",
  "notes",
  "line",
  "reference",
];

const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ");

export function writeImportFile(rows: ImportRow[]): string {
  const lines = [IMPORT_COLUMNS.join("\t")];
  for (const row of rows) lines.push(ROW_ORDER.map((k) => clean(row[k])).join("\t"));
  return lines.join("\n") + "\n";
}

export function importFileName(store: Store): string {
  return `import-${store.demoDate}.txt`;
}
