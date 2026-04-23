import { requireProjectRole } from '@/lib/pageAuth'
import { initDB, db } from '@/lib/db'
import ForecastClient from './ForecastClient'

export const dynamic = 'force-dynamic'

export default async function ForecastPage({ params }: { params: { id: string } }) {
  await requireProjectRole(params.id, 'editor')
  await initDB()
  const [linesResult, codesResult] = await Promise.all([
    db.execute({
      sql: `SELECT f.*, cc.code as cc_code, cc.description as cc_desc, cc.trade, cc.category
            FROM forecast_lines f
            JOIN cost_codes cc ON f.cost_code_id = cc.id
            WHERE f.project_id = ? ORDER BY f.sort_order, f.id`,
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT code, description, trade, category FROM cost_codes WHERE project_id = ? ORDER BY code`,
      args: [params.id],
    }),
  ])
  return (
    <ForecastClient
      lines={linesResult.rows as any[]}
      costCodes={codesResult.rows as any[]}
      projectId={params.id}
    />
  )
}
