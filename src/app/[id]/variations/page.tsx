import { initDB, db } from '@/lib/db'
import VariationsClient from './VariationsClient'
import { requireProjectRole } from '@/lib/pageAuth'
export const dynamic = 'force-dynamic'

export default async function VariationsPage({ params }: { params: { id: string } }) {
  const role = await requireProjectRole(params.id, 'viewer')
  await initDB()
  const r = await db.execute({
    sql: `SELECT * FROM variations WHERE project_id=? ORDER BY ref`,
    args: [params.id],
  })
  const vars = (r.rows as any[]).map(v => ({
    id:              String(v.id),
    ref:             String(v.ref),
    description:     String(v.description || ''),
    status:          String(v.status || 'Instructed'),
    instructed_by:   v.instructed_by  ? String(v.instructed_by)  : null,
    category:        v.category       ? String(v.category)       : null,
    date_instructed: v.date_instructed? String(v.date_instructed): null,
    date_submitted:  v.date_submitted ? String(v.date_submitted) : null,
    date_approved:   v.date_approved  ? String(v.date_approved)  : null,
    income_value:    Number(v.income_value)  || 0,
    cost_estimate:   Number(v.cost_estimate) || 0,
    cost_actual:     Number(v.cost_actual)   || 0,
    pct_complete:    Number(v.pct_complete)  || 0,
    notes:           v.notes ? String(v.notes) : null,
  }))
  return <VariationsClient variations={vars} projectId={params.id} role={role} />
}
