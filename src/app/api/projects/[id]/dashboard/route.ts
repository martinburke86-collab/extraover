import { NextResponse } from 'next/server'
import { initDB, db } from '@/lib/db'
import { getDashboardKPIs, getTradeSummaries, getVariationCodedSummaries, getPrelimItems } from '@/lib/calculations'
import { runHealthChecks } from '@/lib/healthCheck'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const [kpis, trades] = await Promise.all([
    getDashboardKPIs(params.id),
    getTradeSummaries(params.id),
  ])

  const varsR = await db.execute({
    sql: 'SELECT COUNT(*) as n FROM variations WHERE project_id=?', args: [params.id] })
  const lockedR = await db.execute({
    sql: `SELECT COUNT(*) as n FROM report_periods WHERE project_id=? AND locked_at IS NOT NULL`, args: [params.id] })
  const variationsCoded = await getVariationCodedSummaries(params.id)
  const prelimItems = await getPrelimItems(params.id)
  const prelimsTrade = trades.find(t => t.trade.toLowerCase().startsWith('prelim'))
  const prelims = {
    detailBudget: prelimItems.reduce((s, i) => s + i.budget, 0),
    detailPFC:    prelimItems.reduce((s, i) => s + i.projected_final_cost, 0),
    tradeMethod:  prelimsTrade ? prelimsTrade.forecastMethod : null,
  }

  const healthIssues = runHealthChecks(kpis, trades, params.id, {
    lockedPeriods: Number((lockedR.rows[0] as any)?.n) || 0,
    variationCount: Number((varsR.rows[0] as any)?.n) || 0,
    variationsCoded, prelims,
  })

  return NextResponse.json({ kpis, trades, healthIssues })
}
