import { requireProjectRole } from '@/lib/pageAuth'
import { initDB, db } from '@/lib/db'
import SubcontractorsClient from './SubcontractorsClient'
export const dynamic = 'force-dynamic'

export default async function SubcontractorsPage({ params }: { params: { id: string } }) {
  await requireProjectRole(params.id, 'editor')
  await initDB()
  const [codesR, varsR, projR, vpR] = await Promise.all([
    db.execute({ sql: `SELECT id, code, description, trade FROM cost_codes WHERE project_id=? ORDER BY code`, args: [params.id] }),
    db.execute({ sql: `SELECT id, ref, description FROM variations WHERE project_id=? ORDER BY ref`, args: [params.id] }),
    db.execute({ sql: `SELECT retention_pct FROM projects WHERE id=?`, args: [params.id] }),
    db.execute({ sql: `SELECT cumul_certified FROM value_periods WHERE project_id=? LIMIT 1`, args: [params.id] }),
  ])
  const retPct = Number((projR.rows[0] as any)?.retention_pct ?? 3)
  const certified = Number((vpR.rows[0] as any)?.cumul_certified ?? 0)
  const employerRetention = certified * retPct / 100

  return <SubcontractorsClient
    projectId={params.id}
    costCodes={codesR.rows as any[]}
    variations={varsR.rows as any[]}
    employerRetention={employerRetention}
  />
}
