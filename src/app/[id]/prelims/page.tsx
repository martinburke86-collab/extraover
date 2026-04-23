import { requireProjectRole } from '@/lib/pageAuth'
import { initDB, db } from '@/lib/db'
import { getPrelimItems } from '@/lib/calculations'
import PrelimsClient from './PrelimsClient'
export const dynamic = 'force-dynamic'

export default async function PrelimsPage({ params }: { params: { id: string } }) {
  await requireProjectRole(params.id, 'editor')
  await initDB()
  const [items, projR] = await Promise.all([
    getPrelimItems(params.id),
    db.execute({ sql: 'SELECT * FROM projects WHERE id=?', args: [params.id] }),
  ])
  const p = projR.rows[0] as any
  let weeksElapsed = 0, totalWeeks = 0
  if (p?.revised_start) {
    const start  = new Date(p.revised_start)
    const finish = p.revised_finish ? new Date(p.revised_finish) : new Date()
    const today  = new Date()
    weeksElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)))
    totalWeeks   = Math.max(1, Math.ceil((finish.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)))
  }
  return (
    <PrelimsClient
      items={items}
      weeksElapsed={weeksElapsed}
      totalWeeks={totalWeeks}
      projectId={params.id}
      revisedStart={p?.revised_start ?? ''}
      revisedFinish={p?.revised_finish ?? ''}
    />
  )
}
