# ExtraOver v50 - Prelims sheet linked to Cost to Date and Committed

## The problem
Preliminaries cost to date was held in two unconnected places. The dashboard's
Cost to Date, over/under claim and WIP read Cost to Date lines, while the
Preliminaries EFC read figures typed on the prelims sheet. Prelims spend
entered in only one place was missing from the other: for a site manager at
EUR 1,000 a week, 10 weeks in, the dashboard showed either nil cost to date or
a forecast EUR 10,000 short. Only entering it twice gave the right answer.

## Prelims sheet: To Date and Committed are now linked in
The prelims sheet stays where the QS reviews preliminaries, but To Date and
Committed are no longer typed. They are linked from Cost to Date and Committed
lines on each item's cost code, read-only, so prelims cost is entered once in
the ledgers like every other trade. The QS reviews the remaining cost on the
sheet (rate, utilisation, weeks left).
- Changing an item's cost code pulls in that code's costs straight away
- Where several items share a cost code, the code's costs are split across
  them by budget, so the sheet always adds back to the ledgers

## One formula for every trade
Preliminaries on the prelims method no longer overrides its EFC. It uses the
same EFC = Cost to Date + Committed + Uncommitted as every trade, with the
prelims sheet's remaining cost as Uncommitted. Cost posted to a Preliminaries
code that no sheet item uses still counts. Until the sheet has rates, the
element still falls back to budget remaining.

## New health checks
- Warning: prelims To Date or Committed was typed on the sheet (or imported
  from a prelims spreadsheet) but is not on Cost to Date or Committed, so it
  is not in the forecast. Typed figures are kept, never deleted, until the
  costs are posted.
- Info: Preliminaries cost on codes with no prelims sheet item.
- Info: priced prelims items with no cost code, so nothing can be linked.

## Prelims template now carries cost codes
Every item in the standard prelims template has its own cost code, numbered
within its stage (PR101 to PR128 for Management and Staff, PR201 onwards for
Site Establishment, through to PR935), so costs posted to Cost to Date link
straight to the item. Loading the template also adds those codes to the cost
code register under the Preliminaries element (staff as Labour, plant as
Plant, access and security as Subcontractor, the rest as Indirect). Codes the
project already has are left exactly as they are. The load dialog now says
233 items; it said 155.

Projects that loaded the template before v50 keep their items without codes
(no rows are rewritten); the info check lists them so the QS can code them.

## Fixed: loading the prelims template showed nothing until reload
"Load standard template" added the 155 items but the sheet stayed empty until
the page was reloaded. The sheet now refreshes from the server.

## Existing projects
No schema change and no rows rewritten. A project that typed prelims costs on
the sheet without posting them to Cost to Date will see its Preliminaries EFC
drop by that amount, with the warning above saying how much and where to
post it. Projects that entered both (or only on Cost to Date) are unchanged.

## Verification
- Before and after scenarios reproduced the gap and its fix to the euro:
  sheet only, Cost to Date only, both, committed orders, shared codes,
  unallocated codes, unpriced sheet
- Demo project: dashboard identical to v48 to the euro (EFC 7,561,960, prior
  EFC 7,531,400, margin 552,040), no health issues
- 20 check API and UI run for the sheet, health checks and legacy import;
  real browser: cost code change relinks without reload, template loads
- Template, 12 checks: every item coded and unique, codes registered under
  Preliminaries (or a Preliminaries trade name when the element is absent),
  an existing code left untouched, cost posted to a template code links
- Permission matrix (111), v47 fixes (24), demo (54) and owner smoke test
  unchanged; `npm run build` and `tsc --noEmit` clean
- Not yet reconciled against the Riverbank test pack, which is not in the
  repository: run it before release

## Deferred
- EFC Breakdown page computes its own per-code figures and does not follow
  any trade's forecast method, Preliminaries included
