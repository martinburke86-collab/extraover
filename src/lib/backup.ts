// Project backup and restore.
//
// A backup is every row belonging to one project, table by table, as plain
// JSON. Restoring never overwrites anything: it creates a NEW project owned by
// the person restoring, with every id regenerated and every link (period,
// cost code, variation, parent line, subcontractor) remapped, inside a single
// write transaction so a bad file writes nothing.
//
// Restores are schema tolerant: only columns that exist in the current
// database are written (named columns, never positional), so a backup taken on
// an older or newer version still restores; missing columns take defaults.

import { db, cuid } from './db'

export const BACKUP_FORMAT = 'extraover-project-backup'
export const BACKUP_SCHEMA = 1

// Insert order respects foreign keys. `scope` says how rows are found.
const TABLES: { table: string; scope: 'project' | 'period' | 'breakdown' }[] = [
  { table: 'projects',                 scope: 'project' },
  { table: 'trades',                   scope: 'project' },
  { table: 'cost_codes',               scope: 'project' },
  { table: 'variations',               scope: 'project' },
  { table: 'report_periods',           scope: 'project' },
  { table: 'period_snapshots',         scope: 'period' },
  { table: 'subcontractors',           scope: 'project' },
  { table: 'sub_certs',                scope: 'project' },
  { table: 'cost_lines',               scope: 'project' },
  { table: 'committed_lines',          scope: 'project' },
  { table: 'forecast_lines',           scope: 'project' },
  { table: 'value_periods',            scope: 'project' },
  { table: 'prelim_items',             scope: 'project' },
  { table: 's_curve_rows',             scope: 'project' },
  { table: 'breakdowns',               scope: 'breakdown' },
  { table: 'cashflow_bands',           scope: 'project' },
  { table: 'cashflow_month_overrides', scope: 'project' },
  { table: 'cashflow_income_items',    scope: 'project' },
  { table: 'audit_log',                scope: 'project' },
]

// Columns holding ids of other rows in the backup
const LINK_COLUMNS = ['period_id', 'cost_code_id', 'variation_id', 'parent_id', 'subcontractor_id']
// Links a row cannot exist without; rows whose link is missing are skipped
const REQUIRED_LINKS: Record<string, string[]> = {
  period_snapshots: ['period_id'],
  sub_certs:        ['subcontractor_id'],
  cost_lines:       ['cost_code_id'],
  committed_lines:  ['cost_code_id'],
  forecast_lines:   ['cost_code_id'],
  breakdowns:       ['parent_id'],
}

const MAX_ROWS = 250_000

type Value = string | number | null
type Row = Record<string, Value>
export interface ProjectBackup {
  format: typeof BACKUP_FORMAT
  schema: number
  exportedAt: string
  project: { id: string; name: string; code: string }
  tables: Record<string, Row[]>
}

async function rowsOf(sql: string, args: any[]): Promise<Row[]> {
  const r = await db.execute({ sql, args })
  return r.rows.map(row => Object.fromEntries(r.columns.map((c, i) => {
    const v = (row as any)[i]
    return [c, typeof v === 'bigint' ? Number(v) : v ?? null]
  })))
}

export async function exportProjectBackup(projectId: string): Promise<ProjectBackup> {
  const tables: Record<string, Row[]> = {}
  for (const { table, scope } of TABLES) {
    tables[table] =
      table === 'projects' ? await rowsOf(`SELECT * FROM projects WHERE id=?`, [projectId])
      : scope === 'period' ? await rowsOf(`SELECT * FROM ${table} WHERE period_id IN (SELECT id FROM report_periods WHERE project_id=?)`, [projectId])
      : scope === 'breakdown' ? await rowsOf(`SELECT * FROM breakdowns WHERE parent_id IN (
            SELECT id FROM forecast_lines WHERE project_id=? UNION SELECT id FROM committed_lines WHERE project_id=?
            UNION SELECT id FROM prelim_items WHERE project_id=? UNION SELECT id FROM cost_lines WHERE project_id=?)`,
            [projectId, projectId, projectId, projectId])
      : await rowsOf(`SELECT * FROM ${table} WHERE project_id=?`, [projectId])
  }
  const p = tables.projects[0]
  if (!p) throw new Error('Project not found')
  return {
    format: BACKUP_FORMAT, schema: BACKUP_SCHEMA, exportedAt: new Date().toISOString(),
    project: { id: String(p.id), name: String(p.name), code: String(p.code) },
    tables,
  }
}

export class BackupError extends Error {}

// Checks shape only; every value must be a plain string, number or null
function validate(b: any): asserts b is ProjectBackup {
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) throw new BackupError('This is not an ExtraOver project backup file')
  if (typeof b.schema !== 'number' || b.schema > BACKUP_SCHEMA) throw new BackupError('This backup was made by a newer version of ExtraOver')
  if (!b.tables || typeof b.tables !== 'object') throw new BackupError('The backup file is missing its data')
  if (!Array.isArray(b.tables.projects) || b.tables.projects.length !== 1) throw new BackupError('The backup file must contain exactly one project')
  let n = 0
  for (const [t, rows] of Object.entries<any>(b.tables)) {
    if (!TABLES.some(x => x.table === t)) continue
    if (!Array.isArray(rows)) throw new BackupError(`Table ${t} is malformed`)
    n += rows.length
    for (const r of rows) {
      if (!r || typeof r !== 'object' || Array.isArray(r) || typeof r.id !== 'string') throw new BackupError(`A row in ${t} is malformed`)
      for (const v of Object.values(r)) {
        if (v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') throw new BackupError(`A value in ${t} is malformed`)
      }
    }
  }
  if (n > MAX_ROWS) throw new BackupError('The backup file is too large to restore')
}

export async function restoreProjectBackup(
  raw: unknown, ownerUserId: string, userName: string,
): Promise<{ id: string; name: string; rows: number; skipped: number }> {
  validate(raw)
  const b = raw

  // Current schema, so we only write columns this database has
  const columns: Record<string, Set<string>> = {}
  for (const { table } of TABLES) {
    const info = await db.execute(`PRAGMA table_info(${table})`)
    columns[table] = new Set(info.rows.map((r: any) => String(r.name)))
  }

  // New id for every row in the file, so links can be remapped in any order
  const newId = new Map<string, string>()
  for (const { table } of TABLES) for (const r of b.tables[table] ?? []) newId.set(String(r.id), cuid())
  const projectId = newId.get(String(b.tables.projects[0].id))!

  const stmts: { sql: string; args: Value[] }[] = []
  let skipped = 0
  for (const { table } of TABLES) {
    let rows = (b.tables[table] ?? []) as Row[]
    // Forecast lines nest under parent lines: parents first
    if (table === 'forecast_lines') rows = parentsFirst(rows)
    for (const src of rows) {
      const row: Row = {}
      for (const [col, v] of Object.entries(src)) {
        if (!columns[table].has(col)) continue
        const val: Value = typeof v === 'boolean' ? (v ? 1 : 0) : v
        if (col === 'id') row.id = newId.get(String(val))!
        else if (col === 'project_id') row.project_id = projectId
        else if (LINK_COLUMNS.includes(col)) row[col] = val == null ? null : newId.get(String(val)) ?? null
        else row[col] = val
      }
      if (columns[table].has('project_id')) row.project_id = projectId
      if ((REQUIRED_LINKS[table] ?? []).some(c => row[c] == null)) { skipped++; continue }
      if (table === 'projects') {
        row.name = `${src.name} (restored)`
        row.created_at = row.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19)
      }
      const cols = Object.keys(row)
      stmts.push({ sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, args: cols.map(c => row[c]) })
    }
  }

  stmts.push({ sql: `INSERT INTO user_projects (id, user_id, project_id, role) VALUES (?,?,?,'owner')`, args: [cuid(), ownerUserId, projectId] })
  stmts.push({
    sql: `INSERT INTO audit_log (id, project_id, category, action, record_label, field, old_value, new_value, user_name)
          VALUES (?,?,'Project','Created','Restored from backup',NULL,NULL,?,?)`,
    args: [cuid(), projectId, `${b.project.name} exported ${b.exportedAt.slice(0, 10)}`, userName],
  })

  await db.batch(stmts, 'write')
  return { id: projectId, name: `${b.tables.projects[0].name} (restored)`, rows: stmts.length - 2, skipped }
}

function parentsFirst(rows: Row[]): Row[] {
  const ids = new Set(rows.map(r => String(r.id)))
  const done = new Set<string>(), out: Row[] = []
  let pending = rows
  while (pending.length) {
    const next: Row[] = []
    for (const r of pending) {
      const parent = r.parent_id == null ? null : String(r.parent_id)
      if (!parent || !ids.has(parent) || done.has(parent)) { out.push(r); done.add(String(r.id)) }
      else next.push(r)
    }
    if (next.length === pending.length) { out.push(...next); break }   // cycle: let the FK decide
    pending = next
  }
  return out
}
