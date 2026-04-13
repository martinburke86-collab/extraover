import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const body = await req.json()
  const existing = await db.execute({
    sql: `SELECT id FROM value_periods WHERE project_id=? LIMIT 1`,
    args: [params.id],
  })
  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE value_periods SET cumul_claimed=?, cumul_certified=?, front_loading=?,
            unapproved_claims=?, other_adjustments=?, revenue_received=?, total_paid=?,
            risk_value=?, opportunity_value=? WHERE project_id=?`,
      args: [body.cumul_claimed, body.cumul_certified, body.front_loading,
             body.unapproved_claims, body.other_adjustments, body.revenue_received,
             body.total_paid, body.risk_value, body.opportunity_value, params.id],
    })
  } else {
    await db.execute({
      sql: `INSERT INTO value_periods VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?)`,
      args: [cuid(), params.id, body.cumul_claimed, body.cumul_certified, body.front_loading,
             body.unapproved_claims, body.other_adjustments, body.revenue_received,
             body.total_paid, body.risk_value, body.opportunity_value],
    })
  }
  return NextResponse.json({ ok: true })
}
