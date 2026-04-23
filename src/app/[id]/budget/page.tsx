import { initDB, db } from '@/lib/db'
import { getTradeSummaries } from '@/lib/calculations'
import { requireProjectRole } from '@/lib/pageAuth'
import BudgetClient from './BudgetClient'
export const dynamic = 'force-dynamic'

export default async function BudgetPage({ params }: { params: { id: string } }) {
  const role = await requireProjectRole(params.id, 'editor')
  await initDB()

  const [trades, projR] = await Promise.all([
    getTradeSummaries(params.id),
    db.execute({ sql: 'SELECT * FROM projects WHERE id=?', args: [params.id] }),
  ])

  // Also get raw trade IDs so we can save budgets
  const tradesR = await db.execute({
    sql: 'SELECT id, name, budget, sort_order, code_prefix FROM trades WHERE project_id=? ORDER BY sort_order',
    args: [params.id],
  })

  const proj = projR.rows[0] as any

  // Merge EFC/CTD from calculations with raw trade rows
  const rows = (tradesR.rows as any[]).map(t => {
    const summary = trades.find(s => s.trade === t.name)
    return {
      id:         String(t.id),
      name:       String(t.name),
      budget:     Number(t.budget) || 0,
      sortOrder:  Number(t.sort_order) || 0,
      codePrefix: String(t.code_prefix || ''),
      efc:        summary?.efc        ?? 0,
      totalCTD:   summary?.totalCTD   ?? 0,
      committed:  summary?.committed  ?? 0,
      uncommitted: summary?.uncommitted ?? 0,
    }
  })

  return (
    <BudgetClient
      rows={rows}
      projectId={params.id}
      role={role}
      contractSum={Number(proj?.contract_sum) || 0}
      approvedVars={Number(proj?.approved_vars) || 0}
      originalBudget={Number(proj?.original_budget) || 0}
    />
  )
}
