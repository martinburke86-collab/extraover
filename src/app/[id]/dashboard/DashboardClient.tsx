'use client'
import { fmt, pct, clx } from '@/lib/utils'
import type { DashboardKPIs, TradeSummary } from '@/lib/calculations'
import { PageHeader, Panel, SectionTitle, KpiCard, MovCell, RagChip } from '@/components/ui'

interface Props { kpis: DashboardKPIs; trades: TradeSummary[]; projectId: string }

export default function DashboardClient({ kpis, trades, projectId }: Props) {
  const adjustedSum    = kpis.contractSum + kpis.approvedVars
  const forecastMargin = adjustedSum - kpis.efc
  const fmPct          = adjustedSum ? forecastMargin / adjustedSum : 0
  const savingsOverrun = forecastMargin - kpis.originalMargin
  const cashPos        = kpis.revenueReceived - kpis.totalPaid
  const overUnder      = kpis.totalClaimed - kpis.actualsTotal
  const totalEfc       = trades.reduce((s, t) => s + t.efc, 0)
  const rag: 'green' | 'amber' | 'red' = fmPct >= 0.08 ? 'green' : fmPct >= 0.03 ? 'amber' : 'red'

  // Read-only value display
  function Val({ v, bold, accent }: { v: string; bold?: boolean; accent?: 'profit'|'loss' }) {
    return (
      <span className={clx(
        'tabular-nums',
        bold ? 'font-black' : 'font-semibold',
        accent === 'profit' ? 'text-tertiary' : accent === 'loss' ? 'text-error' : 'text-on-surface'
      )}>{v}</span>
    )
  }

  function DataRow({ label, curr, prev, bold, accent, pctFmt }: {
    label: string; curr: number; prev?: number; bold?: boolean
    accent?: 'profit' | 'loss' | 'highlight'; pctFmt?: boolean
  }) {
    const f  = pctFmt ? pct : fmt
    const mv = prev !== undefined ? curr - prev : null
    return (
      <tr style={accent === 'highlight' ? { background: '#EEF4FA' } : accent === 'profit' ? { background: '#F0FCE0' } : accent === 'loss' ? { background: '#FFF0F0' } : {}}>
        <td className={clx('py-2 text-[11px]', bold ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant')}>{label}</td>
        <td className={clx('py-2 text-right tabular-nums text-[11px]', bold ? 'font-black' : 'font-semibold',
          accent === 'profit' ? 'text-tertiary' : accent === 'loss' ? 'text-error' : 'text-on-surface')}>{f(curr)}</td>
        <td className="py-2 text-right tabular-nums text-[11px] text-on-surface-variant">{prev !== undefined ? f(prev) : '–'}</td>
        <td className="py-2 text-right text-[10px]">
          {mv !== null && mv !== 0 ? <MovCell value={mv} formatted={f(Math.abs(mv))} /> : <span className="text-outline-variant">–</span>}
        </td>
      </tr>
    )
  }

  function ColHdrs() {
    return (
      <thead>
        <tr className="border-b border-outline-variant/10">
          <th className="py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wide text-left">Metric</th>
          <th className="py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wide text-right">This Period</th>
          <th className="py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wide text-right">Prev</th>
          <th className="py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wide text-right">Δ</th>
        </tr>
      </thead>
    )
  }

  function SubHdr({ label }: { label: string }) {
    return <tr><td colSpan={4} className="pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{label}</td></tr>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Executive Dashboard"
        subtitle={kpis.projectName ? kpis.projectName + " · " + new Date().toLocaleDateString("en-IE", { month: "long", year: "numeric" }) : new Date().toLocaleDateString("en-IE", { month: "long", year: "numeric" })}
        actions={<RagChip status={rag} />}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">

        {/* KPI strip */}
        <section className="grid grid-cols-5 gap-3">
          <KpiCard label="Adjusted Contract Sum" value={fmt(adjustedSum)} />
          <KpiCard label="Estimated Final Cost"  value={kpis.efc ? fmt(kpis.efc) : '–'} />
          <KpiCard
            label="Forecast Margin"
            value={`${fmt(forecastMargin)} · ${pct(fmPct)}`}
            accent={rag === 'green' ? 'profit' : rag === 'red' ? 'loss' : 'default'}
            trend={rag === 'green' ? 'up' : 'down'}
            sub={rag === 'green' ? 'On Track' : 'At Risk'} />
          <KpiCard label="Financial % Complete"  value={pct(kpis.financialPct)} sub={`${fmt(kpis.actualsTotal)} spent`} />
          <KpiCard
            label="Over / (Under) Claim"
            value={overUnder ? fmt(overUnder) : '–'}
            accent={overUnder > 0 ? 'loss' : 'default'} />
        </section>

        {/* Three panels */}
        <section className="grid grid-cols-3 gap-5 items-start">

          {/* Financial Position */}
          <Panel accent="primary">
            <div className="p-5">
              <SectionTitle action={<RagChip status={rag} />}>Financial Position</SectionTitle>
              <p className="text-[10px] text-on-surface-variant mb-3">Edit values on the relevant input sheets. This panel is read-only.</p>
              <table className="w-full">
                <ColHdrs />
                <tbody className="divide-y divide-outline-variant/5">
                  <SubHdr label="Contract" />
                  <DataRow label="Original Contract Sum"  curr={kpis.contractSum} />
                  <DataRow label="Approved Variations"    curr={kpis.approvedVars} />
                  <DataRow label="Adjusted Contract Sum"  curr={adjustedSum}       bold accent="highlight" />
                  <SubHdr label="Forecast" />
                  <DataRow label="Estimated Final Cost"   curr={kpis.efc}           prev={kpis.prevEfc} />
                  <DataRow label="Forecast Margin (€)"    curr={forecastMargin}     prev={kpis.prevForecastMargin} bold accent={forecastMargin >= 0 ? 'profit' : 'loss'} />
                  <DataRow label="Forecast Margin (%)"    curr={fmPct}              pctFmt />
                  <SubHdr label="vs Budget" />
                  <DataRow label="Original Budget Cost"   curr={kpis.originalBudget} />
                  <DataRow label="Original Margin"        curr={kpis.originalMargin} />
                  <DataRow label="Savings / (Overrun)"    curr={savingsOverrun}     bold accent={savingsOverrun >= 0 ? 'profit' : 'loss'} />
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Progress Claims & Cash */}
          <Panel accent="error">
            <div className="p-5">
              <SectionTitle>Progress Claims & Cash</SectionTitle>
              <p className="text-[10px] text-on-surface-variant mb-3">Update values on the Value / Claims sheet.</p>

              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex justify-between text-[10px] mb-1.5 font-bold uppercase text-on-surface-variant">
                  <span>Cumulative Claimed</span>
                  <span>{fmt(kpis.totalClaimed)} / {fmt(adjustedSum)}</span>
                </div>
                <div className="w-full bg-surface-container h-2 overflow-hidden flex">
                  <div className="bg-tertiary h-full" style={{ width: `${Math.min(100, adjustedSum ? (kpis.cumulCertified/adjustedSum)*100 : 0)}%` }} />
                  <div className="bg-primary h-full opacity-40" style={{ width: `${Math.min(20, adjustedSum ? ((kpis.totalClaimed-kpis.cumulCertified)/adjustedSum)*100 : 0)}%` }} />
                </div>
                <div className="mt-1.5 flex gap-4 text-[9px] uppercase font-bold text-on-surface-variant">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-tertiary inline-block" />Certified</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-primary opacity-40 inline-block" />Pending</div>
                </div>
              </div>

              <table className="w-full">
                <ColHdrs />
                <tbody className="divide-y divide-outline-variant/5">
                  <SubHdr label="Applications & Certs" />
                  <DataRow label="Total Claimed to Date"   curr={kpis.totalClaimed}    prev={kpis.prevTotalClaimed} />
                  <DataRow label="Cumulative Certified"    curr={kpis.cumulCertified}   bold />
                  <SubHdr label="Cash Position" />
                  <DataRow label="Revenue Received"        curr={kpis.revenueReceived} />
                  <DataRow label="Total Paid to Date"      curr={kpis.totalPaid} />
                  <DataRow label="Cash Position"           curr={cashPos} prev={kpis.prevCashPosition} bold accent={cashPos >= 0 ? 'profit' : 'loss'} />
                  <SubHdr label="Cost Analysis" />
                  <DataRow label="Posted Costs"            curr={kpis.postedCostTotal} />
                  <DataRow label="Accruals"                curr={kpis.accrualsTotal} />
                  <DataRow label="Actuals incl. Accruals"  curr={kpis.actualsTotal}     bold />
                  <DataRow label="Financial % Complete"    curr={kpis.financialPct}     pctFmt />
                  <DataRow label="Over / (Under) Claim"    curr={overUnder} prev={kpis.prevOverUnder} bold accent={overUnder > 0 ? 'loss' : 'profit'} />
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Trade Performance + Programme */}
          <div className="flex flex-col gap-4">
            <Panel accent="amber">
              <div className="p-5">
                <SectionTitle action={
                  <div className="flex gap-1.5">
                    <span className="material-symbols-outlined text-outline" style={{ fontSize: 14 }}>filter_alt</span>
                    <span className="material-symbols-outlined text-outline" style={{ fontSize: 14 }}>sort</span>
                  </div>
                }>Trade Performance</SectionTitle>

                <div className="mb-4">
                  <h4 className="text-[9px] font-black text-tertiary uppercase tracking-widest mb-2">Profit Positions</h4>
                  <div className="space-y-1.5">
                    {trades.filter(t => t.projectedPL > 0).slice(0, 3).map(t => (
                      <div key={t.trade} className="flex items-center justify-between p-2 rounded-sm" style={{ background: '#F0FCE0' }}>
                        <span className="text-[11px] font-bold uppercase">{t.trade}</span>
                        <span className="text-[11px] font-black tabular-nums text-tertiary">+{fmt(t.projectedPL)}</span>
                      </div>
                    ))}
                    {trades.filter(t => t.projectedPL > 0).length === 0 && (
                      <p className="text-[10px] text-on-surface-variant text-center py-2">No profit positions</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[9px] font-black text-error uppercase tracking-widest mb-2">Overrun Positions</h4>
                  <div className="space-y-1.5">
                    {trades.filter(t => t.projectedPL < 0).slice(0, 4).map(t => (
                      <div key={t.trade} className="flex items-center justify-between p-2 rounded-sm" style={{ background: '#FFF0F0' }}>
                        <span className="text-[11px] font-bold uppercase">{t.trade}</span>
                        <span className="text-[11px] font-black tabular-nums text-error">{fmt(t.projectedPL)}</span>
                      </div>
                    ))}
                    {trades.filter(t => t.projectedPL < 0).length === 0 && (
                      <p className="text-[10px] text-on-surface-variant text-center py-2">No overrun positions</p>
                    )}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel accent="outline">
              <div className="p-4">
                <SectionTitle>Programme</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Revised Start',  '03-Jul-26'],
                    ['Revised Finish', '30-Sep-27'],
                    ['Wks Elapsed',    '0'],
                    ['Wks Remaining',  '65'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wide">{label}</div>
                      <div className="text-sm font-black text-on-surface mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

        </section>
      </div>
    </div>
  )
}
