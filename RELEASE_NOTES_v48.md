# ExtraOver v48 - Demo project, project delete fix

## Add demo project
New "Add demo project" button on the portfolio, and "Explore demo project"
on the new project page, so a new user can look around a fully worked CVR
before setting up their own. Each click adds a separate project owned by the
person who clicked it; it never changes or deletes anything else.

The demo, Harbour View Apartments, is built the same way as a real project
from the wizard and follows the house conventions throughout:
- Week 30 of a 78 week programme, dated relative to the day it is created
- 14 SCSI elements whose budgets sum exactly to the original budget
- Committed holds remaining commitment only (order value less invoiced)
- Two approved variations coded on cost and committed lines, so the register
  shows coded cost against estimate; adjusted sum comes from the register
- Preliminaries on the prelims sheet method, its figures derived from the
  Cost to Date and Committed lines so the two agree
- Last month locked with a snapshot taken by the real calculation engine, so
  movement columns show this month's changes (rebar overrun on the Frame)
- Two subcontractor accounts with RCT, retention and certs; one has expired
  insurance to show the compliance warning
- Completed elements on agreed final accounts (forecast sheet method)
- No health check issues

`npx tsx src/lib/seed.ts` now adds the same demo project. It previously
deleted every project and the shared Elements and Trades lists first; it now
never deletes anything, and fills the shared lists only when empty.

## Fixed: deleting a project with a locked period
"Delete project" in Settings failed with a server error for any project that
had ever locked a period, because period snapshots do not cascade. Snapshots
and rate breakdowns for the project are now removed in the same transaction.

## Fixed: pre-lock checklist always said "GIFA not set"
The checklist on Period History reads health checks from the dashboard API,
which never passed the project's GIFA. It now does, matching the dashboard.

## Housekeeping
- Project creation moved from the API route into `src/lib/projects.ts`,
  shared by the wizard and the demo. Wizard behaviour unchanged.
- Version label to v48

## Verification
- Demo end to end, 54 checks: created by a signed-in user only, visible only
  to them, every page and API returns, Excel and PDF exports render, no
  health issues, another customer's project and the shared lists are
  byte-identical before and after, a deleted demo leaves no orphaned rows
- Locked-period delete reproduced as a 500 on v47 and passes on v48
- v46 permission matrix (111), v47 fixes (24) and owner smoke test unchanged
- `npm run build` and `tsc --noEmit` clean

## Deferred
- Backup and export: per-project Excel workbook and restorable JSON backup
- Prelims cost to date: the dashboard's Cost to Date total reads Cost to Date
  lines while the Preliminaries EFC reads the prelims sheet, and nothing keeps
  them in step. Needs a decision on the single source, then a reconciliation
  against the test pack.
