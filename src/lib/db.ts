import { createClient } from '@libsql/client'
import path from 'path'

// Use Turso hosted DB in production, local SQLite in development
const isProduction = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN

export const db = createClient(
  isProduction
    ? {
        url:       process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      }
    : {
        url: `file:${path.join(process.cwd(), 'cvr.db')}`,
      }
)

export async function initDB() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      client TEXT,
      contract_type TEXT,
      prepared_by TEXT,
      contract_sum REAL DEFAULT 0,
      approved_vars REAL DEFAULT 0,
      original_budget REAL DEFAULT 0,
      original_margin REAL DEFAULT 0,
      gifa REAL DEFAULT 0,
      contract_start TEXT,
      contract_finish TEXT,
      revised_start TEXT,
      revised_finish TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cost_codes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL,
      trade TEXT NOT NULL,
      category TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, code)
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code_prefix TEXT,
      sort_order INTEGER DEFAULT 0,
      value_certified REAL DEFAULT 0,
      vars_not_agreed REAL DEFAULT 0,
      adjustments REAL DEFAULT 0,
      forecast_method TEXT DEFAULT 'budget_remaining',
      forecast_hard_key REAL,
      budget REAL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, name)
    );

    CREATE TABLE IF NOT EXISTS cost_lines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      period_id TEXT,
      cost_code_id TEXT NOT NULL,
      posted_cost REAL DEFAULT 0,
      accruals REAL DEFAULT 0,
      sub_recon REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (cost_code_id) REFERENCES cost_codes(id)
    );

    CREATE TABLE IF NOT EXISTS committed_lines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      cost_code_id TEXT NOT NULL,
      supplier TEXT,
      description TEXT,
      status TEXT DEFAULT 'Placed',
      quantity REAL,
      unit TEXT,
      unit_rate REAL,
      total REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (cost_code_id) REFERENCES cost_codes(id)
    );

    CREATE TABLE IF NOT EXISTS forecast_lines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      cost_code_id TEXT NOT NULL,
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0,
      supplier TEXT,
      status TEXT DEFAULT 'Estimate',
      factor REAL,
      quantity REAL,
      unit TEXT,
      rate REAL,
      total REAL DEFAULT 0,
      comment TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (cost_code_id) REFERENCES cost_codes(id),
      FOREIGN KEY (parent_id) REFERENCES forecast_lines(id)
    );

    CREATE TABLE IF NOT EXISTS value_periods (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      period_id TEXT,
      cumul_claimed REAL DEFAULT 0,
      cumul_certified REAL DEFAULT 0,
      front_loading REAL DEFAULT 0,
      unapproved_claims REAL DEFAULT 0,
      other_adjustments REAL DEFAULT 0,
      revenue_received REAL DEFAULT 0,
      total_paid REAL DEFAULT 0,
      risk_value REAL DEFAULT 0,
      opportunity_value REAL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS report_periods (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      label TEXT NOT NULL,
      period_date TEXT NOT NULL,
      is_current INTEGER DEFAULT 0,
      locked_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS period_snapshots (
      id TEXT PRIMARY KEY,
      period_id TEXT UNIQUE NOT NULL,
      efc REAL,
      forecast_margin REAL,
      total_ctd REAL,
      total_claimed REAL,
      cash_position REAL,
      over_under_claim REAL,
      trade_pl TEXT,
      FOREIGN KEY (period_id) REFERENCES report_periods(id)
    );

    CREATE TABLE IF NOT EXISTS prelim_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      section TEXT NOT NULL DEFAULT 'General',
      cost_code TEXT,
      description TEXT NOT NULL,
      budget REAL DEFAULT 0,
      ctd REAL DEFAULT 0,
      committed REAL DEFAULT 0,
      qty REAL DEFAULT 1,
      unit TEXT DEFAULT 'Weeks',
      rate REAL DEFAULT 0,
      utilisation_pct REAL DEFAULT 100,
      start_week INTEGER DEFAULT 1,
      finish_week INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

        CREATE TABLE IF NOT EXISTS s_curve_rows (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      month_label TEXT NOT NULL,
      month_date TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      cumul_claimed REAL DEFAULT 0,
      cumul_certified REAL DEFAULT 0,
      cumul_cost REAL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS variations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      ref TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'Submitted',
      date_submitted TEXT,
      date_approved TEXT,
      income_value REAL DEFAULT 0,
      cost_estimate REAL DEFAULT 0,
      cost_actual REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS global_elements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS global_trades (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS breakdowns (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      parent_type TEXT NOT NULL,
      parent_field TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      description TEXT,
      qty REAL DEFAULT 1,
      unit TEXT DEFAULT 'nr',
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      cost_code TEXT,
      trade TEXT,
      element TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      hashed_password TEXT NOT NULL,
      global_role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(user_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      category TEXT NOT NULL,
      action TEXT NOT NULL,
      record_label TEXT,
      field TEXT,
      old_value TEXT,
      new_value TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

  `)
  await runMigrations()
}

export function cuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Run lightweight column migrations on every cold start
export async function runMigrations() {
  const cols = [
    `ALTER TABLE projects ADD COLUMN gifa REAL DEFAULT 0`,
    `ALTER TABLE variations ADD COLUMN instructed_by TEXT`,
    `ALTER TABLE variations ADD COLUMN category TEXT`,
    `ALTER TABLE variations ADD COLUMN date_instructed TEXT`,
    `ALTER TABLE variations ADD COLUMN pct_complete REAL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS cashflow_bands (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      trade_name TEXT NOT NULL,
      start_date TEXT,
      finish_date TEXT,
      s_curve_shape INTEGER DEFAULT 3,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, trade_name)
    )`,
    `ALTER TABLE value_periods ADD COLUMN app_ref TEXT`,
    `ALTER TABLE projects ADD COLUMN earned_value_pct REAL DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN cashflow_income_lag INTEGER DEFAULT 1`,
    `ALTER TABLE cashflow_bands ADD COLUMN s_curve_shape INTEGER DEFAULT 3`,
    `ALTER TABLE audit_log ADD COLUMN user_name TEXT`,
    `ALTER TABLE projects ADD COLUMN terminology TEXT`,
    `ALTER TABLE prelim_items ADD COLUMN stage TEXT NOT NULL DEFAULT 'Construction'`,
    `CREATE TABLE IF NOT EXISTS cashflow_month_overrides (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      trade_name TEXT NOT NULL,
      month TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, trade_name, month)
    )`,
    `CREATE TABLE IF NOT EXISTS cashflow_income_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      label TEXT NOT NULL,
      month TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, label, month)
    )`,
  ]
  for (const sql of cols) {
    try { await db.execute(sql) } catch {}
  }
}

// ── Prelims table (add to initDB) ─────────────────────────────────────────
export async function initPrelimsTable() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS prelim_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'Construction',
      section TEXT,
      description TEXT NOT NULL,
      cost_code TEXT,
      budget REAL DEFAULT 0,
      cost_to_date REAL DEFAULT 0,
      committed REAL DEFAULT 0,
      utilisation REAL DEFAULT 1,
      qty REAL,
      unit TEXT,
      rate REAL,
      start_wk INTEGER,
      finish_wk INTEGER,
      comments TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS variations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      ref TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'Submitted',
      date_submitted TEXT,
      date_approved TEXT,
      income_value REAL DEFAULT 0,
      cost_estimate REAL DEFAULT 0,
      cost_actual REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS global_elements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS global_trades (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS breakdowns (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      parent_type TEXT NOT NULL,
      parent_field TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      description TEXT,
      qty REAL DEFAULT 1,
      unit TEXT DEFAULT 'nr',
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      cost_code TEXT,
      trade TEXT,
      element TEXT,
      notes TEXT
    );

  `)
}
