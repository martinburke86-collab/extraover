import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const r = await db.execute({
    sql: `SELECT * FROM variations WHERE project_id=? ORDER BY ref`,
    args: [params.id],
  })
  return NextResponse.json(r.rows)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const id = cuid()
  await db.execute({
    sql: `INSERT INTO variations VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, params.id, b.ref, b.description, b.status || 'Submitted',
           b.date_submitted || null, b.date_approved || null,
           b.income_value || 0, b.cost_estimate || 0, b.cost_actual || 0,
           b.notes || null],
  })
  return NextResponse.json({ id })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  await db.execute({
    sql: `UPDATE variations SET ref=?,description=?,status=?,date_submitted=?,date_approved=?,
          income_value=?,cost_estimate=?,cost_actual=?,notes=?
          WHERE id=? AND project_id=?`,
    args: [b.ref, b.description, b.status, b.date_submitted || null, b.date_approved || null,
           b.income_value || 0, b.cost_estimate || 0, b.cost_actual || 0,
           b.notes || null, b.id, params.id],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { id } = await req.json()
  await db.execute({ sql: `DELETE FROM variations WHERE id=? AND project_id=?`, args: [id, params.id] })
  return NextResponse.json({ ok: true })
}
