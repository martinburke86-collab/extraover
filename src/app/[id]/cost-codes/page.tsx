import { initDB, db } from '@/lib/db'
import CostCodesClient from './CostCodesClient'
export const dynamic = 'force-dynamic'

export default async function CostCodesPage({ params }: { params: { id: string } }) {
  await initDB()
  const [codesResult, tradesResult] = await Promise.all([
    db.execute({ sql: `SELECT * FROM cost_codes WHERE project_id=? ORDER BY code`, args: [params.id] }),
    db.execute({ sql: `SELECT DISTINCT name FROM trades WHERE project_id=? ORDER BY sort_order`, args: [params.id] }),
  ])
  return (
    <CostCodesClient
      codes={codesResult.rows as any[]}
      trades={tradesResult.rows.map((r: any) => r.name)}
      projectId={params.id}
    />
  )
}
