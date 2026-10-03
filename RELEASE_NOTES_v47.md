# ExtraOver v47 - Fixes: prelim entry, terminology save, named inserts

Fixes the items deferred from v46, plus two live bugs found while doing it.
No schema changes.

## Adding prelim items works again
Adding a line on the Preliminaries sheet, and importing prelims from a
spreadsheet, failed with a server error. Both wrote rows by position, and
the `stage` column added by an earlier migration left them one value short.
Both now name their columns. Loading the standard PR100-PR900 template was
not affected.

## Save Terminology works
The Terminology panel in Settings saves only the renamed labels, but the
server always updated every project field and failed. It now saves the
labels on their own, audited, and a later full settings save keeps them.

## No more positional inserts
All 25 remaining `INSERT INTO ... VALUES` statements (routes, importer and
demo seed) now list their columns, so a future migration cannot shift values
into the wrong column. Each was mapped by what its values mean rather than
by position, because migrated tables have different column orders on fresh
and production databases. This also fixes the demo seed
(`npx tsx src/lib/seed.ts`), which had stopped working.

## Viewers no longer see the lock button
Period History hides "Lock period & roll forward" from viewers, who cannot
lock a period. The page also checks project access directly, like every
other page.

## Housekeeping
- Removed `src/lib/authz.ts`, unused legacy next-auth code
- Version label to v47

## Verification
- New check script covering every converted insert, terminology save and
  lock button visibility: fails 4 of 24 on v46 (prelim POST, terminology,
  viewer lock button), passes 24 of 24 on v47
- v46 permission matrix (111 checks) and owner smoke test unchanged
- `npm run build` and `tsc --noEmit` clean

## Deferred
- Backup and export of a full project
- Demo-seed button (the seed script it needs now works)
