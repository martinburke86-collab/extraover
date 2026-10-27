# ExtraOver v51 - Prelims cost to date has one source

Clears the item deferred from v48.

## Prelims cost to date and committed now come from the lines
Before v51, Preliminaries cost to date was held in two places that never
talked to each other. The dashboard's Cost to Date read the Cost to Date
lines, while the Preliminaries EFC read the CTD and Committed typed on the
prelims sheet. So prelims spend typed on the sheet was in the Preliminaries
EFC but missing from Cost to Date, over/under claim, financial % complete
and WIP. An invoice posted to an A-code on Cost to Date did the reverse: it
showed in Cost to Date but not in the Preliminaries EFC.

Reproduced on a two-item project (each item with €5,000 still to spend):
€10,000 typed on the sheet for A.01 and a €20,000 Cost to Date line on
A.02. Real prelims cost was €30,000 and the EFC should have been €40,000.
The dashboard showed €20,000 for both, and no health check fired.

The Cost to Date and Committed lines are now the single source, the same
as every other element:
- Preliminaries EFC = Cost to Date + Committed (remaining) + Uncommitted.
  The prelims sheet supplies the Uncommitted only (qty x rate x remaining
  weeks x utilisation). The EFC formula itself is unchanged; Preliminaries
  just no longer overrides it.
- The CTD and Committed columns on the prelims sheet are read-only. Each
  item shows the lines on its cost code. If several items share a code,
  the code's lines are split between them by budget (equally if none).
- Preliminaries cost on codes with no sheet item is shown as its own row,
  "Other Preliminaries codes", so the sheet total ties to the element EFC.
- Saving a prelim item, adding one or importing prelims no longer stores
  CTD or Committed. The import tells you when it ignored those columns.
- The demo project no longer copies its lines onto the sheet. Nothing to
  copy now.

Why the lines and not the sheet: accounts imports, accruals, sub recon and
VO tagging all live on the lines. Making the sheet the source would have
broken those and meant rewriting existing A-code lines.

## Moving figures typed on the sheet before v51
Projects that typed CTD or Committed onto the prelims sheet will see that
amount drop out of the Preliminaries EFC until it is moved onto the lines.
Nothing is rewritten on deploy:
- A new error on the health check (blocks period lock unless overridden)
  names the codes and the amount that is on the sheet only.
- The prelims sheet shows the same amount in a banner, with a "Post to
  Cost to Date" button for editors. It adds one Cost to Date line and/or
  one Committed line per cost code in the current period, noted "Moved
  from prelims sheet (v51)", then clears the typed figures on those codes.
  Every line is audited.
- Only the amount the lines on that code do not already hold is posted.
  A QS who kept the sheet and the lines in step gets no double count and
  no warning.
- Items with no cost code, or a code not in the register, can't be posted.
  The check asks for a code first.

## New health checks where the sheet and the element can still drift
- Error, prelims cost on the sheet only (above).
- Warning, Preliminaries cost on codes with no prelims sheet item, so
  nothing forecasts the remaining spend on them.
- Warning, a prelims sheet item coded to another element's cost code. Its
  cost shows on the sheet but counts in that element.
All link to the prelims sheet.

## Fixed: prelims sheet totals one column out
The section and TOTAL PRELIMINARIES rows sat one column to the left, so
Uncommitted showed under Wks and the PFC under Uncommitted. They now line
up with their headings.

## Housekeeping
- Version label to v51
- CLAUDE.md rule 1 updated: no EFC override; prelims sheet CTD and
  Committed are derived
- Schema: none. `prelim_items.ctd` / `committed` stay in place, read only
  for the one-off move above. No migration, no Turso reseed required

## Verification
- Reconciled to the euro against the v48 demo test pack (Harbour View),
  built on v48 and on v51: all 35 dashboard KPIs, all 14 elements, every
  prelims row, last month's snapshot including per-element P&L, and the
  S-curve are identical. The one changed field is the Preliminaries
  element's Uncommitted, which v48 reported as 0 because of the override
  and v51 reports as the real €556,160. Preliminaries EFC unchanged at
  €1,029,460, equal to the prelims sheet total
- Pre-v51 project with every case (sheet only, lines only, kept in step,
  no code, code on another element, code with no item), checked through
  the real API: Preliminaries CTD €34,000 and EFC €51,000 before the move,
  €44,000 and €65,000 after, matching the hand calculation. The second
  move posts nothing, typed CTD on save or add is ignored, and the move is
  refused for a viewer (403), with no session (401) and on another
  project (403)
- `npm run build` and `tsc --noEmit` clean

## Deferred
- Backup and export: per-project Excel workbook and restorable JSON backup
  (carried from v48)
