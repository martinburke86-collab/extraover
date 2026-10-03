import { NextResponse } from 'next/server'
import { initDB, db } from '@/lib/db'
import { getDashboardKPIs, getTradeSummaries, getVariationCodedSummaries, getPrelimItems } from '@/lib/calculations'
import { runHealthChecks } from '@/lib/healthCheck'
import { requireProjectApi } from '@/lib/apiAuth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'viewer')
  if (!guard.ok) return guard.res
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

  const subsCheckR = await db.execute({
    sql: `SELECT s.name, s.tax_clearance_expiry,
                 COALESCE(MAX(c.gross_cumulative), 0) as certified,
                 COALESCE(s.order_value,
                   (SELECT SUM(total) FROM committed_lines cl WHERE cl.project_id = s.project_id AND cl.supplier = s.name), 0) as order_value
          FROM subcontractors s
          LEFT JOIN sub_certs c ON c.subcontractor_id = s.id
          WHERE s.project_id=? GROUP BY s.id`,
    args: [params.id],
  })
  const today = new Date().toISOString().slice(0, 10)
  const subs = (subsCheckR.rows as any[]).map(r => ({
    name: String(r.name),
    certified: Number(r.certified) || 0,
    orderValue: Number(r.order_value) || 0,
    overCertified: (Number(r.order_value) || 0) > 0 && (Number(r.certified) || 0) > (Number(r.order_value) || 0) + 1,
    taxExpired: !!r.tax_clearance_expiry && String(r.tax_clearance_expiry) < today,
  }))

  const healthIssues = runHealthChecks(kpis, trades, params.id, {
    lockedPeriods: Number((lockedR.rows[0] as any)?.n) || 0,
    variationCount: Number((varsR.rows[0] as any)?.n) || 0,
    variationsCoded, prelims, subs,
  })

  return NextResponse.json({ kpis, trades, healthIssues })
}
