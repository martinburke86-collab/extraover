# ExtraOver - CLAUDE.md

Live CVR (cost value reconciliation) web tool for Irish building contractors,
deployed at extraover.vercel.app. Real QS teams use it to report monthly cost
and value, so treat every change as a production change.

## Stack and deployment

- Next.js 14 (App Router), TypeScript, Tailwind, raw `@libsql/client` SQL.
  Prisma is installed but bypassed, do not introduce it.
- Local dev uses `cvr.db` (SQLite file). Production uses Turso when
  `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set (see `src/lib/db.ts`).
- Vercel deploys automatically on every push to `main`. A push to main is a
  release, so it must build cleanly.
- Commands: `npm run dev`, `npm run build`, `npx tsc --noEmit`. There is no
  test suite or lint script, so typecheck and build before every push.

## Layout

- `src/app/[id]/<page>/page.tsx` server page + `<Page>Client.tsx` client grid
- `src/app/api/projects/[id]/<resource>/route.ts` REST routes, each calls `initDB()`
- `src/lib/db.ts` schema (`initDB`, `initPrelimsTable`) and `runMigrations()`
- `src/lib/calculations.ts` trade summaries and dashboard KPI engine
- `src/lib/healthCheck.ts` reconciliation checks (dashboard, pre-lock gate)
- `src/lib/audit.ts` `writeAudit` / `auditChanges` / `auditMoney`
- `src/lib/pageAuth.ts` (pages) and `apiAuth.ts` (API routes) enforce owner /
  editor / viewer roles via `roles.ts`. `authz.ts` is legacy next-auth, unused
- `src/components/ui.tsx` shared primitives (PageHeader, Panel, KpiCard, Btn...)
- `src/app/[id]/LayoutClient.tsx` sidebar, including the version label

## Non-negotiable rules

### 1. Committed means REMAINING commitment
Committed is the value of orders still to be invoiced, reduced by the QS as
costs land on Cost to Date. The formula is fixed:

    EFC = Cost to Date + Committed (remaining) + Uncommitted

Never change this formula and never reintroduce full-order-value logic that
double counts invoiced cost. Anything needing a full order value (sub
register, over-certification check) uses the standing `order_value` on the
subcontractor account, falling back to the committed sum only when unset.
The only EFC override is the Preliminaries trade on the `prelims` method,
where EFC comes from the prelims sheet.

### 2. Named-column INSERTs and ALTER-only migrations
- Never write positional `INSERT INTO table VALUES (...)` on `cost_lines`,
  `committed_lines`, `forecast_lines` or any table that has ever been
  migrated. Always list the columns. Positional inserts broke when
  `variation_id` was added. Applies to routes, importer and seeds alike.
- Schema changes go in `runMigrations()` in `src/lib/db.ts` as
  `ALTER TABLE ... ADD COLUMN` (or `CREATE TABLE IF NOT EXISTS`) appended to
  the list. They run on every cold start and must be idempotent. New columns
  must be nullable or have a DEFAULT.
- Never require a Turso reseed, drop tables, or rewrite existing rows to
  ship a release. Production data must survive every deploy.
- Also add new columns to the `CREATE TABLE` in `initDB` only if fresh
  databases need them before migrations run; the ALTER is still required.

### 3. Variations are a coding dimension
- `variation_id` on cost, committed and forecast lines (and sub certs) tags
  cost to a VO. The register's Coded cost is derived from those tagged lines;
  it is read-only and falls back to the manual estimate when nothing is coded.
- Tagged lines are ordinary cost-code lines, so VO cost flows into trade EFCs
  through normal aggregation. Never add VO cost on top separately.
- Adjusted contract sum = contract sum + approved variations from the
  register. Once a project has any variations, the register is the single
  source of truth; `projects.approved_vars` only applies to register-less
  projects. Every screen showing approved variations must read the same value.

### 4. Enter once, at the lowest level
Every figure is entered once, at the lowest level it exists (cost code line,
prelim item, sub cert, VO). Everywhere else it is read-only and derived.
Dashboards, trade summaries and portfolio views aggregate, never accept
input. If a number could be typed in two places, one of them is a bug.
Prefer deriving values (e.g. suggested accruals from sub certs) over asking
for them, and add a health check when two sources can drift.

### 5. Release discipline
Every release that goes to main:
- Bumps the sidebar label in `src/app/[id]/LayoutClient.tsx` (currently
  `ExtraOver v46`) to the next number.
- Adds `RELEASE_NOTES_vXX.md` at the repo root (format below).
- Uses a commit subject of the form `vXX: short summary, comma separated`.

### 6. Costline design system
- Type: IBM Plex Sans for UI, IBM Plex Mono for codes, refs, timestamps and
  section labels. Tabular figures so money aligns.
- Use the tokens in `tailwind.config.js` and `globals.css`, not raw hex.
  Ground `#f6f7f9`, white surfaces, `#e7e9ee` borders, 12px card radius,
  dark `#1a1d23` ledger strips for summaries.
- Blue `#1c4ed8` (`primary`) is for action, selection, focus and editable
  cells (`cvr-input` `#eef2ff`) only. Never decorative.
- Green `#0a8a54` = money-positive, red `#c8412a` = money-negative, amber
  `#b6740a` = caution. Nothing else may use these colours.
- Tables: mono uppercase headers on `#fbfbfc`, hairline dividers, heavy
  bordered bold total rows. Primary button solid blue, secondary white.
- No em dashes anywhere: UI copy, code comments, release notes, commits,
  PDFs. Use commas or a plain hyphen.

## Other conventions

- Audit every money or settings change with `writeAudit` / `auditChanges`.
- Middleware skips `/api/*`, so every API handler must open with a guard:
  `const guard = await requireProjectApi(params.id, 'viewer' | 'editor' |
  'owner'); if (!guard.ok) return guard.res`. GET is viewer, writes are
  editor, settings and project delete are owner. Scope every row lookup by
  `project_id` so a member of one project cannot touch another's rows.
- Compliance and integrity gates live on the server (e.g. expired tax
  clearance blocks certifying or paying a sub), not just in the UI.
- When a calculation or join changes, reconcile the dashboard against a
  known test pack (e.g. Riverbank) to the euro before releasing.
- New integrity rules belong in `runHealthChecks`, with severity, a plain
  English detail and an `href` to the sheet that fixes it. Errors block
  period lock unless explicitly overridden.
- Irish context: euro, RCT rates 0/20/35, retention with 50/50 moiety
  release, tax clearance and insurance expiry on subs.
- User-facing labels for core sheets can be renamed per project via
  `src/lib/terminology.ts`; use the terms object, not hardcoded strings.
- Known debt is tracked in `TECHNICAL_DEBT.md`; do not start the trade_id or
  ORM refactors unprompted.

## Release notes format

    # ExtraOver vXX - Short theme

    ## Section per feature or fix
    What changed and why, in plain QS language.
    - Bullets for detail
    - Schema: new columns/tables, "applied by runMigrations on cold start,
      no Turso reseed required"

Note deferred work explicitly (e.g. "Deferred to vXX") so the roadmap carries.
