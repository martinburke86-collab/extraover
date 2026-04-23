import { getDashboardKPIs, getTradeSummaries } from '@/lib/calculations'
import { initDB, db } from '@/lib/db'
import { runHealthChecks } from '@/lib/healthCheck'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ params }: { params: { id: string } }) {
  await initDB()

  const [kpis, trades] = await Promise.all([
    getDashboardKPIs(params.id),
    getTradeSummaries(params.id),
  ])

  // Extras for health check
  const projR = await db.execute({ sql: 'SELECT gifa FROM projects WHERE id=?', args: [params.id] })
  const gifa = Number((projR.rows[0] as any)?.gifa) || 0

  const lockedR = await db.execute({
    sql: 'SELECT COUNT(*) as n FROM report_periods WHERE project_id=? AND locked_at IS NOT NULL',
    args: [params.id],
  })
  const lockedPeriods = Number((lockedR.rows[0] as any)?.n) || 0

  const varsR = await db.execute({
    sql: 'SELECT COUNT(*) as n FROM variations WHERE project_id=?',
    args: [params.id],
  })
  const variationCount = Number((varsR.rows[0] as any)?.n) || 0

  const healthIssues = runHealthChecks(kpis, trades, params.id, { gifa, lockedPeriods, variationCount })

  // All locked period snapshots for trend chart — ordered oldest first
  const trendR = await db.execute({
    sql: `SELECT rp.label, rp.period_date, ps.efc, ps.forecast_margin, ps.total_ctd, ps.total_claimed
          FROM period_snapshots ps
          JOIN report_periods rp ON ps.period_id = rp.id
          WHERE rp.project_id = ?
          ORDER BY rp.period_date ASC`,
    args: [params.id],
  })

  const trendData = (trendR.rows as any[]).map(r => ({
    label:          String(r.label),
    efc:            Number(r.efc)            || 0,
    forecastMargin: Number(r.forecast_margin)|| 0,
    totalCtd:       Number(r.total_ctd)      || 0,
    totalClaimed:   Number(r.total_claimed)  || 0,
  }))

  // Append current period as the final "live" point
  const adjustedSum = kpis.contractSum + kpis.approvedVars
  trendData.push({
    label:          'Current',
    efc:            kpis.efc,
    forecastMargin: adjustedSum - kpis.efc,
    totalCtd:       kpis.actualsTotal,
    totalClaimed:   kpis.totalClaimed,
  })

  return (
    <DashboardClient
      kpis={kpis}
      trades={trades}
      projectId={params.id}
      healthIssues={healthIssues}
      trendData={trendData}
      adjustedSum={adjustedSum}
    />
  )
}
