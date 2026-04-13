import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const result = await db.execute({
    sql: `SELECT f.*, cc.code, cc.description, cc.trade, cc.category
          FROM forecast_lines f
          JOIN cost_codes cc ON f.cost_code_id = cc.id
          WHERE f.project_id = ?
          ORDER BY f.sort_order, f.id`,
    args: [params.id],
  })
  return NextResponse.json(result.rows)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()

  // Get cost code id
  const ccResult = await db.execute({
    sql: `SELECT id FROM cost_codes WHERE project_id=? AND code=?`,
    args: [params.id, b.code],
  })
  const ccId = ccResult.rows[0]?.id
  if (!ccId) return NextResponse.json({ error: 'Cost code not found' }, { status: 400 })

  const maxOrder = await db.execute({
    sql: `SELECT MAX(sort_order) as m FROM forecast_lines WHERE project_id=? AND (parent_id IS NULL OR parent_id=?)`,
    args: [params.id, b.parentId ?? null],
  })
  const nextOrder = (Number((maxOrder.rows[0] as any)?.m) || 0) + 1

  const total = calcTotal(b.factor, b.quantity, b.rate)
  const id = cuid()
  await db.execute({
    sql: `INSERT INTO forecast_lines VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, params.id, ccId, b.parentId ?? null, nextOrder,
           b.supplier ?? null, b.status ?? 'Estimate',
           b.factor ?? null, b.quantity ?? null, b.unit ?? null, b.rate ?? null, total, b.comment ?? null],
  })
  return NextResponse.json({ id })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const total = calcTotal(b.factor, b.quantity, b.rate)
  await db.execute({
    sql: `UPDATE forecast_lines SET supplier=?, status=?, factor=?, quantity=?, unit=?, rate=?, total=?, comment=?
          WHERE id=? AND project_id=?`,
    args: [b.supplier ?? null, b.status, b.factor ?? null, b.quantity ?? null,
           b.unit ?? null, b.rate ?? null, total, b.comment ?? null, b.lineId, params.id],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { lineId } = await req.json()
  // Delete children first
  await db.execute({ sql: `DELETE FROM forecast_lines WHERE parent_id=? AND project_id=?`, args: [lineId, params.id] })
  await db.execute({ sql: `DELETE FROM forecast_lines WHERE id=? AND project_id=?`, args: [lineId, params.id] })
  return NextResponse.json({ ok: true })
}

function calcTotal(factor?: number | null, quantity?: number | null, rate?: number | null): number {
  if (factor && quantity && rate) return factor * quantity * rate
  if (quantity && rate) return quantity * rate
  if (rate) return rate
  return 0
}
