import { initDB, db } from '@/lib/db'
import SettingsClient from './SettingsClient'
export const dynamic = 'force-dynamic'

export default async function SettingsPage({ params }: { params: { id: string } }) {
  await initDB()
  const r = await db.execute({ sql: `SELECT * FROM projects WHERE id=?`, args: [params.id] })
  const trades = await db.execute({
    sql: `SELECT * FROM trades WHERE project_id=? ORDER BY sort_order`,
    args: [params.id],
  })
  return <SettingsClient project={r.rows[0] as any} trades={trades.rows as any[]} projectId={params.id} />
}
