import { initDB, db } from '@/lib/db'
import { getDashboardKPIs, getTradeSummaries } from '@/lib/calculations'
import { runHealthChecks } from '@/lib/healthCheck'
import { getSession } from '@/lib/getSession'
import { redirect } from 'next/navigation'
import PortfolioClient from './PortfolioClient'
export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  await initDB()

  const session = await getSession()
  if (!session) redirect('/login')

  const userId     = session.userId
  const globalRole = session.globalRole

  // All projects
  const projsR = await db.execute('SELECT * FROM projects ORDER BY created_at DESC')
  let projects = projsR.rows as any[]

  // Non-owners only see their assigned projects
  if (globalRole !== 'owner') {
    const assignR = await db.execute({
      sql:  'SELECT project_id FROM user_projects WHERE user_id=?',
      args: [userId],
    })
    const allowed = new Set((assignR.rows as any[]).map(r => String(r.project_id)))
    projects = projects.filter(p => allowed.has(String(p.id)))
  }

  if (projects.length === 0) redirect('/new-project')

  // Batch extras in a few queries (avoids N×3 individual queries)
  const ids = projects.map(p => p.id)
  const placeholders = ids.map(() => '?').join(',')

  const [lockedR, varsR, periodR] = await Promise.all([
    db.execute({
      sql: `SELECT project_id, COUNT(*) as n FROM report_periods
            WHERE project_id IN (${placeholders}) AND locked_at IS NOT NULL
            GROUP BY project_id`,
      args: ids,
    }),
    db.execute({
      sql: `SELECT project_id, COUNT(*) as n FROM variations
            WHERE project_id IN (${placeholders}) GROUP BY project_id`,
      args: ids,
    }),
    db.execute({
      sql: `SELECT project_id, label FROM report_periods
            WHERE project_id IN (${placeholders}) AND is_current=1`,
      args: ids,
    }),
  ])

  const lockedMap: Record<string, number> = {}
  const varsMap:   Record<string, number> = {}
  const periodMap: Record<string, string> = {}
  lockedR.rows.forEach((r: any) => { lockedMap[r.project_id] = Number(r.n) })
  varsR.rows.forEach((r: any)   => { varsMap[r.project_id]   = Number(r.n) })
  periodR.rows.forEach((r: any) => { periodMap[r.project_id] = String(r.label) })

  // Fetch KPIs for every project in parallel
  const summaries = await Promise.all(projects.map(async (proj) => {
    try {
      const [kpis, trades] = await Promise.all([
        getDashboardKPIs(proj.id),
        getTradeSummaries(proj.id),
      ])
      const issues = runHealthChecks(kpis, trades, proj.id, {
        gifa:           Number(proj.gifa) || 0,
        lockedPeriods:  lockedMap[proj.id] || 0,
        variationCount: varsMap[proj.id]   || 0,
      })
      return {
        id:            proj.id as string,
        name:          String(proj.name || ''),
        code:          String(proj.code || ''),
        client:        String(proj.client || ''),
        contractSum:   Number(proj.contract_sum)    || 0,
        approvedVars:  Number(proj.approved_vars)   || 0,
        originalMargin:Number(proj.original_margin) || 0,
        efc:           kpis.efc,
        adjustedSum:   kpis.adjustedSum,
        forecastMargin:kpis.forecastMargin,
        forecastPct:   kpis.forecastMarginPct,
        totalCtd:      kpis.actualsTotal,
        cashPosition:  kpis.cashPosition,
        periodLabel:   periodMap[proj.id] || '',
        issueCount:    issues.length,
        errorCount:    issues.filter(i => i.severity === 'error').length,
        issues:        issues.map(i => ({
          id: i.id, severity: i.severity, title: i.title, href: i.href,
        })),
      }
    } catch {
      return {
        id: proj.id as string,
        name: String(proj.name || ''),
        code: String(proj.code || ''),
        client: String(proj.client || ''),
        contractSum: Number(proj.contract_sum) || 0,
        approvedVars: 0, originalMargin: 0,
        efc: 0, adjustedSum: 0, forecastMargin: 0, forecastPct: 0,
        totalCtd: 0, cashPosition: 0,
        periodLabel: periodMap[proj.id] || '',
        issueCount: 1, errorCount: 1,
        issues: [{ id: 'load-error', severity: 'error' as const, title: 'Could not load project data', href: 'settings' }],
      }
    }
  }))

  return <PortfolioClient summaries={summaries} />
}
