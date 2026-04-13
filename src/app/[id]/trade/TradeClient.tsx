'use client'
import { useState, useTransition } from 'react'
import { fmt, pct, clx } from '@/lib/utils'
import type { TradeSummary } from '@/lib/calculations'
import { PageHeader } from '@/components/ui'
import { useRouter } from 'next/navigation'
import { useTableNav } from '@/lib/tableUtils'

interface Props { trades: TradeSummary[]; projectId: string }

const METHOD_LABELS: Record<string, string> = {
  prelims:          'Prelims Calc',
  budget_remaining: 'Budget Remaining',
  forecast_sheet:   'Forecast Sheet',
  hard_key:         'Hard Key',
}

const METHOD_BG: Record<string, string> = {
  prelims:          '#d0fc9a',
  budget_remaining: '#dae2fd',
  forecast_sheet:   '#DEE5B5',
  hard_key:         '#FFEEB9',
}

export default function TradeClient({ trades, projectId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const tableNav = useTableNav()

  type TradeEdit = {
    vc: number; vna: number; adj: number
    method: string; hardKey: number | null; budget: number
  }
  const [edits, setEdits] = useState<Record<string, TradeEdit>>(() =>
    Object.fromEntries(trades.map(t => [t.id, {
      vc: t.valueCertified, vna: t.varsNotAgreed, adj: t.adjustments,
      method: t.forecastMethod, hardKey: t.forecastHardKey, budget: t.budget,
    }]))
  )
  const [saving, setSaving] = useState<string | null>(null)

  async function saveTrade(tradeId: string) {
    setSaving(tradeId)
    const e = edits[tradeId]
    await fetch(`/api/projects/${projectId}/trades`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId,
        valueCertified: e.vc, varsNotAgreed: e.vna, adjustments: e.adj,
        budget: e.budget, forecastMethod: e.method, forecastHardKey: e.hardKey,
      }),
    })
    setSaving(null)
    startTransition(() => router.refresh())
  }

  function upd(tradeId: string, key: keyof TradeEdit, value: any) {
    setEdits(prev => ({ ...prev, [tradeId]: { ...prev[tradeId], [key]: value } }))
  }

  function liveEfc(t: TradeSummary): number {
    const e = edits[t.id]
    if (!e) return t.efc
    if (e.method === 'prelims') return t.efc
    if (e.method === 'hard_key' && e.hardKey !== null) return t.totalCTD + t.committed + Math.max(0, e.hardKey - t.totalCTD - t.committed)
    if (e.method === 'forecast_sheet') return t.totalCTD + t.committed + t.uncommitted
    return t.totalCTD + t.committed + Math.max(0, e.budget - t.totalCTD - t.committed)
  }
  function liveFV(t: TradeSummary): number {
    const e = edits[t.id]; if (!e) return t.finalValue
    return e.vc + e.vna + e.adj
  }

  const totals = trades.reduce((acc, t) => ({
    budget: acc.budget + (edits[t.id]?.budget || 0),
    fv:     acc.fv + liveFV(t), ctd: acc.ctd + t.totalCTD,
    committed: acc.committed + t.committed, uncommitted: acc.uncommitted + t.uncommitted,
    efc: acc.efc + liveEfc(t), pl: acc.pl + (liveFV(t) - liveEfc(t)),
  }), { budget:0, fv:0, ctd:0, committed:0, uncommitted:0, efc:0, pl:0 })

  function NumInp({ tradeId, field, val }: { tradeId: string; field: 'vc'|'vna'|'adj'|'hardKey'|'budget'; val: number|null }) {
    const [focused, setFocused] = useState(false)
    const [raw, setRaw] = useState('')
    const displayVal = focused
      ? (raw ? Number(raw.replace(/,/g, '')).toLocaleString('en-IE') : '')
      : (val ? Math.round(val).toLocaleString('en-IE') : '')
    return (
      <input type="text" inputMode="numeric"
        value={displayVal}
        placeholder="0"
        className="no-spin w-28 border border-outline-variant/40 rounded px-2 py-1 text-xs text-right font-medium focus:outline-none focus:ring-1 focus:ring-primary"
        style={{ background: '#FFFFC7' }}
        onChange={e => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
        onFocus={() => { setFocused(true); setRaw(val ? String(Math.round(val)) : '') }}
        onBlur={() => {
          setFocused(false)
          const n = parseInt(raw.replace(/,/g, ''), 10) || null
          upd(tradeId, field, n)
          saveTrade(tradeId)
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else tableNav(e) }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="CVR Trade Breakdown"
        subtitle="EFC = Cost to Date + Committed + Uncommitted Forecast"
        actions={
          <div className="flex items-center gap-2">
            {Object.entries(METHOD_LABELS).map(([k, v]) => (
              <span key={k} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-sm border border-outline-variant/30"
                style={{ background: METHOD_BG[k], color: '#26343d' }}>
                {v}
              </span>
            ))}
          </div>
        }
      />

      {/* EFC equation bar */}
      <div className="flex-shrink-0 border-b border-outline-variant/20 bg-white">
        <div className="flex items-stretch divide-x divide-outline-variant/20">
          {[
            { label: 'Final Value',   val: totals.fv,           bg: '#f6fafe', accent: '#565e74' },
            { label: 'Cost to Date',  val: totals.ctd,          bg: '#f6fafe', accent: '#565e74' },
            { label: 'Committed',     val: totals.committed,    bg: '#f6fafe', accent: '#565e74' },
            { label: 'Uncommitted',   val: totals.uncommitted,  bg: '#fff7f6', accent: '#9f403d' },
            { label: 'EFC',           val: totals.efc,          bg: '#eef4fa', accent: '#565e74' },
            { label: 'Proj P/L',      val: totals.pl,           bg: totals.pl >= 0 ? '#f0fce0' : '#fff0f0', accent: totals.pl >= 0 ? '#456919' : '#9f403d' },
          ].map(({ label, val, bg, accent }) => (
            <div key={label} className="px-5 py-3 flex-1" style={{ background: bg }}>
              <div className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</div>
              <div className="text-base font-black tabular-nums mt-0.5" style={{ color: accent }}>{fmt(val)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="text-xs border-collapse" style={{ minWidth: 1300 }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left text-on-primary font-black text-[10px] uppercase tracking-wide bg-primary" colSpan={2}>Trade</th>
              <th className="px-3 py-2.5 text-center text-white font-black text-[10px] uppercase tracking-wide bg-cvr-value border-l border-white/20" colSpan={4}>Value</th>
              <th className="px-3 py-2.5 text-center text-on-primary font-black text-[10px] uppercase tracking-wide bg-primary-dim border-l border-white/20" colSpan={3}>Costs to Date</th>
              <th className="px-3 py-2.5 text-center text-on-surface font-black text-[10px] uppercase tracking-wide bg-cvr-forecast border-l border-white/20" colSpan={3}>EFC Build-Up</th>
              <th className="px-3 py-2.5 text-center text-on-surface font-black text-[10px] uppercase tracking-wide bg-cvr-profit border-l border-white/20" colSpan={4}>Profit / Loss</th>
            </tr>
            <tr>
              {/* Trade */}
              <th className="px-3 py-2 text-left text-on-primary text-[10px] font-bold bg-primary sticky top-[37px]">Trade</th>
              <th className="px-3 py-2 text-center text-on-primary text-[10px] font-bold bg-primary sticky top-[37px]">Method</th>
              {/* Value */}
              <th className="px-3 py-2 text-right text-on-primary text-[10px] font-bold bg-primary-dim sticky top-[37px]">Budget</th>
              <th className="px-3 py-2 text-right text-white text-[10px] font-bold bg-cvr-value sticky top-[37px]">Val Certified</th>
              <th className="px-3 py-2 text-right text-white text-[10px] font-bold bg-cvr-value sticky top-[37px]">Vars N/A</th>
              <th className="px-3 py-2 text-right text-white text-[10px] font-bold bg-cvr-value sticky top-[37px]">Final Value</th>
              {/* CTD */}
              <th className="px-3 py-2 text-right text-on-primary text-[10px] font-bold bg-primary-dim sticky top-[37px]">Posted</th>
              <th className="px-3 py-2 text-right text-on-primary text-[10px] font-bold bg-primary-dim sticky top-[37px]">Accruals</th>
              <th className="px-3 py-2 text-right text-on-primary text-[10px] font-bold bg-primary-dim sticky top-[37px]">Total CTD</th>
              {/* EFC */}
              <th className="px-3 py-2 text-right text-on-surface text-[10px] font-bold bg-cvr-forecast sticky top-[37px]">Committed</th>
              <th className="px-3 py-2 text-right text-on-surface text-[10px] font-bold bg-cvr-forecast sticky top-[37px]">Uncommitted</th>
              <th className="px-3 py-2 text-right text-on-surface text-[10px] font-bold bg-cvr-forecast sticky top-[37px]">EFC</th>
              {/* P/L */}
              <th className="px-3 py-2 text-right text-on-surface text-[10px] font-bold bg-cvr-profit sticky top-[37px]">Proj P/L</th>
              <th className="px-3 py-2 text-right text-on-surface text-[10px] font-bold bg-cvr-profit-lt sticky top-[37px]">P/L %</th>
              <th className="px-3 py-2 text-right text-on-surface text-[10px] font-bold bg-cvr-profit-lt sticky top-[37px]">Left to Spend</th>
              <th className="px-3 py-2 text-center text-on-surface text-[10px] font-bold bg-cvr-profit-lt sticky top-[37px]"></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, idx) => {
              const e   = edits[t.id] || { vc: t.valueCertified, vna: t.varsNotAgreed, adj: t.adjustments, method: t.forecastMethod, hardKey: t.forecastHardKey, budget: t.budget }
              const fv  = liveFV(t)
              const efc = liveEfc(t)
              const pl  = fv - efc
              const isNeg = pl < 0

              return (
                <tr key={t.id}
                  className="border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors"
                  style={idx % 2 === 1 ? { background: '#fafcff' } : {}}>
                  <td className="px-3 py-2.5 font-bold text-on-surface">{t.trade}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-col gap-1">
                      <select value={e.method}
                        onChange={ev => { upd(t.id, 'method', ev.target.value); if (ev.target.value !== 'hard_key') saveTrade(t.id) }}
                        className="border border-outline-variant/40 rounded px-2 py-1 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                        style={{ background: METHOD_BG[e.method] || '#f6fafe' }}>
                        <option value="budget_remaining">Budget Remaining</option>
                        <option value="forecast_sheet">Forecast Sheet</option>
                        <option value="hard_key">Hard Key</option>
                        <option value="prelims" disabled={t.trade !== 'Preliminaries'}>Prelims Calc</option>
                      </select>
                      {e.method === 'hard_key' && <NumInp tradeId={t.id} field="hardKey" val={e.hardKey} />}
                    </div>
                  </td>
                  <td className="px-2 py-1.5"><NumInp tradeId={t.id} field="budget" val={e.budget} /></td>
                  <td className="px-2 py-1.5"><NumInp tradeId={t.id} field="vc"  val={e.vc} /></td>
                  <td className="px-2 py-1.5"><NumInp tradeId={t.id} field="vna" val={e.vna} /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold bg-cvr-value-lt">{fmt(fv)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-on-surface-variant">{t.postedCost ? fmt(t.postedCost) : '–'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-on-surface-variant">{t.accruals ? fmt(t.accruals) : '–'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold bg-primary-container">{fmt(t.totalCTD)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-on-surface-variant">{t.committed ? fmt(t.committed) : '–'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-on-surface-variant">
                    <div className="flex items-center justify-end gap-1">
                      {fmt(t.uncommitted)}
                      {e.method === 'prelims' && (
                        <span className="text-[9px] px-1 rounded-sm font-bold bg-tertiary-container text-on-tertiary-container">P</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-black bg-cvr-forecast">{fmt(efc)}</td>
                  <td className={clx('px-3 py-2.5 text-right tabular-nums font-black', isNeg ? 'text-error bg-error/5' : 'text-tertiary bg-tertiary/5')}>{fmt(pl)}</td>
                  <td className={clx('px-3 py-2.5 text-right tabular-nums text-xs bg-cvr-profit-lt', isNeg ? 'text-error' : 'text-tertiary')}>{fv ? pct(pl/fv) : '–'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-on-surface-variant bg-cvr-profit-lt">{fmt(efc - t.totalCTD)}</td>
                  <td className="px-3 py-2.5 text-center text-[10px] text-on-surface-variant">
                    {saving === t.id ? <span className="animate-pulse">…</span> : ''}
                  </td>
                </tr>
              )
            })}

            {/* Total row */}
            <tr className="font-black border-t-2 border-outline-variant/30 bg-cvr-profit-lt">
              <td className="px-3 py-3 text-on-surface uppercase tracking-wide text-xs" colSpan={2}>Total</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.budget)}</td>
              <td colSpan={2} />
              <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.fv)}</td>
              <td colSpan={2} />
              <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.ctd)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.committed)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.uncommitted)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.efc)}</td>
              <td className={clx('px-3 py-3 text-right tabular-nums', totals.pl < 0 ? 'text-error' : 'text-tertiary')}>{fmt(totals.pl)}</td>
              <td className={clx('px-3 py-3 text-right tabular-nums text-xs', totals.pl < 0 ? 'text-error' : 'text-tertiary')}>{totals.fv ? pct(totals.pl/totals.fv) : '–'}</td>
              <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.efc - totals.ctd)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-6 px-6 py-2.5 bg-white border-t border-outline-variant/20 text-[10px] text-on-surface-variant flex-shrink-0">
        <span className="font-bold uppercase tracking-wide text-on-surface">EFC formula:</span>
        <span>CTD + Committed + Uncommitted = EFC</span>
        <span className="text-outline-variant">·</span>
        <span><span className="font-bold text-tertiary bg-tertiary-container px-1 rounded-sm text-[9px]">P</span> = driven by Prelims worksheet</span>
        <span className="text-outline-variant">·</span>
        <span>Yellow cells = editable · Auto-saves on blur</span>
      </div>
    </div>
  )
}
