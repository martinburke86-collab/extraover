import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: { id: string; codeId: string } }) {
  await initDB()
  const b = await req.json()
  await db.execute({
    sql: `UPDATE cost_codes SET code=?, description=?, trade=?, category=?, notes=? WHERE id=? AND project_id=?`,
    args: [b.code, b.description, b.trade, b.category, b.notes ?? null, params.codeId, params.id],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: { id: string; codeId: string } }) {
  await initDB()
  await db.execute({
    sql: `DELETE FROM cost_codes WHERE id=? AND project_id=?`,
    args: [params.codeId, params.id],
  })
  return NextResponse.json({ ok: true })
}
