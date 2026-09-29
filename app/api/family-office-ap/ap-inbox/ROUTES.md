# Routes: ap-inbox

Prefix: `/api/family-office-ap/ap-inbox`. Every handler exports `dynamic = "force-dynamic"`, answers with `json` from `@/lib/api`, and fails with `{ error: string }` and a 4xx status carrying plain words the screen can show. Type names below are in `packs/ap-inbox/lib/types.ts`. Money in every payload is integer cents unless a field is marked as text.

The store starts with every item `New`. Nothing is drafted until `POST arrive` runs (the This week's arrivals screen calls it on load) or an item is opened, which drafts that one item. The Split across properties page also switches an open draft into splitter mode server-side, through the same `setMode` action as `POST mode`. `POST reset` re-seeds and drops every draft, update, batch and upload.

## Screens

| Route | Method | Body | Response |
|---|---|---|---|
| `/inbox` | GET | none | `InboxView` (counters cover every `ItemState`; `readyToSubmit` counts Drafted items whose readiness is `canSubmit`) |
| `/arrive` | POST | none | `InboxView` after drafting every `New` item; safe to call again, already-drafted items are untouched |
| `/items/[itemId]` | GET | none | `ItemView`; drafts the item first if it is still `New` |
| `/items/[itemId]/document` | GET | none | the uploaded bytes (`content-type` from the upload, inline); 404 for scripted items, whose document is at `documentUrl` under `/demo/ap-inbox/` |
| `/exceptions` | GET | none | `ExceptionsView`; one card per unresolved exception on items in state `Needs attention` only (a Skipped, Drafted, Submitted, Approved, Paid or New item never has a card), `open` equals the card count |
| `/approvals` | GET | none | `ApprovalsView`; items in state `Submitted` |
| `/ready` | GET | none | `ReadyView`; Approved items with their `ImportRow`s. After Mark batch paid, with nothing left Approved, it shows the last batch with `paid: true` and `batch` set |
| `/ready/file` | GET | none | the import file as `text/plain`, tab-separated, header row of the 15 `IMPORT_COLUMNS` then one row per invoice line, `content-disposition: attachment; filename="import-2026-09-03.txt"` |
| `/tracker` | GET | none | `TrackerView`; cards most recent first, `cameByEmailNotInTrackerBefore` marks cards created in the demo whose first update came by email, `emailNewCount` counts them |
| `/archive` | GET | none | `ArchiveView`; documents grouped by Monday-start week, label "Week of Aug 31, 2026", most recent week first |
| `/parcel-lookup?q=&limit=` | GET | query string | `ParcelLookupView & { matches: ParcelRecord[] }`. `q` is a parcel id or an address; `result` is the `Resolution` (`one`, `none`, `many` with candidates). With `limit` (1 to 50) `matches` carries a prefix or substring search over id and address for pickers; without it `matches` is empty |

## Actions on an item

All return the updated `ItemView` unless noted. `[itemId]` must exist and be drafted (409 when the item is still `New`; open This week's arrivals first).

| Route | Method | Body | Notes |
|---|---|---|---|
| `/items/[itemId]/field` | POST | `{ field: DraftField, value: string \| null }` | Sets the field by hand: source "You", confidence 1, and adds it to `confirmed`. `amount` is dollars text ("175.00"); `postMonth` is "YYYY-MM"; `expenseType` is fixed and ignored. In splitter mode a new amount recomputes `sumCheck` |
| `/items/[itemId]/confirm` | POST | `{ field: DraftField }` | Adds the field to `confirmed` so a low-confidence value no longer blocks Submit |
| `/items/[itemId]/ledger` | POST | `{ glAccount: string }` | Picks a ledger account from `ledgerAccounts`; clears the "last three disagree" block. `ledgerChoices` stays for display |
| `/items/[itemId]/mode` | POST | `{ mode: "single" \| "splitter" }` | Switch to splitter builds one line from the resolved property when the draft has no lines; switch back restores entity and cash account from the property or the vendor history |
| `/items/[itemId]/line` | POST | `{ lineNumber: number, amount: string }` | Amount as dollars text. The line becomes `stated`, `sumCheck` is recomputed; readiness carries "Lines do not add up to the invoice total" when it is red |
| `/items/[itemId]/line-parcel` | POST | `{ lineNumber: number, parcelId: string }` | Resolves a line whose address did not match (owner, entity, cash account, property-list flag from the parcel) |
| `/items/[itemId]/create-property` | POST | `{ lineNumber: number }` | Adds the line's parcel to the system property list (`SP-21601` upward, `createdInDemo`) and clears the flag on every line with that parcel |
| `/items/[itemId]/create-vendor` | POST | none | Adds a vendor named after the document text (`V-041` upward, no history), resolves "Unknown vendor", leaves the ledger account empty; entity and cash account stay resolved from the property when there is one |
| `/items/[itemId]/match-vendor` | POST | `{ vendorId: string }` | Adds the document text as an alias of that vendor, applies its defaults, resolves "Unknown vendor" |
| `/items/[itemId]/map-utility-account` | POST | `{ parcelId: string }` | Maps the item's utility account to the parcel in the crosswalk (it stays mapped for the session), resolves the property by utility account, fills entity and cash account, resolves "Unknown utility account" |
| `/items/[itemId]/enter-amount` | POST | `{ amount: string }` | Dollars text. Sets the amount, resolves "Amount unreadable" |
| `/items/[itemId]/choose-owner` | POST | `{ parcelId: string }` | Resolves the property to the chosen candidate, resolves "Ambiguous owner" |
| `/items/[itemId]/resolve-property` | POST | `{ query: string }` | Parcel id or address typed on the review screen; one hit resolves the property, none or many fails with the reason |
| `/items/[itemId]/skip` | POST | none | State `Skipped`; the "Possible duplicate" exception is resolved as "Skipped, duplicate of <number>", so the card leaves Needs a person; the item never reaches Ready for Yardi |
| `/items/[itemId]/keep` | POST | none | Resolves "Possible duplicate" as "Kept, not a duplicate", also after a skip; back to `Drafted` |
| `/items/[itemId]/send-to-exceptions` | POST | `{ note: string }` | Adds a "Sent to exceptions" card with the note, state `Needs attention` |
| `/items/[itemId]/clear-sent` | POST | none | Resolves that card, back to `Drafted` |
| `/items/[itemId]/submit` | POST | none | Requires state `Drafted` and `readiness.canSubmit`; fails with the first reason otherwise. Sets `Submitted`, posts the tracker "submitted" updates |
| `/inbox/submit-all` | POST | none | Submits every Drafted item that can be submitted. Returns `InboxView & { submitted: number }` |

## Approver and batch

| Route | Method | Body | Response |
|---|---|---|---|
| `/approvals/[itemId]/approve` | POST | none | `ApprovalsView`; only a `Submitted` item can be approved |
| `/approvals/[itemId]/return` | POST | `{ note: string }` | `ApprovalsView`; the item goes back to `Drafted` with `returnNote` set |
| `/approvals/approve-all` | POST | none | `ApprovalsView & { approved: number }` |
| `/ready/paid` | POST | none | `ReadyView` with `paid: true` and the new `PaidBatch` (`B-1` upward). Every Approved item becomes `Paid`, `paidAt` is stamped, tracker "paid" updates are posted. Fails when nothing is Approved |

## Documents and reset

| Route | Method | Body | Response |
|---|---|---|---|
| `/upload` | POST | `multipart/form-data` with a `file` field | `ItemView` of the new item (`I-9001` upward, source Email, unscripted). The document is read live only when `ANTHROPIC_API_KEY` is set; otherwise the draft opens with `readFailed: true` ("Could not read this document, enter fields by hand") and every field except expense type and post month empty, ready to be typed and submitted |
| `/reset` | POST | none | `ResetResult` `{ ok: true, items, states }` with every item back to `New` |

## Where the rules live

`packs/ap-inbox/lib/`: `money.ts` (`parseMoney`, `dollarsToCents`, `fmtCents`, `fmtCentsPlain`), `vendors.ts` (`normaliseVendorName`, `scoreVendor`, `matchVendor`, `VENDOR_THRESHOLD`), `defaults.ts` (`vendorDefaults`, `ledgerForChargeType`), `split.ts` (`equalSplit`, `sumCheck`), `duplicates.ts` (`findDuplicate`), `notes.ts` (`notesTemplate`, `numberWord`), `draft.ts` (`buildDraft`, `draftState`, `applyResolution`, `resolutionFor`, `oneLineAddress`), `readiness.ts` (`readiness`), `tracker.ts` (`ensureCard`, `postCaptured`, `postSubmitted`, `postPaid`, `trackerMessage`), `importfile.ts` (`importRows`, `importRowsFor`, `rowsForDraft`, `writeImportFile`, `importFileName`, `rowsTotal`), `views.ts` (`inboxView`, `itemView`, `exceptionsView`, `approvalsView`, `readyView`, `trackerView`, `archiveView`, `parcelLookupView`, `documentUrl`, `draftTotal`), `actions.ts` (every state change above, `ActionError`), `clock.ts` (`stamp`, `fmtDate`, `mondayOf`, `shiftDays`, `shiftMonths`), `model.ts` (`readDocument`, `readCanned`, `validateExtraction`). The shared parcel module is `packs/property-owner-lookup/lib` (`loadParcels`, `parcelById`, `normalizeAddress`, `resolveParcel`, `findParcelText`, `searchParcels`, `entityList`, `entityForOwner`, `lookupView`).

Field confidence bands for colour: `CONFIDENCE.HIGH` 0.85 and above, `CONFIDENCE.CONFIRM` 0.60; a field below 0.60 that is not in `confirmed` blocks Submit with the reason "Confirm the amount" (or "Confirm the <field>").
