import type { DraftField, InvoiceDraft, Readiness, Store } from "./types";
import { CONFIDENCE, DRAFT_FIELDS, FIELD_LABELS, REQUIRED_FIELDS } from "./types";

// Whether a draft can be submitted, with plain-word reasons when it cannot.

const label = (f: DraftField) => FIELD_LABELS[f].toLowerCase();

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export function readiness(draft: InvoiceDraft, store: Store): Readiness {
  const reasons: string[] = [];
  const item = store.items.find((i) => i.itemId === draft.itemId);
  switch (item?.state) {
    case "Submitted":
      reasons.push("Already submitted");
      break;
    case "Approved":
      reasons.push("Already approved");
      break;
    case "Paid":
      reasons.push("Already paid");
      break;
    case "Skipped":
      reasons.push("Skipped, not for payment");
      break;
    case "New":
      reasons.push("Not drafted yet");
      break;
    default:
      break;
  }

  for (const e of draft.exceptions) if (!e.resolved) reasons.push(`Work the exception: ${e.title}`);

  for (const f of REQUIRED_FIELDS) {
    if (draft.mode === "splitter" && (f === "entity" || f === "cashAccount")) continue;
    if (f === "glAccount" && draft.ledgerChoices && isEmpty(draft.glAccount)) continue;
    if (isEmpty(draft[f])) reasons.push(`Fill in the ${label(f)}`);
  }

  for (const f of DRAFT_FIELDS) {
    const c = draft.fieldConfidence[f];
    if (c !== null && c < CONFIDENCE.CONFIRM && !draft.confirmed.includes(f) && !isEmpty(draft[f])) {
      reasons.push(f === "amount" ? "Confirm the amount" : `Confirm the ${label(f)}`);
    }
  }

  if (draft.ledgerChoices && isEmpty(draft.glAccount)) reasons.push("Pick the ledger account, the last three invoices disagree");

  if (draft.mode === "splitter") {
    if (draft.lines.length === 0) reasons.push("Add at least one property line");
    for (const line of draft.lines) {
      if (!line.parcelId) {
        reasons.push(`${line.address} did not match a parcel`);
      } else {
        if (!line.entityCode || !line.cashAccount) reasons.push(`${line.address} has no owner entity`);
        if (!line.systemPropertyExists) reasons.push(`${line.address} is not in the property list`);
      }
      if (!line.glAccount) reasons.push(`Pick the ledger account for ${line.address}`);
      if (line.amount === null) reasons.push(`Enter the amount for ${line.address}`);
    }
    if (!draft.sumCheck?.ok) reasons.push("Lines do not add up to the invoice total");
  }

  return { canSubmit: reasons.length === 0, reasons };
}
