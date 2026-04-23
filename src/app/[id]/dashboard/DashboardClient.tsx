'use client'
import { fmt, pct, clx } from '@/lib/utils'
import type { DashboardKPIs, TradeSummary } from '@/lib/calculations'
import type { HealthIssue } from '@/lib/healthCheck'
import { PageHeader, Panel, SectionTitle, KpiCard, MovCell, RagChip } from '@/components/ui'
import HealthBanner from '@/components/HealthBanner'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer, Area, ComposedChart,
} from 'recharts'

type TrendPoint = {
  label: string
  efc: number
  forecastMargin: number
  totalCtd: number
  totalClaimed: number
}

interface Props {
  kpis: DashboardKPIs
  trades: TradeSummary[]
  projectId: string
  healthIssues: HealthIssue[]
  trendData: TrendPoint[]
  adjustedSum: number
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}m`
  if (Math.abs(n) >= 1_000)     return `€${(n / 1_000).toFixed(0)}k`
  return `€${Math.round(n)}`
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#1e3a5f' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, color: p.color, marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtM(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardClient({ kpis, trades, projectId, healthIssues, trendData, adjustedSum }: Props) {
  const forecastMargin = adjustedSum - kpis.efc
  const fmPct          = adjustedSum ? forecastMargin / adjustedSum : 0
  const savingsOverrun = forecastMargin - kpis.originalMargin
  const cashPos        = kpis.revenueReceived - kpis.totalPaid
  const overUnder      = kpis.totalClaimed - kpis.actualsTotal
  const rag: 'green' | 'amber' | 'red' = fmPct >= 0.08 ? 'green' : fmPct >= 0.03 ? 'amber' : 'red'

  const hasTrend = trendData.length > 1

  // EFC direction — compare first locked snapshot to current
  const firstSnap  = trendData.length > 1 ? trendData[0] : null
  const efcTrend   = firstSnap ? kpis.efc - firstSnap.efc : 0
  const efcDirUp   = efcTrend > 0 // EFC going up = bad

  function DataRow({ label, curr, prev, bold, accent, pctFmt }: {
    label: string; curr: number; prev?: number; bold?: boolean
    accent?: 'profit' | 'loss' | 'highlight'; pctFmt?: boolean
  }) {
    const f  = pctFmt ? pct : fmt
    const mv = prev !== undefined ? curr - prev : null
    return (
      <tr style={
        accent === 'highlight' ? { background: '#EEF4FA' } :
        accent === 'profit'    ? { background: '#F0FCE0' } :
        accent === 'loss'      ? { background: '#FFF0F0' } : {}
      }>
        <td className={clx('py-2 text-[11px]', bold ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant')}>{label}</td>
        <td className={clx('py-2 text-right tabular-nums text-[11px]', bold ? 'font-black' : 'font-semibold',
          accent === 'profit' ? 'text-tertiary' : accent === 'loss' ? 'text-error' : 'text-on-surface')}>
          {f(curr)}
        </td>
        <td className="py-2 text-right tabular-nums text-[11px] text-on-surface-variant hidden sm:table-cell">
          {prev !== undefined ? f(prev) : '–'}
        </td>
        <td className="py-2 text-right text-[10px] hidden sm:table-cell">
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
          <th className="py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wide text-right">This period</th>
          <th className="py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wide text-right hidden sm:table-cell">Prev</th>
          <th className="py-2 text-[9px] font-bold text-on-surface-variant uppercase tracking-wide text-right hidden sm:table-cell">Δ</th>
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
        subtitle={kpis.projectName
          ? kpis.projectName + ' · ' + new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })
          : new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
        actions={<RagChip status={rag} />}
      />

      {healthIssues.length > 0 && (
        <HealthBanner issues={healthIssues} projectId={projectId} />
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-5 bg-background">

        {/* ── KPI strip ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          <KpiCard label="Adjusted Contract Sum" value={fmt(adjustedSum)} />
          <KpiCard label="Estimated Final Cost"  value={kpis.efc ? fmt(kpis.efc) : '–'} />
          <KpiCard
            label="Forecast Margin"
            value={`${fmt(forecastMargin)} · ${pct(fmPct)}`}
            accent={rag === 'green' ? 'profit' : rag === 'red' ? 'loss' : 'default'}
            trend={rag === 'green' ? 'up' : 'down'}
            sub={rag === 'green' ? 'On Track' : 'At Risk'} />
          <KpiCard label="Financial % Complete" value={pct(kpis.financialPct)} sub={`${fmt(kpis.actualsTotal)} spent`} />
          <KpiCard
            label="Over / (Under) Claim"
            value={overUnder ? fmt(overUnder) : '–'}
            accent={overUnder > 0 ? 'loss' : 'default'} />
          {(() => {
            const wip = kpis.cumulCertified - kpis.revenueReceived
            return (
              <KpiCard
                label={wip >= 0 ? 'WIP' : 'Overbilling'}
                value={fmt(Math.abs(wip))}
                sub={wip >= 0 ? 'Certified not yet received' : 'Received exceeds certified'}
                accent={wip >= 0 ? 'default' : 'warning'}
              />
            )
          })()}
        </section>

        {/* ── EFC Trend chart ────────────────────────────────────────────── */}
        {hasTrend && (
          <Panel accent="primary">
            <div className="p-4 md:p-5">
              <div className="flex items-start justify-between mb-4 gap-4">
                <div>
                  <SectionTitle>EFC trend</SectionTitle>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    Estimated Final Cost movement across locked periods
                  </p>
                </div>

                {/* Mini summary tiles */}
                <div className="flex gap-3 flex-shrink-0">
                  {firstSnap && (
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wide text-on-surface-variant font-bold">EFC movement</div>
                      <div className={clx('text-sm font-black tabular-nums', efcDirUp ? 'text-error' : 'text-tertiary')}>
                        {efcDirUp ? '+' : ''}{fmtM(efcTrend)}
                      </div>
                      <div className="text-[9px] text-on-surface-variant">since {firstSnap.label}</div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wide text-on-surface-variant font-bold">Periods locked</div>
                    <div className="text-sm font-black text-on-surface">{trendData.length - 1}</div>
                  </div>
                </div>
              </div>

              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={fmtM}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(value) => <span style={{ color: '#6b7280' }}>{value}</span>}
                    />

                    {/* Contract sum reference line */}
                    <ReferenceLine
                      y={adjustedSum}
                      stroke="#1e3a5f"
                      strokeDasharray="5 3"
                      strokeWidth={1}
                      label={{ value: 'Contract sum', position: 'insideTopRight', fontSize: 9, fill: '#1e3a5f', dy: -4 }}
                    />

                    {/* Shaded area under EFC */}
                    <Area
                      type="monotone"
                      dataKey="efc"
                      name="EFC"
                      stroke="#9f403d"
                      strokeWidth={2.5}
                      fill="#9f403d"
                      fillOpacity={0.06}
                      dot={{ r: 3, fill: '#9f403d', stroke: '#fff', strokeWidth: 1.5 }}
                      activeDot={{ r: 5 }}
                    />

                    {/* CTD line */}
                    <Line
                      type="monotone"
                      dataKey="totalCtd"
                      name="Cost to date"
                      stroke="#1e3a5f"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#1e3a5f', stroke: '#fff', strokeWidth: 1.5 }}
                      activeDot={{ r: 5 }}
                      strokeDasharray="0"
                    />

                    {/* Claimed line */}
                    <Line
                      type="monotone"
                      dataKey="totalClaimed"
                      name="Claimed"
                      stroke="#456919"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#456919', stroke: '#fff', strokeWidth: 1.5 }}
                      activeDot={{ r: 5 }}
                      strokeDasharray="4 2"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Legend explanation */}
              <div className="flex flex-wrap gap-4 mt-3 text-[10px] text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span style={{ width: 20, height: 2.5, background: '#9f403d', display: 'inline-block', borderRadius: 2 }} />
                  EFC — if trending up, cost is growing
                </span>
                <span className="flex items-center gap-1.5">
                  <span style={{ width: 20, height: 2, background: '#1e3a5f', display: 'inline-block', borderRadius: 2 }} />
                  Cost to date
                </span>
                <span className="flex items-center gap-1.5">
                  <span style={{ width: 20, height: 2, background: '#456919', display: 'inline-block', borderRadius: 2, backgroundImage: 'repeating-linear-gradient(90deg, #456919 0, #456919 4px, transparent 4px, transparent 6px)' }} />
                  Claimed
                </span>
              </div>
            </div>
          </Panel>
        )}

        {/* ── No periods locked yet ───────────────────────────────────────── */}
        {!hasTrend && (
          <Panel accent="outline">
            <div className="p-4 flex items-center gap-4">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 28, opacity: 0.4 }}>timeline</span>
              <div>
                <div className="text-sm font-semibold text-on-surface">EFC trend will appear here</div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Lock your first period from Settings → Lock Period to start tracking EFC movement over time.
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* ── Earned Value panel ────────────────────────────────────────── */}
        {(kpis.cumulCertified > 0 || kpis.actualsTotal > 0) && (() => {
          const ev   = kpis.cumulCertified          // Earned Value = cumulative certified
          const ac   = kpis.actualsTotal            // Actual Cost to date
          const pv   = adjustedSum * kpis.financialPct // Planned Value proxy
          const cv   = ev - ac                      // Cost Variance
          const sv   = ev - pv                      // Schedule Variance
          const cpi  = ac > 0 ? ev / ac : null
          const spi  = pv > 0 ? ev / pv : null

          // Profit earned = projected margin % × certified value to date
          // This is the portion of the forecast profit that has been "earned" through certified work
          const projMarginPct  = adjustedSum > 0 ? forecastMargin / adjustedSum : 0
          const profitEarned   = ev * projMarginPct
          const profitGood     = profitEarned >= 0
          const cvGood         = cv >= 0
          const svGood         = sv >= 0

          return (
            <Panel accent={cvGood ? 'primary' : 'error'}>
              <div className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle>Earned Value — Profit to Date</SectionTitle>
                  <div className={clx('px-2.5 py-1 rounded text-[11px] font-bold',
                    profitGood ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
                    {profitGood ? '▲ Profitable' : '▼ Loss position'}
                  </div>
                </div>

                {/* Main EV figures */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Certified to date',  val: fmt(ev),           sub: 'Cumulative certified',             col: 'text-on-surface' },
                    { label: 'Cost to date',        val: fmt(ac),           sub: 'Actual cost incurred',             col: 'text-on-surface' },
                    { label: 'Profit earned',       val: fmt(profitEarned), sub: `${pct(projMarginPct)} margin × certified`, col: profitGood ? 'text-tertiary' : 'text-error' },
                    { label: 'CPI',                 val: cpi ? cpi.toFixed(2) : '—',
                      sub: cpi ? (cpi >= 1 ? 'Cost efficient' : 'Cost overrun') : 'No cost data',
                      col: !cpi ? 'text-on-surface-variant' : cpi >= 1 ? 'text-tertiary' : 'text-error' },
                  ].map(k => (
                    <div key={k.label} className="bg-surface-container-low p-4 flex flex-col justify-between h-20">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{k.label}</span>
                      <div>
                        <span className={`text-2xl font-black tabular-nums tracking-tight ${k.col}`}>{k.val}</span>
                        <div className="text-[10px] font-bold text-on-surface-variant mt-0.5">{k.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Variance bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1 font-bold uppercase text-on-surface-variant">
                      <span>Cost Variance (EV − AC)</span>
                      <span style={{ color: cvGood ? '#27500A' : '#991B1B' }}>{fmt(cv)}</span>
                    </div>
                    <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: cvGood ? '#456919' : '#9f403d',
                        width: `${Math.min(100, ev > 0 ? Math.abs(cv) / ev * 100 : 0)}%`,
                        marginLeft: cvGood ? 0 : 'auto',
                      }} />
                    </div>
                    <div className="text-[9px] text-on-surface-variant mt-1">
                      {cvGood ? 'Spending less than the value earned — cost efficient' : 'Spending more than the value earned — investigate'}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1 font-bold uppercase text-on-surface-variant">
                      <span>Schedule Variance (EV − PV)</span>
                      <span style={{ color: svGood ? '#27500A' : '#991B1B' }}>{fmt(sv)}</span>
                    </div>
                    <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: svGood ? '#456919' : '#9f403d',
                        width: `${Math.min(100, pv > 0 ? Math.abs(sv) / pv * 100 : 0)}%`,
                      }} />
                    </div>
                    <div className="text-[9px] text-on-surface-variant mt-1">
                      SPI {spi ? spi.toFixed(2) : '—'} · {svGood ? 'Ahead of planned spend profile' : 'Behind planned spend profile'}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-on-surface-variant mt-3">
                  Profit earned = projected margin % ({pct(projMarginPct)}) × cumulative certified · CPI = certified ÷ actual cost · SPI = certified ÷ planned value
                </p>
              </div>
            </Panel>
          )
        })()}


        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">

          {/* Financial Position */}
          <Panel accent="primary">
            <div className="p-4 md:p-5">
              <SectionTitle action={<RagChip status={rag} />}>Financial Position</SectionTitle>
              <p className="text-[10px] text-on-surface-variant mb-3">Read-only. Edit on the relevant input sheets.</p>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[280px]">
                  <ColHdrs />
                  <tbody className="divide-y divide-outline-variant/5">
                    <SubHdr label="Contract" />
                    <DataRow label="Original Contract Sum" curr={kpis.contractSum} />
                    <DataRow label="Approved Variations"   curr={kpis.approvedVars} />
                    <DataRow label="Adjusted Contract Sum" curr={adjustedSum}        bold accent="highlight" />
                    <SubHdr label="Forecast" />
                    <DataRow label="Estimated Final Cost"  curr={kpis.efc}           prev={kpis.prevEfc} />
                    <DataRow label="Forecast Margin (€)"   curr={forecastMargin}     prev={kpis.prevForecastMargin} bold accent={forecastMargin >= 0 ? 'profit' : 'loss'} />
                    <DataRow label="Forecast Margin (%)"   curr={fmPct}              pctFmt />
                    <SubHdr label="vs Budget" />
                    <DataRow label="Original Budget"        curr={kpis.originalBudget} />
                    <DataRow label="Original Margin"        curr={kpis.originalMargin} />
                    <DataRow label="Savings / (Overrun)"    curr={savingsOverrun}      bold accent={savingsOverrun >= 0 ? 'profit' : 'loss'} />
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          {/* Progress Claims & Cash */}
          <Panel accent="error">
            <div className="p-4 md:p-5">
              <SectionTitle>Progress Claims & Cash</SectionTitle>
              <p className="text-[10px] text-on-surface-variant mb-3">Update on the Value / Claims sheet.</p>

              <div className="mb-4">
                <div className="flex justify-between text-[10px] mb-1.5 font-bold uppercase text-on-surface-variant">
                  <span>Cumulative Claimed</span>
                  <span className="tabular-nums">{fmt(kpis.totalClaimed)} / {fmt(adjustedSum)}</span>
                </div>
                <div className="w-full bg-surface-container h-2 overflow-hidden flex rounded-full">
                  <div className="bg-tertiary h-full"
                    style={{ width: `${Math.min(100, adjustedSum ? (kpis.cumulCertified / adjustedSum) * 100 : 0)}%` }} />
                  <div className="bg-primary h-full opacity-40"
                    style={{ width: `${Math.min(20, adjustedSum ? ((kpis.totalClaimed - kpis.cumulCertified) / adjustedSum) * 100 : 0)}%` }} />
                </div>
                <div className="mt-1.5 flex gap-4 text-[9px] uppercase font-bold text-on-surface-variant">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-tertiary inline-block rounded-full" />Certified</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-primary opacity-40 inline-block rounded-full" />Pending</div>
                </div>
              </div>

              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[280px]">
                  <ColHdrs />
                  <tbody className="divide-y divide-outline-variant/5">
                    <SubHdr label="Applications & Certs" />
                    <DataRow label="Total Claimed"          curr={kpis.totalClaimed}   prev={kpis.prevTotalClaimed} />
                    <DataRow label="Cumul. Certified"       curr={kpis.cumulCertified}  bold />
                    <SubHdr label="WIP / Cash Position" />
                    <DataRow label="Revenue Received"       curr={kpis.revenueReceived} />
                    <DataRow label="Total Paid"             curr={kpis.totalPaid} />
                    <DataRow label="Cash Position"          curr={cashPos} prev={kpis.prevCashPosition} bold accent={cashPos >= 0 ? 'profit' : 'loss'} />
                    {(() => {
                      const wip         = kpis.cumulCertified - kpis.revenueReceived
                      const wipGood     = wip >= 0   // positive = money owed to us (normal)
                      return (
                        <>
                          <DataRow
                            label={wip >= 0 ? 'WIP (certified not received)' : 'Overbilling (received > certified)'}
                            curr={Math.abs(wip)}
                            bold
                            accent={wipGood ? 'profit' : 'highlight'}
                          />
                        </>
                      )
                    })()}
                    <SubHdr label="Cost Analysis" />
                    <DataRow label="Posted Costs"           curr={kpis.postedCostTotal} />
                    <DataRow label="Accruals"               curr={kpis.accrualsTotal} />
                    <DataRow label="Actuals incl. Accruals" curr={kpis.actualsTotal}    bold />
                    <DataRow label="Financial % Complete"   curr={kpis.financialPct}    pctFmt />
                    <DataRow label="Over / (Under) Claim"   curr={overUnder} prev={kpis.prevOverUnder} bold accent={overUnder > 0 ? 'loss' : 'profit'} />
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          {/* Trade Performance + Programme */}
          <div className="flex flex-col gap-4">
            <Panel accent="amber">
              <div className="p-4 md:p-5">
                <SectionTitle>Trade Performance</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  <div>
                    <h4 className="text-[9px] font-black text-tertiary uppercase tracking-widest mb-2">Profit positions</h4>
                    <div className="space-y-1.5">
                      {trades.filter(t => t.projectedPL > 0).slice(0, 4).map(t => (
                        <div key={t.trade} className="flex items-center justify-between p-2 rounded-sm" style={{ background: '#F0FCE0' }}>
                          <span className="text-[11px] font-bold uppercase truncate mr-2">{t.trade}</span>
                          <span className="text-[11px] font-black tabular-nums text-tertiary flex-shrink-0">+{fmt(t.projectedPL)}</span>
                        </div>
                      ))}
                      {trades.filter(t => t.projectedPL > 0).length === 0 && (
                        <p className="text-[10px] text-on-surface-variant text-center py-2">No profit positions</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black text-error uppercase tracking-widest mb-2">Overrun positions</h4>
                    <div className="space-y-1.5">
                      {trades.filter(t => t.projectedPL < 0).slice(0, 4).map(t => (
                        <div key={t.trade} className="flex items-center justify-between p-2 rounded-sm" style={{ background: '#FFF0F0' }}>
                          <span className="text-[11px] font-bold uppercase truncate mr-2">{t.trade}</span>
                          <span className="text-[11px] font-black tabular-nums text-error flex-shrink-0">{fmt(t.projectedPL)}</span>
                        </div>
                      ))}
                      {trades.filter(t => t.projectedPL < 0).length === 0 && (
                        <p className="text-[10px] text-on-surface-variant text-center py-2">No overruns</p>
                      )}
                    </div>
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
