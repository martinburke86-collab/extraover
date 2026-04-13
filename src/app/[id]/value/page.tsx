import { initDB, db } from '@/lib/db'
import ValueClient from './ValueClient'
export const dynamic = 'force-dynamic'

export default async function ValuePage({ params }: { params: { id: string } }) {
  await initDB()
  const [vpResult, projResult] = await Promise.all([
    db.execute({
      sql: `SELECT * FROM value_periods WHERE project_id=? ORDER BY rowid DESC LIMIT 1`,
      args: [params.id],
    }),
    db.execute({ sql: `SELECT * FROM projects WHERE id=?`, args: [params.id] }),
  ])
  const vp   = vpResult.rows[0] as any
  const proj = projResult.rows[0] as any
  return <ValueClient vp={vp} proj={proj} projectId={params.id} />
}
