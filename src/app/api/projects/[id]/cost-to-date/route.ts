import { getSession } from '@/lib/getSession'
import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { writeAudit, auditChanges, auditMoney } from '@/lib/audit'
import { requireProjectApi } from '@/lib/apiAuth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'viewer')
  if (!guard.ok) return guard.res
  await initDB()
  const result = await db.execute({
    sql: `SELECT cl.*, cc.code, cc.description, cc.trade, cc.category, v.ref as variation_ref
          FROM cost_lines cl
          JOIN cost_codes cc ON cl.cost_code_id = cc.id
          LEFT JOIN variations v ON cl.variation_id = v.id
          WHERE cl.project_id = ?
          ORDER BY cc.trade, cc.code`,
    args: [params.id],
  })
  return NextResponse.json(result.rows)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const b = await req.json()
  const ccResult = await db.execute({
    sql: `SELECT id, code, description FROM cost_codes WHERE project_id=? AND code=?`,
    args: [params.id, b.code],
  })
  const cc = ccResult.rows[0] as any
  if (!cc) return NextResponse.json({ error: 'Cost code not found' }, { status: 400 })
  const id = cuid()
  await db.execute({
    sql: `INSERT INTO cost_lines
            (id, project_id, period_id, cost_code_id, posted_cost, accruals, sub_recon, notes, variation_id)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [id, params.id, b.periodId ?? null, cc.id, b.postedCost ?? 0, b.accruals ?? 0, b.subRecon ?? 0, b.notes ?? null, b.variationId ?? null],
  })
  await writeAudit(params.id, 'CTD', 'Created', `${cc.code} · ${cc.description}`,
    'Total', null, auditMoney((b.postedCost ?? 0) + (b.accruals ?? 0) + (b.subRecon ?? 0)))
  return NextResponse.json({ id })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const b = await req.json()

  // Read old values for audit
  const old = await db.execute({
    sql: `SELECT cl.posted_cost, cl.accruals, cl.sub_recon, cl.variation_id, cc.code, cc.description
          FROM cost_lines cl JOIN cost_codes cc ON cl.cost_code_id=cc.id
          WHERE cl.id=? AND cl.project_id=?`,
    args: [b.lineId, params.id],
  })
  const o = old.rows[0] as any

  // variationId: undefined = leave unchanged, null = clear, string = set
  const variationId = b.variationId === undefined ? (o?.variation_id ?? null) : (b.variationId || null)

  await db.execute({
    sql: `UPDATE cost_lines SET posted_cost=?, accruals=?, sub_recon=?, notes=?, variation_id=? WHERE id=? AND project_id=?`,
    args: [b.postedCost ?? 0, b.accruals ?? 0, b.subRecon ?? 0, b.notes ?? null, variationId, b.lineId, params.id],
  })

  if (o) {
    const label = `${o.code} · ${o.description}`
    const _session = await getSession()
    const userName = _session?.name ?? 'Unknown'
  await auditChanges(params.id, 'CTD', label, [
      { field: 'Posted cost',  old: auditMoney(Number(o.posted_cost)), next: auditMoney(b.postedCost ?? 0) },
      { field: 'Accruals',     old: auditMoney(Number(o.accruals)),    next: auditMoney(b.accruals ?? 0) },
      { field: 'Sub recon',    old: auditMoney(Number(o.sub_recon)),   next: auditMoney(b.subRecon ?? 0) },
    ], userName)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const { lineId } = await req.json()
  const old = await db.execute({
    sql: `SELECT cc.code, cc.description FROM cost_lines cl JOIN cost_codes cc ON cl.cost_code_id=cc.id WHERE cl.id=?`,
    args: [lineId],
  })
  const o = old.rows[0] as any
  await db.execute({ sql: `DELETE FROM cost_lines WHERE id=? AND project_id=?`, args: [lineId, params.id] })
  if (o) await writeAudit(params.id, 'CTD', 'Deleted', `${o.code} · ${o.description}`)
  return NextResponse.json({ ok: true })
}
