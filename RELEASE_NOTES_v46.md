# ExtraOver v46 - API access control

Closes the gap found during the v45 security review: the page middleware
deliberately skips `/api/*`, and most API routes never checked who was
calling. Anyone with a project link could read its financials, and anyone at
all could list or delete projects. No schema changes.

## Every API route now checks the caller
New `src/lib/apiAuth.ts` does for API routes what `pageAuth.ts` does for
pages: reads the session, looks up the user's role on the project and returns
401 (not signed in) or 403 (no access, or role too low). Rules mirror the UI:
- Read (GET): any member of the project, viewer upwards
- Write (POST, PUT, PATCH, DELETE): editor or owner, so viewers are truly
  read-only. This includes locking a period.
- Project settings and deleting a project: project owner only
- Project list: global owners see every project, everyone else only the
  projects they are assigned to (matches the portfolio page)
- Creating a project: any signed-in user, who becomes its owner (unchanged)

## Global lists are admin-only
The shared Elements and Trades lists feed every project, so editing them now
needs a global owner. Any signed-in user can still read them for the
breakdown dropdowns. The Global Settings panel is hidden from project owners
who are not global owners, instead of failing on save.

## Cross-project protection on breakdowns
Rate/quantity breakdown rows have no project column, so a member of one
project could read or edit another project's breakdowns by row id. Each
request now confirms the parent forecast, committed, prelim or cost line
belongs to the project in the URL. Unknown parents read as "no breakdown";
writes to them return 404.

## Verification
- Permission matrix, 111 checks, all passing: anonymous, forged cookie,
  signed-in but unassigned, viewer, editor, project owner and global owner,
  across every route, plus cross-project breakdown attempts
- Owner smoke test identical to v45 on every page and API route except the
  anonymous dashboard request, which now returns 401
- `npm run build` and `tsc --noEmit` clean

## Found, not fixed (deferred)
- Settings "Save Terminology" sends only the terminology field but the
  settings route always updates every column, so it fails with a server
  error. Custom terminology cannot currently be saved.
- Period History shows the lock button to viewers; it now fails with a
  "Failed to lock period" message rather than locking. Hide it for viewers.
- `src/lib/authz.ts` is unused legacy next-auth code; remove it.
