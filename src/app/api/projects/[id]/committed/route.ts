import { getSession } from '@/lib/getSession'
import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { writeAudit, auditChanges, auditMoney } from '@/lib/audit'

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
    sql: `SELECT id, code, description FROM cost_codes WHERE project_id=? AND code=?`,
    args: [params.id, b.code],
  })
  const cc = ccResult.rows[0] as any
  if (!cc) return NextResponse.json({ error: 'Cost code not found' }, { status: 400 })
  const total = b.quantity && b.unitRate ? b.quantity * b.unitRate : (b.total ?? 0)
  const id = cuid()
  await db.execute({
    sql: `INSERT INTO committed_lines VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, params.id, cc.id, b.supplier ?? null, b.description ?? null,
           b.status ?? 'Placed', b.quantity ?? null, b.unit ?? null, b.unitRate ?? null, total, b.notes ?? null],
  })
  await writeAudit(params.id, 'Committed', 'Created',
    `${cc.code} · ${b.supplier || b.description || ''}`, 'Total', null, auditMoney(total))
  return NextResponse.json({ id })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const total = b.quantity && b.unitRate ? b.quantity * b.unitRate : (b.total ?? 0)

  const old = await db.execute({
    sql: `SELECT c.total, c.status, c.supplier, cc.code, cc.description
          FROM committed_lines c JOIN cost_codes cc ON c.cost_code_id=cc.id
          WHERE c.id=? AND c.project_id=?`,
    args: [b.lineId, params.id],
  })
  const o = old.rows[0] as any

  await db.execute({
    sql: `UPDATE committed_lines SET supplier=?, description=?, status=?, quantity=?, unit=?, unit_rate=?, total=?, notes=?
          WHERE id=? AND project_id=?`,
    args: [b.supplier ?? null, b.description ?? null, b.status, b.quantity ?? null,
           b.unit ?? null, b.unitRate ?? null, total, b.notes ?? null, b.lineId, params.id],
  })

  if (o) {
    const _session = await getSession()
    const userName = _session?.name ?? 'Unknown'
  await auditChanges(params.id, 'Committed', `${o.code} · ${o.supplier || o.description || ''}`, [
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
    sql: `SELECT c.total, c.supplier, cc.code, cc.description
          FROM committed_lines c JOIN cost_codes cc ON c.cost_code_id=cc.id
          WHERE c.id=?`,
    args: [lineId],
  })
  const o = old.rows[0] as any
  await db.execute({ sql: `DELETE FROM committed_lines WHERE id=? AND project_id=?`, args: [lineId, params.id] })
  if (o) await writeAudit(params.id, 'Committed', 'Deleted',
    `${o.code} · ${o.supplier || o.description || ''}`, 'Total', auditMoney(Number(o.total)), null)
  return NextResponse.json({ ok: true })
}
