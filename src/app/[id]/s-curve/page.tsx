import { initDB, db } from '@/lib/db'
import { getDashboardKPIs } from '@/lib/calculations'
import SCurveClient from './SCurveClient'
export const dynamic = 'force-dynamic'

export default async function SCurvePage({ params }: { params: { id: string } }) {
  await initDB()
  const [rowsResult, kpis] = await Promise.all([
    db.execute({
      sql: `SELECT * FROM s_curve_rows WHERE project_id=? ORDER BY sort_order`,
      args: [params.id],
    }),
    getDashboardKPIs(params.id),
  ])
  return <SCurveClient rows={rowsResult.rows as any[]} kpis={kpis} projectId={params.id} />
}
