import { getDashboardKPIs, getTradeSummaries } from '@/lib/calculations'
import { initDB } from '@/lib/db'
import { fmt, pct } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ params }: { params: { id: string } }) {
  await initDB()
  const [kpis, trades] = await Promise.all([
    getDashboardKPIs(params.id),
    getTradeSummaries(params.id),
  ])
  return <DashboardClient kpis={kpis} trades={trades} projectId={params.id} />
}
