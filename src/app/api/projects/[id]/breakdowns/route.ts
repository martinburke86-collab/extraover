import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

// GET /api/projects/[id]/breakdowns?parentId=xxx&parentType=forecast&parentField=total
export async function GET(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { searchParams } = new URL(req.url)
  const parentId    = searchParams.get('parentId')
  const parentType  = searchParams.get('parentType')
  const parentField = searchParams.get('parentField')

  if (!parentId || !parentType || !parentField) {
    return NextResponse.json({ error: 'Missing parentId, parentType or parentField' }, { status: 400 })
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
  await initDB()
  const b = await req.json()
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
  await initDB()
  const b = await req.json()
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
  await initDB()
  const { id } = await req.json()
  await db.execute({ sql: `DELETE FROM breakdowns WHERE id=?`, args: [id] })
  return NextResponse.json({ ok: true })
}
