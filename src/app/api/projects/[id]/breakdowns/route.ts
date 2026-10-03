import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { requireProjectApi } from '@/lib/apiAuth'

// breakdowns has no project_id; ownership comes from the parent line
const PARENT_TABLE: Record<string, string> = {
  forecast:  'forecast_lines',
  committed: 'committed_lines',
  prelim:    'prelim_items',
  ctd:       'cost_lines',
}

async function parentInProject(parentId: unknown, parentType: unknown, projectId: string) {
  const table = PARENT_TABLE[String(parentType)]
  if (!table || !parentId) return false
  const r = await db.execute({
    sql: `SELECT 1 FROM ${table} WHERE id=? AND project_id=?`,
    args: [String(parentId), projectId],
  })
  return r.rows.length > 0
}

async function rowInProject(rowId: unknown, projectId: string) {
  if (!rowId) return false
  const r = await db.execute({ sql: `SELECT parent_id, parent_type FROM breakdowns WHERE id=?`, args: [String(rowId)] })
  const row = r.rows[0] as any
  return !!row && parentInProject(row.parent_id, row.parent_type, projectId)
}

const notFound = () => NextResponse.json({ error: 'Breakdown not found' }, { status: 404 })

// GET /api/projects/[id]/breakdowns?parentId=xxx&parentType=forecast&parentField=total
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'viewer')
  if (!guard.ok) return guard.res
  await initDB()
  const { searchParams } = new URL(req.url)
  const parentId    = searchParams.get('parentId')
  const parentType  = searchParams.get('parentType')
  const parentField = searchParams.get('parentField')

  if (!parentId || !parentType || !parentField) {
    return NextResponse.json({ error: 'Missing parentId, parentType or parentField' }, { status: 400 })
  }
  // Unknown or other-project parent reads as "no breakdown", revealing nothing
  if (!(await parentInProject(parentId, parentType, params.id))) {
    return NextResponse.json({ rows: [], total: 0 })
  }

  const rows = await db.execute({
    sql: `SELECT * FROM breakdowns WHERE parent_id=? AND parent_type=? AND parent_field=? ORDER BY sort_order`,
    args: [parentId, parentType, parentField],
  })

  const total = (rows.rows as any[]).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  return NextResponse.json({ rows: rows.rows, total })
}

// POST — add a row
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const b = await req.json()
  if (!(await parentInProject(b.parentId, b.parentType, params.id))) return notFound()
  const id = cuid()
  const amount = (Number(b.qty) || 0) * (Number(b.rate) || 0)

  const maxOrd = await db.execute({
    sql: `SELECT MAX(sort_order) as m FROM breakdowns WHERE parent_id=? AND parent_type=? AND parent_field=?`,
    args: [b.parentId, b.parentType, b.parentField],
  })
  const nextOrder = (Number((maxOrd.rows[0] as any)?.m) || 0) + 1

  await db.execute({
    sql: `INSERT INTO breakdowns VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, b.parentId, b.parentType, b.parentField, nextOrder,
           b.description || null, b.qty ?? 1, b.unit || 'nr',
           b.rate || 0, amount, b.cost_code || null, b.trade || null,
           b.element || null, b.notes || null],
  })
  return NextResponse.json({ id, amount })
}

// PATCH — update a row
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const b = await req.json()
  if (!(await rowInProject(b.id, params.id))) return notFound()
  const amount = (Number(b.qty) || 0) * (Number(b.rate) || 0)
  await db.execute({
    sql: `UPDATE breakdowns SET description=?,qty=?,unit=?,rate=?,amount=?,cost_code=?,trade=?,element=?,notes=? WHERE id=?`,
    args: [b.description || null, b.qty ?? 1, b.unit || 'nr',
           b.rate || 0, amount, b.cost_code || null, b.trade || null,
           b.element || null, b.notes || null, b.id],
  })
  return NextResponse.json({ ok: true, amount })
}

// DELETE — remove a row
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const { id } = await req.json()
  if (!(await rowInProject(id, params.id))) return notFound()
  await db.execute({ sql: `DELETE FROM breakdowns WHERE id=?`, args: [id] })
  return NextResponse.json({ ok: true })
}
