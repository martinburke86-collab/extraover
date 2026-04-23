import { db } from './db'

export interface PrelimItem {
  id: string; section: string; cost_code: string | null; description: string
  budget: number; ctd: number; committed: number
  qty: number; unit: string; rate: number; utilisation_pct: number
  start_week: number; finish_week: number; sort_order: number; notes: string | null
  // Computed
  amount: number              // projected uncommitted remaining spend
  projected_final_cost: number  // ctd + committed + amount
  vs_budget: number           // budget - pfc
}

export interface TradeSummary {
  id: string; trade: string; sortOrder: number
  valueCertified: number; varsNotAgreed: number; adjustments: number; finalValue: number
  postedCost: number; accruals: number; subRecon: number; totalCTD: number
  committed: number
  uncommitted: number          // forecast remaining (varies by method)
  efc: number                  // CTD + committed + uncommitted
  forecastMethod: 'prelims' | 'budget_remaining' | 'forecast_sheet' | 'hard_key'
  forecastHardKey: number | null
  budget: number
  projectedPL: number; plPct: number; leftToSpend: number; pctVoverCTD: number
}

export interface DashboardKPIs {
  projectName: string
  contractSum: number; approvedVars: number; adjustedSum: number
  originalBudget: number; originalMargin: number
  efc: number; forecastMargin: number; forecastMarginPct: number; savingsOverrun: number
  riskValue: number; opportunityValue: number; mostLikelyMargin: number
  totalClaimed: number; cumulCertified: number; revenueReceived: number; totalPaid: number
  cashPosition: number; postedCostTotal: number; accrualsTotal: number
  actualsTotal: number; financialPct: number; overUnderClaim: number
  prevEfc: number; prevForecastMargin: number; prevTotalClaimed: number
  prevCashPosition: number; prevOverUnder: number
  approvedVarsIncome: number; submittedVarsIncome: number; totalVarsCostEst: number
}

// ── Core prelim amount formula ────────────────────────────────────────────
// If unit = Weeks:  qty × rate × remaining_weeks × (utilisation_pct/100)
// Otherwise:        qty × rate × (utilisation_pct/100)
export function calcPrelimAmount(
  item: Pick<PrelimItem, 'qty'|'unit'|'rate'|'utilisation_pct'|'start_week'|'finish_week'>,
  weeksElapsed: number
): number {
  const util = item.utilisation_pct / 100
  if (item.unit.toLowerCase() === 'weeks') {
    const currentWeek    = Math.max(weeksElapsed, item.start_week - 1)
    const remainingWeeks = Math.max(0, item.finish_week - currentWeek)
    return item.qty * item.rate * remainingWeeks * util
  }
  return item.qty * item.rate * util
}

function weeksFromDate(revisedStart: string | null): number {
  if (!revisedStart) return 0
  const start = new Date(revisedStart)
  const today = new Date()
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)))
}

// ── Prelim items with computed columns ───────────────────────────────────
export async function getPrelimItems(projectId: string): Promise<PrelimItem[]> {
  const projR = await db.execute({ sql: 'SELECT revised_start FROM projects WHERE id=?', args: [projectId] })
  const weeksElapsed = weeksFromDate((projR.rows[0] as any)?.revised_start)

  const result = await db.execute({
    sql: 'SELECT * FROM prelim_items WHERE project_id=? ORDER BY sort_order',
    args: [projectId],
  })

  return result.rows.map(r => {
    const item = r as any
    const amount = calcPrelimAmount(item, weeksElapsed)
    const pfc    = Number(item.ctd) + Number(item.committed) + amount
    return {
      id: item.id, section: item.section, cost_code: item.cost_code,
      description: item.description,
      budget: Number(item.budget), ctd: Number(item.ctd), committed: Number(item.committed),
      qty: Number(item.qty), unit: item.unit, rate: Number(item.rate),
      utilisation_pct: Number(item.utilisation_pct),
      start_week: Number(item.start_week), finish_week: Number(item.finish_week),
      sort_order: Number(item.sort_order), notes: item.notes,
      amount, projected_final_cost: pfc,
      vs_budget: Number(item.budget) ? Number(item.budget) - pfc : 0,
    }
  })
}

// ── Trade summaries with full EFC breakdown ──────────────────────────────
export async function getTradeSummaries(projectId: string): Promise<TradeSummary[]> {
  const projR = await db.execute({ sql: 'SELECT * FROM projects WHERE id=?', args: [projectId] })
  const proj  = projR.rows[0] as any
  const weeksElapsed = weeksFromDate(proj?.revised_start)

  const tradesR = await db.execute({
    sql: 'SELECT * FROM trades WHERE project_id=? ORDER BY sort_order', args: [projectId],
  })

  // Aggregate CTD by trade
  const ctdR = await db.execute({
    sql: `SELECT cc.trade,
            SUM(cl.posted_cost) as posted,
            SUM(cl.accruals)    as accruals,
            SUM(cl.sub_recon)   as sub_recon
          FROM cost_lines cl
          JOIN cost_codes cc ON cl.cost_code_id=cc.id
          WHERE cl.project_id=? GROUP BY cc.trade`,
    args: [projectId],
  })

  // Aggregate Committed by trade
  const commR = await db.execute({
    sql: `SELECT cc.trade, SUM(c.total) as committed
          FROM committed_lines c
          JOIN cost_codes cc ON c.cost_code_id=cc.id
          WHERE c.project_id=? GROUP BY cc.trade`,
    args: [projectId],
  })

  // Aggregate Forecast sheet by trade
  const fcstR = await db.execute({
    sql: `SELECT cc.trade, SUM(f.total) as forecast
          FROM forecast_lines f
          JOIN cost_codes cc ON f.cost_code_id=cc.id
          WHERE f.project_id=? GROUP BY cc.trade`,
    args: [projectId],
  })

  // Prelims EFC (for trades using 'prelims' method)
  const prelimsR = await db.execute({
    sql: 'SELECT * FROM prelim_items WHERE project_id=?', args: [projectId],
  })
  const totalPrelimEfc = (prelimsR.rows as any[]).reduce((sum, item) => {
    return sum + Number(item.ctd) + Number(item.committed) + calcPrelimAmount(item, weeksElapsed)
  }, 0)

  const ctdMap:  Record<string, { posted: number; accruals: number; subRecon: number }> = {}
  const commMap: Record<string, number> = {}
  const fcstMap: Record<string, number> = {}
  ctdR.rows.forEach(r  => { ctdMap[r.trade  as string] = { posted: Number(r.posted)||0, accruals: Number(r.accruals)||0, subRecon: Number(r.sub_recon)||0 } })
  commR.rows.forEach(r => { commMap[r.trade as string] = Number(r.committed)||0 })
  fcstR.rows.forEach(r => { fcstMap[r.trade as string] = Number(r.forecast)||0 })

  return tradesR.rows.map(t => {
    const trade   = t.name as string
    const vc      = Number(t.value_certified)  || 0
    const vna     = Number(t.vars_not_agreed)  || 0
    const adj     = Number(t.adjustments)      || 0
    const fv      = vc + vna + adj
    const ctd     = ctdMap[trade] || { posted: 0, accruals: 0, subRecon: 0 }
    const totalCTD    = ctd.posted + ctd.accruals + ctd.subRecon
    const committed   = commMap[trade] || 0
    const method      = ((t as any).forecast_method as TradeSummary['forecastMethod']) || 'budget_remaining'
    const hardKey     = (t as any).forecast_hard_key != null ? Number((t as any).forecast_hard_key) : null
    const tradeBudget = Number((t as any).budget) || 0  // set per-trade in Settings / CVR Trade

    let uncommitted = 0
    let efcOverride: number | null = null
    if (method === 'prelims') {
      // Prelims EFC = sum of all prelim items (each item: CTD + committed + amount)
      // If prelim items are all zero (not yet filled in), fall back to budget remaining
      if (totalPrelimEfc > 0) {
        efcOverride = totalPrelimEfc
      } else {
        uncommitted = Math.max(0, tradeBudget - totalCTD - committed)
      }
    } else if (method === 'forecast_sheet') {
      uncommitted = Math.max(0, (fcstMap[trade] || 0) - totalCTD - committed)
    } else if (method === 'hard_key' && hardKey !== null) {
      uncommitted = Math.max(0, hardKey - totalCTD - committed)
    } else {
      // budget_remaining: remaining budget after CTD and committed
      uncommitted = Math.max(0, tradeBudget - totalCTD - committed)
    }

    const efc         = efcOverride !== null ? efcOverride : (totalCTD + committed + uncommitted)
    const projectedPL = fv - efc

    return {
      id:             t.id as string,
      trade, sortOrder: Number(t.sort_order),
      valueCertified: vc, varsNotAgreed: vna, adjustments: adj, finalValue: fv,
      postedCost: ctd.posted, accruals: ctd.accruals, subRecon: ctd.subRecon, totalCTD,
      committed, uncommitted, efc,
      forecastMethod:  method,
      forecastHardKey: hardKey,
      budget:          tradeBudget,
      projectedPL,
      plPct:           fv ? projectedPL / fv : 0,
      leftToSpend:     efc - totalCTD,
      pctVoverCTD:     vc ? totalCTD / vc : 0,
    }
  })
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────
export async function getDashboardKPIs(projectId: string): Promise<DashboardKPIs> {
  const projR = await db.execute({ sql: 'SELECT * FROM projects WHERE id=?', args: [projectId] })
  const p = projR.rows[0] as any
  if (!p) throw new Error('Project not found')

  const projectName    = String(p.name || "")
  const contractSum    = Number(p.contract_sum)    || 0
  const approvedVars   = Number(p.approved_vars)   || 0
  const originalBudget = Number(p.original_budget) || 0
  const originalMargin = Number(p.original_margin) || 0
  const adjustedSum    = contractSum + approvedVars

  const trades          = await getTradeSummaries(projectId)
  const efc             = trades.reduce((s, t) => s + t.efc, 0)
  const forecastMargin  = adjustedSum - efc
  const forecastMarginPct = adjustedSum ? forecastMargin / adjustedSum : 0
  const savingsOverrun  = forecastMargin - originalMargin
  const postedCostTotal = trades.reduce((s, t) => s + t.postedCost, 0)
  const accrualsTotal   = trades.reduce((s, t) => s + t.accruals, 0)
  const actualsTotal    = postedCostTotal + accrualsTotal
  const financialPct    = efc ? actualsTotal / efc : 0

  const vpR = await db.execute({
    sql: 'SELECT * FROM value_periods WHERE project_id=? ORDER BY rowid DESC LIMIT 1',
    args: [projectId],
  })
  const vp = vpR.rows[0] as any
  const totalClaimed    = Number(vp?.cumul_claimed)     || 0
  const cumulCertified  = Number(vp?.cumul_certified)   || 0
  const revenueReceived = Number(vp?.revenue_received)  || 0
  const totalPaid       = Number(vp?.total_paid)        || 0
  const cashPosition    = revenueReceived - totalPaid
  const overUnderClaim  = totalClaimed - actualsTotal
  const riskValue       = Number(vp?.risk_value)        || 0
  const opportunityValue= Number(vp?.opportunity_value) || 0
  const mostLikelyMargin= forecastMargin + riskValue + opportunityValue

  const snapR = await db.execute({
    sql: `SELECT ps.* FROM period_snapshots ps
          JOIN report_periods rp ON ps.period_id=rp.id
          WHERE rp.project_id=? ORDER BY rp.period_date DESC LIMIT 1`,
    args: [projectId],
  })
  const snap = snapR.rows[0] as any

  // Variations
  const varsR = await db.execute({
    sql: `SELECT status, SUM(income_value) as income, SUM(cost_estimate) as cost_est
          FROM variations WHERE project_id=? GROUP BY status`,
    args: [projectId],
  })
  let approvedVarsIncome = 0, submittedVarsIncome = 0, totalVarsCostEst = 0
  for (const r of varsR.rows as any[]) {
    if (r.status === 'Approved') approvedVarsIncome += Number(r.income) || 0
    else if (r.status === 'Submitted' || r.status === 'Pending') submittedVarsIncome += Number(r.income) || 0
    totalVarsCostEst += Number(r.cost_est) || 0
  }

  return {
    projectName, contractSum, approvedVars, adjustedSum, originalBudget, originalMargin,
    efc, forecastMargin, forecastMarginPct, savingsOverrun,
    riskValue, opportunityValue, mostLikelyMargin,
    totalClaimed, cumulCertified, revenueReceived, totalPaid, cashPosition,
    postedCostTotal, accrualsTotal, actualsTotal, financialPct, overUnderClaim,
    prevEfc:            Number(snap?.efc)             || 0,
    prevForecastMargin: Number(snap?.forecast_margin) || 0,
    prevTotalClaimed:   Number(snap?.total_claimed)   || 0,
    prevCashPosition:   Number(snap?.cash_position)   || 0,
    prevOverUnder:      Number(snap?.over_under_claim)|| 0,
    approvedVarsIncome, submittedVarsIncome, totalVarsCostEst,
  }
}
