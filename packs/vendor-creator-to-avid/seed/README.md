# Vendor Creator to Avid seed

## Regenerate

From the repo root:

    npx tsx packs/vendor-creator-to-avid/seed/generate.ts

The generator is seeded (mulberry32 behind one fixed constant) and never reads the clock, so two runs write byte-identical `seed.json`. It asserts every rule below before writing and throws with a plain message on any violation. There are no canned outputs and no generated documents in this module; the import file is built at run time by a route from the store.

## What is in seed.json

The `Seed` shape from `lib/types.ts`: `demo_date` 2026-09-01, `next_yardi_number` 125, `next_avid_number` 113, then four collections.

- `yardi_vendors`: 119 (117 active, 2 inactive). Ids V-Y-0001 through V-Y-0124 with six gaps (0007, 0038, 0061, 0090, 0102, 0111) plus V-Y-0130. V-Y-0125 is absent because the presenter mints it live.
- `avid_vendors`: 112, ids V-A-0001 through V-A-0112, all `source` seed. 110 are exact twins of an active Yardi vendor (same raw name, same raw address, six of them with unknown tax digits); two are the scripted near-match records.
- `match_candidates`: 2, both `decision` none, scores and reasons computed with `lib/normalize.ts`.
- `incoming_invoices`: 15, INV-5001 through INV-5015; 11 known, 2 yardi_only, 1 first_seen, 1 near_match.

Against the Avid list the 117 active Yardi vendors split 110 exact, 2 near matches, 5 clean creations; the 2 inactive vendors have no match of any kind.

## Scripted records

- V-Y-0117 PW Maintenance LLC, 41 Marlin Bay Dr, tax 4471, against V-A-0088 P.W. Maintenance at the same address with the same tax digits. Same normalized name, same address, suffix difference: held, score 1.
- V-Y-0119 Tidewater Plumbing Co, 118 Snook Creek Way, tax 3390, against V-A-0092 Tidewater Plumbing Supply, 7 Sandbar Isle Ct, tax 7712. Similar name, different address, different tax digits: held, score 1.
- V-Y-0121 Coral Ridge Pressure Washing, 9 Seagrass Ct: clean creation; INV-5004 is its first invoice, flagged yardi_only.
- V-Y-0118, V-Y-0122, V-Y-0123, V-Y-0124: the other four clean creations; INV-5012 is V-Y-0123's first invoice, flagged yardi_only.
- V-Y-0130 Old Harbor Fencing and V-Y-0073: inactive, no Avid match.
- V-Y-0044 Brightline Landscaping and its twin V-A-0031: an exact pair; INV-5001 spells the payee "Brightline Landscaping LLC" so normalization is visible. INV-5008 does the same with another exact vendor.
- INV-5007 Keys Gate Fencing: in neither master, first_seen, day 0.
- INV-5009 PW Maintenance: matches the held V-Y-0117 pair, near_match, received 2026-08-25, 7 days in queue.
- "Marlin Bay Cleaning", the vendor the presenter creates in beat 1, collides with nothing in either list.

## How exact and near are told apart

The 110 exact twins carry the Yardi vendor's raw name and address unchanged. The PW pair shares a normalized name and an address but differs by suffix and punctuation, so `suffixDiffers` from `lib/normalize.ts` is what separates a skip from a hold; the generator asserts that this pair is the only same-name same-address pair with a suffix difference. Every generated name has at least three tokens and a place pair used by no other name, so no two generated names score above 0.75 against each other.
