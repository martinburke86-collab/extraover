import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { getDashboardKPIs, getTradeSummaries } from '@/lib/calculations'

export const dynamic = 'force-dynamic'

// GET — all periods + snapshots for a project
export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()

  const periodsR = await db.execute({
    sql: `SELECT rp.*, ps.efc, ps.forecast_margin, ps.total_ctd,
                 ps.total_claimed, ps.cash_position, ps.over_under_claim, ps.trade_pl
          FROM report_periods rp
          LEFT JOIN period_snapshots ps ON ps.period_id = rp.id
          WHERE rp.project_id = ?
          ORDER BY rp.period_date ASC`,
    args: [params.id],
  })

  const periods = periodsR.rows.map((r: any) => ({
    id:             String(r.id),
    label:          String(r.label),
    periodDate:     String(r.period_date),
    isCurrent:      Number(r.is_current) === 1,
    lockedAt:       r.locked_at ? String(r.locked_at) : null,
    efc:            r.efc            != null ? Number(r.efc)             : null,
    forecastMargin: r.forecast_margin != null ? Number(r.forecast_margin) : null,
    totalCtd:       r.total_ctd      != null ? Number(r.total_ctd)       : null,
    totalClaimed:   r.total_claimed  != null ? Number(r.total_claimed)   : null,
    cashPosition:   r.cash_position  != null ? Number(r.cash_position)   : null,
    overUnder:      r.over_under_claim != null ? Number(r.over_under_claim) : null,
    tradePL:        r.trade_pl ? JSON.parse(String(r.trade_pl)) : null,
  }))

  // Fetch live KPIs for the current (unlocked) period
  const currentPeriod = periods.find(p => p.isCurrent)
  let liveKpis = null
  if (currentPeriod && !currentPeriod.lockedAt) {
    try {
      const [kpis] = await Promise.all([getDashboardKPIs(params.id)])
      liveKpis = {
        efc:            kpis.efc,
        forecastMargin: kpis.forecastMargin,
        forecastMarginPct: kpis.forecastMarginPct,
        totalCtd:       kpis.actualsTotal,
        totalClaimed:   kpis.totalClaimed,
        cashPosition:   kpis.cashPosition,
        overUnder:      kpis.overUnderClaim,
      }
    } catch {}
  }

  return NextResponse.json({ periods, liveKpis })
}

// POST — lock current period and roll to next
export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const body = await req.json()
  const { newLabel, newDate } = body

  // 1. Get current period
  const curR = await db.execute({
    sql: `SELECT id FROM report_periods WHERE project_id=? AND is_current=1 LIMIT 1`,
    args: [params.id],
  })
  const currentPeriodId = curR.rows[0]?.id as string | undefined

  if (currentPeriodId) {
    // 2. Snapshot current KPIs
    const [kpis, trades] = await Promise.all([
      getDashboardKPIs(params.id),
      getTradeSummaries(params.id),
    ])
    const tradePL: Record<string, { projPL: number; efc: number }> = {}
    for (const t of trades) tradePL[t.trade] = { projPL: t.projectedPL, efc: t.efc }

    await db.execute({ sql: `DELETE FROM period_snapshots WHERE period_id=?`, args: [currentPeriodId] })
    await db.execute({
      sql: `INSERT INTO period_snapshots VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [cuid(), currentPeriodId, kpis.efc, kpis.forecastMargin, kpis.actualsTotal,
             kpis.totalClaimed, kpis.cashPosition, kpis.overUnderClaim, JSON.stringify(tradePL)],
    })

    // 3. Lock current period
    await db.execute({
      sql: `UPDATE report_periods SET locked_at=datetime('now'), is_current=0 WHERE id=?`,
      args: [currentPeriodId],
    })
  }

  // 4. Create new current period
  const newId = cuid()
  const dateStr = newDate || new Date().toISOString().slice(0, 10)
  await db.execute({
    sql: `INSERT INTO report_periods VALUES (?,?,?,?,1,NULL)`,
    args: [newId, params.id, newLabel || 'New Period', dateStr],
  })

  return NextResponse.json({ ok: true, newPeriodId: newId })
}
