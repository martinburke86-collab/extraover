import { requireProjectRole } from '@/lib/pageAuth'
import { initDB, db } from '@/lib/db'
import AuditClient from './AuditClient'
export const dynamic = 'force-dynamic'

export default async function AuditPage({ params }: { params: { id: string } }) {
  await requireProjectRole(params.id, 'editor')
  await initDB()
  const r = await db.execute({
    sql: `SELECT * FROM audit_log WHERE project_id=? ORDER BY created_at DESC LIMIT 300`,
    args: [params.id],
  })
  const entries = (r.rows as any[]).map(row => ({
    id:          String(row.id),
    createdAt:   String(row.created_at),
    category:    String(row.category),
    action:      String(row.action),
    recordLabel: row.record_label ? String(row.record_label) : null,
    field:       row.field        ? String(row.field)        : null,
    oldValue:    row.old_value    ? String(row.old_value)    : null,
    newValue:    row.new_value    ? String(row.new_value)    : null,
    userName:    row.user_name    ? String(row.user_name)    : null,
  }))
  return <AuditClient entries={entries} projectId={params.id} />
}
