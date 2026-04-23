import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const result = await db.execute({
    sql: `SELECT * FROM cost_codes WHERE project_id = ? ORDER BY code`,
    args: [params.id],
  })
  return NextResponse.json(result.rows)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const body = await req.json()
  const id = cuid()
  await db.execute({
    sql: `INSERT INTO cost_codes VALUES (?,?,?,?,?,?,?)`,
    args: [id, params.id, body.code, body.description, body.trade, body.category, body.notes ?? null],
  })
  return NextResponse.json({ id })
}
