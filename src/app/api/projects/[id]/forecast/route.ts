import { getSession } from '@/lib/getSession'
import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { writeAudit, auditChanges, auditMoney } from '@/lib/audit'

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

  const ccResult = await db.execute({
    sql: `SELECT id, code, description FROM cost_codes WHERE project_id=? AND code=?`,
    args: [params.id, b.code],
  })
  const cc = ccResult.rows[0] as any
  if (!cc) return NextResponse.json({ error: 'Cost code not found' }, { status: 400 })

  const maxOrder = await db.execute({
    sql: `SELECT MAX(sort_order) as m FROM forecast_lines WHERE project_id=? AND (parent_id IS NULL OR parent_id=?)`,
    args: [params.id, b.parentId ?? null],
  })
  const nextOrder = (Number((maxOrder.rows[0] as any)?.m) || 0) + 1

  const total = calcTotal(b.factor, b.quantity, b.rate)
  const id = cuid()
  await db.execute({
    sql: `INSERT INTO forecast_lines VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, params.id, cc.id, b.parentId ?? null, nextOrder,
           b.supplier ?? null, b.status ?? 'Estimate',
           b.factor ?? null, b.quantity ?? null, b.unit ?? null, b.rate ?? null, total, b.comment ?? null],
  })

  await writeAudit(params.id, 'Forecast', 'Created',
    `${cc.code} · ${b.supplier || cc.description}`,
    'Total', null, auditMoney(total))

  return NextResponse.json({ id })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const total = calcTotal(b.factor, b.quantity, b.rate)

  // Read old values
  const old = await db.execute({
    sql: `SELECT f.total, f.status, f.supplier, cc.code, cc.description
          FROM forecast_lines f JOIN cost_codes cc ON f.cost_code_id=cc.id
          WHERE f.id=? AND f.project_id=?`,
    args: [b.lineId, params.id],
  })
  const o = old.rows[0] as any

  await db.execute({
    sql: `UPDATE forecast_lines SET supplier=?, status=?, factor=?, quantity=?, unit=?, rate=?, total=?, comment=?
          WHERE id=? AND project_id=?`,
    args: [b.supplier ?? null, b.status, b.factor ?? null, b.quantity ?? null,
           b.unit ?? null, b.rate ?? null, total, b.comment ?? null, b.lineId, params.id],
  })

  if (o) {
    const _session = await getSession()
    const userName = _session?.name ?? 'Unknown'
  await auditChanges(params.id, 'Forecast', `${o.code} · ${o.supplier || o.description}`, [
      { field: 'Total',  old: auditMoney(Number(o.total)),  next: auditMoney(total) },
      { field: 'Status', old: String(o.status || ''),       next: String(b.status || '') },
    ], userName)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { lineId } = await req.json()

  const old = await db.execute({
    sql: `SELECT f.total, f.supplier, cc.code, cc.description
          FROM forecast_lines f JOIN cost_codes cc ON f.cost_code_id=cc.id
          WHERE f.id=?`,
    args: [lineId],
  })
  const o = old.rows[0] as any

  await db.execute({ sql: `DELETE FROM forecast_lines WHERE parent_id=? AND project_id=?`, args: [lineId, params.id] })
  await db.execute({ sql: `DELETE FROM forecast_lines WHERE id=? AND project_id=?`, args: [lineId, params.id] })

  if (o) await writeAudit(params.id, 'Forecast', 'Deleted',
    `${o.code} · ${o.supplier || o.description}`, 'Total', auditMoney(Number(o.total)), null)

  return NextResponse.json({ ok: true })
}

function calcTotal(factor?: number | null, quantity?: number | null, rate?: number | null): number {
  if (factor && quantity && rate) return factor * quantity * rate
  if (quantity && rate) return quantity * rate
  if (rate) return rate
  return 0
}
