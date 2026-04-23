import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { getDashboardKPIs, getTradeSummaries } from '@/lib/calculations'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const [kpis, trades] = await Promise.all([
    getDashboardKPIs(params.id),
    getTradeSummaries(params.id),
  ])

  const tradePL: Record<string, { projPL: number; efc: number }> = {}
  for (const t of trades) {
    tradePL[t.trade] = { projPL: t.projectedPL, efc: t.efc }
  }

  // Get or create current period
  const periodResult = await db.execute({
    sql: `SELECT id FROM report_periods WHERE project_id=? AND is_current=1 LIMIT 1`,
    args: [params.id],
  })
  let periodId = periodResult.rows[0]?.id as string | undefined
  if (!periodId) {
    periodId = cuid()
    await db.execute({
      sql: `INSERT INTO report_periods VALUES (?,?,?,datetime('now'),1,NULL)`,
      args: [periodId, params.id, 'Current Period'],
    })
  }

  // Delete existing snapshot for this period and re-create
  await db.execute({ sql: `DELETE FROM period_snapshots WHERE period_id=?`, args: [periodId] })
  await db.execute({
    sql: `INSERT INTO period_snapshots VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [cuid(), periodId, kpis.efc, kpis.forecastMargin, kpis.actualsTotal,
           kpis.totalClaimed, kpis.cashPosition, kpis.overUnderClaim,
           JSON.stringify(tradePL)],
  })

  // Mark period as locked
  await db.execute({
    sql: `UPDATE report_periods SET locked_at=datetime('now') WHERE id=?`,
    args: [periodId],
  })

  return NextResponse.json({
    ok: true,
    snapshot: { efc: kpis.efc, forecastMargin: kpis.forecastMargin, totalCTD: kpis.actualsTotal },
  })
}
