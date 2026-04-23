import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

export async function GET() {
  await initDB()
  const r = await db.execute('SELECT * FROM global_elements ORDER BY sort_order, name')
  return NextResponse.json(r.rows)
}

export async function POST(req: Request) {
  await initDB()
  const { name } = await req.json()
  const maxOrd = await db.execute('SELECT MAX(sort_order) as m FROM global_elements')
  const nextOrder = (Number((maxOrd.rows[0] as any)?.m) || 0) + 1
  const id = cuid()
  await db.execute({ sql: `INSERT INTO global_elements VALUES (?,?,?)`, args: [id, name.trim(), nextOrder] })
  return NextResponse.json({ id })
}

export async function DELETE(req: Request) {
  await initDB()
  const { id } = await req.json()
  await db.execute({ sql: `DELETE FROM global_elements WHERE id=?`, args: [id] })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  await initDB()
  const { id, name } = await req.json()
  await db.execute({ sql: `UPDATE global_elements SET name=? WHERE id=?`, args: [name.trim(), id] })
  return NextResponse.json({ ok: true })
}
