import { initDB, db } from '@/lib/db'
import { getDashboardKPIs, getTradeSummaries } from '@/lib/calculations'
import { requireProjectRole } from '@/lib/pageAuth'
import SCurveClient from './SCurveClient'
export const dynamic = 'force-dynamic'

const INCOME_LABELS = ['Income - Contract', 'Rent', 'Land Sale', 'Other Income']
const MANUAL_INCOME_LABELS = ['Rent', 'Land Sale', 'Other Income'] // Income-Contract is auto-calculated

export default async function SCurvePage({ params }: { params: { id: string } }) {
  const role = await requireProjectRole(params.id, 'viewer')
  await initDB()  // runs all migrations including cashflow_income_lag

  // Run sequentially so any table-missing error surfaces clearly
  const rowsResult = await db.execute({ sql: `SELECT * FROM s_curve_rows WHERE project_id=? ORDER BY sort_order`, args: [params.id] })
  const kpis       = await getDashboardKPIs(params.id)
  const trades     = await getTradeSummaries(params.id)
  const projR      = await db.execute({ sql: `SELECT revised_start, revised_finish, original_margin, contract_sum, approved_vars, cashflow_income_lag FROM projects WHERE id=?`, args: [params.id] })
  const bandsR     = await db.execute({ sql: `SELECT * FROM cashflow_bands WHERE project_id=? ORDER BY trade_name`, args: [params.id] })

  // These tables may not exist on older DBs — safe fallback to empty
  let overridesR = { rows: [] as any[] }, incomeR = { rows: [] as any[] }
  try { overridesR = await db.execute({ sql: `SELECT * FROM cashflow_month_overrides WHERE project_id=?`, args: [params.id] }) } catch {}
  try { incomeR    = await db.execute({ sql: `SELECT * FROM cashflow_income_items WHERE project_id=?`,    args: [params.id] }) } catch {}

  const proj = projR.rows[0] as any

  const tradeSummaries = trades.map(t => ({
    name: t.trade, efc: t.efc, totalCTD: t.totalCTD,
    committed: t.committed, remaining: Math.max(0, t.efc - t.totalCTD),
  }))

  const bands = (bandsR.rows as any[]).map(b => ({
    tradeName: String(b.trade_name),
    startDate: b.start_date  ? String(b.start_date)  : null,
    finishDate: b.finish_date ? String(b.finish_date) : null,
    sCurveShape: Number(b.s_curve_shape) || 3,
  }))

  // overrides: { [tradeName]: { [month]: amount } }
  const overrides: Record<string, Record<string, number>> = {}
  for (const r of overridesR.rows as any[]) {
    const tn = String(r.trade_name), m = String(r.month)
    if (!overrides[tn]) overrides[tn] = {}
    overrides[tn][m] = Number(r.amount)
  }

  // income: { [label]: { [month]: amount } } — only manual income rows
  const income: Record<string, Record<string, number>> = {}
  for (const label of MANUAL_INCOME_LABELS) income[label] = {}
  for (const r of incomeR.rows as any[]) {
    const label = String(r.label), m = String(r.month)
    if (!income[label]) income[label] = {}
    income[label][m] = Number(r.amount)
  }

  const lagMonths = Number(proj?.cashflow_income_lag ?? 1)

  return (
    <SCurveClient
      rows={rowsResult.rows as any[]}
      kpis={kpis}
      projectId={params.id}
      role={role}
      tradeSummaries={tradeSummaries}
      bands={bands}
      overrides={overrides}
      income={income}
      incomeLabels={INCOME_LABELS}
      manualIncomeLabels={MANUAL_INCOME_LABELS}
      lagMonths={lagMonths}
      projectStart={proj?.revised_start  ? String(proj.revised_start)  : null}
      projectFinish={proj?.revised_finish ? String(proj.revised_finish) : null}
      originalMarginPct={
        (Number(proj?.contract_sum) + Number(proj?.approved_vars)) > 0
          ? Number(proj?.original_margin) / (Number(proj?.contract_sum) + Number(proj?.approved_vars))
          : 0
      }
    />
  )
}
