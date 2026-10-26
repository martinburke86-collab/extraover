import { db } from './db'

export interface PrelimItem {
  id: string; section: string; cost_code: string | null; description: string
  budget: number
  // Derived from the Cost to Date and Committed lines on the item's cost code
  // (split by budget when several items share a code). Never typed on the sheet.
  ctd: number; committed: number
  qty: number; unit: string; rate: number; utilisation_pct: number
  start_week: number; finish_week: number; sort_order: number; notes: string | null
  // Computed
  amount: number              // projected uncommitted remaining spend
  projected_final_cost: number  // ctd + committed + amount
  vs_budget: number           // budget - pfc
}

// Per cost code totals from the lines, the single source for prelims cost
interface CodeTotals { trade: string; ctd: number; committed: number }

// Figures that tie the prelims sheet to the Preliminaries element (health checks)
export interface PrelimsReconciliation {
  detailBudget: number; detailPFC: number; tradeMethod: string | null
  // Pre-v49 figures typed on the sheet that are not on the lines yet
  sheetOnly: { code: string | null; description: string; ctd: number; committed: number; postable: boolean }[]
  // Preliminaries cost on codes with no sheet item, so nothing forecasts their remaining spend
  unlisted: { code: string; ctd: number; committed: number }[]
  // Sheet items coded to another element's cost code
  otherElement: { code: string; trade: string; ctd: number; committed: number }[]
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
  revisedStart: string | null; revisedFinish: string | null
  employerRetention: number; subRetentionHeld: number
}

export interface VariationCodedSummary {
  id: string; ref: string; status: string
  cost_estimate: number; coded_cost: number
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

async function getCodeTotals(projectId: string): Promise<Record<string, CodeTotals>> {
  const r = await db.execute({
    sql: `SELECT cc.code, cc.trade,
            COALESCE((SELECT SUM(COALESCE(cl.posted_cost,0) + COALESCE(cl.accruals,0) + COALESCE(cl.sub_recon,0))
                      FROM cost_lines cl WHERE cl.cost_code_id=cc.id AND cl.project_id=cc.project_id), 0) as ctd,
            COALESCE((SELECT SUM(c.total)
                      FROM committed_lines c WHERE c.cost_code_id=cc.id AND c.project_id=cc.project_id), 0) as committed
          FROM cost_codes cc WHERE cc.project_id=?`,
    args: [projectId],
  })
  const out: Record<string, CodeTotals> = {}
  for (const row of r.rows as any[]) {
    out[String(row.code)] = { trade: String(row.trade), ctd: Number(row.ctd) || 0, committed: Number(row.committed) || 0 }
  }
  return out
}

// Builds sheet items with CTD and Committed taken from the lines on each
// item's cost code. Items sharing a code split it by budget (equally if none).
function buildPrelimItems(rows: any[], codes: Record<string, CodeTotals>, weeksElapsed: number): PrelimItem[] {
  const shareBase: Record<string, { budget: number; n: number }> = {}
  for (const item of rows) {
    if (!item.cost_code) continue
    const b = shareBase[item.cost_code] ??= { budget: 0, n: 0 }
    b.budget += Number(item.budget) || 0
    b.n += 1
  }
  return rows.map(item => {
    const totals = item.cost_code ? codes[item.cost_code] : undefined
    const base   = item.cost_code ? shareBase[item.cost_code] : undefined
    const share  = !totals || !base ? 0
      : base.budget > 0 ? (Number(item.budget) || 0) / base.budget : 1 / base.n
    const ctd       = totals ? totals.ctd * share : 0
    const committed = totals ? totals.committed * share : 0
    const amount = calcPrelimAmount(item, weeksElapsed)
    const pfc    = ctd + committed + amount
    return {
      id: item.id, section: item.section, cost_code: item.cost_code,
      description: item.description,
      budget: Number(item.budget), ctd, committed,
      qty: Number(item.qty), unit: item.unit, rate: Number(item.rate),
      utilisation_pct: Number(item.utilisation_pct),
      start_week: Number(item.start_week), finish_week: Number(item.finish_week),
      sort_order: Number(item.sort_order), notes: item.notes,
      amount, projected_final_cost: pfc,
      vs_budget: Number(item.budget) ? Number(item.budget) - pfc : 0,
    }
  })
}

// ── Prelim items with computed columns ───────────────────────────────────
export async function getPrelimItems(projectId: string): Promise<PrelimItem[]> {
  const projR = await db.execute({ sql: 'SELECT revised_start FROM projects WHERE id=?', args: [projectId] })
  const weeksElapsed = weeksFromDate((projR.rows[0] as any)?.revised_start)

  const [result, codes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM prelim_items WHERE project_id=? ORDER BY sort_order', args: [projectId] }),
    getCodeTotals(projectId),
  ])
  return buildPrelimItems(result.rows as any[], codes, weeksElapsed)
}

// The trade the prelims sheet belongs to: the one on the 'prelims' method,
// else the one named Preliminaries.
export function findPrelimsTrade(trades: TradeSummary[]): TradeSummary | undefined {
  return trades.find(t => t.forecastMethod === 'prelims')
    ?? trades.find(t => t.trade.toLowerCase().startsWith('prelim'))
}

// ── Prelims sheet vs Preliminaries element reconciliation ────────────────
export async function getPrelimsReconciliation(projectId: string, trades: TradeSummary[]): Promise<PrelimsReconciliation> {
  const projR = await db.execute({ sql: 'SELECT revised_start FROM projects WHERE id=?', args: [projectId] })
  const weeksElapsed = weeksFromDate((projR.rows[0] as any)?.revised_start)
  const [result, codes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM prelim_items WHERE project_id=? ORDER BY sort_order', args: [projectId] }),
    getCodeTotals(projectId),
  ])
  const rows  = result.rows as any[]
  const items = buildPrelimItems(rows, codes, weeksElapsed)
  const prelimsTrade = findPrelimsTrade(trades)
  const cents = (n: number) => Math.round(n * 100) / 100

  // Sheet-typed CTD / Committed (pre-v49) beyond what the lines on that code
  // already hold. Grouped by code; uncoded items stand alone.
  const groups = new Map<string, { code: string | null; description: string; ctd: number; committed: number }>()
  for (const r of rows) {
    const ctd = Number(r.ctd) || 0, committed = Number(r.committed) || 0
    if (!ctd && !committed) continue
    const key = r.cost_code ? `c:${r.cost_code}` : `i:${r.id}`
    const g = groups.get(key) ?? { code: r.cost_code || null, description: String(r.description), ctd: 0, committed: 0 }
    g.ctd += ctd; g.committed += committed
    groups.set(key, g)
  }
  const sheetOnly: PrelimsReconciliation['sheetOnly'] = []
  for (const g of Array.from(groups.values())) {
    const lines = g.code ? codes[g.code] : undefined
    const ctd       = cents(Math.max(0, g.ctd - (lines?.ctd ?? 0)))
    const committed = cents(Math.max(0, g.committed - (lines?.committed ?? 0)))
    if (ctd > 0 || committed > 0) sheetOnly.push({ code: g.code, description: g.description, ctd, committed, postable: !!lines })
  }

  const sheetCodes = new Set(rows.map(r => r.cost_code).filter(Boolean))
  const unlisted: PrelimsReconciliation['unlisted'] = []
  const otherElement: PrelimsReconciliation['otherElement'] = []
  for (const [code, t] of Object.entries(codes)) {
    if (!t.ctd && !t.committed) continue
    if (prelimsTrade && t.trade === prelimsTrade.trade && !sheetCodes.has(code)) unlisted.push({ code, ...t })
    if (prelimsTrade && t.trade !== prelimsTrade.trade && sheetCodes.has(code)) otherElement.push({ code, ...t })
  }

  return {
    detailBudget: items.reduce((s, i) => s + i.budget, 0),
    detailPFC:    items.reduce((s, i) => s + i.projected_final_cost, 0),
    tradeMethod:  prelimsTrade ? prelimsTrade.forecastMethod : null,
    sheetOnly, unlisted, otherElement,
  }
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

  // Prelims sheet (for trades using 'prelims' method). The sheet supplies the
  // uncommitted remaining spend only; CTD and Committed come from the lines.
  const [prelimsR, codeTotals] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM prelim_items WHERE project_id=?', args: [projectId] }),
    getCodeTotals(projectId),
  ])
  const prelimItems = buildPrelimItems(prelimsR.rows as any[], codeTotals, weeksElapsed)
  const prelimUncommitted = prelimItems.reduce((s, i) => s + i.amount, 0)
  const prelimSheetInUse  = prelimItems.some(i => i.amount > 0 || i.ctd > 0 || i.committed > 0)

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
    if (method === 'prelims') {
      // Uncommitted = the prelims sheet's remaining spend (qty x rate x weeks).
      // If the sheet is not filled in yet, fall back to budget remaining.
      if (prelimSheetInUse) {
        uncommitted = prelimUncommitted
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

    const efc         = totalCTD + committed + uncommitted
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
  // Single source of truth: once the variations register is in use, it drives
  // approved vars; the settings field is only a fallback for register-less projects.
  const varAgg = await db.execute({
    sql: `SELECT COUNT(*) as n,
                 SUM(CASE WHEN status='Approved' THEN income_value ELSE 0 END) as appr
          FROM variations WHERE project_id=?`,
    args: [projectId],
  })
  const va = varAgg.rows[0] as any
  const approvedVars = Number(va?.n) > 0 ? (Number(va?.appr) || 0) : (Number(p.approved_vars) || 0)
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


  // Retention position: what the employer holds against us vs what we hold against subs
  const employerRetention = (Number(vp?.cumul_certified) || 0) * (Number(p.retention_pct ?? 3)) / 100
  const subRetR = await db.execute({
    sql: `SELECT s.retention_pct as pct, MAX(c.gross_cumulative) as gross
          FROM sub_certs c JOIN subcontractors s ON c.subcontractor_id = s.id
          WHERE c.project_id=? GROUP BY c.subcontractor_id`,
    args: [projectId],
  })
  const subRetentionHeld = (subRetR.rows as any[]).reduce(
    (t, r) => t + (Number(r.gross) || 0) * (Number(r.pct) || 0) / 100, 0)
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
    revisedStart:  p.revised_start  ? String(p.revised_start)  : null,
    revisedFinish: p.revised_finish ? String(p.revised_finish) : null,
    employerRetention,
    subRetentionHeld,
  }
}

// -- Variation coded-cost summaries (for register, checks and reconciliation) --
export async function getVariationCodedSummaries(projectId: string): Promise<VariationCodedSummary[]> {
  const [varsR, ctdR, commR, fcstR] = await Promise.all([
    db.execute({ sql: `SELECT id, ref, status, cost_estimate FROM variations WHERE project_id=?`, args: [projectId] }),
    db.execute({
      sql: `SELECT variation_id, SUM(posted_cost + accruals + sub_recon) as amt
            FROM cost_lines WHERE project_id=? AND variation_id IS NOT NULL GROUP BY variation_id`,
      args: [projectId],
    }),
    db.execute({
      sql: `SELECT variation_id, SUM(total) as amt
            FROM committed_lines WHERE project_id=? AND variation_id IS NOT NULL GROUP BY variation_id`,
      args: [projectId],
    }),
    db.execute({
      sql: `SELECT variation_id, SUM(total) as amt
            FROM forecast_lines WHERE project_id=? AND variation_id IS NOT NULL GROUP BY variation_id`,
      args: [projectId],
    }),
  ])
  const toMap = (rows: any[]) => Object.fromEntries(rows.map(r => [r.variation_id, Number(r.amt) || 0]))
  const a = toMap(ctdR.rows as any[]), c = toMap(commR.rows as any[]), f = toMap(fcstR.rows as any[])
  return (varsR.rows as any[]).map(v => ({
    id: String(v.id), ref: String(v.ref), status: String(v.status || ''),
    cost_estimate: Number(v.cost_estimate) || 0,
    coded_cost: (a[v.id] || 0) + (c[v.id] || 0) + (f[v.id] || 0),
  }))
}
