import { initDB, db } from '@/lib/db'
import CTDClient from './CTDClient'
export const dynamic = 'force-dynamic'

export default async function CTDPage({ params }: { params: { id: string } }) {
  await initDB()
  const [linesResult, codesResult] = await Promise.all([
    db.execute({
      sql: `SELECT cl.*, cc.code, cc.description, cc.trade, cc.category
            FROM cost_lines cl JOIN cost_codes cc ON cl.cost_code_id = cc.id
            WHERE cl.project_id=? ORDER BY cc.trade, cc.code`,
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT code, description, trade, category FROM cost_codes WHERE project_id=? ORDER BY code`,
      args: [params.id],
    }),
  ])
  return <CTDClient lines={linesResult.rows as any[]} costCodes={codesResult.rows as any[]} projectId={params.id} />
}
