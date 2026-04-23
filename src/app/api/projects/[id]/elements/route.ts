import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import * as XLSX from 'xlsx'

// GET — list all trades for this project
export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const r = await db.execute({
    sql: 'SELECT * FROM trades WHERE project_id=? ORDER BY sort_order',
    args: [params.id],
  })
  return NextResponse.json(r.rows)
}

// POST — upload CSV/XLSX to add/replace elements (trades)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const formData  = await req.formData()
  const file      = formData.get('file') as File
  const mode      = String(formData.get('mode') ?? 'add') // 'add' | 'replace'

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buf  = Buffer.from(await file.arrayBuffer())
  const wb   = XLSX.read(buf, { type: 'buffer' })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

  // Normalise keys
  const norm = rows.map(r =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [
      k.toString().trim().toLowerCase().replace(/[\s\/\-\(\)%]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''),
      v,
    ]))
  )

  const inserted: string[] = []
  const updated:  string[] = []
  const errors:   string[] = []

  if (mode === 'replace') {
    await db.execute({ sql: 'DELETE FROM trades WHERE project_id=?', args: [params.id] })
  }

  // Get existing trades to check for duplicates
  const existingR = await db.execute({
    sql: 'SELECT id, name FROM trades WHERE project_id=?',
    args: [params.id],
  })
  const existingMap = new Map((existingR.rows as any[]).map(r => [String(r.name).toLowerCase(), String(r.id)]))

  let sortOrder = (existingR.rows as any[]).length

  for (let i = 0; i < norm.length; i++) {
    const row = norm[i]

    // Accept Name, Element, Trade as the primary name column
    const name = String(row.name || row.element || row.trade || row.section || '').trim()
    if (!name) { errors.push(`Row ${i + 2}: missing name`); continue }

    const budget    = parseFloat(String(row.budget     || row.total || 0))   || 0
    const sortVal   = parseInt(String(row.sort_order   || row.sort  || 0))   || sortOrder
    const code      = String(row.code_prefix || row.code || '').trim()

    const existing = existingMap.get(name.toLowerCase())
    if (existing && mode === 'add') {
      // Update budget only
      await db.execute({
        sql: 'UPDATE trades SET budget=? WHERE id=?',
        args: [budget || 0, existing],
      })
      updated.push(name)
    } else if (!existing) {
      const id = cuid()
      await db.execute({
        sql: `INSERT INTO trades (id, project_id, name, code_prefix, sort_order,
              value_certified, vars_not_agreed, adjustments, forecast_method, forecast_hard_key, budget)
              VALUES (?,?,?,?,?,0,0,0,'budget_remaining',NULL,?)`,
        args: [id, params.id, name, code, sortVal || sortOrder, budget],
      })
      inserted.push(name)
      sortOrder++
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: inserted.length,
    updated:  updated.length,
    errors,
    total: norm.length,
  })
}

// PATCH — update a single trade's budget
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { tradeId, budget, name, sortOrder } = await req.json()

  if (name) {
    const oldR = await db.execute({ sql: 'SELECT name FROM trades WHERE id=? AND project_id=?', args: [tradeId, params.id] })
    const oldName = String((oldR.rows[0] as any)?.name ?? '')
    await db.execute({
      sql: 'UPDATE trades SET name=?, sort_order=?, budget=? WHERE id=? AND project_id=?',
      args: [name, sortOrder ?? 0, budget ?? 0, tradeId, params.id],
    })
    // Cascade name change to cost_codes so CTD/Committed/Forecast joins stay intact
    if (name !== oldName && oldName) {
      await db.execute({
        sql: 'UPDATE cost_codes SET trade=? WHERE project_id=? AND trade=?',
        args: [name, params.id, oldName],
      })
    }
  } else {
    await db.execute({
      sql: 'UPDATE trades SET budget=? WHERE id=? AND project_id=?',
      args: [budget ?? 0, tradeId, params.id],
    })
  }
  return NextResponse.json({ ok: true })
}

// DELETE — remove a trade element
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { tradeId } = await req.json()
  await db.execute({
    sql: 'DELETE FROM trades WHERE id=? AND project_id=?',
    args: [tradeId, params.id],
  })
  return NextResponse.json({ ok: true })
}
