# ExtraOver v39 - Variation cost coding and reconciliation

## The big change: variations are now a coding dimension

Every line on Cost to Date, Committed and Forecast can be tagged to a variation
via a new VO column. The Variations register gains a read-only **Coded cost**
column derived from those tagged lines (actuals + committed orders + forecast
to complete), shown beside the manual **Cost est.** so estimate vs actual
recovery is visible per VO. Margin per variation now uses coded cost when
lines are tagged, falling back to the estimate.

Because tagged lines are ordinary cost-code lines, coded variation costs flow
into trade EFCs through the existing aggregation. Nothing is double counted
and the outturn can no longer silently omit VO cost.

- New nullable `variation_id` column on cost_lines, committed_lines and
  forecast_lines, applied automatically by runMigrations() on cold start.
  No Turso reseed required.
- All INSERTs on these three tables converted to named columns
  (routes, importer and seed) so the new column cannot cause the
  positional-ordering bug again.

## New reconciliation health checks

- Element budgets total vs original budget mismatch
- EFC below cost to date on any element (impossible forecast), shown as error
- Approved variations carrying estimated cost with no coded lines
- Coded cost drifting materially past the estimate
- Prelims detail present but the Preliminaries element not on the
  'prelims' forecast method (single-source-of-truth guard)

## Fixes

- Dashboard Programme panel now reads revised start and finish from the
  project (was hardcoded to 03-Jul-26 / 30-Sep-27); weeks elapsed and
  remaining are computed live
- Budget Formation table refreshes immediately after a CSV or XLSX import
  (rows state now syncs with server refresh)
- Sidebar version label unstuck from v27; remember to bump it each release

## Deferred to v40 (agreed roadmap)

- Preliminaries element fully read-only on Cost to Date and Committed,
  derived from the prelims sheet
- Cost entry defaulting to cost-code level with trade rollups everywhere
- "Where does this figure come from" popovers on read-only cells
- Clickable dashboard KPIs opening EFC-breakdown-style drilldowns
