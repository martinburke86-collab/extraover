import { getSession } from '@/lib/getSession'
import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import { auditChanges, auditMoney } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()

  const old = await db.execute({
    sql: `SELECT name, contract_sum, approved_vars, original_budget, original_margin, gifa FROM projects WHERE id=?`,
    args: [params.id],
  })
  const o = old.rows[0] as any

  await db.execute({
    sql: `UPDATE projects SET name=?, code=?, client=?, contract_type=?, prepared_by=?,
          contract_sum=?, approved_vars=?, original_budget=?, original_margin=?,
          contract_start=?, contract_finish=?, revised_start=?, revised_finish=?,
          gifa=?, terminology=COALESCE(?, terminology), updated_at=datetime('now') WHERE id=?`,
    args: [b.name, b.code, b.client, b.contractType, b.preparedBy,
           b.contractSum, b.approvedVars, b.originalBudget, b.originalMargin,
           b.contractStart || null, b.contractFinish || null,
           b.revisedStart  || null, b.revisedFinish  || null,
           b.gifa || 0,
           b.terminology ?? null,
           params.id],
  })

  if (o) {
    const _session = await getSession()
    const userName = _session?.name ?? 'Unknown'
    await auditChanges(params.id, 'Settings', 'Project settings', [
      { field: 'Contract sum',     old: auditMoney(Number(o.contract_sum)),     next: auditMoney(b.contractSum) },
      { field: 'Approved vars',    old: auditMoney(Number(o.approved_vars)),    next: auditMoney(b.approvedVars) },
      { field: 'Original budget',  old: auditMoney(Number(o.original_budget)),  next: auditMoney(b.originalBudget) },
      { field: 'Target margin',    old: auditMoney(Number(o.original_margin)),  next: auditMoney(b.originalMargin) },
      { field: 'GIFA',             old: o.gifa ? String(Number(o.gifa)) + ' m²' : '—', next: b.gifa ? String(b.gifa) + ' m²' : '—' },
    ], userName)
  }

  return NextResponse.json({ ok: true })
}
