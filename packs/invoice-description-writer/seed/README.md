# Seed for invoice-description-writer

## Regenerate

From the repo root:

    npx tsx packs/invoice-description-writer/seed/generate.ts

The generator uses a seeded random source with a fixed seed constant and never reads the clock, so two runs write byte-identical files. It rewrites:

- `packs/invoice-description-writer/seed/seed.json`: vendors (14), gl_accounts (12), coding_history (19 aggregated rows), invoices (30, in inbox order, INV-3004 to INV-3033).
- `packs/invoice-description-writer/seed/canned/<invoice_id>.json`: the canned reader output for every invoice, in the ExtractionFields shape from `lib/types.ts`. Each file is the ground truth for its document; null means the field is not printed on the invoice.
- `public/demo/invoice-description-writer/<invoice_id>.pdf` and `.svg`: the same invoice drawn twice, the PDF for the download link and the SVG for the preview on Write the invoice description. Every field the canned file returns is printed in plain text on the document, so the presenter sees the same numbers on the page and in the draft.

Every vendor, property, address, amount, account number, and meter number is invented. Fictional names live in the lists inside `generate.ts`. Commit nothing; leave the generated files in place.

## Scripted records

Seven invoices carry `scripted: true` and always serve their canned file:

| id | vendor | what it shows |
|---|---|---|
| INV-3007 | V-01 Coral Ridge Roofing | happy path; CR-88213, 2400.00, service 2026-08-24 to 2026-08-26 at PR-12; suggestion 6320 strong, 14 of 16 |
| INV-3012 | V-04 Saltmarsh Pest Control | prints no service dates, so the description says so; suggestion 7410 strong |
| INV-3019 | V-14 Keys Gate Fencing | unseen vendor with no history; suggestion none |
| INV-3021 | V-13 Seagrass Building Services | stylized document with the vendor name inside a logo; canned reading returns null vendor and amount, so it goes to manual entry |
| INV-3025 | V-09 Sunline Power | electric bill with account and meter numbers; routed out as a utility |
| INV-3030 | V-03 Tidewater Plumbing | suggestion 6510 weak, 9 of 15, with 6520 as the alternative |
| INV-3033 | V-02 Brightline Landscaping | service contract with a customer account number, which leads the description |

INV-3016 is the second utility bill (V-09, another property); it is not scripted but is also routed. Every other invoice is an unscripted service invoice that reads cleanly.

## Marker rules

Account numbers are 99 plus eight digits, meter numbers M9 plus eight digits, invoice ids INV-30xx, vendor ids V-01 to V-14, invoice numbers two capital letters and five digits. The GL codes are the 12 listed under allow in `../markers.json`. The generator checks its own output against these rules before writing.
