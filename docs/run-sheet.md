# Run sheet: utility system, two months

Open http://localhost:3000. In the sidebar, Industrial AP holds Utility bills to Yardi, Meter register, and Paid-or-not reconciliation; the three share one store and one reset. Keys: `a` opens or closes the explanation panel; on Match bills to meters Enter accepts, N skips, M opens the full picker, U undoes; on Confirm which account a payment matched 1, 2, 3 pick a candidate. "Reset this demo" at the foot of the sidebar returns everything to the fresh August state.

Every number on screen is a count of seed things or a seed-computed amount labeled example data. No client figure appears anywhere.

## Screens

| Sidebar module | Screen | Route |
| --- | --- | --- |
| Utility bills to Yardi | Capture this month's bills | /industrial-ap/utility-bills-to-yardi/capture-this-months-bills |
| Utility bills to Yardi | Match bills to meters | /industrial-ap/utility-bills-to-yardi/match-bills-to-meters |
| Meter register | Every meter and its account | /industrial-ap/meter-register/every-meter-and-its-account |
| Meter register | One meter's history | /industrial-ap/meter-register/one-meters-history/[meterId] |
| Paid-or-not reconciliation | Which bills are paid | /industrial-ap/utility-payment-reconciliation/which-bills-are-paid |
| Paid-or-not reconciliation | One property, month by month | /industrial-ap/utility-payment-reconciliation/one-property-month-by-month/[siteId] |
| Paid-or-not reconciliation | Confirm which account a payment matched | /industrial-ap/utility-payment-reconciliation/confirm-which-account-a-payment-matched |
| Paid-or-not reconciliation | Payments without a meter | /industrial-ap/utility-payment-reconciliation/payments-without-a-meter |
| Paid-or-not reconciliation | Bill-backs, transfers and calls | /industrial-ap/utility-payment-reconciliation/bill-backs-transfers-and-calls |
| Paid-or-not reconciliation | Files and notes produced | /industrial-ap/utility-payment-reconciliation/files-and-notes-produced |
| Paid-or-not reconciliation | The tracker as kept today | /industrial-ap/utility-payment-reconciliation/the-tracker-as-kept-today |

## Beats

1. **Which bills are paid, August.** The red cell and the dark grey cell sit together on Site A: unit 12 (Unpaid) and unit 13 (No account on record, the check cannot run). Read the month stepper: July closed, August this month, September not yet.
2. **One meter's history, unit 12 then unit 07.** Unit 12: vacant since June, landlord account active from the day after, no ledger line for August. Unit 07: occupied since April, the landlord's account never closed, bill-back four months so far, Transfer needed on the row.
3. **Capture this month's bills: Run Aug 2026.** The run panel ticks: received by route, fields read, matched, surfaced by bill (accounts the tracker never had), unmapped, meter on bill differs, duplicate blocked, unusual amount. Export is disabled while the duplicate is open.
4. **Match bills to meters.** The Site B house-meter bill: press Enter on the suggested meter (service address match). The printed-meter mismatch on Site A's house meter: S to confirm the swap; the history gains a row. The duplicate: F drops the second copy. The unusual amount on Site B: 1, vacant but in use, which adds a verify-on-site item. Press U once to show undo.
5. **Export to Yardi, on Capture this month's bills.** One zip: a 13-column headerless file per property per provider, every row with the property's bank GL, water bills as three rows under one invoice number, plus the bill-backs file.
6. **Yardi import confirmed.** The paid column fills itself. Show the totals on Which bills are paid and Site A on One property, month by month; the Site B county water master reads Paid because its three lines sum.
7. **Confirm which account a payment matched.** The legacy line whose four-digit suffix two Site A accounts share: pick the candidate. Say: after this month's export wrote the scheme into the invoice numbers, September will have nothing here.
8. **Fill the master, on Which bills are paid.** Provider account list import: introduce it as our suggestion, not something the client asked for. Watch No account on record fall. Site visit results: blank meter numbers fall, the carried-over rows verify as tenant-paid, and the Site A occupied row marked owner-paid by the seller's workbook drops out of Transfer needed.
9. **Step to September.** Read the deltas per count and the contributions line per mechanism. Run September if time allows: fewer surfaced, fewer unmapped, nothing left on Confirm which account a payment matched.
10. **Bill-backs, transfers and calls.** Bill back unit 07 (a tenant charge row into the bill-backs file). Draft a transfer for a quiet-site Transfer needed row (nothing is sent). Generate the checklist for Site B. Mark a provider call. Files and notes produced lists everything the month wrote.
11. **Why this status.** Click any cell on One property, month by month or Every meter and its account: the rule, the rent roll on the 15th, the account on the 15th, the ledger lines with invoice numbers, the flags.
12. **The tracker as kept today.** One tab per property, next to the rent roll tab and the discrepancy list; the manual steps beside the demo's steps.
13. **Reset this demo.**

## Sample bills

`public/sample-bills/` holds A-5.pdf, B-4.pdf, B-6.pdf, B-7.pdf, and clean.pdf. Dropping one on Capture this month's bills reads its canned fields. Any other file name is refused.
