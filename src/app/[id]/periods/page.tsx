import { initDB, db } from '@/lib/db'
import PeriodsClient from './PeriodsClient'
import { getDashboardKPIs } from '@/lib/calculations'
export const dynamic = 'force-dynamic'

export default async function PeriodsPage({ params }: { params: { id: string } }) {
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
    efc:            r.efc             != null ? Number(r.efc)              : null,
    forecastMargin: r.forecast_margin != null ? Number(r.forecast_margin)  : null,
    totalCtd:       r.total_ctd       != null ? Number(r.total_ctd)        : null,
    totalClaimed:   r.total_claimed   != null ? Number(r.total_claimed)    : null,
    cashPosition:   r.cash_position   != null ? Number(r.cash_position)    : null,
    overUnder:      r.over_under_claim!= null ? Number(r.over_under_claim) : null,
    tradePL:        r.trade_pl ? JSON.parse(String(r.trade_pl)) : null,
  }))

  let liveKpis = null
  const currentPeriod = periods.find(p => p.isCurrent)
  if (currentPeriod && !currentPeriod.lockedAt) {
    try {
      const kpis = await getDashboardKPIs(params.id)
      liveKpis = {
        efc:               kpis.efc,
        forecastMargin:    kpis.forecastMargin,
        forecastMarginPct: kpis.forecastMarginPct,
        totalCtd:          kpis.actualsTotal,
        totalClaimed:      kpis.totalClaimed,
        cashPosition:      kpis.cashPosition,
        overUnder:         kpis.overUnderClaim,
      }
    } catch {}
  }

  return <PeriodsClient periods={periods} liveKpis={liveKpis} projectId={params.id} />
}
