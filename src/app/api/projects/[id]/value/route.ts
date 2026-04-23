import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { getSession } from '@/lib/getSession'
import { auditChanges, auditMoney } from '@/lib/audit'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const body    = await req.json()
  const session = await getSession()
  const userName = session?.name ?? 'Unknown'

  // Fetch previous values for audit
  const prevR = await db.execute({
    sql: `SELECT cumul_claimed, cumul_certified, revenue_received, total_paid, risk_value, opportunity_value
          FROM value_periods WHERE project_id=? LIMIT 1`,
    args: [params.id],
  })
  const prev = prevR.rows[0] as any

  const existing = await db.execute({
    sql: `SELECT id FROM value_periods WHERE project_id=? LIMIT 1`,
    args: [params.id],
  })

  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE value_periods SET cumul_claimed=?, cumul_certified=?, front_loading=?,
            unapproved_claims=?, other_adjustments=?, revenue_received=?, total_paid=?,
            risk_value=?, opportunity_value=?, app_ref=? WHERE project_id=?`,
      args: [body.cumul_claimed, body.cumul_certified, body.front_loading,
             body.unapproved_claims, body.other_adjustments, body.revenue_received,
             body.total_paid, body.risk_value, body.opportunity_value,
             body.app_ref || null, params.id],
    })
  } else {
    await db.execute({
      sql: `INSERT INTO value_periods (id, project_id, period_id, cumul_claimed, cumul_certified,
            front_loading, unapproved_claims, other_adjustments, revenue_received, total_paid,
            risk_value, opportunity_value, app_ref) VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?,?)`,
      args: [cuid(), params.id, body.cumul_claimed, body.cumul_certified, body.front_loading,
             body.unapproved_claims, body.other_adjustments, body.revenue_received,
             body.total_paid, body.risk_value, body.opportunity_value, body.app_ref || null],
    })
  }

  // Audit changes
  if (prev) {
    await auditChanges(params.id, 'Value / Claims', 'Application', [
      { field: 'Cumulative claimed',   old: auditMoney(Number(prev.cumul_claimed)),    next: auditMoney(body.cumul_claimed) },
      { field: 'Cumulative certified', old: auditMoney(Number(prev.cumul_certified)),  next: auditMoney(body.cumul_certified) },
      { field: 'Revenue received',     old: auditMoney(Number(prev.revenue_received)), next: auditMoney(body.revenue_received) },
      { field: 'Total paid',           old: auditMoney(Number(prev.total_paid)),       next: auditMoney(body.total_paid) },
    ], userName)
  }

  return NextResponse.json({ ok: true })
}
