# Seed for AP Inbox

## Regenerate

From the repo root:

```
npx tsx packs/ap-inbox/seed/generate.ts
```

The generator uses a seeded number source with a fixed constant and never reads the clock, so two runs produce byte-identical files. It writes:

- `packs/ap-inbox/seed/seed.json`: the `Seed` shape from `../lib/types.ts`. One week of 26 arrivals (12 tracker approved, 8 email, 4 utility portal, 2 mail scan), 40 vendors with two to five invoices of history each, 25 entities (E-001 operating, E-101 to E-124 holding, taken from the shared entity list in `packs/property-owner-lookup/lib/entities.ts`), 16 ledger accounts (all start with 9), 1,600 system properties out of the 2,000 registry parcels, 30 utility accounts (2 unmapped on purpose), 300 tracker cards (T-8001 to T-8299 plus T-8812).
- `packs/ap-inbox/seed/canned/<itemId>.json`: one `Extraction` per item, the fields the reader returns for that document.
- `public/demo/ap-inbox/<fileName>`, served at `/demo/ap-inbox/<fileName>`: 24 PDFs built with pdf-lib and 2 SVGs (the phone photo of handwritten lots for I-0007 and the grey mail scan for I-0019). Each document prints the same payee, number, date, addresses, lines and total as its canned file. The generator empties the folder and writes every document again.

The parcel registry is read from `packs/property-owner-lookup/seed/parcels.json` and never written here; the scripted parcels and holding companies come from `packs/property-owner-lookup/lib/scripted.ts`. Money is integer cents in `seed.json`; the canned files carry amounts as printed ("6,988.40").

`documents.ts` holds the PDF and SVG rendering. pdf-lib names font resources with `Math.random`, so that module replaces `Math.random` with a seeded generator before any PDF is built; nothing else uses it.

## Scripted records

| item | source | what it exercises |
|---|---|---|
| I-0003 | email | Bluewater Tree Removal is not in the vendor master (unknown vendor) |
| I-0005 | email | payee printed "Peoria Plumbing Co.", parcel P-12003 printed on the invoice, all confidences at or above 0.9 |
| I-0007 | tracker approved | phone photo, nine lots without prices, total 450.00; 702 Palmer Ln is not in the system property list; card on P-10601 |
| I-0009 | email | Summit Roofing invoice 4471, 1,900.00, same number as the vendor's most recent paid invoice (possible duplicate); Summit's last three ledgers disagree |
| I-0011 | tracker approved | Ridgeway Locksmith 140.00 on card T-8812 |
| I-0012 | email | Harborview statement, ten properties with stated amounts and charge types, total 6,988.40 |
| I-0013 | tracker approved | Riverbend Mowing, two lots with stated amounts 85.00 each |
| I-0015 | email | Prairie Fence Co on P-11348, which has no tracker card |
| I-0016 | tracker approved | Greenway Lawn Care, three lots with stated amounts 60.00, 50.00, 40.00 |
| I-0018 | utility portal | Midwest Power and Light account 5520-118, not in the crosswalk, no address on the bill |
| I-0019 | mail scan | Lakefront Office Supply, amount confidence 0.55 |
| I-0021 | email | Copperfield Pest Control, total hidden behind a grey block, amount confidence 0.10 |
| I-0022 | utility portal | Midwest Power and Light account 5520-044, mapped to P-10231 |
| I-0024 | email | Lakefront Office Supply office item, no property |
| I-0026 | email | Northshore Glass at "14 Elm St, Springfield" with no state (two registry candidates) |
| I-0002 | mail scan | Tri-County Print and Postage office item, no property |

The other ten items (I-0001, I-0004, I-0006, I-0008, I-0014, I-0017, I-0023, I-0025 tracker approved; I-0010 and I-0020 utility portal) are ordinary single-property invoices on parcels that are in the system property list and carry a tracker card or a mapped utility account.
