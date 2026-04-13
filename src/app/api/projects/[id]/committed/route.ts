import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const result = await db.execute({
    sql: `SELECT c.*, cc.code, cc.description, cc.trade, cc.category
          FROM committed_lines c
          JOIN cost_codes cc ON c.cost_code_id = cc.id
          WHERE c.project_id = ?
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
  const total = b.quantity && b.unitRate ? b.quantity * b.unitRate : (b.total ?? 0)
  const id = cuid()
  await db.execute({
    sql: `INSERT INTO committed_lines VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, params.id, ccId, b.supplier ?? null, b.description ?? null,
           b.status ?? 'Placed', b.quantity ?? null, b.unit ?? null, b.unitRate ?? null, total, b.notes ?? null],
  })
  return NextResponse.json({ id })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const total = b.quantity && b.unitRate ? b.quantity * b.unitRate : (b.total ?? 0)
  await db.execute({
    sql: `UPDATE committed_lines SET supplier=?, description=?, status=?, quantity=?, unit=?, unit_rate=?, total=?, notes=?
          WHERE id=? AND project_id=?`,
    args: [b.supplier ?? null, b.description ?? null, b.status, b.quantity ?? null,
           b.unit ?? null, b.unitRate ?? null, total, b.notes ?? null, b.lineId, params.id],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { lineId } = await req.json()
  await db.execute({ sql: `DELETE FROM committed_lines WHERE id=? AND project_id=?`, args: [lineId, params.id] })
  return NextResponse.json({ ok: true })
}
