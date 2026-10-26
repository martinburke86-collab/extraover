import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { getPrelimItems, getTradeSummaries, getPrelimsReconciliation } from '@/lib/calculations'
import { requireProjectApi } from '@/lib/apiAuth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'viewer')
  if (!guard.ok) return guard.res
  await initDB()
  const [items, projR, trades] = await Promise.all([
    getPrelimItems(params.id),
    db.execute({ sql: 'SELECT revised_start, revised_finish FROM projects WHERE id=?', args: [params.id] }),
    getTradeSummaries(params.id),
  ])
  const recon = await getPrelimsReconciliation(params.id, trades)
  const p = projR.rows[0] as any
  let weeksElapsed = 0, totalWeeks = 0
  if (p?.revised_start) {
    const start  = new Date(p.revised_start)
    const finish = p.revised_finish ? new Date(p.revised_finish) : new Date()
    const today  = new Date()
    weeksElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)))
    totalWeeks   = Math.ceil((finish.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
  }
  return NextResponse.json({ items, weeksElapsed, totalWeeks, sheetOnly: recon.sheetOnly, unlisted: recon.unlisted })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const b = await req.json()
  const id = cuid()
  const maxOrd = await db.execute({
    sql: 'SELECT MAX(sort_order) as m FROM prelim_items WHERE project_id=?', args: [params.id],
  })
  const nextOrder = (Number((maxOrd.rows[0] as any)?.m) || 0) + 1
  // CTD and Committed come from the lines on the item's cost code, so the
  // stored columns are only written as 0 (pre-v49 rows may still hold values)
  await db.execute({
    sql: `INSERT INTO prelim_items (id, project_id, section, cost_code, description, budget, ctd, committed, qty, unit, rate, utilisation_pct, start_week, finish_week, sort_order, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, params.id, b.section || 'General', b.cost_code || null, b.description,
      b.budget || 0, 0, 0,
      b.qty ?? 1, b.unit || 'Weeks', b.rate || 0, b.utilisation_pct ?? 100,
      b.start_week || 1, b.finish_week || 1, nextOrder, b.notes || null],
  })
  return NextResponse.json({ id })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const b = await req.json()
  await db.execute({
    sql: `UPDATE prelim_items SET section=?,cost_code=?,description=?,budget=?,
            qty=?,unit=?,rate=?,utilisation_pct=?,start_week=?,finish_week=?,notes=?
          WHERE id=? AND project_id=?`,
    args: [b.section, b.cost_code || null, b.description,
      b.budget || 0,
      b.qty ?? 1, b.unit || 'Weeks', b.rate || 0, b.utilisation_pct ?? 100,
      b.start_week || 1, b.finish_week || 1, b.notes || null,
      b.id, params.id],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const { id } = await req.json()
  await db.execute({ sql: 'DELETE FROM prelim_items WHERE id=? AND project_id=?', args: [id, params.id] })
  return NextResponse.json({ ok: true })
}
