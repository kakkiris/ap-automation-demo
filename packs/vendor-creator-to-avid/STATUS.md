# Vendor Creator to Avid STATUS

Department: Industrial AP (industrial-ap). Slug: vendor-creator-to-avid. Screens live under /industrial-ap/vendor-creator-to-avid; handlers under /api/industrial-ap/vendor-creator-to-avid.

## Screens

In the order the work happens, as the sidebar lists them.

| Screen | Route |
|---|---|
| Create the vendor once in Yardi | /industrial-ap/vendor-creator-to-avid/create-the-vendor-once-in-yardi |
| Run the nightly sync to Avid | /industrial-ap/vendor-creator-to-avid/run-the-nightly-sync-to-avid |
| Decide the near matches | /industrial-ap/vendor-creator-to-avid/decide-the-near-matches |
| Catch unknown payees on arrival | /industrial-ap/vendor-creator-to-avid/catch-unknown-payees-on-arrival |

## Built

- lib/types.ts: every record from the pack's data section, the seed and store shapes, and the route payload shapes.
- lib/normalize.ts: shared name and address normalization plus the token overlap score, used by both the seed generator and the matcher.
- lib/match.ts, lib/sync.ts, lib/frontdoor.ts, lib/ids.ts: the matcher with reasons, decisions, the nightly run in both modes, the import file, the task list, the gap and held counters, and the front-door flags. Pure, no clock, no randomness. 63 unit tests under lib/__tests__/.
- store.ts on globalThis.__vendorCreatorToAvidStore, built from seed/seed.json; reset rebuilds it.
- seed/generate.ts and seed/seed.json: 119 Yardi vendors (117 active, 2 inactive), 112 Avid vendors, 2 near-match pairs, 15 incoming invoices, every scripted record on its named id; self-checks run before writing; byte-identical on rerun.
- markers.json with rules for the V-Y, V-A, INV, R, T id shapes and the four-digit tax endings.
- 12 route handlers under app/api/industrial-ap/vendor-creator-to-avid (state, mode, masters, masters/create, run, import, tasks/done, near-matches, near-matches/decide, front-door, front-door/receive, reset) documented in ROUTES.md. The handler segments keep their short names; only the screens carry the client's words.
- module.ts (vendorCreatorToAvidPack: slug, name, department, base, apiBase, resetPath, and the four screens the sidebar lists), the module layout (the assisted or automatic toggle in the module bar under the top bar, on every screen; the sidebar, breadcrumb, and reset come from the shell), and four screens: Create the vendor once in Yardi, Run the nightly sync to Avid, Decide the near matches, Catch unknown payees on arrival.
- e2e/vendor-creator-to-avid.spec.ts: one Playwright test per acceptance check.

## Stubbed

- Nothing. The Avid side is a seed list by design; there is no real Yardi or Avid connection in this demo.

## Waiting for the pack

- Avid import format (open question 1): the CSV carries name and address_line with a first-line placeholder comment.
- Whether Avid accepts a direct write (open question 1): both modes are built; the toggle picks one.

## Decisions to confirm

- Run summary arithmetic. Check 2 lists compared 124, skipped exact 110, staged 6, held 2, skipped inactive 2, but those buckets sum to 120, and the seed profile's "124 Yardi vendors, 4 inactive" contradicts "2 inactive skipped". The build keeps every spoken and load-bearing number (gap 5, exact 110, staged 6 after beat 1, held 2, inactive 2, Avid 112) and makes "compared" the honest count of Yardi vendors examined: 119 in the seed, 120 after the beat 1 creation. The rehearsal asserts compared 120.
- Gap counter meaning. "In Yardi, not in Avid" counts active Yardi vendors the sync would create right now: no exact match in Avid and not held as a near match. 5 at boot, 6 after beat 1, 0 after an automatic run. The two held pairs are shown separately.
- Token overlap score is shared tokens over the smaller token set (so "Tidewater Plumbing Co" against "Tidewater Plumbing Supply" scores 1.0 and holds). Hyphens and slashes become spaces; other punctuation is removed, so "P.W. Maintenance" and "PW Maintenance LLC" normalize the same.
- AvidVendor carries a demo-only tax_id_last4 (nullable) so the Tidewater pair can show "different tax id last four", which the presenter says aloud.
- Yardi ids are not dense: the seed has 119 vendors on ids up to V-Y-0124 plus V-Y-0130, and the next minted id is V-Y-0125 as the pack names it.
- Front door flags come from the same matcher: the payee is matched by normalized name to a Yardi vendor, then that vendor's own outcome against Avid decides known, near_match, or yardi_only; no Yardi vendor means first_seen.
- The mode lives in the store; the toggle in the module bar posts it, and "Run nightly sync" uses it.
- Empty states name the step, not the screen: "No run yet. Press Run nightly sync to compare the two masters." and "No invoices received yet. Press Receive invoices to check today's payees against both masters." The near matches screen says where a pair comes from when nothing is held and what to press when nothing is decided.

## Acceptance checks

Rehearsed by packs/vendor-creator-to-avid/e2e/vendor-creator-to-avid.spec.ts, one test per check in the pack's order, run twice against the dev server on port 3000 with E2E_BASE_URL=http://localhost:3000 npx playwright test packs/vendor-creator-to-avid. Every test posts to the reset route first and walks the real screens; the import file is read through the request fixture (GET /import) and its rows counted as lines minus the two header lines.

| id | how verified | result |
|---|---|---|
| 1 | Playwright: on Create the vendor once in Yardi the gap counter reads "In Yardi, not in Avid: 5" and links to Run the nightly sync to Avid; yardi-count 119, avid-count 112; row yardi-V-Y-0121 (Coral Ridge Pressure Washing) is in the Yardi list and no Avid row carries that name; held counter reads 2 | pass |
| 2 | Playwright: create Marlin Bay Cleaning in the form (note reads V-Y-0125), Run nightly sync in assisted mode; summary reads compared 120, skipped exact 110, staged 6 (label "Staged"), held 2, skipped inactive 2; "Run R-001, assisted"; GET /import through the request fixture has 6 data rows including the Marlin Bay row; task list has 6 lines with 6 checkboxes; the download link points at /import with a download attribute. Amended per the coordinator: compared is the number of Yardi vendors examined, 120 after the beat 1 creation (the pack's 124 cannot coexist with 110 + 6 + 2 + 2) | pass |
| 3 | Playwright, after beat 1 and an assisted run: card pair-V-Y-0117-V-A-0088 lists "same normalized name" and "same address", both normalized forms read "pw maintenance", score 1.00; GET /masters shows avid_count 112, no Avid vendor named "PW Maintenance LLC", no synced Avid vendor; Create the vendor once in Yardi avid-count reads 112 | pass |
| 4 | Playwright: after beat 1 and an assisted run, click "Same vendor, link" on the PW card; decision note and decided-V-Y-0117-V-A-0088 ("Same vendor, linked by hand") appear, the held card is gone, the Tidewater card stays; GET /run shows V-Y-0117 with action skip_exact and avid_vendor_id V-A-0088; Run the nightly sync to Avid shows the same under "Show exact matches"; import still 6 rows on GET /import, on the import-row-count, and 6 task lines | pass |
| 5 | Playwright, two halves. Assisted: Tidewater card lists "similar name" and "different address"; "Different, create" moves it to decided ("Different vendor, created"), GET /import has 7 rows including "Tidewater Plumbing Co", Run the nightly sync to Avid shows 7 rows, 7 tasks, delta-V-Y-0119 action stage. Automatic: reset, create, automatic run, "Different, create"; Create the vendor once in Yardi avid-count 119 and one Avid row "Tidewater Plumbing Co" marked synced, confirmed through GET /masters | pass |
| 6 | Playwright: after beat 1 and an assisted run (label "Staged"), flip the toggle in the module bar to automatic (mode-label reads automatic) and run again; "Run R-002, automatic", label "Created", count 6, created-count-value 6, no download link and no task list; Create the vendor once in Yardi avid-count 118, gap counter 0, and each of the six staged names (Marlin Bay Cleaning, Coral Ridge Pressure Washing, Spoonbill Sound Roofing, Sandbar Grove Pressure Washing, Tarpon Grove Cleaning LLC, Bayberry Hammock Landscaping) has an Avid row marked synced; GET /masters shows exactly 6 synced | pass |
| 7 | Playwright: after an assisted run delta-V-Y-0130 (Old Harbor Fencing) shows action skip_inactive with a reason mentioning inactive; GET /import?run=R-001 has no Old Harbor Fencing; automatic run R-002 shows skip_inactive again and neither /import?run=R-002 nor /import carries the name | pass |
| 8 | Playwright: after creating Marlin Bay Cleaning, delta-V-Y-0125 shows the name with action stage after the assisted run and action create with an Avid id after the automatic run | pass |
| 9 | Playwright: Receive invoices; row invoice-INV-5007 (Keys Gate Fencing) shows flag first_seen, days 0, matched vendor none; its "Create vendor in Yardi" link lands on Create the vendor once in Yardi with ?name= in the address and #vendor-name valued "Keys Gate Fencing"; column header "Days in queue" present | pass |
| 10 | Playwright, twice. Fresh store: invoice-INV-5009 (PW Maintenance) shows flag near_match, days 7, matched V-Y-0117; "Open near match" href carries pair=V-Y-0117 and lands on the highlighted card pair-V-Y-0117-V-A-0088 on Decide the near matches. In script order after the PW pair is linked and Tidewater created: flag still near_match, days 7, the link lands on the decided entry. Amended per the coordinator: the flag holds after the link because the front door checks the two masters only | pass |
| 11 | Playwright: run the whole script (create, assisted run, 6 import rows, automatic run, link PW, create Tidewater, receive invoices, scope line) and snapshot state, run, delta, tasks, import rows, held and decided pairs, front door flags, and both masters through the routes; click the sidebar "Reset this demo" button and wait for the reload; avid-count 112, yardi-count 119, gap 5, held 2, no yardi-V-Y-0125, no synced Avid row, mode assisted, both pairs held with "Nothing decided yet.", no run, front door not received, GET /state at boot values; run the script again without touching the reset route and the second snapshot deep-equals the first | pass |

## Tests and hygiene

- Unit: npx vitest run packs/vendor-creator-to-avid: 5 files, 63 tests, all passing.
- e2e: E2E_BASE_URL=http://localhost:3000 npx playwright test packs/vendor-creator-to-avid: 11 tests (one per acceptance check), 11 passing when the spec runs alone. The spec resets the store in afterAll. Two Playwright runs against the same dev server share one in-memory store and poison each other (a reset or a run from one lands mid-test in the other); run this module's spec alone, and expect the same when npm run e2e runs every module in one worker, which is fine because that is sequential.
- Types and lint: npx tsc --noEmit clean; npx eslint over packs/vendor-creator-to-avid, app/industrial-ap/vendor-creator-to-avid, app/api/industrial-ap/vendor-creator-to-avid clean.
- Hygiene from the repo root: check:figures clean, check:dashes clean, check:markers clean (suite rules plus this module's markers.json). grep for the em dash character and for old route names across the three directories: no matches. public/demo/vendor-creator-to-avid does not exist; this module generates no documents.
