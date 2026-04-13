import { initDB, db } from '@/lib/db'
import CommittedClient from './CommittedClient'
export const dynamic = 'force-dynamic'

export default async function CommittedPage({ params }: { params: { id: string } }) {
  await initDB()
  const [linesResult, codesResult] = await Promise.all([
    db.execute({
      sql: `SELECT c.*, cc.code, cc.description, cc.trade, cc.category
            FROM committed_lines c JOIN cost_codes cc ON c.cost_code_id = cc.id
            WHERE c.project_id=? ORDER BY cc.trade, cc.code`,
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT code, description, trade, category FROM cost_codes WHERE project_id=? ORDER BY code`,
      args: [params.id],
    }),
  ])
  return <CommittedClient lines={linesResult.rows as any[]} costCodes={codesResult.rows as any[]} projectId={params.id} />
}
