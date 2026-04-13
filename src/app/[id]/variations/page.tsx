import { initDB, db } from '@/lib/db'
import VariationsClient from './VariationsClient'
export const dynamic = 'force-dynamic'

export default async function VariationsPage({ params }: { params: { id: string } }) {
  await initDB()
  const r = await db.execute({
    sql: `SELECT * FROM variations WHERE project_id=? ORDER BY ref`,
    args: [params.id],
  })
  return <VariationsClient variations={r.rows as any[]} projectId={params.id} />
}
