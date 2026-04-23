# ExtraOver — Technical Debt & Future Improvements

Logged from architecture review, April 2026. These are known issues to address in a planned refactor sprint — not urgent, but tracked here so they aren't forgotten.

---

## Priority: High

### 1. Migration system needs hardening
**File:** `src/lib/db.ts` — `runMigrations()`

The current migration approach wraps every `ALTER TABLE` in a silent `try/catch`. This masks real errors — if a column fails to add due to a constraint issue rather than "already exists", the app continues with a broken schema and no log.

**Fix:**
- Log migration failures to console with the SQL that failed and the error message
- Add a `schema_migrations` table to track which migrations have been applied (idempotent runner)
- Consider migrating to `drizzle-kit` or a lightweight migration tracker like `umzug`

---

## Priority: Medium

### 2. Raw SQL type safety — reduce `as any` casting
**Files:** `src/lib/calculations.ts`, `src/lib/db.ts`, most API routes

All DB rows are typed as `any` and values are manually cast with `Number()`, `String()` etc. This means TypeScript can't catch mismatched field names or type errors at compile time.

**Fix:**
- Define TypeScript interfaces for each DB row shape (e.g. `ProjectRow`, `TradeRow`, `CostLineRow`)
- Apply these types to `db.execute()` results instead of `as any`
- Does not require migrating to an ORM — just adding interfaces and applying them consistently
- Prisma or Drizzle would give this for free if a full ORM migration is ever done

### 3. Cost codes reference trade by name, not foreign key
**Files:** `src/lib/db.ts` schema, `src/lib/calculations.ts`, `src/app/[id]/efc-breakdown/page.tsx`

`cost_codes.trade` is a plain text column matched by string equality against `trades.name`. If a trade is renamed, all associated cost codes silently break in aggregations.

**Fix:**
- Add `trade_id TEXT` to `cost_codes` referencing `trades.id`
- Migrate existing data to populate `trade_id` from the name match
- Update all JOIN queries in calculations.ts and API routes to use `trade_id`
- This is a significant refactor — do in a dedicated sprint when feature set is stable

---

## Priority: Low (housekeeping)

### 4. Component library is a single file
**File:** `src/components/ui.tsx`

All core UI primitives (PageHeader, Panel, KpiCard, Badge, Btn, MovCell, RagChip etc.) live in one file. Fine at current size (~200 lines) but will become hard to navigate as it grows.

**Fix when file exceeds ~500 lines:**
- Split into `src/components/ui/kpi-card.tsx`, `badge.tsx`, `page-header.tsx` etc.
- Barrel export from `src/components/ui/index.ts` so import paths don't change

### 5. calculations.ts will become a monolith
**File:** `src/lib/calculations.ts`

Currently ~300 lines of dashboard KPI and trade summary logic. Will grow as reporting features are added.

**Fix when file exceeds ~500 lines:**
- Split into a service layer: `src/lib/services/dashboard.ts`, `trades.ts`, `prelims.ts`
- Keep the same exported function signatures so call sites don't change

---

## Not acting on (decision logged)

### ORM migration (Prisma / Drizzle)
Prisma is installed but bypassed in favour of raw `@libsql/client`. Migrating mid-build carries high rewrite risk. The experimental Prisma/Turso driver adds further uncertainty. Decision: stay with raw LibSQL for now, address type safety via interfaces (item 2 above) without changing the data layer.

---

*Last updated: April 2026*
