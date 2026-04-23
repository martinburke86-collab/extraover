import { initDB, db } from './db'

async function migrate() {
  await initDB()  // creates prelim_items table

  // Add new columns to trades if not present
  for (const col of [
    `ALTER TABLE trades ADD COLUMN forecast_method TEXT DEFAULT 'budget_remaining'`,
    `ALTER TABLE trades ADD COLUMN forecast_hard_key REAL`,
  ]) {
    try { await db.execute(col) } catch {}
  }

  // Update existing trades to budget_remaining default
  await db.execute(`UPDATE trades SET forecast_method='budget_remaining' WHERE forecast_method IS NULL`)

  const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table'`)
  console.log('Tables:', tables.rows.map((r: any) => r.name).join(', '))

  const trades = await db.execute(`SELECT name, forecast_method FROM trades LIMIT 5`)
  console.log('Trades sample:', trades.rows)

  console.log('✅ Migration complete')
}

migrate().catch(console.error)
