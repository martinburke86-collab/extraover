# ExtraOver v52 - Prelims template cost codes, sheet reloads after template and import

Follows v51 (prelims Cost to Date and Committed linked from the lines). No
schema changes.

## Prelims template now carries cost codes
Since v51 the prelims sheet picks up Cost to Date and Committed by each item's
cost code, but the standard template's items had no codes, so they could never
show any cost. Every template item now has its own code, numbered within its
stage: PR101 to PR128 for Management and Staff, PR201 onwards for Site
Establishment, through to PR935. Codes are fixed in the template, so editing
it never renumbers them.
- Loading the template adds the codes to the cost code register under the
  Preliminaries element (staff as Labour, plant as Plant, access and security
  as Subcontractor, the rest as Indirect), so costs can be posted to them
  straight away
- Codes the project already has are left exactly as they are
- The load dialog now says 233 items; it said 155

Projects that loaded the template before v52 keep their items without codes;
no rows are rewritten.

## Fixed: template and import showed nothing until reload
"Load standard template" and the prelims spreadsheet import both added rows
on the server, but the sheet kept showing its old rows until the page was
reloaded. The sheet now reloads its items after either.

## Housekeeping
- Version label to v52

## Verification
- Template, 12 checks: all 233 items coded and unique, codes registered under
  Preliminaries (or a Preliminaries element name when the project has none),
  an existing code left untouched, cost posted to a template code shows on
  its item, load skipped when the sheet is not empty
- Real browser: template rows appear without reload (v51: none until
  reload), and an imported prelims row appears when the import dialog closes
- Permission matrix, v47 fixes, demo and owner smoke test unchanged;
  `npm run build` and `tsc --noEmit` clean
