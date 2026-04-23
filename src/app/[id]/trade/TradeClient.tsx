'use client'
import { useRef, useState, useTransition, useMemo } from 'react'
import { fmt, pct, clx } from '@/lib/utils'
import type { TradeSummary } from '@/lib/calculations'
import { PageHeader } from '@/components/ui'
import { useRouter } from 'next/navigation'
import { useGridNav } from '@/lib/tableUtils'
import GridInput from '@/components/GridInput'

interface Props { trades: TradeSummary[]; projectId: string }

const METHOD_BG: Record<string, string> = {
  prelims:          '#d0fc9a',
  budget_remaining: '#dae2fd',
  forecast_sheet:   '#DEE5B5',
  hard_key:         '#FFEEB9',
}

export default function TradeClient({ trades, projectId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const gridNav = useGridNav()

  // ── Local edits (ref = no re-renders per keystroke) ───────────────────────
  type TradeEdit = { vc: number; vna: number; adj: number; method: string; hardKey: number | null; budget: number }
  const localEdits = useRef<Record<string, Partial<TradeEdit>>>({})
  const [tick, setTick] = useState(0)

  const [methods, setMethods] = useState<Record<string, string>>(() =>
    Object.fromEntries(trades.map(t => [t.id, t.forecastMethod]))
  )

  function getEdit(id: string): TradeEdit {
    const local = localEdits.current[id] || {}
    const t = trades.find(t => t.id === id)!
    return {
      vc:      local.vc      ?? t.valueCertified,
      vna:     local.vna     ?? t.varsNotAgreed,
      adj:     local.adj     ?? t.adjustments,
      method:  methods[id]   ?? t.forecastMethod,
      hardKey: local.hardKey ?? t.forecastHardKey,
      budget:  local.budget  ?? t.budget,
    }
  }

  // Fire-and-forget save
  function saveTrade(tradeId: string) {
    const e = getEdit(tradeId)
    fetch(`/api/projects/${projectId}/trades`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId,
        valueCertified: e.vc, varsNotAgreed: e.vna, adjustments: e.adj,
        budget: e.budget, forecastMethod: e.method, forecastHardKey: e.hardKey,
      }),
    })
  }

  function saveCell(id: string, field: keyof TradeEdit, value: any) {
    localEdits.current[id] = { ...(localEdits.current[id] || {}), [field]: value }
    setTick(t => t + 1)
    saveTrade(id)
  }

  function liveEfc(t: TradeSummary): number {
    const e = getEdit(t.id)
    if (e.method === 'prelims') return t.efc
    if (e.method === 'hard_key' && e.hardKey !== null)
      return t.totalCTD + t.committed + Math.max(0, e.hardKey - t.totalCTD - t.committed)
    if (e.method === 'forecast_sheet') return t.totalCTD + t.committed + t.uncommitted
    return t.totalCTD + t.committed + Math.max(0, e.budget - t.totalCTD - t.committed)
  }

  function liveFV(t: TradeSummary): number {
    const e = getEdit(t.id)
    return e.vc + e.vna + e.adj
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const totals = useMemo(() => trades.reduce((acc, t) => ({
    budget: acc.budget + getEdit(t.id).budget,
    fv: acc.fv + liveFV(t), ctd: acc.ctd + t.totalCTD,
    committed: acc.committed + t.committed, uncommitted: acc.uncommitted + t.uncommitted,
    efc: acc.efc + liveEfc(t), pl: acc.pl + (liveFV(t) - liveEfc(t)),
  }), { budget:0, fv:0, ctd:0, committed:0, uncommitted:0, efc:0, pl:0 }), [tick, trades]) // eslint-disable-line

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="CVR Trade Breakdown"
        subtitle="EFC = Cost to Date + Committed + Uncommitted Forecast"
        actions={
          <div className="flex items-center gap-1.5">
            {Object.entries({ 'Prelims Calc': '#d0fc9a', 'Budget Remaining': '#dae2fd', 'Forecast Sheet': '#DEE5B5', 'Hard Key': '#FFEEB9' }).map(([k, bg]) => (
              <span key={k} className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border border-outline-variant/30"
                style={{ background: bg, color: '#26343d' }}>{k}</span>
            ))}
          </div>
        }
      />

      {/* Totals bar */}
      <div className="flex-shrink-0 border-b border-outline-variant/20 bg-white">
        <div className="flex items-stretch divide-x divide-outline-variant/20">
          {[
            { label: 'Final Value',  val: totals.fv,          accent: '#565e74' },
            { label: 'Cost to Date', val: totals.ctd,         accent: '#565e74' },
            { label: 'Committed',    val: totals.committed,   accent: '#565e74' },
            { label: 'Uncommitted',  val: totals.uncommitted, accent: '#9f403d' },
            { label: 'EFC',          val: totals.efc,         accent: '#1e3a5f' },
            { label: 'Proj P/L',     val: totals.pl,          accent: totals.pl >= 0 ? '#456919' : '#9f403d' },
          ].map(({ label, val, accent }) => (
            <div key={label} className="px-5 py-3 flex-1 bg-surface-container-low/30">
              <div className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</div>
              <div className="text-base font-black tabular-nums mt-0.5" style={{ color: accent }}>{fmt(val)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="ss-table" style={{ minWidth: 1300 }} onKeyDown={gridNav}>
          <thead>
            <tr>
              <th colSpan={2} style={{ textAlign: 'left' }}>Trade</th>
              <th colSpan={4} style={{ background: '#2d5a9a', textAlign: 'center' }}>Value</th>
              <th colSpan={3} style={{ background: '#253f6a', textAlign: 'center' }}>Costs to Date</th>
              <th colSpan={3} style={{ background: '#3a6b4a', textAlign: 'center' }}>EFC Build-Up</th>
              <th colSpan={4} style={{ background: '#7a4a15', textAlign: 'center' }}>Profit / Loss</th>
            </tr>
            <tr>
              <th style={{ textAlign: 'left', width: 150 }}>Element</th>
              <th style={{ width: 140 }}>Method</th>
              <th style={{ textAlign: 'right', width: 110 }}>Budget</th>
              <th style={{ textAlign: 'right', width: 110, background: '#2d5a9a' }}>Val Certified</th>
              <th style={{ textAlign: 'right', width: 110, background: '#2d5a9a' }}>Vars N/A</th>
              <th style={{ textAlign: 'right', width: 110, background: '#2d5a9a' }}>Final Value</th>
              <th style={{ textAlign: 'right', width: 110, background: '#253f6a' }}>Posted</th>
              <th style={{ textAlign: 'right', width: 110, background: '#253f6a' }}>Accruals</th>
              <th style={{ textAlign: 'right', width: 110, background: '#253f6a' }}>Total CTD</th>
              <th style={{ textAlign: 'right', width: 110, background: '#3a6b4a' }}>Committed</th>
              <th style={{ textAlign: 'right', width: 110, background: '#3a6b4a' }}>Uncommitted</th>
              <th style={{ textAlign: 'right', width: 110, background: '#3a6b4a' }}>EFC</th>
              <th style={{ textAlign: 'right', width: 110, background: '#7a4a15' }}>Proj P/L</th>
              <th style={{ textAlign: 'right', width: 80,  background: '#7a4a15' }}>P/L %</th>
              <th style={{ textAlign: 'right', width: 110, background: '#7a4a15' }}>Left to Spend</th>
              <th style={{ width: 30, background: '#7a4a15' }}></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, idx) => {
              const e   = getEdit(t.id)
              const fv  = liveFV(t)
              const efc = liveEfc(t)
              const pl  = fv - efc
              const isOver = e.budget > 0 && efc > e.budget

              return (
                <tr key={t.id} data-row={idx}
                  style={isOver ? { background: '#FFF5F5' } : idx % 2 === 1 ? { background: '#fafcff' } : {}}>
                  <td>
                    <div className="ss-cell-ro font-semibold" title={t.trade}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 145 }}>{t.trade}</span>
                    </div>
                  </td>
                  <td style={{ padding: '3px 6px' }}>
                    <div className="flex flex-col gap-1">
                      <select value={e.method}
                        onChange={ev => {
                          const m = ev.target.value
                          setMethods(prev => ({ ...prev, [t.id]: m }))
                          localEdits.current[t.id] = { ...(localEdits.current[t.id] || {}), method: m }
                          setTick(x => x + 1)
                          if (m !== 'hard_key') saveTrade(t.id)
                        }}
                        className="border rounded px-1 py-0.5 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                        style={{ background: METHOD_BG[e.method] || '#f6fafe' }}>
                        <option value="budget_remaining">Budget Remaining</option>
                        <option value="forecast_sheet">Forecast Sheet</option>
                        <option value="hard_key">Hard Key</option>
                        <option value="prelims" disabled={t.trade !== 'Preliminaries'}>Prelims Calc</option>
                      </select>
                      {e.method === 'hard_key' && (
                        <GridInput value={e.hardKey ?? 0}
                          onSave={v => saveCell(t.id, 'hardKey', v)}
                          className="grid-input-sm" />
                      )}
                    </div>
                  </td>
                  <td data-col={0}><GridInput value={e.budget} onSave={v => saveCell(t.id, 'budget', v)} /></td>
                  <td data-col={1}><GridInput value={e.vc}     onSave={v => saveCell(t.id, 'vc', v)} /></td>
                  <td data-col={2}><GridInput value={e.vna}    onSave={v => saveCell(t.id, 'vna', v)} /></td>
                  <td><div className="ss-cell-total">{fmt(fv)}</div></td>
                  <td><div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#565e74' }}>{t.postedCost ? fmt(t.postedCost) : '—'}</div></td>
                  <td><div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#565e74' }}>{t.accruals ? fmt(t.accruals) : '—'}</div></td>
                  <td><div className="ss-cell-total">{fmt(t.totalCTD)}</div></td>
                  <td><div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#856c0b' }}>{t.committed ? fmt(t.committed) : '—'}</div></td>
                  <td>
                    <div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#565e74' }}>
                      {fmt(t.uncommitted)}
                      {e.method === 'prelims' && <span className="ml-1 text-[9px] px-1 rounded font-bold bg-green-100 text-green-800">P</span>}
                    </div>
                  </td>
                  <td><div className="ss-cell-total" style={{ fontWeight: 900, color: '#1e3a5f' }}>{fmt(efc)}</div></td>
                  <td><div className="ss-cell-ro ss-cell-ro-r font-bold" style={{ color: pl >= 0 ? '#27500A' : '#991B1B' }}>{fmt(pl)}</div></td>
                  <td><div className="ss-cell-ro ss-cell-ro-r text-[11px]" style={{ color: pl >= 0 ? '#456919' : '#9f403d' }}>{fv ? pct(pl/fv) : '—'}</div></td>
                  <td><div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#565e74' }}>{fmt(efc - t.totalCTD)}</div></td>
                  <td />
                </tr>
              )
            })}
            <tr style={{ background: '#e8f0fb', borderTop: '2px solid #1e3a5f' }}>
              <td colSpan={2}><div className="ss-cell-ro font-bold text-[#1e3a5f] uppercase tracking-wide text-[10px]">Portfolio Total</div></td>
              <td><div className="ss-cell-ro ss-cell-ro-r font-bold">{fmt(totals.budget)}</div></td>
              <td colSpan={2} />
              <td><div className="ss-cell-ro ss-cell-ro-r font-bold">{fmt(totals.fv)}</div></td>
              <td colSpan={2} />
              <td><div className="ss-cell-ro ss-cell-ro-r font-bold">{fmt(totals.ctd)}</div></td>
              <td><div className="ss-cell-ro ss-cell-ro-r font-bold">{fmt(totals.committed)}</div></td>
              <td><div className="ss-cell-ro ss-cell-ro-r font-bold">{fmt(totals.uncommitted)}</div></td>
              <td><div className="ss-cell-ro ss-cell-ro-r font-black text-[#1e3a5f]">{fmt(totals.efc)}</div></td>
              <td><div className="ss-cell-ro ss-cell-ro-r font-bold" style={{ color: totals.pl >= 0 ? '#27500A' : '#991B1B' }}>{fmt(totals.pl)}</div></td>
              <td><div className="ss-cell-ro ss-cell-ro-r text-[11px]" style={{ color: totals.pl >= 0 ? '#456919' : '#9f403d' }}>{totals.fv ? pct(totals.pl/totals.fv) : '—'}</div></td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-6 py-2 bg-surface-container-low border-t text-[10px] text-on-surface-variant flex-shrink-0">
        Yellow cells are editable · Tab / Enter / Arrow keys to navigate · Changes save automatically
      </div>
    </div>
  )
}
