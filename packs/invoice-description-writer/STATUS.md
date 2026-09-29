# invoice-description-writer STATUS

Department: Industrial AP. Slug: invoice-description-writer. Display name: Invoice description writer. Updated by the pack coordinator at every stopping point.

Base: /industrial-ap/invoice-description-writer (the module root redirects to the first screen). Routes: /api/industrial-ap/invoice-description-writer/*, reset at /api/industrial-ap/invoice-description-writer/reset. Navigation is the suite sidebar and breadcrumb; the module has no control bar.

## Screens

| slug | label | what it shows |
|---|---|---|
| receive-todays-invoices | Receive today's invoices | the day's post after Receive invoices: four counts and one row per invoice with its status |
| write-the-invoice-description | Write the invoice description | one invoice: the drawing, the fields read off it, the description to paste, the suggested code, Used as is or Corrected |
| how-this-vendor-was-coded-before | How this vendor was coded before | the vendor's codings over the last six months and this session's confirmations and corrections |
| the-house-description-order | The house description order | the two templates, what each segment says when the invoice does not print it, and an example of each |

## Built

- module.ts (invoiceDescriptionWriterPack): slug, name, department, sentence, base, apiBase, resetPath, and the four screens above in work order; lib/registry.ts imports it.
- lib/types.ts: every record in the pack's Data model, the store shape, and the route payload shapes.
- markers.json: scope, invoice id and vendor id rules, the 12 GL codes allowed (orchestrator ruling).
- seed/generate.ts (seeded, byte-identical on rerun), seed/seed.json (14 vendors, 12 GL accounts, 19 coding history rows, 30 invoices INV-3004 to INV-3033), seed/canned/<id>.json for all 30, public/demo/invoice-description-writer/<id>.pdf and .svg for all 30, seed/README.md.
- lib/describe.ts (template assembly, 250 character limit trimming the service segment first), lib/suggest.ts (history tiers), lib/checks.ts (extraction checks and vendor resolution), lib/model.ts (Messages call with fetch and zod, canned fallback, injectable fetch and env), lib/receive.ts, lib/feedback.ts, lib/views.ts, lib/money.ts, lib/labels.ts, lib/errors.ts; 96 unit tests under lib/__tests__/.
- store.ts on globalThis.__invoiceDescriptionWriterStore, reset drops the received invoices, extractions, descriptions, suggestions, and feedback.
- Routes under app/api/industrial-ap/invoice-description-writer/: reset, inbox, receive, workbench, feedback, vendors, vendor-history, scheme; ROUTES.md documents each. Route names are unchanged by the screen renaming.
- Pages under app/industrial-ap/invoice-description-writer/<slug>/ rendering the four screens from ui/ (inbox.tsx, workbench.tsx, vendor-history.tsx, scheme.tsx; file names kept, every ScreenHeader carries the screen key invoice-description-writer/<slug> and the label as its title). Page links are built with screenHref from lib/registry.ts. Copy buttons show Copied.
- e2e/invoice-description-writer.spec.ts: one Playwright test per acceptance check, 11 passing.

## Stubbed

- Nothing. The live reading path exists and is exercised only by unit tests (no key on the dev server); every seed invoice serves its canned reading.

## Waiting for the pack

- Nothing. Every open question in the pack carries a recorded decision.

## Decisions to confirm

- Every seed invoice has a canned extraction file (its ground truth), so Receive invoices serves canned for all 30 without a key. The seven scripted records always serve canned; the other 23 may go live when a key is present, with canned as the fallback on error, timeout, or a failed check.
- Canned and live outputs pass through the same checks. INV-3021's canned output returns null vendor and null amount, so it fails the checks and goes to manual.
- Service description order: account number first when the invoice prints one, then vendor, service, property and unit, service dates. "no account number" is rendered only by the utility template.
- Feedback "at" is a 1-based session sequence, not a clock, so a reset and a replay produce identical records.
- Write the invoice description shows the invoice drawn as SVG with a link to the PDF; both are generated from the same seed record.
- The two utility bills are both from V-09; the unseen vendor is V-14 Keys Gate Fencing with no history.
- Wording on screen names the step, not the component: the empty state on Receive today's invoices reads "No invoices received yet. Press Receive invoices to bring in today's post."; Write the invoice description with nothing open reads "Press Receive invoices first." before receive and "Pick an invoice from today's invoices to write its description." after; its return link reads "Back to today's invoices"; the return link on How this vendor was coded before reads "Back to the invoice description".

## Acceptance checks

Rehearsed by packs/invoice-description-writer/e2e/invoice-description-writer.spec.ts (one test per check, named "check <id>: ...", each posting to the reset route first and walking the real screens on the dev server at port 3000 with no ANTHROPIC_API_KEY). Run: E2E_BASE_URL=http://localhost:3000 npx playwright test packs/invoice-description-writer.

| id | check | how verified | result |
|---|---|---|---|
| 1 | Receive invoices: 30 received, 27 ready, 1 manual, 2 routed; INV-3007 ready | Playwright: empty state before, Receive invoices button, summary testids read 30, 27, 1, 2, status-INV-3007 reads ready, 30 rows, button disabled after | pass |
| 2 | INV-3007 description exact text; copy button places it on the clipboard | Playwright: INV-3007 link from Receive today's invoices to Write the invoice description, description-text toHaveText exact, Copy description then Copied state, navigator.clipboard.readText equals the text | pass |
| 3 | INV-3007 GL card 6320 Roofing repairs, 14 of 16, strong; Used as is sets the row status to used | Playwright: gl-code, gl-basis, gl-tier texts, Used as is, feedback-note "Recorded: used as is.", invoice-status used, status-INV-3007 on Receive today's invoices reads used | pass |
| 4 | INV-3012 description contains "dates not on invoice" and no date values; GL 7410 strong | Playwright: description-text contains the phrase and does not match a YYYY-MM-DD pattern, service date markers read not on invoice, gl-code 7410 Pest control, gl-tier strong | pass |
| 5 | INV-3019 description assembled; GL card "no history for this vendor", no code | Playwright: description-text matches vendor, service, PR, unit, dates and equals the workbench payload, gl-none text, no gl-code, no four-digit code on the card, Used as is disabled | pass |
| 6 | INV-3021 status manual; no Description card; manual-entry card lists missing fields | Playwright: status manual on both screens, description-card and gl-card absent, manual-fields list equals payload.manual_entry, every missing key's marker reads not on invoice | pass |
| 7 | INV-3025 routed with the note on Receive today's invoices; Write the invoice description shows no Description or GL card | Playwright: status-INV-3025 routed, note-INV-3025 exact note, link to the description screen, routed-note card, no description-card, gl-card, fields, or feedback buttons | pass |
| 8 | INV-3030 GL 6510 weak 9 of 15 with 6520 alternative; Corrected to 6520; row corrected; session line on How this vendor was coded before | Playwright: gl texts and alternative line, Corrected, pick 6520, Record correction, feedback-note, status corrected on Receive today's invoices, vendor-link to V-03, session-line exact text | pass |
| 9 | INV-3033 description begins with the account number segment | Playwright: account number field read from PDF, description-text starts with that ten-digit number and a space, first token equals extraction.fields.account_number | pass |
| 10 | No key: checks 1 to 9 pass on canned; key set and network down: still pass | Playwright request fixture: after receive, extraction.source is canned for every non-routed invoice (routed have no extraction); the key-set fetch-failure path is lib/__tests__/model.test.ts (rejecting fetch, timeout, bad JSON, bad status, bad shape all serve canned), 12 tests passing | pass |
| 11 | Reset this demo: today's invoices empty, feedback cleared, session line gone; replay identical | Playwright: script beats 1 to 7 recorded (screen texts, clipboard, inbox, workbench and vendor-history payloads), Reset this demo in the sidebar, empty Receive today's invoices with zero tiles and no rows, Write the invoice description "Press Receive invoices first.", V-03 and V-01 session-empty, script run again and deep-equal to the first | pass |

## Tests and hygiene

- Unit: npx vitest run packs/invoice-description-writer: 9 files, 96 tests, all passing (model.test.ts alone: 12 passing, covering the no-key and key-set fallbacks to canned). The live-path fixture PDF lives under lib/__tests__/fixtures/public/demo/invoice-description-writer/.
- E2E: E2E_BASE_URL=http://localhost:3000 npx playwright test packs/invoice-description-writer: 11 passed, run alone; the spec leaves the store reset.
- Seed: npx tsx packs/invoice-description-writer/seed/generate.ts rewrites seed.json, the 30 canned files, and the 60 documents byte-identically (verified by diff after the move to public/demo/invoice-description-writer).
- Hygiene: check:figures clean for this module (its one hit is a comment in components/ui/sidebar.tsx, outside the module), check:dashes clean, check:markers clean (suite rules plus the pack marker files); grep for the em dash character across the module's four directories finds nothing; grep for the old leg and slug finds nothing but the pack file name on the first line of this file.
