import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const r = await db.execute({
    sql: `SELECT * FROM s_curve_rows WHERE project_id=? ORDER BY sort_order`,
    args: [params.id],
  })
  return NextResponse.json(r.rows)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { rows } = await req.json()
  await db.execute({ sql: `DELETE FROM s_curve_rows WHERE project_id=?`, args: [params.id] })
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    await db.execute({
      sql: `INSERT INTO s_curve_rows VALUES (?,?,?,?,?,?,?,?)`,
      args: [r.id || cuid(), params.id, r.month_label, r.month_date || new Date().toISOString().slice(0,10),
             i, r.cumul_claimed || 0, r.cumul_certified || 0, r.cumul_cost || 0],
    })
  }
  return NextResponse.json({ ok: true })
}
