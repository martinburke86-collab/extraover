# ExtraOver v41 - Quick wins + retention tracking

## Retention tracking (Value / Claims)
New Retention panel: retention held to date computed from certified value,
editable retention rate and defects period (stored on the project, audited),
and a 50/50 moiety release schedule with dates derived from practical
completion (revised finish) and PC + defects months. Moieties show a green
"Due for release" badge once their date passes. Net certified after
retention shown beneath.
- New project columns retention_pct (default 3) and defects_months
  (default 12), applied by runMigrations on cold start.

## Pre-lock checklist (Period History)
Opening "Lock period & roll forward" now runs the full reconciliation check
suite and shows a "Ready to lock?" panel: green when clean, otherwise each
error and warning with a Fix link to the relevant sheet. Errors block the
confirm button unless "Lock anyway" is explicitly ticked, so a locked
snapshot can never silently preserve an impossible position.
- Dashboard API now returns healthIssues alongside kpis and trades.

## Portfolio card view
Table/Cards toggle on the portfolio. Cards show adjusted contract sum, RAG
status pill, margin %, CTD, cash position and flag count per project, and
click through to the dashboard.

## Cashflow chart join
The actual-history and forecast lines now meet at the current month instead
of leaving a visual gap: the forecast series is seeded from the last actual
point.
