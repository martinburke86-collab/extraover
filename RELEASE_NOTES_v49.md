# ExtraOver v49 - Project backup and restore, complete Excel export

## Download project backup
New "Download project backup" link in the sidebar (editors and owners).
It saves every row of the project as one JSON file: cost codes, every cost,
committed and forecast line with its variation coding, variations, prelims,
valuations, periods and their locked snapshots, subcontractors and certs,
S-curve, cashflow, rate breakdowns and the audit log. It holds no user
accounts, passwords or access lists.

## Restore backup
New "Restore backup" button on the portfolio and the new project page.
Restoring never overwrites anything: the file becomes a NEW project, named
"(restored)", owned by the person who restored it. Every id is regenerated
and every link remapped, so a restore can also be used to copy a project.
- All or nothing: the restore runs in one transaction, so a damaged file
  writes nothing
- Works across versions: only columns this version has are written, so
  backups from older releases restore with defaults for newer fields
- Rejects anything that is not an ExtraOver backup with a plain message;
  links to rows outside the file are dropped, never pointed at other projects
- The browser compresses the file before upload to stay well inside the
  hosting upload limit
- The restore is recorded in the new project's audit log

## Excel export now includes everything
"Export to Excel" gains five sheets:
- Subcontractors: order value, certified, % certified, retention held, RCT,
  tax clearance and insurance expiry, final account
- Sub Certs: every certificate with the same deduction cascade as the
  register (period gross, retention, RCT on the balance, net payable)
- Valuation: claimed, certified, received, paid, cash position, risk and
  opportunity, employer retention held, defects period
- Period History: each period with its locked EFC, margin, cost to date,
  claimed, cash and over/under claim
- Audit Log: every recorded change

## Housekeeping
- Version label to v49

## Verification
- Round trip: demo project backed up and restored; KPIs, every trade line,
  coded variations, prelims, certs and period snapshots identical
- Hostile and awkward files: older schema, unknown columns, links into
  another project, table and column name injection, malformed values, too
  many rows, a failure part way through (nothing written)
- End to end, 39 checks: anonymous 401, viewer and non-member 403, restores
  private to the restorer, another customer's project unchanged, workbook
  opened and the cascade, valuation and period figures checked cell by cell
- Real browser: sidebar download, then portfolio restore (gzip upload) lands
  on the restored project
- Demo (54), permission matrix (111), v47 fixes (24) and owner smoke test
  unchanged; `npm run build` and `tsc --noEmit` clean

## Deferred
- Prelims cost to date single source (see v48)
- Margin RAG thresholds differ between dashboard and portfolio (see v48)
