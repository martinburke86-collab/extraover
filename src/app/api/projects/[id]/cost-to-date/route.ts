import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const result = await db.execute({
    sql: `SELECT cl.*, cc.code, cc.description, cc.trade, cc.category
          FROM cost_lines cl
          JOIN cost_codes cc ON cl.cost_code_id = cc.id
          WHERE cl.project_id = ?
          ORDER BY cc.trade, cc.code`,
    args: [params.id],
  })
  return NextResponse.json(result.rows)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const ccResult = await db.execute({
    sql: `SELECT id FROM cost_codes WHERE project_id=? AND code=?`,
    args: [params.id, b.code],
  })
  const ccId = ccResult.rows[0]?.id
  if (!ccId) return NextResponse.json({ error: 'Cost code not found' }, { status: 400 })
  const id = cuid()
  await db.execute({
    sql: `INSERT INTO cost_lines VALUES (?,?,?,?,?,?,?,?)`,
    args: [id, params.id, b.periodId ?? null, ccId, b.postedCost ?? 0, b.accruals ?? 0, b.subRecon ?? 0, b.notes ?? null],
  })
  return NextResponse.json({ id })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  await db.execute({
    sql: `UPDATE cost_lines SET posted_cost=?, accruals=?, sub_recon=?, notes=? WHERE id=? AND project_id=?`,
    args: [b.postedCost ?? 0, b.accruals ?? 0, b.subRecon ?? 0, b.notes ?? null, b.lineId, params.id],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { lineId } = await req.json()
  await db.execute({ sql: `DELETE FROM cost_lines WHERE id=? AND project_id=?`, args: [lineId, params.id] })
  return NextResponse.json({ ok: true })
}
