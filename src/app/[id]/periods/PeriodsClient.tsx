'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { useToast } from '@/components/Toast'

type Period = {
  id: string
  label: string
  periodDate: string
  isCurrent: boolean
  lockedAt: string | null
  efc: number | null
  forecastMargin: number | null
  totalCtd: number | null
  totalClaimed: number | null
  cashPosition: number | null
  overUnder: number | null
  tradePL: Record<string, { projPL: number; efc: number }> | null
}

type LiveKpis = {
  efc: number
  forecastMargin: number
  forecastMarginPct: number
  totalCtd: number
  totalClaimed: number
  cashPosition: number
  overUnder: number
}

function Delta({ current, prior, lowerIsBetter = false }: {
  current: number | null; prior: number | null; lowerIsBetter?: boolean
}) {
  if (current == null || prior == null) return <span className="text-on-surface-variant/30 text-xs">—</span>
  const diff = current - prior
  if (Math.abs(diff) < 1) return <span className="text-on-surface-variant/40 text-xs">—</span>
  const improved = lowerIsBetter ? diff < 0 : diff > 0
  return (
    <span className={clx('text-xs font-medium tabular-nums inline-flex items-center gap-0.5',
      improved ? 'text-[#456919]' : 'text-[#9f403d]')}>
      {improved ? '▲' : '▼'} {diff > 0 ? '+' : ''}{fmt(diff)}
    </span>
  )
}

function PctDelta({ current, prior, lowerIsBetter = false }: {
  current: number | null; prior: number | null; lowerIsBetter?: boolean
}) {
  if (current == null || prior == null) return null
  const diff = current - prior
  if (Math.abs(diff) < 0.0001) return null
  const improved = lowerIsBetter ? diff < 0 : diff > 0
  const pctStr = (diff > 0 ? '+' : '') + (diff * 100).toFixed(1) + '%'
  return (
    <span className={clx('text-[10px] font-medium ml-1', improved ? 'text-[#456919]' : 'text-[#9f403d]')}>
      {pctStr}
    </span>
  )
}

function Money({ v, cls }: { v: number | null; cls?: string }) {
  if (v == null) return <span className="text-on-surface-variant/30">—</span>
  return <span className={clx('tabular-nums', cls)}>{v === 0 ? '—' : fmt(v)}</span>
}

export default function PeriodsClient({
  periods,
  liveKpis,
  projectId,
}: {
  periods: Period[]
  liveKpis: LiveKpis | null
  projectId: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const { toast } = useToast()
  const [rolling, setRolling] = useState(false)
  const [showRollForm, setShowRollForm] = useState(false)
  const [newLabel, setNewLabel] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })
  })
  const [newDate, setNewDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1, 0) // last day of next month
    return d.toISOString().slice(0, 10)
  })

  // Display newest first
  const sorted = [...periods].reverse()
  const currentPeriod = periods.find(p => p.isCurrent)

  async function lockAndRoll() {
    setRolling(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newLabel, newDate }),
      })
      if (!res.ok) throw new Error()
      toast(`Period locked · ${newLabel} is now current`, 'success')
      setShowRollForm(false)
      startTransition(() => router.refresh())
    } catch {
      toast('Failed to lock period', 'error')
    }
    setRolling(false)
  }

  // Get prior period data for a given index (in sorted = newest-first array)
  function getPrior(idx: number): Period | null {
    return sorted[idx + 1] || null
  }

  function getPriorMetrics(p: Period, prior: Period | null) {
    return {
      efc:           prior?.efc           ?? null,
      forecastMargin:prior?.forecastMargin ?? null,
      totalCtd:      prior?.totalCtd      ?? null,
      totalClaimed:  prior?.totalClaimed  ?? null,
      cashPosition:  prior?.cashPosition  ?? null,
      overUnder:     prior?.overUnder     ?? null,
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Period History"
        subtitle="Month-on-month CVR comparison · lock periods to preserve snapshots"
        actions={
          <div className="flex items-center gap-2">
            {!showRollForm && (
              <button
                onClick={() => setShowRollForm(true)}
                className="bg-[#1e3a5f] text-white px-4 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#16304f] font-medium">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>lock</span>
                Lock period & roll forward
              </button>
            )}
          </div>
        }
      />

      {/* Roll form */}
      {showRollForm && (
        <div className="bg-[#FFFFC7] border-b border-amber-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <span className="text-sm font-medium text-on-surface">
            Lock <strong>{currentPeriod?.label || 'current period'}</strong> and start:
          </span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-on-surface-variant uppercase tracking-wide">Label</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-on-surface-variant uppercase tracking-wide">Period end date</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button
            onClick={lockAndRoll}
            disabled={rolling || !newLabel.trim()}
            className="bg-[#456919] text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-40 hover:bg-[#3a5715]">
            {rolling ? 'Locking…' : 'Confirm lock & roll'}
          </button>
          <button onClick={() => setShowRollForm(false)}
            className="text-sm text-on-surface-variant hover:text-on-surface">
            Cancel
          </button>
        </div>
      )}

      {/* Summary strip for current live KPIs */}
      {liveKpis && (
        <div className="bg-[#1e3a5f] px-6 py-2.5 flex items-center gap-8 flex-shrink-0">
          <div className="text-white">
            <div className="text-[10px] uppercase tracking-wide opacity-60">Current period</div>
            <div className="text-xs font-bold opacity-90">{currentPeriod?.label || '—'}</div>
          </div>
          {[
            { label: 'Live EFC',        val: fmt(liveKpis.efc) },
            { label: 'Forecast margin', val: fmt(liveKpis.forecastMargin), col: liveKpis.forecastMargin >= 0 ? '#9edd6e' : '#ff9a9a' },
            { label: 'Margin %',        val: (liveKpis.forecastMarginPct * 100).toFixed(1) + '%', col: liveKpis.forecastMarginPct >= 0 ? '#9edd6e' : '#ff9a9a' },
            { label: 'Total CTD',       val: fmt(liveKpis.totalCtd) },
            { label: 'Cash position',   val: fmt(liveKpis.cashPosition) },
          ].map(k => (
            <div key={k.label} className="text-white">
              <div className="text-[10px] uppercase tracking-wide opacity-60">{k.label}</div>
              <div className="text-sm font-bold tabular-nums" style={{ color: k.col || 'white' }}>{k.val}</div>
            </div>
          ))}
          <div className="ml-auto">
            <span className="text-[10px] text-white/40 uppercase tracking-wide">Live · not yet locked</span>
          </div>
        </div>
      )}

      {/* Main table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {periods.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant gap-2">
            <span className="material-symbols-outlined text-4xl opacity-30">calendar_month</span>
            <p className="text-sm">No periods yet.</p>
            <p className="text-xs opacity-60">Lock the current period to start building history.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {[
                  ['Period',          'left',  'w-36'],
                  ['Status',          'left',  'w-24'],
                  ['EFC',             'right', 'w-32'],
                  ['EFC movement',    'right', 'w-28'],
                  ['Forecast P&L',    'right', 'w-32'],
                  ['Margin %',        'right', 'w-24'],
                  ['P&L movement',    'right', 'w-28'],
                  ['Total CTD',       'right', 'w-32'],
                  ['CTD movement',    'right', 'w-28'],
                  ['Total claimed',   'right', 'w-32'],
                  ['Cash position',   'right', 'w-28'],
                ].map(([h, align, w]) => (
                  <th key={h} className={clx(
                    'px-4 py-2.5 text-[10px] font-bold text-white bg-[#1e3a5f] uppercase tracking-wide',
                    w, `text-${align}`
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => {
                const prior = getPrior(idx)
                const isCurrent = p.isCurrent && !p.lockedAt
                const isLocked  = !!p.lockedAt

                // For current unlocked period, use live KPIs if available
                const efc    = isCurrent && liveKpis ? liveKpis.efc            : p.efc
                const margin = isCurrent && liveKpis ? liveKpis.forecastMargin  : p.forecastMargin
                const ctd    = isCurrent && liveKpis ? liveKpis.totalCtd        : p.totalCtd
                const claimed= isCurrent && liveKpis ? liveKpis.totalClaimed    : p.totalClaimed
                const cash   = isCurrent && liveKpis ? liveKpis.cashPosition    : p.cashPosition

                const priorEfc    = prior ? (prior.efc            ?? null) : null
                const priorMargin = prior ? (prior.forecastMargin ?? null) : null
                const priorCtd    = prior ? (prior.totalCtd       ?? null) : null

                const marginPct = efc && (efc + (margin || 0)) > 0
                  ? (margin || 0) / (efc + (margin || 0))
                  : null

                return (
                  <tr key={p.id} className={clx(
                    'border-b border-outline-variant/10 transition-colors',
                    isCurrent ? 'bg-[#FFFFC7]/50 hover:bg-[#FFFFC7]/70' : 'bg-white hover:bg-surface-container-low/30'
                  )}>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-on-surface text-sm">{p.label}</div>
                      <div className="text-[10px] text-on-surface-variant">
                        {p.periodDate ? new Date(p.periodDate).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {isCurrent ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFFFC7] text-amber-700 border border-amber-300">Current</span>
                      ) : isLocked ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-[#456919] border border-green-200">Locked</span>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant">Draft</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Money v={efc} cls="text-[#565e74] font-semibold" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Delta current={efc} prior={priorEfc} lowerIsBetter={true} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Money v={margin} cls={margin != null ? (margin >= 0 ? 'text-[#456919] font-semibold' : 'text-[#9f403d] font-semibold') : ''} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {marginPct != null ? (
                        <span className={clx('text-xs font-medium tabular-nums', marginPct >= 0 ? 'text-[#456919]' : 'text-[#9f403d]')}>
                          {(marginPct * 100).toFixed(1)}%
                        </span>
                      ) : <span className="text-on-surface-variant/30">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Delta current={margin} prior={priorMargin} lowerIsBetter={false} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Money v={ctd} cls="text-on-surface-variant" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Delta current={ctd} prior={priorCtd} lowerIsBetter={false} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Money v={claimed} cls="text-on-surface-variant" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Money v={cash} cls={cash != null ? (cash >= 0 ? 'text-[#456919]' : 'text-[#9f403d]') : ''} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer note */}
      <div className="bg-surface-container-low border-t px-6 py-2 text-[11px] text-on-surface-variant flex items-center gap-2 flex-shrink-0 flex-shrink-0">
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>info</span>
        Lock & Roll snapshots current KPIs, marks the period as locked, and opens a new current period. Values cannot be edited after locking.
      </div>
    </div>
  )
}
