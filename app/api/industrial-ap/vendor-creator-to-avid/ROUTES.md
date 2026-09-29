# Vendor Creator to Avid routes

Base path: `/api/industrial-ap/vendor-creator-to-avid`. Every handler exports `dynamic = "force-dynamic"`, answers with `json` or `fail` from `@/lib/api`, and reads or writes the pack store (`packs/vendor-creator-to-avid/store.ts`). Type names below come from `packs/vendor-creator-to-avid/lib/types.ts`. Every action answers with the full state its screen needs, so the ui never has to guess.

## Routes

| Route | Method | Request body | Response | Notes |
|---|---|---|---|---|
| `/state` | GET | none | `StatePayload` | mode, counts, live gap and held, last run id. Cheap; the mode bar can poll it. |
| `/mode` | POST | `ModeBody` `{ mode: "assisted" \| "automatic" }` | `StatePayload` | 400 `{ error }` on any other mode. The next run uses the stored mode. |
| `/masters` | GET | none | `MastersPayload` | `StatePayload` plus the full `yardi` and `avid` lists. |
| `/masters/create` | POST | `CreateVendorBody` `{ name, address_line, status }` | `CreateVendorPayload` | `MastersPayload` plus `created: YardiVendor`. Trims both strings; 400 `{ error }` when either is empty. `status` defaults to `active`. Mints `V-Y-0125` first. Does not run a sync. |
| `/run` | GET | none | `RunPayload` | The latest run, or `run: null` with an empty delta before the first. |
| `/run` | POST | none | `RunPayload` | Runs the nightly sync in the stored mode, then answers like GET. |
| `/import` | GET | none; optional `?run=R-001` | CSV text | `content-type: text/csv; charset=utf-8`, `content-disposition: attachment; filename="vendor-import-R-001.csv"`. 200 with only the two header lines before the first run (`vendor-import-none.csv`). 404 `{ error }` for a run id that does not exist. |
| `/tasks/done` | POST | `TaskDoneBody` `{ task_id, done }` | `RunPayload` | 400 when the body is malformed, 404 `{ error }` for an unknown task. |
| `/near-matches` | GET | none | `NearMatchesPayload` | `held` (decision none or later) and `decided` (link or create), each a `PairView[]` sorted by Yardi id. |
| `/near-matches/decide` | POST | `DecideBody` `{ yardi_vendor_id, avid_vendor_id, decision: "link" \| "create" \| "later" }` | `NearMatchesPayload` | 400 `{ error }` on an unknown pair or a bad decision. Also updates the latest run's delta, counts, import rows, and tasks. After a decide, refetch `/run` and `/state` if those are on screen. |
| `/front-door` | GET | none | `FrontDoorPayload` | `received: false` and `invoices: []` until receive is pressed. |
| `/front-door/receive` | POST | none | `FrontDoorPayload` | Flags the day's invoices and answers with the rows. |
| `/reset` | POST | none | `{ ok: true, mode: "assisted" }` | Rebuilds the store from the seed: mode assisted, no runs, seed decisions, invoices not received. |

## What each payload carries

- `StatePayload`: `mode`, `demo_date`, `yardi_count`, `yardi_active_count`, `avid_count`, `gap`, `held`, `last_run_id`. `gap` is the number of active Yardi vendors the sync would stage or create right now (5 at boot); `held` is the number waiting on a decision (2 at boot). Both are computed live from the masters with decisions applied, no run needed.
- `RunPayload`: `mode`, `run: SyncRun | null`, `delta: DeltaRow[]` (each delta item joined to `name`, `address_line`, `status`, and `avid_name`), `tasks: Task[]`, `import_row_count`, `import_file_name` (null before the first run), `scope_line` (the fixed line for the bottom of Sync run; render it verbatim).
- `SyncRun.counts`: `compared`, `skipped_exact`, `staged_or_created`, `held`, `skipped_inactive`. The last four always add up to `compared`, which is the number of Yardi vendors in the store when the run started (119 at boot, 120 after one is created in the form).
- `DeltaRow.action` is one of `create`, `stage`, `hold`, `skip_inactive`, `skip_exact`; show `ACTION_LABELS[action]` next to it and `reason` as the visible reason. A `hold` row carries the Avid id in `avid_vendor_id` so it can link to the pair on Near matches.
- `PairView`: `candidate` (`score`, `reasons[]`, `decision`), `yardi`, `avid`, `yardi_normalized`, `avid_normalized`. Reasons are the exact strings in `MATCH_REASONS`.
- `InvoiceRow`: the `IncomingInvoice` fields plus `matched_yardi_name`, `matched_avid_name`, `flag_label` (from `FLAG_LABELS`). A `near_match` row carries the pair ids in `matched_yardi_vendor_id` and `matched_avid_vendor_id`; a `first_seen` row has no Yardi id, and its shortcut should open the create form with `payee_name` filled in.

## Import file format

Line 1: `# placeholder columns until the Avid import format is confirmed: name, address_line`
Line 2: `name,address_line`
Then one line per staged or created vendor, each field wrapped in double quotes with inner quotes doubled, for example `"Coral Ridge Pressure Washing","9 Seagrass Ct"`. Lines are joined with `\n` and the file ends with `\n`. Row count = total lines minus 2.

## Id formats

- Yardi vendor: `V-Y-` plus four digits. Created in the form from `next_yardi_number` (first `V-Y-0125`).
- Avid vendor: `V-A-` plus four digits. Synced copies come from `next_avid_number` (first `V-A-0113`) with `source: "synced"`.
- Sync run: `R-` plus three digits, `R-001` first. `run_at` is `<demo_date>T23:30:00`.
- Task: `T-` plus three digits, `T-001` first, one global counter across runs. A task keeps its id and `done` flag when a decision rebuilds the list.
- Invoice: `INV-` plus four digits, the first of them a 5 (the seed runs INV-5001 to INV-5015).

## Mode and decisions

- The mode lives in the store. POST `/mode` sets it; POST `/run` reads it. In assisted mode the run stages vendors (import file and tasks); in automatic mode it creates them in Avid and the Avid list on `/masters` grows.
- A `link` decision turns the pair's delta item into `skip_exact` and never adds an import row. A `create` decision turns it into `stage` (assisted) or `create` (automatic, minting the Avid vendor at once) and adds one import row and one task. `later` keeps the pair held.
- In automatic mode a `create` decision mints the Avid vendor even before the first run.
