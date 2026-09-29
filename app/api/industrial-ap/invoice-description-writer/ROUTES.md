# invoice-description-writer routes

Base: `/api/industrial-ap/invoice-description-writer`. Every route is `force-dynamic` and answers JSON. Failures answer `{ "error": "<plain sentence>" }` with the status listed. Response type names are from `packs/invoice-description-writer/lib/types.ts`.

State lives in one in-memory store per server process. Nothing is written until `POST receive`; `POST reset` drops everything back to the seed.

| Route | Method | Query or body | Response |
|---|---|---|---|
| `/reset` | POST | none | `{ ok: true }` |
| `/inbox` | GET | none | `InboxPayload` |
| `/receive` | POST | none | `InboxPayload` |
| `/workbench` | GET | `?id=<invoice_id>` | `WorkbenchPayload` |
| `/feedback` | POST | `FeedbackRequest` | `WorkbenchPayload` |
| `/vendors` | GET | none | `{ vendors: VendorSummary[] }` |
| `/vendor-history` | GET | `?vendor_id=<vendor_id>` | `VendorHistoryPayload` |
| `/scheme` | GET | none | `SchemePayload` |

## POST /reset

Drops the store and rebuilds it from the seed: inbox empty, no extractions, no descriptions, no suggestions, no feedback. Returns `{ "ok": true }`.

## GET /inbox

Before `receive`: `{ "received": false, "summary": { "received": 0, "ready": 0, "manual": 0, "routed": 0 }, "items": [] }`.

After `receive`: one item per invoice in inbox order. `summary.ready` counts invoices with a description ready to paste, which includes those later marked used or corrected, so the four counts always add up to `received`.

```json
{
  "received": true,
  "summary": { "received": 30, "ready": 27, "manual": 1, "routed": 2 },
  "items": [
    { "invoice_id": "INV-3007", "vendor_id": "V-01", "vendor_name": "Coral Ridge Roofing", "property_code": "PR", "invoice_number": "CR-88213", "amount": 2400, "status": "ready", "note": null },
    { "invoice_id": "INV-3025", "vendor_id": "V-09", "vendor_name": "Sunline Power", "property_code": "SG", "invoice_number": "SP-86717", "amount": 110.47, "status": "routed", "note": "utility, handled by the capture pipeline" }
  ]
}
```

Item values come from what was read off the invoice (`null` when the reader could not find them). Routed rows are never read, so their values come from the seed record and `note` carries the routed wording; every other row has `note: null`. A manual row can have `vendor_name`, `vendor_id`, or `amount` at `null`.

## POST /receive

Ingests the day's folder once. Utility bills are routed out unread. Every other invoice is read (canned, or live when a key is present and the invoice is not scripted), checked, and either described and suggested (`ready`) or flagged (`manual`). Calling it again after the first time returns the current inbox without reading anything again. Returns the same `InboxPayload` as `GET /inbox`.

## GET /workbench?id=INV-3007

`409` `"Press Receive invoices first."` before receive; `404` for an unknown id; `400` when `id` is missing.

```json
{
  "invoice": { "invoice_id": "INV-3007", "invoice_type": "service", "status": "ready", "pdf_path": "/demo/invoice-description-writer/INV-3007.pdf", "preview_path": "/demo/invoice-description-writer/INV-3007.svg" },
  "vendor": { "vendor_id": "V-01", "name": "Coral Ridge Roofing" },
  "vendor_name_as_read": "Coral Ridge Roofing",
  "extraction": { "invoice_id": "INV-3007", "source": "canned", "fields": { "...": "ExtractionFields" }, "status": "read", "missing": ["account_number", "meter_number"], "reasons": [], "resolved_vendor_id": "V-01" },
  "fields": [
    { "key": "vendor_name", "label": "Vendor", "value": "Coral Ridge Roofing", "read": true },
    { "key": "amount", "label": "Amount", "value": "$2,400.00", "read": true },
    { "key": "meter_number", "label": "Meter number", "value": null, "read": false }
  ],
  "description": { "invoice_id": "INV-3007", "text": "Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26", "template_id": "service", "missing_fields": [], "truncated": false },
  "template": "{account number, when the invoice prints one} {vendor} {service} {property} {unit} {service from} to {service to}",
  "suggestion": { "invoice_id": "INV-3007", "gl_code": "6320", "gl_name": "Roofing repairs", "basis_count": 14, "basis_total": 16, "tier": "strong", "alternatives": [{ "gl_code": "6310", "gl_name": "Repairs and maintenance", "count": 2, "last_used": "2026-05-03" }] },
  "manual_entry": [],
  "routed_note": null,
  "feedback": null,
  "gl_accounts": [{ "gl_code": "6110", "gl_name": "Electric" }],
  "prev_id": "INV-3006",
  "next_id": "INV-3008",
  "position": 4,
  "total": 30
}
```

- `fields` is always the 12 readings in this order: Vendor, Invoice number, Invoice date, Due date, Amount, Property, Unit, Service, Service from, Service to, Account number, Meter number. `value` is the display string (`amount` formatted as `$2,400.00`); `read` is false when the invoice did not print it. Empty for routed invoices.
- `description`, `template`, and `suggestion` are `null` for manual and routed invoices. `template` is the faint line to show under the description card.
- `suggestion.tier` is `strong`, `weak`, or `none`. With `none`, `gl_code` and `gl_name` are `null` and the counts are 0 (the ui renders "no history for this vendor"). `alternatives` lists the vendor's other codes, most used first.
- `manual_entry` is the plain labels of the fields the reader could not find; non-empty only for manual invoices. `extraction.reasons` says why the reading failed in plain sentences.
- `routed_note` is exactly `"utility, handled by the capture pipeline"` for routed invoices, otherwise `null`; `vendor` for a routed invoice is the seed vendor.
- `vendor` is `null` when the name read off the invoice matches no seed vendor (or nothing was read). A seed vendor with no coding history (V-14) still links, with a `none` suggestion.
- `feedback` is the latest record for this invoice this session, or `null`.
- `prev_id`, `next_id`, `position`, `total` follow inbox order.

## POST /feedback

Body `FeedbackRequest`: `{ "invoice_id": "INV-3007", "outcome": "used" }` or `{ "invoice_id": "INV-3030", "outcome": "corrected", "corrected_gl": "6520" }`.

Sets the invoice status to `used` or `corrected`, appends a `Feedback` record (`at` is a 1-based session sequence, not a clock), and returns the updated `WorkbenchPayload` for that invoice. A second feedback on the same invoice replaces its status and appends another record.

Failures: `409` before receive; `404` unknown invoice; `400` when `outcome` is not `used` or `corrected`, when `corrected_gl` is missing or not one of the 12 chart codes, or when the invoice is manual or routed.

## GET /vendors

`{ "vendors": [ { "vendor_id": "V-01", "name": "Coral Ridge Roofing", "service_type": "multi", "default_gl": null, "history_rows": 2 }, ... ] }` sorted by `vendor_id`. Works before receive.

## GET /vendor-history?vendor_id=V-01

`404` for an unknown vendor; `400` when `vendor_id` is missing. Works before receive (with an empty `session`).

```json
{
  "vendor": { "vendor_id": "V-01", "name": "Coral Ridge Roofing", "service_type": "multi", "default_gl": null },
  "rows": [
    { "gl_code": "6320", "gl_name": "Roofing repairs", "count": 14, "last_used": "2026-08-21" },
    { "gl_code": "6310", "gl_name": "Repairs and maintenance", "count": 2, "last_used": "2026-05-03" }
  ],
  "total": 16,
  "session": [
    { "invoice_id": "INV-3007", "outcome": "used", "gl_code": "6320", "gl_name": "Roofing repairs", "text": "Recorded this session: INV-3007 used 6320 Roofing repairs as is." }
  ]
}
```

`rows` are most used first, then most recently used. `session` has one line per feedback record whose invoice resolved to this vendor, in the order recorded; a correction reads `"Recorded this session: INV-3030 corrected to 6520 Plumbing capital."`. The ui shows its own "No corrections or confirmations yet." when `session` is empty.

## GET /scheme

Read-only. Rendered from the seed records with the same template code Write the invoice description uses, so it works before receive.

```json
{
  "max_length": 250,
  "templates": [
    {
      "template_id": "service",
      "label": "Service vendor",
      "template": "{account number, when the invoice prints one} {vendor} {service} {property} {unit} {service from} to {service to}",
      "segments": [
        { "placeholder": "{account number, when the invoice prints one}", "when_missing": null },
        { "placeholder": "{vendor}", "when_missing": null },
        { "placeholder": "{service}", "when_missing": "service not on invoice" },
        { "placeholder": "{property}", "when_missing": null },
        { "placeholder": "{unit}", "when_missing": "no unit" },
        { "placeholder": "{service from} to {service to}", "when_missing": "dates not on invoice" }
      ],
      "example": { "invoice_id": "INV-3007", "text": "Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26" }
    },
    {
      "template_id": "utility",
      "label": "Utility",
      "template": "{account number} {service} {service from} to {service to} meter {meter number}",
      "segments": [
        { "placeholder": "{account number}", "when_missing": "no account number" },
        { "placeholder": "{service}", "when_missing": "service not on invoice" },
        { "placeholder": "{service from} to {service to}", "when_missing": "dates not on invoice" },
        { "placeholder": "meter {meter number}", "when_missing": "meter number not on invoice" }
      ],
      "example": { "invoice_id": "INV-3025", "text": "<account number> electric service <from> to <to> meter <meter number>" }
    }
  ]
}
```

`when_missing: null` means the segment is left out of the text when the invoice does not print it (the invoice type never renders "no account number" on a service invoice). The 250 character limit trims the service segment first, word by word; `Description.truncated` is true when anything was cut.
