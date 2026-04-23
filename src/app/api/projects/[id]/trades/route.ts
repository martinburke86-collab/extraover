import { getSession } from '@/lib/getSession'
import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import { auditChanges, writeAudit, auditMoney } from '@/lib/audit'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const result = await db.execute({
    sql: `SELECT * FROM trades WHERE project_id = ? ORDER BY sort_order`,
    args: [params.id],
  })
  return NextResponse.json(result.rows)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { tradeId, valueCertified, varsNotAgreed, adjustments,
          forecastMethod, forecastHardKey, budget, name } = await req.json()

  const old = await db.execute({
    sql: `SELECT name, budget, value_certified, vars_not_agreed, forecast_method, forecast_hard_key FROM trades WHERE id=? AND project_id=?`,
    args: [tradeId, params.id],
  })
  const o = old.rows[0] as any

  const oldName = String(o?.name ?? '')
  const newName = name ?? oldName

  await db.execute({
    sql: `UPDATE trades SET
            name=?,
            value_certified=?, vars_not_agreed=?, adjustments=?,
            budget=?, forecast_method=?, forecast_hard_key=?
          WHERE id=? AND project_id=?`,
    args: [
      newName,
      valueCertified ?? 0, varsNotAgreed ?? 0, adjustments ?? 0,
      budget ?? 0, forecastMethod ?? 'budget_remaining', forecastHardKey ?? null,
      tradeId, params.id,
    ],
  })

  // CASCADE rename to cost_codes — this is the critical step that keeps
  // CTD/Committed/Forecast aggregations working after a trade rename
  if (newName !== oldName && oldName) {
    await db.execute({
      sql: `UPDATE cost_codes SET trade=? WHERE project_id=? AND trade=?`,
      args: [newName, params.id, oldName],
    })
  }

  if (o) {
    const session  = await getSession()
    const userName = session?.name ?? 'Unknown'
    await auditChanges(params.id, 'CVR Trade', newName, [
      { field: 'Trade name',       old: oldName,                               next: newName },
      { field: 'Budget',           old: auditMoney(Number(o.budget)),           next: auditMoney(budget ?? 0) },
      { field: 'Val certified',    old: auditMoney(Number(o.value_certified)),  next: auditMoney(valueCertified ?? 0) },
      { field: 'Vars not agreed',  old: auditMoney(Number(o.vars_not_agreed)),  next: auditMoney(varsNotAgreed ?? 0) },
      { field: 'Forecast method',  old: String(o.forecast_method ?? ''),        next: String(forecastMethod ?? '') },
    ], userName)
  }

  return NextResponse.json({ ok: true })
}
