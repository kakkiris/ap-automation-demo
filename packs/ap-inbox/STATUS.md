# AP Inbox: status

Module: AP Inbox (slug ap-inbox), department Family Office AP. Base: /family-office-ap/ap-inbox. API: /api/family-office-ap/ap-inbox. Reset: /api/family-office-ap/ap-inbox/reset. Descriptor: apInboxPack in packs/ap-inbox/module.ts, registered in lib/registry.ts by the orchestrator. The same file exports multiPropertySplitPack, the "Multi-property invoice splitter" sidebar entry (slug multi-property-split), which is a plain link into this module's Split across properties screen.

## Screens

| Screen | Route | What it is |
|---|---|---|
| This week's arrivals | /family-office-ap/ap-inbox/this-weeks-arrivals | Landing. The week arrives on open (every New item gets its draft), with Submit all ready drafts and Add a document |
| Review an invoice | /family-office-ap/ap-inbox/review-an-invoice/[itemId] | The document beside the pre-filled draft. Without an item the route opens the first draft still open, else this week's arrivals |
| Split across properties | /family-office-ap/ap-inbox/split-across-properties/[itemId] | The same review in splitter mode; the URL alone switches the draft into the splitter. Without an item it opens I-0007 while that is still open, else the first multi-property draft still open, else this week's arrivals. The sidebar entry Multi-property invoice splitter (/family-office-ap/multi-property-split) lands here |
| Needs a person | /family-office-ap/ap-inbox/needs-a-person | One card per open exception with the one fix it needs |
| Approve | /family-office-ap/ap-inbox/approve | Approver view with Approve all and Return |
| Ready for Yardi | /family-office-ap/ap-inbox/ready-for-yardi | The batch: download, 15-column preview, Mark batch paid |
| Property tracker updates | /family-office-ap/ap-inbox/property-tracker-updates | Messages posted to each property's card, with the "came by email, not in tracker before" filter |
| Document archive | /family-office-ap/ap-inbox/document-archive | Every document by week with the door it used |

The Review an invoice screen carries "Split across properties" (moves to the splitter route) and the splitter carries "Back to the single draft" (moves back). Both screens title themselves with the item id ("Review an invoice: I-0005", "Split across properties: I-0007"). The Property Owner Lookup is no longer a bar in this module's layout: the shared module packs/property-owner-lookup owns it and the top bar offers it as a side panel on every Family Office screen. This module keeps its own route /api/family-office-ap/ap-inbox/parcel-lookup, which adds whether the parcel is on the property list.

## Built

- packs/property-owner-lookup/lib/ (the shared Family Office module, imported here, never edited here): types, scripted parcels and holding companies, the entity list, deterministic generator (2,000 synthetic Midwest parcels, P-10100 to P-12099, seed/parcels.json), loader, address normalisation, resolver (parcel first, cleaned address second, none or many), text lookup and search.
- Seed: seed/generate.ts and seed/documents.ts, byte-identical on every run (regenerated this session and diffed: seed.json, the 26 canned files and the 26 documents unchanged). seed.json holds 26 inbox items (12 tracker approved, 8 email, 4 utility portal, 2 mail scan, all New), 40 vendors with two to five invoices of history, 25 entities from the shared entity list, 16 ledger accounts (all starting with 9), 1,600 system properties out of the 2,000 parcels, 30 utility accounts (2 unmapped on purpose), 300 tracker cards. 26 canned extractions under seed/canned/. 24 PDFs and 2 SVGs under public/demo/ap-inbox/, served at /demo/ap-inbox/.
- Rules in lib/: money, vendor matching (alias table, scored names, 0.85 threshold), vendor history defaults (most recent wins, the last three disagreeing shows all three and asks), equal split in integer cents with the remainder on the first line, sum checks, duplicate detection over 12 months, the notes template, draft building on arrival, submit readiness, tracker messages and new cards, the 15-column import file, every screen view, every action, the logical clock, and the document reader (canned for scripted items; live read through fetch only when ANTHROPIC_API_KEY is set, validated with zod, canned or "could not read" on any failure). store.ts on globalThis.__apInboxStore. markers.json with eight identifier rules.
- 36 route handlers under app/api/family-office-ap/ap-inbox/ including reset, documented in ROUTES.md.
- Pages under app/family-office-ap/ap-inbox/: the eight screens above plus the two item-less redirects (review-an-invoice, split-across-properties). The layout and the module root page are the orchestrator's.
- Playwright: packs/ap-inbox/e2e/, four spec files plus helpers.ts, one test per acceptance check, each starting from the reset route.

## Stubbed

- Model step 3 (the notes line) is the template only, which the pack allows.
- The live document reader was not exercised this session (no key on the dev server); scripted items serve canned output and an unscripted upload opens the enter-by-hand state.

## Waiting for the pack

- The real standard-invoice import layout and where the property goes. The demo uses the 15-column layout with the property in the description as "address, charge" (recorded decision).
- A real utility account to parcel crosswalk; the demo's is a seed table the client would populate.
- Approval routing rules and dollar thresholds are not modelled (out of scope per the pack).

## Decisions to confirm

- Ledger account codes start with 9 (suite marker rule): 9200-3100 Repairs and maintenance, 9200-3300 Grounds, 9100-2100 Utilities electric, 9100-2200 Utilities gas, 9200-3150 Locks and securing, 9100-1100 Office expense, plus ten more in the chart. Cash accounts keep the 1000-2201 shape; entity codes are E-001 (operating company) and E-101 upward (holding companies, in the order of packs/property-owner-lookup/lib/scripted.ts).
- Drafting happens on arrival: after Reset every item is New; the first load of This week's arrivals reads the week and each item becomes Drafted (21) or Needs attention (5). "New" is visible in the reset response and the arrivals payload before arrival, never as a counter on screen. Opening a review or splitter URL directly drafts that one item.
- The splitter is a screen of its own in the sidebar and a mode of the draft underneath. Opening split-across-properties/[itemId] switches an open draft (Drafted or Needs attention) into the splitter; a submitted item keeps whatever mode it was submitted in.
- The scripted batch is 24 invoices and 44 import rows (20 single-line invoices plus splitter lines of 9, 10, 3 and 2). The pack's 41 cannot be reached with the nine-, ten- and three-line items it names; the fourth multi-property item (I-0013, two lots) is the smallest possible.
- Needs a person holds five cards for the seeded week (unknown vendor, possible duplicate, unknown utility account, amount unreadable, ambiguous owner). The script's beat 5 works four; I-0021 stays in Needs attention through the scripted run, which is why the batch is 24 and not 25.
- This week's arrivals has "Submit all ready drafts" and Approve has "Approve all" so the presenter can move the week without clicking each item. The specialist still submits; nothing auto-submits.
- Create vendor leaves the ledger account empty (a new vendor has no history); the specialist picks it on Review an invoice before submitting. The mail scan I-0019 must have its amount confirmed before it submits.
- Skip on a possible duplicate resolves the card as "Skipped, duplicate of 4471"; Keep resolves it as "Kept, not a duplicate". Only items in Needs attention show under Needs a person.
- Vendor match score: exact name 1.00; a document name whose core words all appear in the master name loses 0.06 per legal-suffix token it omits (Co, Company, LLC, Inc, Corp, Ltd), 0.20 per core word it omits, 0.10 per extra core word; anything else scores by word overlap below 0.85. "Peoria Plumbing Co." against "Peoria Plumbing Company LLC" is 0.94.
- Entity and cash account come from the resolved property's owner when a property resolves ("Resolved from property"), otherwise from vendor history. Ledger account always comes from vendor history (per charge type for statements).
- The import file is tab-separated text with a header row, one row per invoice line, amounts without thousands grouping, file name import-2026-09-03.txt. Columns: Entity, Vendor code, Payee, Invoice number, Invoice date, Post month, Due date, Expense type, Cash account, Ledger account, Amount, Description, Notes, Line, Reference.
- Summit Roofing is the vendor whose last three invoices disagree on the ledger account, so the ask shows on I-0009 if the presenter clicks Keep instead of Skip.
- An unresolved single address raises an "Owner not found" card with a parcel or address search; no seeded item hits it.

## Acceptance checks

| id | how verified | result |
|---|---|---|
| 1 | Playwright checks-1-7.spec.ts:9. After reset This week's arrivals shows 26 rows, badges Email 8, Tracker approved 12, Utility portal 4, Mail scan 2, and the seven state counters sum to 26 | pass |
| 2 | checks-1-7.spec.ts:31. I-0005 review: the ten required fields are filled, every field carries one of the five source words, the vendor panel shows "Peoria Plumbing Company LLC" and "Match score 0.94", Submit is enabled | pass |
| 3 | checks-1-7.spec.ts:53. The property panel shows P-12003, Lakeshore Lien Fund 2 LLC, Entity E-101, Cash account 1000-2201, method "parcel" | pass |
| 4 | checks-1-7.spec.ts:66. I-0019: the amount dot is in the low band (0.55), readiness says "Confirm the amount", Submit is disabled; Confirm amount enables Submit | pass |
| 5 | checks-1-7.spec.ts:83. I-0007: nine lines at 50.00, split method equal on all nine, sum check ok showing 450.00 | pass |
| 6 | checks-1-7.spec.ts:102. Line 1 flagged "Not in property list" with Submit disabled; Create property clears the flag and enables Submit | pass |
| 7 | checks-1-7.spec.ts:119. I-0012: ten stated lines, two or more ledger codes, sum 6,988.40 ok; adding 1.00 to line 1 turns the sum check red and disables Submit. I-0016: 60.00, 50.00, 40.00, all stated, no equal | pass |
| 8 | checks-8-12.spec.ts:6. Card "Unknown vendor"; Create vendor removes it; the item is Drafted with an empty ledger account and no ledger source; the arrivals list shows Drafted | pass |
| 9 | checks-8-12.spec.ts:31. Card "Possible duplicate of 4471" showing the earlier invoice; Skip sets Skipped; after Submit all and Approve all neither Ready for Yardi nor the import file carries I-0009 | pass |
| 10 | checks-8-12.spec.ts:68. Card "Unknown utility account 5520-118"; searching P-10777 and Map to this parcel resolves it by utility account and moves it to Drafted, still resolved on a second read; I-0022 is Drafted on P-10231 by utility account | pass |
| 11 | checks-8-12.spec.ts:107. Card "Amount unreadable"; saving 175.00 gives amount 17500, Drafted, Submit enabled | pass |
| 12 | checks-8-12.spec.ts:129. Card "Ambiguous owner, 2 candidates" with P-11702 (IL) and P-11950 (MO); choosing P-11702 resolves it, Drafted | pass |
| 13 | checks-13-15.spec.ts:16. The scripted week through Mark batch paid; every Paid item with a property has a paid tracker update; the filter leaves only cards carrying I-0015 | pass |
| 14 | checks-13-15.spec.ts:50. The import file has a 15-column header and 15 fields on every row; 44 rows equal to the line count and to the sum of line counts; 24 invoices; the file total equals the batch total; the sidebar's Reset this demo button's response reports 26 New; a second run of the week matches the first. The pack's 41 rows is an arithmetic slip, see Decisions to confirm | pass |
| 15 | checks-13-15.spec.ts:105. I-0005's draft equals its canned file; an unscripted PDF added on This week's arrivals opens with "Could not read this document, enter fields by hand", is completed by hand and submits | pass |
| 16 | check-16.spec.ts:7. Visiting /family-office-ap/multi-property-split ends on split-across-properties/I-0007 titled "Split across properties: I-0007" with nine lines and the "Back to the single draft" button | pass |

## Tests and hygiene

- Unit: 77 passed of 77 (10 files under packs/ap-inbox/lib/__tests__), npx vitest run packs/ap-inbox. The shared lookup module's own tests live with it.
- Playwright: 16 passed of 16, E2E_BASE_URL=http://localhost:3000 npx playwright test packs/ap-inbox, run alone.
- npx tsc --noEmit: clean. npx eslint packs/ap-inbox app/family-office-ap/ap-inbox app/api/family-office-ap/ap-inbox: clean.
- check:figures clean, check:dashes clean, check:markers clean (eight module rules, empty allow list). No em dash and no old route or name across packs/ap-inbox, app/family-office-ap/ap-inbox, app/api/family-office-ap/ap-inbox and public/demo/ap-inbox.
