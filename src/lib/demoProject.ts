// Demo project builder. Adds one fully worked, reconciling project for the
// given user and never touches any other project or the shared lists.
//
// Built through createProject() so it is structurally identical to a project
// made in the setup wizard. Every total is derived from line-level data:
// budgets sum to the original budget, Committed holds REMAINING commitment
// (order value less what has been invoiced), approved variations are coded
// on cost and committed lines, and last month is snapshotted by the real
// calculation engine before this month's movement is added.

import { db, cuid } from './db'
import { createProject } from './projects'
import { getDashboardKPIs, getTradeSummaries } from './calculations'
import { writeAudit } from './audit'

const WEEKS_ELAPSED = 30
const TOTAL_WEEKS   = 78
const RETENTION     = 0.03

type Cat = 'Subcontractor' | 'Materials' | 'Labour' | 'Indirect'
interface Code   { code: string; desc: string; cat: Cat }
interface Order  { code: string; supplier: string; desc: string; value: number; vo?: string }
// prior = posted by last month end, now = posted this month, accrual = this month
interface Cost   { code: string; prior: number; now?: number; accrual?: number; vo?: string; notes?: string }
interface Final  { code: string; supplier: string; total: number }

interface DemoTrade {
  name: string
  budget: number
  method?: 'forecast_sheet'
  pctPrior: number; pctNow: number          // value certified, % of element contract value
  voIncome?: number                         // approved VO income certified in this element
  codes: Code[]; orders?: Order[]; costs?: Cost[]; finals?: Final[]
}

const TRADES: DemoTrade[] = [
  { name: 'Substructure', budget: 620000, method: 'forecast_sheet', pctPrior: 100, pctNow: 100, voIncome: 68000,
    codes: [
      { code: '1.01', desc: 'Excavation & Earthworks', cat: 'Subcontractor' },
      { code: '1.02', desc: 'Piling', cat: 'Subcontractor' },
      { code: '1.08', desc: 'Ground Floor Slab', cat: 'Subcontractor' },
      { code: '1.10', desc: 'Drainage Below Slab', cat: 'Subcontractor' },
    ],
    orders: [
      { code: '1.01', supplier: 'Midland Earthmoving Ltd', desc: 'Bulk dig and cart away', value: 168000 },
      { code: '1.02', supplier: 'Shannon Piling Ltd', desc: 'CFA piling package', value: 205000 },
      { code: '1.08', supplier: 'Liffey Concrete Ltd', desc: 'Ground floor slab', value: 142000 },
      { code: '1.10', supplier: 'Midland Drainage Ltd', desc: 'Below slab drainage', value: 48000 },
    ],
    costs: [
      { code: '1.01', prior: 168000 },
      { code: '1.02', prior: 205000 },
      { code: '1.02', prior: 49500, vo: 'VO-001', notes: 'Additional piles, east boundary' },
      { code: '1.08', prior: 120000, now: 22000 },
      { code: '1.10', prior: 48000 },
    ],
    finals: [
      { code: '1.01', supplier: 'Midland Earthmoving Ltd', total: 168000 },
      { code: '1.02', supplier: 'Shannon Piling Ltd', total: 254500 },
      { code: '1.08', supplier: 'Liffey Concrete Ltd', total: 142000 },
      { code: '1.10', supplier: 'Midland Drainage Ltd', total: 48000 },
    ] },
  { name: 'Frame', budget: 1450000, pctPrior: 62, pctNow: 78,
    codes: [
      { code: '2.1.01', desc: 'Structural Steel Frame', cat: 'Subcontractor' },
      { code: '2.1.05', desc: 'Concrete Frame - Walls & Cores', cat: 'Subcontractor' },
      { code: '2.1.07', desc: 'Concrete Reinforcement', cat: 'Materials' },
    ],
    orders: [
      { code: '2.1.01', supplier: 'Atlantic Steel Fabricators Ltd', desc: 'Structural steelwork package', value: 980000 },
      { code: '2.1.05', supplier: 'Liffey Concrete Ltd', desc: 'RC stair and lift cores', value: 410000 },
    ],
    costs: [
      { code: '2.1.01', prior: 610000, now: 180000, accrual: 25000 },
      { code: '2.1.05', prior: 300000, now: 55000 },
      { code: '2.1.07', prior: 61000, now: 31000, notes: 'Rebar, merchant invoices' },
    ] },
  { name: 'Upper Floors', budget: 380000, pctPrior: 40, pctNow: 68,
    codes: [{ code: '2.2.02', desc: 'Precast / Hollowcore Planks', cat: 'Subcontractor' }],
    orders: [{ code: '2.2.02', supplier: 'Precast Planks Ireland Ltd', desc: 'Hollowcore floors supply and fix', value: 312000 }],
    costs: [{ code: '2.2.02', prior: 140000, now: 96000 }] },
  { name: 'Roof', budget: 310000, pctPrior: 0, pctNow: 14,
    codes: [{ code: '2.3.02', desc: 'Flat Roof Membrane System', cat: 'Subcontractor' }],
    orders: [{ code: '2.3.02', supplier: 'Summit Roofing Ltd', desc: 'Warm roof membrane system', value: 248000 }],
    costs: [{ code: '2.3.02', prior: 0, now: 42000 }] },
  { name: 'External Walls', budget: 760000, pctPrior: 9, pctNow: 17,
    codes: [
      { code: '2.5.01', desc: 'Masonry External Walls', cat: 'Subcontractor' },
      { code: '2.5.04', desc: 'Rainscreen Cladding System', cat: 'Subcontractor' },
    ],
    orders: [
      { code: '2.5.01', supplier: 'Brickwork Contracts Ltd', desc: 'Facing brick and blockwork', value: 285000 },
      { code: '2.5.04', supplier: 'Facade Systems Ltd', desc: 'Rainscreen cladding', value: 395000 },
    ],
    costs: [{ code: '2.5.01', prior: 60000, now: 48000 }] },
  { name: 'Windows & External Doors', budget: 540000, pctPrior: 0, pctNow: 0,
    codes: [{ code: '2.6.01', desc: 'Windows - Aluminium / PVC-U', cat: 'Subcontractor' }],
    orders: [
      { code: '2.6.01', supplier: 'Glazing Solutions Ltd', desc: 'Windows and curtain walling', value: 512000 },
      { code: '2.6.01', supplier: 'Glazing Solutions Ltd', desc: 'Entrance canopy glazing upgrade', value: 17800, vo: 'VO-003' },
    ] },
  { name: 'Internal Walls & Partitions', budget: 420000, pctPrior: 0, pctNow: 0,
    codes: [{ code: '2.7.03', desc: 'Metal Stud Partition Framing', cat: 'Subcontractor' }] },
  { name: 'Floor Finishes', budget: 260000, pctPrior: 0, pctNow: 0,
    codes: [{ code: '3.2.01', desc: 'Screeds', cat: 'Subcontractor' }] },
  { name: 'Space Heating & Air Treatment', budget: 520000, pctPrior: 4, pctNow: 10,
    codes: [{ code: '5.6.01', desc: 'Heating Distribution', cat: 'Subcontractor' }],
    orders: [{ code: '5.6.01', supplier: 'Thermal Services Ltd', desc: 'Heating and ventilation package', value: 534000 }],
    costs: [{ code: '5.6.01', prior: 20000, now: 28000 }] },
  { name: 'Electrical Installations', budget: 640000, pctPrior: 6, pctNow: 13,
    codes: [{ code: '5.8.01', desc: 'Electrical Installation', cat: 'Subcontractor' }],
    orders: [{ code: '5.8.01', supplier: 'Volt Electrical Ltd', desc: 'Electrical package', value: 618000 }],
    costs: [{ code: '5.8.01', prior: 35000, now: 40000 }] },
  { name: 'Lift & Conveyor Installations', budget: 140000, pctPrior: 0, pctNow: 0,
    codes: [{ code: '5.10.01', desc: 'Passenger Lifts', cat: 'Subcontractor' }],
    orders: [{ code: '5.10.01', supplier: 'Vertical Lifts Ltd', desc: 'Two 8-person passenger lifts', value: 128000 }] },
  { name: 'Site Preparation Works', budget: 230000, method: 'forecast_sheet', pctPrior: 100, pctNow: 100,
    codes: [
      { code: '8.1.03', desc: 'Site Clearance & Reduced Level Dig', cat: 'Subcontractor' },
      { code: '8.1.06', desc: 'Temporary Roads & Hardstandings', cat: 'Materials' },
    ],
    orders: [{ code: '8.1.03', supplier: 'Midland Earthmoving Ltd', desc: 'Site clearance and reduced level dig', value: 205000 }],
    costs: [{ code: '8.1.03', prior: 205000 }, { code: '8.1.06', prior: 9000 }],
    finals: [
      { code: '8.1.03', supplier: 'Midland Earthmoving Ltd', total: 205000 },
      { code: '8.1.06', supplier: 'Builders merchant', total: 9000 },
    ] },
  { name: 'Contingencies', budget: 240000, pctPrior: 0, pctNow: 0,
    codes: [{ code: 'C.02', desc: 'Construction Risk Contingency', cat: 'Indirect' }] },
]

// Preliminaries: weekly items cost rate x utilisation per week over 78 weeks.
// Lump items carry their own invoiced / ordered / to-complete figures.
interface Prelim {
  code: string; section: string; desc: string
  rate: number; util?: number; adjust?: number     // weekly items; adjust = cost to date variance
  lump?: { invoicedPrior: number; invoicedNow: number; order?: { supplier: string; value: number }; toComplete: number; budget: number }
}
const PRELIMS: Prelim[] = [
  { code: 'A.01', section: 'Site Management', desc: 'Contracts Manager / Project Director', rate: 1900, util: 50 },
  { code: 'A.02', section: 'Site Management', desc: 'Site Manager / General Foreman', rate: 1850, adjust: 3200 },
  { code: 'A.03', section: 'Site Management', desc: "Contractor's Quantity Surveyor", rate: 1500 },
  { code: 'A.04', section: 'Site Management', desc: 'Site Engineer & Setting Out', rate: 1300 },
  { code: 'A.05', section: 'Site Management', desc: 'Safety Officer / PSCS', rate: 900 },
  { code: 'A.07', section: 'Welfare & Offices', desc: 'Site Office Units & Furniture', rate: 650 },
  { code: 'A.08', section: 'Welfare & Offices', desc: 'Welfare Facilities', rate: 450 },
  { code: 'A.11', section: 'Plant & Equipment', desc: 'Plant & Equipment - General', rate: 2400, adjust: -6500 },
  { code: 'A.15', section: 'Security', desc: 'Security - Hoardings, Fencing & Guards', rate: 900 },
  { code: 'A.17', section: 'Environmental', desc: 'Site Waste & Skip Hire', rate: 520 },
  { code: 'A.14', section: 'Temporary Works', desc: 'Temporary Works Design & Execution', rate: 0,
    lump: { invoicedPrior: 48000, invoicedNow: 14000, order: { supplier: 'Ground Support Engineering Ltd', value: 96000 }, toComplete: 8000, budget: 100000 } },
  { code: 'A.19', section: 'Bond & Insurance', desc: 'Contractor All Risks Insurance', rate: 0,
    lump: { invoicedPrior: 38000, invoicedNow: 0, toComplete: 0, budget: 40000 } },
]

const VARIATIONS = [
  { ref: 'VO-001', desc: 'Additional piling to east boundary', status: 'Approved', income: 68000, cost: 52000, cat: 'Client change', by: 'Employer Representative' },
  { ref: 'VO-002', desc: 'Enhanced rainscreen specification', status: 'Submitted', income: 42000, cost: 31000, cat: 'Client change', by: 'Architect' },
  { ref: 'VO-003', desc: 'Entrance canopy glazing upgrade', status: 'Approved', income: 24000, cost: 18000, cat: 'Client change', by: 'Architect' },
  { ref: 'VO-004', desc: 'Additional EV charging points', status: 'Instructed', income: 36000, cost: 28000, cat: 'Client change', by: 'Employer Representative' },
]

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0))
const monthLabel = (d: Date) => d.toLocaleDateString('en-IE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const round = (n: number) => Math.round(n)

export async function createDemoProject(ownerUserId: string | null, userName = 'Demo'): Promise<{ id: string }> {
  const now        = new Date()
  const start      = addDays(now, -WEEKS_ELAPSED * 7)
  const finish     = addDays(start, TOTAL_WEEKS * 7)
  const priorEnd   = monthEnd(now.getUTCFullYear(), now.getUTCMonth() - 1)
  const currentEnd = monthEnd(now.getUTCFullYear(), now.getUTCMonth())

  // ── Budgets, all derived ─────────────────────────────────────────────────
  const weekly = (p: Prelim) => p.rate * (p.util ?? 100) / 100
  const prelimBudget = (p: Prelim) => p.lump ? p.lump.budget : weekly(p) * TOTAL_WEEKS
  const prelimsTotal = PRELIMS.reduce((s, p) => s + prelimBudget(p), 0)
  const budgets: Record<string, number> = { Preliminaries: prelimsTotal }
  for (const t of TRADES) budgets[t.name] = t.budget
  const originalBudget = Object.values(budgets).reduce((s, b) => s + b, 0)
  const contractSum    = Math.round(originalBudget / 0.94 / 1000) * 1000
  const markup         = contractSum / originalBudget

  const { id, periodId: priorPeriodId } = await createProject({
    name: 'Harbour View Apartments (Demo)', code: 'DEMO-01',
    client: 'Demo Housing Association', contractType: 'PW-CF1 Public Works (Lump Sum)',
    preparedBy: 'ExtraOver demo', contractSum, originalBudget, originalMargin: contractSum - originalBudget,
    gifa: 6400, startDate: iso(start), finishDate: iso(finish),
    reportPeriod: monthLabel(priorEnd),
    selectedElements: Object.keys(budgets),
    budgets,
  }, ownerUserId)
  const run = (sql: string, args: any[] = []) => db.execute({ sql, args })
  await run(`UPDATE report_periods SET period_date=? WHERE id=?`, [iso(priorEnd), priorPeriodId])

  const tradeRows = (await run(`SELECT id, name FROM trades WHERE project_id=?`, [id])).rows as any[]
  const tradeId = Object.fromEntries(tradeRows.map(t => [String(t.name), String(t.id)]))

  // ── Cost codes ───────────────────────────────────────────────────────────
  const codeId: Record<string, string> = {}
  const addCode = async (c: Code, trade: string) => {
    if (codeId[c.code]) return
    codeId[c.code] = cuid()
    await run(`INSERT INTO cost_codes (id, project_id, code, description, trade, category, notes) VALUES (?,?,?,?,?,?,NULL)`,
      [codeId[c.code], id, c.code, c.desc, trade, c.cat])
  }
  for (const t of TRADES) for (const c of t.codes) await addCode(c, t.name)
  for (const p of PRELIMS) await addCode({ code: p.code, desc: p.desc, cat: p.lump ? 'Subcontractor' : 'Indirect' }, 'Preliminaries')

  // ── Variations register ──────────────────────────────────────────────────
  const voId: Record<string, string> = {}
  for (const v of VARIATIONS) {
    voId[v.ref] = cuid()
    const approved = v.status === 'Approved'
    await run(`INSERT INTO variations (id, project_id, ref, description, status, date_submitted, date_approved,
                 income_value, cost_estimate, cost_actual, notes, instructed_by, category, date_instructed, pct_complete)
               VALUES (?,?,?,?,?,?,?,?,?,0,NULL,?,?,?,?)`,
      [voId[v.ref], id, v.ref, v.desc, v.status, iso(addDays(start, 60)), approved ? iso(addDays(start, 90)) : null,
       v.income, v.cost, v.by, v.cat, iso(addDays(start, 45)), v.ref === 'VO-001' ? 100 : 0])
  }

  // ── Cost to Date lines, Preliminaries included (invoices land here) ─────
  const ctdTotal: Record<string, { prior: number; now: number }> = {}
  const bump = (code: string, prior: number, now: number) => {
    const c = ctdTotal[code] ??= { prior: 0, now: 0 }
    c.prior += prior; c.now += prior + now
  }
  const addCost = async (period: string, code: string, posted: number, accruals: number, vo?: string, notes?: string) =>
    run(`INSERT INTO cost_lines (id, project_id, period_id, cost_code_id, posted_cost, accruals, sub_recon, notes, variation_id)
         VALUES (?,?,?,?,?,?,0,?,?)`, [cuid(), id, period, codeId[code], posted, accruals, notes ?? null, vo ? voId[vo] : null])

  for (const t of TRADES) for (const c of t.costs ?? []) {
    if (c.prior) await addCost(priorPeriodId, c.code, c.prior, 0, c.vo, c.notes)
    bump(c.code, c.prior, (c.now ?? 0) + (c.accrual ?? 0))
  }
  const prelimCost = PRELIMS.map(p => {
    const prior = p.lump ? p.lump.invoicedPrior : round(weekly(p) * (WEEKS_ELAPSED - 4) + (p.adjust ?? 0) * (WEEKS_ELAPSED - 4) / WEEKS_ELAPSED)
    const now   = p.lump ? p.lump.invoicedNow  : round(weekly(p) * WEEKS_ELAPSED + (p.adjust ?? 0)) - prior
    return { p, prior, now }
  })
  for (const { p, prior, now } of prelimCost) {
    if (prior) await addCost(priorPeriodId, p.code, prior, 0)
    bump(p.code, prior, now)
  }

  // ── Committed: REMAINING commitment = order value less invoiced ─────────
  const orders: (Order & { lineId: string })[] = []
  for (const t of TRADES) for (const o of t.orders ?? []) orders.push({ ...o, lineId: cuid() })
  for (const p of PRELIMS) if (p.lump?.order) orders.push({ code: p.code, supplier: p.lump.order.supplier, desc: p.desc, value: p.lump.order.value, lineId: cuid() })
  // A VO order is its own instruction: invoices against the code reduce the main order first
  const remaining = (o: Order, at: 'prior' | 'now') =>
    o.vo ? o.value : Math.max(0, o.value - (ctdTotal[o.code]?.[at] ?? 0))
  for (const o of orders) {
    await run(`INSERT INTO committed_lines (id, project_id, cost_code_id, supplier, description, status, quantity, unit, unit_rate, total, notes, variation_id)
               VALUES (?,?,?,?,?,'Placed',1,'Item',NULL,?,?,?)`,
      [o.lineId, id, codeId[o.code], o.supplier, o.desc, remaining(o, 'prior'), `Order value ${o.value.toLocaleString('en-IE')}`, o.vo ? voId[o.vo] : null])
  }

  // ── Forecast sheet for complete elements (final account values) ─────────
  let sort = 1
  for (const t of TRADES) for (const f of t.finals ?? []) {
    await run(`INSERT INTO forecast_lines (id, project_id, cost_code_id, parent_id, sort_order, supplier, status, factor, quantity, unit, rate, total, comment, variation_id)
               VALUES (?,?,?,NULL,?,?,'Final',NULL,NULL,NULL,NULL,?,'Final account agreed',NULL)`,
      [cuid(), id, codeId[f.code], sort++, f.supplier, f.total])
  }
  for (const t of TRADES) if (t.method) await run(`UPDATE trades SET forecast_method=? WHERE id=?`, [t.method, tradeId[t.name]])

  // ── Prelims sheet: rates and budgets only. Its CTD and Committed are read
  // from the Cost to Date and Committed lines on each code (v51), so the
  // stored columns stay 0.
  const setPrelims = async () => {
    for (const p of PRELIMS) {
      const fields = [p.section, p.desc, prelimBudget(p), 0, 0, 1, p.lump ? 'nr' : 'Weeks',
                      p.lump ? p.lump.toComplete : p.rate, p.lump ? 100 : (p.util ?? 100), 1, TOTAL_WEEKS]
      const upd = await run(`UPDATE prelim_items SET section=?, description=?, budget=?, ctd=?, committed=?, qty=?, unit=?, rate=?,
                               utilisation_pct=?, start_week=?, finish_week=? WHERE project_id=? AND cost_code=?`, [...fields, id, p.code])
      if (upd.rowsAffected === 0) {
        await run(`INSERT INTO prelim_items (id, project_id, section, description, budget, ctd, committed, qty, unit, rate,
                     utilisation_pct, start_week, finish_week, cost_code, sort_order, stage, notes)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,100,'Construction',NULL)`, [cuid(), id, ...fields, p.code])
      }
    }
  }
  await setPrelims()

  // ── Value certified per element, and the valuation ──────────────────────
  const prelimPct = (at: 'prior' | 'now') => 100 * (WEEKS_ELAPSED - (at === 'prior' ? 4 : 0)) / TOTAL_WEEKS
  const certified = (at: 'prior' | 'now') => {
    const out: Record<string, number> = {
      Preliminaries: round(prelimsTotal * markup * prelimPct(at) / 100),
    }
    for (const t of TRADES) out[t.name] = round(t.budget * markup * (at === 'prior' ? t.pctPrior : t.pctNow) / 100) + (t.voIncome ?? 0)
    return out
  }
  const setValue = async (at: 'prior' | 'now') => {
    const vc = certified(at)
    for (const [name, v] of Object.entries(vc)) await run(`UPDATE trades SET value_certified=? WHERE id=?`, [v, tradeId[name]])
    const cert = Object.values(vc).reduce((s, v) => s + v, 0)
    const prevCert = Object.values(certified('prior')).reduce((s, v) => s + v, 0)
    const posted = Object.values(ctdTotal).reduce((s, c) => s + (at === 'prior' ? c.prior : c.now), 0)
    await run(`UPDATE value_periods SET cumul_claimed=?, cumul_certified=?, unapproved_claims=?, revenue_received=?,
                 total_paid=?, risk_value=?, opportunity_value=?, app_ref=? WHERE project_id=?`,
      [cert + 64000, cert, 42000, round((at === 'prior' ? prevCert * 0.8 : prevCert) * (1 - RETENTION)),
       round(posted * 0.8), -60000, 35000, at === 'prior' ? 'AFP-07' : 'AFP-08', id])
  }
  await setValue('prior')

  // ── Snapshot last month exactly as "Lock period & roll forward" does ────
  // Shift the programme four weeks so time-based prelims are valued as at
  // last month end, snapshot with the real engine, then restore.
  await run(`UPDATE projects SET revised_start=? WHERE id=?`, [iso(addDays(start, 28)), id])
  const [kpis, trades] = await Promise.all([getDashboardKPIs(id), getTradeSummaries(id)])
  await run(`UPDATE projects SET revised_start=? WHERE id=?`, [iso(start), id])
  const tradePL: Record<string, { projPL: number; efc: number }> = {}
  for (const t of trades) tradePL[t.trade] = { projPL: t.projectedPL, efc: t.efc }
  await run(`INSERT INTO period_snapshots (id, period_id, efc, forecast_margin, total_ctd, total_claimed, cash_position, over_under_claim, trade_pl)
             VALUES (?,?,?,?,?,?,?,?,?)`,
    [cuid(), priorPeriodId, kpis.efc, kpis.forecastMargin, kpis.actualsTotal, kpis.totalClaimed, kpis.cashPosition, kpis.overUnderClaim, JSON.stringify(tradePL)])
  await run(`UPDATE report_periods SET locked_at=datetime('now'), is_current=0 WHERE id=?`, [priorPeriodId])
  const currentPeriodId = cuid()
  await run(`INSERT INTO report_periods (id, project_id, label, period_date, is_current, locked_at) VALUES (?,?,?,?,1,NULL)`,
    [currentPeriodId, id, monthLabel(currentEnd), iso(currentEnd)])

  // ── This month's movement ────────────────────────────────────────────────
  for (const t of TRADES) for (const c of t.costs ?? []) {
    if (c.now || c.accrual) await addCost(currentPeriodId, c.code, c.now ?? 0, c.accrual ?? 0, c.vo,
      c.accrual ? 'Accrual: work certified, invoice not yet received' : c.notes)
  }
  for (const { p, now } of prelimCost) if (now) await addCost(currentPeriodId, p.code, now, 0)
  for (const o of orders) await run(`UPDATE committed_lines SET total=? WHERE id=?`, [remaining(o, 'now'), o.lineId])
  await setValue('now')

  // ── Subcontractor register with Irish deduction cascade ─────────────────
  const subs = [
    { name: 'Atlantic Steel Fabricators Ltd', code: '2.1.01', order: 980000, rct: 20, status: 'Open', final: null,
      ins: 160, certs: [{ gross: 610000, date: addDays(priorEnd, -6), paid: true }, { gross: 815000, date: addDays(currentEnd, -10), paid: false }] },
    { name: 'Shannon Piling Ltd', code: '1.02', order: 254500, rct: 20, status: 'Agreed', final: 254500,
      ins: -12, certs: [{ gross: 205000, date: addDays(start, 70), paid: true }, { gross: 254500, date: addDays(start, 120), paid: true }] },
  ]
  for (const s of subs) {
    const subId = cuid()
    await run(`INSERT INTO subcontractors (id, project_id, name, retention_pct, rct_rate, tax_clearance_expiry, insurance_expiry,
                 final_account_status, final_account_value, order_value, notes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [subId, id, s.name, RETENTION * 100, s.rct, iso(addDays(now, 270)), iso(addDays(now, s.ins)), s.status, s.final, s.order,
       s.ins < 0 ? 'Insurance renewal requested' : null])
    for (let i = 0; i < s.certs.length; i++) {
      const c = s.certs[i]
      await run(`INSERT INTO sub_certs (id, project_id, subcontractor_id, cert_no, cert_date, gross_cumulative, retention_pct, rct_rate,
                   cost_code_id, variation_id, status, paid_date, notes)
                 VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?,NULL)`,
        [cuid(), id, subId, i + 1, iso(c.date), c.gross, RETENTION * 100, s.rct, codeId[s.code],
         c.paid ? 'Paid' : 'Certified', c.paid ? iso(addDays(c.date, 14)) : null])
    }
  }

  // ── S-curve: monthly cumulative position up to this month ───────────────
  const final = await getDashboardKPIs(id)
  const months: Date[] = []
  for (let d = monthEnd(start.getUTCFullYear(), start.getUTCMonth()); d <= currentEnd; d = monthEnd(d.getUTCFullYear(), d.getUTCMonth() + 1)) months.push(d)
  for (let i = 0; i < months.length; i++) {
    const f = Math.pow((i + 1) / months.length, 1.6)
    await run(`INSERT INTO s_curve_rows (id, project_id, month_label, month_date, sort_order, cumul_claimed, cumul_certified, cumul_cost)
               VALUES (?,?,?,?,?,?,?,?)`,
      [cuid(), id, months[i].toLocaleDateString('en-IE', { month: 'short', year: '2-digit', timeZone: 'UTC' }), iso(months[i]), i,
       round(final.totalClaimed * f), round(final.cumulCertified * f), round(final.actualsTotal * f)])
  }

  await writeAudit(id, 'Project', 'Created', 'Demo project', undefined, undefined, undefined, userName)
  return { id }
}
