'use client'
import { useRef, useState, useCallback, useMemo } from 'react'
import { fmt, pct } from '@/lib/utils'
import type { DashboardKPIs } from '@/lib/calculations'
import type { Role } from '@/lib/roleUtils'
import ViewerBanner from '@/components/ViewerBanner'
import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────
type TradeSummary = { name: string; efc: number; totalCTD: number; committed: number; remaining: number }
type Band  = { tradeName: string; startDate: string | null; finishDate: string | null; sCurveShape: number }
type HistRow = { id: string; month_label: string; month_date: string; sort_order: number; cumul_claimed: number; cumul_certified: number; cumul_cost: number }

interface Props {
  rows: HistRow[]; kpis: DashboardKPIs; projectId: string; role: Role
  tradeSummaries: TradeSummary[]
  bands: Band[]
  overrides: Record<string, Record<string, number>>   // tradeName → month → amount
  income:   Record<string, Record<string, number>>    // label → month → amount
  incomeLabels: string[]
  manualIncomeLabels: string[]
  lagMonths: number
  projectStart: string | null; projectFinish: string | null
  originalMarginPct: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isWorkDay(d: Date) { const n = d.getDay(); return n !== 0 && n !== 6 }

function workDaysBetween(s: Date, e: Date): Date[] {
  const days: Date[] = [], cur = new Date(s)
  cur.setHours(0,0,0,0); e = new Date(e); e.setHours(0,0,0,0)
  while (cur <= e) { if (isWorkDay(cur)) days.push(new Date(cur)); cur.setDate(cur.getDate()+1) }
  return days
}

function mk(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }

function mkLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo-1, 1).toLocaleDateString('en-IE', { month: 'short', year: '2-digit' })
}

function addMonths(m: string, n: number): string {
  const d = new Date(m + '-01'); d.setMonth(d.getMonth() + n); return mk(d)
}

// ─── S-curve weights (Beta distribution, symmetric) ───────────────────────────
function sCurveWeights(n: number, shape: number): number[] {
  if (n === 0) return []
  if (n === 1) return [1]
  const alpha = Math.max(1, shape)
  const raw = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n
    return alpha === 1 ? 1 : Math.pow(t, alpha-1) * Math.pow(1-t, alpha-1)
  })
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map(w => w / sum)
}

const SHAPE_LABELS: Record<number, string> = { 1:'Linear', 2:'Gentle S', 3:'Standard S', 4:'Steep S', 5:'Sharp S' }

// ─── Core calculation ─────────────────────────────────────────────────────────
// Returns per-month amount for a trade, accounting for overrides and S-curve redistribution
function calcTradeMonths(
  trade: TradeSummary,
  band: Band | undefined,
  tradeOverrides: Record<string, number>,
  months: string[],
  projectStart: string | null,
  projectFinish: string | null,
): Record<string, { amount: number; isOverride: boolean; inBand: boolean }> {

  const today = new Date(); today.setHours(0,0,0,0)
  const projEnd = projectFinish ? new Date(projectFinish) : new Date(today.getFullYear()+2, 11, 31)
  const bandStart  = band?.startDate  ? new Date(band.startDate)  : (projectStart ? new Date(projectStart) : today)
  const bandFinish = band?.finishDate ? new Date(band.finishDate) : projEnd
  const shape = band?.sCurveShape ?? 3

  // Get all future working days in the band
  const allDays    = workDaysBetween(bandStart, bandFinish)
  const futureDays = allDays.filter(d => d >= today)

  // Group future days by month, compute sum of S-curve weights per month
  const weights = sCurveWeights(futureDays.length, shape)
  const monthWeightSum: Record<string, number> = {}
  futureDays.forEach((d, i) => {
    const m = mk(d)
    monthWeightSum[m] = (monthWeightSum[m] ?? 0) + weights[i]
  })

  const bandMonths = new Set([...allDays.map(d => mk(d))])
  const futureBandMonths = new Set(Object.keys(monthWeightSum))

  // Months with overrides that are in the future band
  const overridedMonths = Object.keys(tradeOverrides).filter(m => futureBandMonths.has(m))
  const overrideTotal   = overridedMonths.reduce((s, m) => s + (tradeOverrides[m] ?? 0), 0)

  // Remaining to spread across non-overrided months
  const toSpread    = Math.max(0, trade.remaining - overrideTotal)
  const nonOvWeightSum = Array.from(futureBandMonths)
    .filter(m => !overridedMonths.includes(m))
    .reduce((s, m) => s + (monthWeightSum[m] ?? 0), 0)

  const result: Record<string, { amount: number; isOverride: boolean; inBand: boolean }> = {}

  for (const m of months) {
    if (!bandMonths.has(m)) {
      result[m] = { amount: 0, isOverride: false, inBand: false }
    } else if (tradeOverrides[m] !== undefined) {
      result[m] = { amount: tradeOverrides[m], isOverride: true, inBand: true }
    } else if (futureBandMonths.has(m) && nonOvWeightSum > 0) {
      const calc = toSpread * ((monthWeightSum[m] ?? 0) / nonOvWeightSum)
      result[m] = { amount: calc, isOverride: false, inBand: true }
    } else {
      result[m] = { amount: 0, isOverride: false, inBand: true }
    }
  }

  return result
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SCurveClient({
  rows: initialRows, kpis, projectId, role,
  tradeSummaries, bands: initialBands,
  overrides: initialOverrides, income: initialIncome, incomeLabels, manualIncomeLabels,
  lagMonths: initialLag,
  projectStart, projectFinish, originalMarginPct,
}: Props) {
  const router = useRouter()

  // ── State ──────────────────────────────────────────────────────────────────
  const [bands,     setBands]     = useState<Band[]>(initialBands)
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>(initialOverrides)
  const [income,    setIncome]    = useState<Record<string, Record<string, number>>>(initialIncome)
  const [marginPct, setMarginPct] = useState(Math.round(originalMarginPct * 100) || 10)
  const [lagMonths, setLagMonths] = useState(initialLag)
  const [tab, setTab]             = useState<'forecast'|'chart'|'history'>('forecast')
  const [histRows,  setHistRows]  = useState(initialRows.map(r => ({ ...r })))
  const [saving,    setSaving]    = useState(false)

  // ── Month range ────────────────────────────────────────────────────────────
  const months = useMemo(() => {
    const starts  = bands.map(b => b.startDate).filter(Boolean) as string[]
    const finishes = bands.map(b => b.finishDate).filter(Boolean) as string[]
    const today   = mk(new Date())
    const rawStart  = [projectStart, ...starts, today].filter(Boolean).map(s => s!.slice(0,7)).sort()[0]  ?? today
    const rawFinish = [projectFinish, ...finishes].filter(Boolean).map(f => f!.slice(0,7)).sort().reverse()[0] ?? addMonths(today, 18)
    // Pad 1 month either side
    const start  = addMonths(rawStart,  -1)
    const finish = addMonths(rawFinish,  1)
    const result: string[] = []
    let cur = start
    while (cur <= finish) { result.push(cur); cur = addMonths(cur, 1) }
    return result
  }, [bands, projectStart, projectFinish])

  // ── Calculated monthly amounts per trade ───────────────────────────────────
  const tradeMonths = useMemo(() =>
    Object.fromEntries(tradeSummaries.map(t => [
      t.name,
      calcTradeMonths(t, bands.find(b => b.tradeName === t.name), overrides[t.name] ?? {}, months, projectStart, projectFinish)
    ])),
    [tradeSummaries, bands, overrides, months, projectStart, projectFinish]
  )

  // ── Column totals ──────────────────────────────────────────────────────────
  const costTotals = useMemo(() =>
    Object.fromEntries(months.map(m => [
      m,
      tradeSummaries.reduce((s, t) => s + (tradeMonths[t.name]?.[m]?.amount ?? 0), 0)
    ])),
    [months, tradeMonths, tradeSummaries]
  )

  async function saveLag(v: number) {
    setLagMonths(v)
    await fetch(`/api/projects/${projectId}/cashflow`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'lag', lagMonths: v }),
    })
  }

  // Auto-calculated Income - Contract: costs shifted by lag months × (1+margin%)
  const contractIncome = useMemo(() =>
    Object.fromEntries(months.map(m => {
      const srcMonth = addMonths(m, -lagMonths)
      return [m, (costTotals[srcMonth] ?? 0) * (1 + marginPct / 100)]
    })),
    [months, costTotals, lagMonths, marginPct]
  )
  const incomeTotals = useMemo(() =>
    Object.fromEntries(months.map(m => [
      m,
      (contractIncome[m] ?? 0) +
      Object.values(income).reduce((s, vals) => s + (vals[m] ?? 0), 0)
    ])),
    [months, income, contractIncome]
  )

  // ── Cumulative totals (for summary strip) ──────────────────────────────────
  const totalForecastCost = tradeSummaries.reduce((s, t) =>
    s + months.reduce((ms, m) => ms + (tradeMonths[t.name]?.[m]?.amount ?? 0), 0), 0)

  // ── API calls ──────────────────────────────────────────────────────────────
  const saveBand = useCallback(async (tradeName: string, field: Partial<Omit<Band,'tradeName'>>) => {
    const existing = bands.find(b => b.tradeName === tradeName) ?? { tradeName, startDate: null, finishDate: null, sCurveShape: 3 }
    const updated  = { ...existing, ...field }
    setBands(prev => prev.some(b => b.tradeName === tradeName)
      ? prev.map(b => b.tradeName === tradeName ? updated : b)
      : [...prev, updated])
    await fetch(`/api/projects/${projectId}/cashflow`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeName, startDate: updated.startDate, finishDate: updated.finishDate, sCurveShape: updated.sCurveShape }),
    })
  }, [bands, projectId])

  const saveCell = useCallback(async (tradeName: string, month: string, amount: number) => {
    setOverrides(prev => {
      const t = { ...(prev[tradeName] ?? {}) }
      if (amount === 0) { delete t[month]; return { ...prev, [tradeName]: t } }
      return { ...prev, [tradeName]: { ...t, [month]: amount } }
    })
    await fetch(`/api/projects/${projectId}/cashflow`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'trade', tradeName, month, amount }),
    })
  }, [projectId])

  const saveIncome = useCallback(async (label: string, month: string, amount: number) => {
    setIncome(prev => {
      const l = { ...(prev[label] ?? {}) }
      if (amount === 0) { delete l[month]; return { ...prev, [label]: l } }
      return { ...prev, [label]: { ...l, [month]: amount } }
    })
    await fetch(`/api/projects/${projectId}/cashflow`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'income', label, month, amount }),
    })
  }, [projectId])

  async function saveHistory() {
    setSaving(true)
    await fetch(`/api/projects/${projectId}/s-curve`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: histRows.filter(r => r.month_label) }),
    })
    setSaving(false)
    router.refresh()
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  // Column widths
  const W = { name: 170, date: 88, money: 96, month: 84 }
  const FROZEN = W.name + W.date * 2 + W.money * 3

  const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '0 0', borderBottom: '0.5px solid #e2e8f0', borderRight: '0.5px solid #e2e8f0',
    verticalAlign: 'middle', ...extra,
  })
  const frozen = (left: number, bg = '#fff'): React.CSSProperties => ({
    position: 'sticky', left, zIndex: 2, background: bg,
    borderBottom: '0.5px solid #e2e8f0', borderRight: '0.5px solid #e2e8f0',
    verticalAlign: 'middle',
  })
  const thFrozen = (left: number): React.CSSProperties => ({
    position: 'sticky', left, zIndex: 3, background: '#1e3a5f',
    color: '#fff', fontSize: 11, fontWeight: 600, padding: '7px 8px',
    textAlign: 'right', whiteSpace: 'nowrap', borderRight: '0.5px solid rgba(255,255,255,0.15)',
  })
  const thMonth: React.CSSProperties = {
    background: '#1e3a5f', color: '#fff', fontSize: 11, fontWeight: 600,
    padding: '7px 4px', textAlign: 'right', minWidth: W.month,
    borderRight: '0.5px solid rgba(255,255,255,0.12)',
  }

  // Editable cell: uncontrolled input
  function EditCell({ value, isOverride, inBand, onSave, disabled = false }: {
    value: number; isOverride: boolean; inBand: boolean
    onSave: (v: number) => void; disabled?: boolean
  }) {
    const [editing, setEditing] = useState(false)
    const [raw, setRaw]         = useState('')

    if (!inBand) return <div style={{ textAlign: 'right', padding: '5px 8px', color: '#d1d5db', fontSize: 11 }}>—</div>

    const display = value > 0 ? Math.round(value).toLocaleString('en-IE') : (isOverride ? '0' : '')
    const bg = disabled ? 'transparent' : isOverride ? '#FFFFC7' : '#f8faff'
    const col = disabled ? '#9ca3af' : isOverride ? '#1a1a1a' : value > 0 ? '#374151' : '#d1d5db'

    return (
      <input
        type="text" inputMode="numeric"
        disabled={disabled}
        value={editing ? raw : display}
        placeholder={value > 0 && !isOverride ? Math.round(value).toLocaleString('en-IE') : ''}
        onChange={e => setRaw(e.target.value.replace(/[^\d.-]/g, ''))}
        onFocus={() => { setEditing(true); setRaw(isOverride && value ? String(Math.round(value)) : '') }}
        onBlur={() => {
          setEditing(false)
          const v = parseFloat(raw) || 0
          if (v !== value || (v === 0 && isOverride)) onSave(v)
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{
          width: '100%', background: bg, border: 'none', outline: 'none',
          padding: '5px 8px', fontSize: 11, textAlign: 'right',
          fontVariantNumeric: 'tabular-nums', color: col,
          fontStyle: !isOverride && value > 0 ? 'italic' : 'normal',
        }}
      />
    )
  }

  const tabCls = (t: string) => ({
    padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: tab === t ? '#fff' : 'transparent',
    borderBottom: tab === t ? '2px solid #1e3a5f' : '2px solid transparent',
    color: tab === t ? '#1e3a5f' : '#6b7280',
  } as React.CSSProperties)

  // ─── Section header row ────────────────────────────────────────────────────
  function SectionRow({ label, bg = '#253f6a' }: { label: string; bg?: string }) {
    return (
      <tr>
        <td colSpan={1} style={{ ...frozen(0, bg), padding: '5px 10px', fontWeight: 700, fontSize: 11, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</td>
        <td colSpan={5} style={{ background: bg, borderBottom: '0.5px solid rgba(255,255,255,0.1)' }} />
        {months.map(m => <td key={m} style={{ background: bg, borderBottom: '0.5px solid rgba(255,255,255,0.1)', borderRight: '0.5px solid rgba(255,255,255,0.08)' }} />)}
      </tr>
    )
  }

  // ─── Totals row ────────────────────────────────────────────────────────────
  function TotalsRow({ label, getVal, bg = '#f0f4fa', bold = true }: {
    label: string; getVal: (m: string) => number; bg?: string; bold?: boolean
  }) {
    const runningTotal = { val: 0 }
    return (
      <tr style={{ background: bg }}>
        <td style={{ ...frozen(0, bg), padding: '6px 10px', fontSize: 11, fontWeight: bold ? 700 : 500, color: '#1e3a5f' }}>{label}</td>
        <td colSpan={5} style={{ background: bg, borderBottom: '0.5px solid #e2e8f0' }} />
        {months.map(m => {
          const v = getVal(m)
          return (
            <td key={m} style={{ background: bg, borderRight: '0.5px solid #e2e8f0', borderBottom: '0.5px solid #e2e8f0', padding: '6px 8px', textAlign: 'right', fontSize: 11, fontWeight: bold ? 700 : 500, fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#1e3a5f' : '#d1d5db' }}>
              {v > 0 ? Math.round(v).toLocaleString('en-IE') : '—'}
            </td>
          )
        })}
      </tr>
    )
  }

  const adjustedSum = kpis.contractSum + kpis.approvedVars

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-white border-b border-outline-variant/20 flex-shrink-0 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-black text-on-surface tracking-tight uppercase">Cashflow</h2>
          <p className="text-[10px] text-on-surface-variant hidden sm:block">Forecast · Income · Actual history</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Margin %</span>
            <input type="number" value={marginPct} onChange={e => setMarginPct(Number(e.target.value))}
              style={{ width: 52, border: '0.5px solid #d1d5db', borderRadius: 5, padding: '4px 6px', fontSize: 12, fontWeight: 700, textAlign: 'right', background: '#FFFFC7' }} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Income lag</span>
            <select value={lagMonths} onChange={e => saveLag(Number(e.target.value))}
              style={{ border: '0.5px solid #d1d5db', borderRadius: 5, padding: '4px 6px', fontSize: 12, fontWeight: 600, background: '#f0f9ff', color: '#0c447c', cursor: 'pointer' }}>
              <option value={0}>None (same month)</option>
              <option value={1}>1 month</option>
              <option value={2}>2 months</option>
              <option value={3}>3 months</option>
            </select>
          </div>
          {tab === 'history' && role !== 'viewer' && (
            <button onClick={saveHistory} disabled={saving}
              className="px-3 py-1.5 rounded text-xs font-semibold text-white bg-[#1e3a5f] hover:bg-[#253f6a] disabled:opacity-50">
              {saving ? 'Saving…' : 'Save History'}
            </button>
          )}
        </div>
      </div>

      <ViewerBanner role={role} />

      {/* Summary strip */}
      <div className="bg-[#1e3a5f] px-6 py-2.5 flex items-center gap-6 flex-shrink-0 flex-wrap">
        {[
          { label: 'Contract sum', val: fmt(adjustedSum),       col: '#ccd4ee' },
          { label: 'Total EFC',    val: fmt(kpis.efc),          col: '#ccd4ee' },
          { label: 'Cost to date', val: fmt(kpis.actualsTotal), col: '#ccd4ee' },
          { label: 'To forecast',  val: fmt(totalForecastCost), col: '#FAEEDA' },
          { label: 'Periods',      val: `${months.length}`,     col: '#DEE5B5' },
        ].map(k => (
          <div key={k.label} className="flex-shrink-0">
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'rgba(168,196,224,0.5)' }}>{k.label}</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: k.col }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <button style={tabCls('forecast')} onClick={() => setTab('forecast')}>Forecast Grid</button>
        <button style={tabCls('chart')}    onClick={() => setTab('chart')}>Chart</button>
        <button style={tabCls('history')}  onClick={() => setTab('history')}>Actual History</button>
      </div>

      {/* ── FORECAST GRID ───────────────────────────────────────────────────── */}
      {tab === 'forecast' && (
        <div className="flex-1 overflow-auto">
          <div style={{ minWidth: FROZEN + months.length * W.month + 20, position: 'relative' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', fontSize: 12 }}>
              <colgroup>
                <col style={{ width: W.name }} />
                <col style={{ width: W.date }} />
                <col style={{ width: W.date }} />
                <col style={{ width: W.money }} />
                <col style={{ width: W.money }} />
                <col style={{ width: W.money }} />
                {months.map(m => <col key={m} style={{ width: W.month }} />)}
              </colgroup>

              {/* ── Header row ─────────────────────────────────────────── */}
              <thead style={{ position: 'sticky', top: 0, zIndex: 4 }}>
                <tr>
                  <th style={{ ...thFrozen(0), textAlign: 'left', width: W.name }}>Element</th>
                  <th style={{ ...thFrozen(W.name), width: W.date }}>Start</th>
                  <th style={{ ...thFrozen(W.name + W.date), width: W.date }}>Finish</th>
                  <th style={{ ...thFrozen(W.name + W.date * 2), width: W.money }}>Total EFC</th>
                  <th style={{ ...thFrozen(W.name + W.date * 2 + W.money), width: W.money }}>CTD</th>
                  <th style={{ ...thFrozen(W.name + W.date * 2 + W.money * 2), width: W.money, borderRight: '2px solid rgba(255,255,255,0.4)' }}>Remaining</th>
                  {months.map(m => <th key={m} style={thMonth}>{mkLabel(m)}</th>)}
                </tr>
              </thead>

              <tbody>
                {/* ── INCOME SECTION ─────────────────────────────────── */}
                <SectionRow label="Income" bg="#253f6a" />

                {/* Income totals row */}
                <TotalsRow label="TOTAL INCOME" getVal={m => incomeTotals[m] ?? 0} bg="#EAF3DE" />

                {/* Income type rows */}
                {incomeLabels.map((label, ri) => {
                  const isAuto = label === 'Income - Contract'
                  const rowBg  = ri % 2 === 0 ? '#f8fdf3' : '#fff'
                  return (
                    <tr key={label} style={{ background: rowBg }}>
                      <td style={{ ...frozen(0, rowBg), padding: '4px 10px' }}>
                        <div style={{ fontSize: 12, color: '#374151', fontWeight: isAuto ? 600 : 400 }}>{label}</div>
                        {isAuto && (
                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                            Auto — cost × {marginPct}% margin, {lagMonths === 0 ? 'no lag' : `${lagMonths}m lag`}
                          </div>
                        )}
                      </td>
                      <td colSpan={5} style={{ background: rowBg, borderBottom: '0.5px solid #e2e8f0' }} />
                      {months.map(m => (
                        <td key={m} style={cell()}>
                          {isAuto ? (
                            /* Read-only auto-calculated cell */
                            <div style={{
                              padding: '5px 8px', textAlign: 'right', fontSize: 11,
                              fontVariantNumeric: 'tabular-nums',
                              color: (contractIncome[m] ?? 0) > 0 ? '#27500A' : '#d1d5db',
                              fontStyle: 'italic', background: '#f0fce0',
                            }}>
                              {(contractIncome[m] ?? 0) > 0
                                ? Math.round(contractIncome[m]).toLocaleString('en-IE')
                                : '—'}
                            </div>
                          ) : (
                            <EditCell
                              value={income[label]?.[m] ?? 0}
                              isOverride={!!(income[label]?.[m])}
                              inBand={true}
                              disabled={role === 'viewer'}
                              onSave={v => saveIncome(label, m, v)}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}

                {/* ── EXPENDITURE SECTION ────────────────────────────── */}
                <SectionRow label="Expenditure" bg="#1e3a5f" />

                {/* Expenditure totals row */}
                <TotalsRow label="TOTAL EXPENDITURE" getVal={m => costTotals[m] ?? 0} bg="#f0f4fa" />

                {/* Trade rows */}
                {tradeSummaries.map((t, ri) => {
                  const band = bands.find(b => b.tradeName === t.name)
                  const shape = band?.sCurveShape ?? 3

                  return (
                    <tr key={t.name} style={{ background: ri % 2 === 0 ? '#fff' : '#f8faff' }}>
                      {/* Frozen: name */}
                      <td style={{ ...frozen(0, ri % 2 === 0 ? '#fff' : '#f8faff'), padding: '4px 10px' }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111' }}>{t.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <input type="range" min={1} max={5} step={1}
                            value={shape}
                            title={`S-curve: ${SHAPE_LABELS[shape]}`}
                            onChange={e => saveBand(t.name, { sCurveShape: Number(e.target.value) })}
                            style={{ width: 60, accentColor: '#1e3a5f', verticalAlign: 'middle' }}
                          />
                          <span style={{ fontSize: 9, color: '#9ca3af', whiteSpace: 'nowrap' }}>{SHAPE_LABELS[shape]}</span>
                        </div>
                      </td>
                      {/* Frozen: start */}
                      <td style={{ ...frozen(W.name, ri % 2 === 0 ? '#fff' : '#f8faff'), padding: '2px 4px' }}>
                        <input type="date" defaultValue={band?.startDate ?? projectStart ?? ''}
                          onBlur={e => saveBand(t.name, { startDate: e.target.value || null })}
                          style={{ width: '100%', border: 'none', fontSize: 11, background: 'transparent', outline: 'none', color: '#374151', padding: '4px 2px' }} />
                      </td>
                      {/* Frozen: finish */}
                      <td style={{ ...frozen(W.name + W.date, ri % 2 === 0 ? '#fff' : '#f8faff'), padding: '2px 4px' }}>
                        <input type="date" defaultValue={band?.finishDate ?? projectFinish ?? ''}
                          onBlur={e => saveBand(t.name, { finishDate: e.target.value || null })}
                          style={{ width: '100%', border: 'none', fontSize: 11, background: 'transparent', outline: 'none', color: '#374151', padding: '4px 2px' }} />
                      </td>
                      {/* Frozen: Total EFC */}
                      <td style={{ ...frozen(W.name + W.date*2, ri % 2 === 0 ? '#fff' : '#f8faff'), padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1e3a5f', fontWeight: 600, fontSize: 11 }}>
                        {fmt(t.efc)}
                      </td>
                      {/* Frozen: CTD */}
                      <td style={{ ...frozen(W.name + W.date*2 + W.money, ri % 2 === 0 ? '#fff' : '#f8faff'), padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280', fontSize: 11 }}>
                        {t.totalCTD ? fmt(t.totalCTD) : '—'}
                      </td>
                      {/* Frozen: Remaining */}
                      <td style={{ ...frozen(W.name + W.date*2 + W.money*2, ri % 2 === 0 ? '#fff' : '#f8faff'), padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 11, color: t.remaining > 0 ? '#856c0b' : '#9ca3af', borderRight: '2px solid #e2e8f0' }}>
                        {t.remaining > 0 ? fmt(t.remaining) : '—'}
                      </td>
                      {/* Monthly cells */}
                      {months.map(m => {
                        const cell_data = tradeMonths[t.name]?.[m]
                        return (
                          <td key={m} style={cell()}>
                            <EditCell
                              value={cell_data?.amount ?? 0}
                              isOverride={cell_data?.isOverride ?? false}
                              inBand={cell_data?.inBand ?? false}
                              disabled={role === 'viewer'}
                              onSave={v => saveCell(t.name, m, v)}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center gap-6 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5"><span style={{ width: 16, height: 12, background: '#FFFFC7', border: '0.5px solid #d1d5db', borderRadius: 2, display: 'inline-block' }} />Hard key (your value)</span>
            <span className="flex items-center gap-1.5"><span style={{ width: 16, height: 12, background: '#f8faff', border: '0.5px solid #d1d5db', borderRadius: 2, display: 'inline-block' }} />S-curve calculated (italic)</span>
            <span className="flex items-center gap-1.5"><span style={{ width: 16, height: 12, background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: 10 }} />Outside band</span>
            <span className="ml-auto">Click any cell to enter an amount · Tab / Enter to move · S-curve slider per trade</span>
          </div>
        </div>
      )}

      {/* ── CHART TAB ────────────────────────────────────────────────────── */}
      {tab === 'chart' && (() => {
        // Build chart data: blend actual history + forecast months
        const histMonthSet = new Set(histRows.map(r => r.month_date?.slice(0,7)).filter(Boolean))

        // Actual history points
        const histPoints = histRows.map((r, i) => {
          const prev = histRows[i - 1]
          return {
            month: r.month_label || mkLabel(r.month_date?.slice(0,7) ?? ''),
            actualCost:    r.cumul_cost    || null,
            actualClaimed: r.cumul_claimed || null,
            monthlyCost:   prev ? r.cumul_cost - prev.cumul_cost : r.cumul_cost,
            forecastCost:  null as number|null,
            forecastIncome: null as number|null,
          }
        })

        // Forecast points
        let runCost   = histRows[histRows.length-1]?.cumul_cost    ?? 0
        let runIncome = histRows[histRows.length-1]?.cumul_claimed  ?? 0
        const fPoints = months
          .filter(m => !histMonthSet.has(m))
          .map(m => {
            const mCost   = costTotals[m]   ?? 0
            const mIncome = incomeTotals[m] ?? 0
            runCost   += mCost
            runIncome += mIncome
            return {
              month: mkLabel(m),
              actualCost:    null as number|null,
              actualClaimed: null as number|null,
              monthlyCost:   mCost,
              forecastCost:  runCost   || null,
              forecastIncome: runIncome || null,
            }
          })
          .filter(p => p.monthlyCost > 0 || p.forecastCost || p.forecastIncome)

        const chartData = [...histPoints, ...fPoints]

        const fmtM = (n: number) =>
          Math.abs(n) >= 1e6 ? `€${(n/1e6).toFixed(2)}m`
          : Math.abs(n) >= 1e3 ? `€${(n/1e3).toFixed(0)}k`
          : `€${Math.round(n)}`

        function ChartTip({ active, payload, label }: any) {
          if (!active || !payload?.length) return null
          return (
            <div style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ fontWeight: 700, color: '#1e3a5f', marginBottom: 6 }}>{label}</div>
              {payload.map((p: any) => p.value != null && (
                <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, color: p.color ?? p.fill, marginBottom: 2 }}>
                  <span>{p.name}</span>
                  <span style={{ fontWeight: 600 }}>{fmtM(p.value)}</span>
                </div>
              ))}
            </div>
          )
        }

        // Monthly cost breakdown by trade for stacked bars
        const tradeColors = [
          '#1e3a5f','#2d5a9a','#456919','#9f403d','#856c0b',
          '#3a6b4a','#6b3a8b','#3a6b8b','#8b3a6b','#6b8b3a',
        ]

        // Build stacked chart data per trade
        const stackedData = months
          .filter(m => {
            const totalCost = tradeSummaries.reduce((s, t) => s + (tradeMonths[t.name]?.[m]?.amount ?? 0), 0)
            return totalCost > 0 || histMonthSet.has(m)
          })
          .map(m => {
            const row: any = { month: mkLabel(m) }
            tradeSummaries.forEach(t => { row[t.name] = Math.round(tradeMonths[t.name]?.[m]?.amount ?? 0) || null })
            row.actualCost    = histMonthSet.has(m) ? (histRows.find(r => r.month_date?.startsWith(m))?.cumul_cost    || null) : null
            row.actualClaimed = histMonthSet.has(m) ? (histRows.find(r => r.month_date?.startsWith(m))?.cumul_claimed || null) : null
            return row
          })

        // Running cumulative for the line
        let cumForecast = histRows[histRows.length-1]?.cumul_cost ?? 0
        let cumIncome   = histRows[histRows.length-1]?.cumul_claimed ?? 0
        stackedData.forEach(row => {
          const monthStr = months.find(m => mkLabel(m) === row.month)
          if (monthStr && !histMonthSet.has(monthStr)) {
            cumForecast += costTotals[monthStr] ?? 0
            cumIncome   += incomeTotals[monthStr] ?? 0
            row.cumulForecast = cumForecast || null
            row.cumulIncome   = cumIncome   || null
          }
        })

        return (
          <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

            {/* Summary KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total forecast cost',   val: fmtM(Object.values(costTotals).reduce((s,v) => s+v, 0)) },
                { label: 'Forecast income (incl. margin)', val: fmtM(Object.values(incomeTotals).reduce((s,v)=>s+v,0)) },
                { label: 'Margin %',              val: `${marginPct}%` },
                { label: 'Contract sum',           val: fmtM(adjustedSum) },
              ].map(k => (
                <div key={k.label} style={{ background: '#f8faff', border: '0.5px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Monthly cost bars + cumulative lines */}
            <div style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 10, padding: '16px 16px 8px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Monthly cost forecast by trade · cumulative cost & income</div>
              <div style={{ height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stackedData} margin={{ top: 8, right: 20, bottom: 20, left: 56 }}
                    barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false}
                      angle={-35} textAnchor="end" height={45} />
                    <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={false} tickLine={false} width={54} />
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />

                    <ReferenceLine y={adjustedSum} stroke="#1e3a5f" strokeDasharray="5 3" strokeWidth={1}
                      label={{ value: 'Contract sum', position: 'insideTopRight', fontSize: 9, fill: '#1e3a5f' }} />

                    {/* Stacked bars per trade */}
                    {tradeSummaries.map((t, i) => (
                      <Bar key={t.name} dataKey={t.name} stackId="cost"
                        fill={tradeColors[i % tradeColors.length]}
                        fillOpacity={0.82} radius={i === tradeSummaries.length-1 ? [2,2,0,0] : [0,0,0,0]} />
                    ))}

                    {/* Cumulative forecast lines */}
                    <Line type="monotone" dataKey="cumulForecast" name="Cumul. cost (forecast)"
                      stroke="#9f403d" strokeWidth={2.5}
                      dot={{ r: 3, fill: '#9f403d', stroke: '#fff', strokeWidth: 1.5 }}
                      strokeDasharray="6 3" connectNulls={false} />
                    <Line type="monotone" dataKey="cumulIncome" name="Cumul. income (forecast)"
                      stroke="#456919" strokeWidth={2.5}
                      dot={{ r: 3, fill: '#456919', stroke: '#fff', strokeWidth: 1.5 }}
                      strokeDasharray="4 2" connectNulls={false} />

                    {/* Actual history lines */}
                    <Line type="monotone" dataKey="actualCost" name="Actual cost (history)"
                      stroke="#1e3a5f" strokeWidth={2.5}
                      dot={{ r: 4, fill: '#1e3a5f', stroke: '#fff', strokeWidth: 2 }}
                      connectNulls={false} />
                    <Line type="monotone" dataKey="actualClaimed" name="Actual claimed (history)"
                      stroke="#856c0b" strokeWidth={2}
                      dot={{ r: 3, fill: '#856c0b', stroke: '#fff', strokeWidth: 1.5 }}
                      connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Per-trade spend profile (S-curve preview) */}
            <div style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 10, padding: '16px 16px 8px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Cumulative spend profile by trade</div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={(() => {
                    // Build cumulative per trade
                    const running: Record<string, number> = {}
                    return months
                      .filter(m => costTotals[m] > 0)
                      .map(m => {
                        const row: any = { month: mkLabel(m) }
                        tradeSummaries.forEach(t => {
                          running[t.name] = (running[t.name] ?? 0) + (tradeMonths[t.name]?.[m]?.amount ?? 0)
                          row[t.name + '_c'] = Math.round(running[t.name]) || null
                        })
                        return row
                      })
                  })()} margin={{ top: 8, right: 20, bottom: 20, left: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false}
                      angle={-35} textAnchor="end" height={45} />
                    <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={false} tickLine={false} width={54} />
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                      formatter={v => v.replace('_c', '')} />
                    {tradeSummaries.map((t, i) => (
                      <Line key={t.name} type="monotone" dataKey={t.name + '_c'} name={t.name}
                        stroke={tradeColors[i % tradeColors.length]} strokeWidth={1.8}
                        dot={false} connectNulls={false} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 8 }}>
                S-curve shape per trade controls the slope of each line. Adjust sliders on the Forecast Grid tab.
              </p>
            </div>

          </div>
        )
      })()}


      {tab === 'history' && (
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Actual cumulative data</span>
            {role !== 'viewer' && (
              <button onClick={() => setHistRows(prev => [...prev, { id: '', month_label: '', month_date: new Date().toISOString().slice(0,10), sort_order: prev.length, cumul_claimed: 0, cumul_certified: 0, cumul_cost: 0 }])}
                style={{ border: '0.5px solid #565e74', color: '#565e74', background: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={12} /> Add month
              </button>
            )}
          </div>
          <table className="ss-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 32, textAlign: 'center' }}>#</th>
                <th style={{ width: 90, textAlign: 'left' }}>Month</th>
                <th style={{ textAlign: 'right' }}>Cumul. claimed</th>
                <th style={{ textAlign: 'right', background: '#2d5a9a' }}>Monthly claim</th>
                <th style={{ textAlign: 'right' }}>Cumul. certified</th>
                <th style={{ textAlign: 'right', background: '#2d5a9a' }}>Monthly cert</th>
                <th style={{ textAlign: 'right' }}>Cumul. cost T/D</th>
                <th style={{ textAlign: 'right', background: '#2d5a9a' }}>Monthly cost</th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {histRows.map((r, idx) => {
                const prev = histRows[idx - 1]
                return (
                  <tr key={idx} data-row={idx} className="group"
                    style={idx === histRows.length - 1 ? { background: '#FFFDE8' } : {}}>
                    <td className="row-num">{idx + 1}</td>
                    <td style={{ padding: '2px 4px' }}>
                      <input defaultValue={r.month_label}
                        onBlur={e => setHistRows(h => h.map((x,i) => i===idx ? {...x, month_label: e.target.value} : x))}
                        className="grid-input" style={{ textAlign: 'left' }} placeholder="Apr 26" />
                    </td>
                    <td><input type="number" defaultValue={r.cumul_claimed || ''} onBlur={e => setHistRows(h => h.map((x,i) => i===idx ? {...x, cumul_claimed: +e.target.value} : x))} className="grid-input" /></td>
                    <td><div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#2d5a9a', fontWeight: 600 }}>{prev ? fmt(r.cumul_claimed - prev.cumul_claimed) : '—'}</div></td>
                    <td><input type="number" defaultValue={r.cumul_certified || ''} onBlur={e => setHistRows(h => h.map((x,i) => i===idx ? {...x, cumul_certified: +e.target.value} : x))} className="grid-input" /></td>
                    <td><div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#2d5a9a', fontWeight: 600 }}>{prev ? fmt(r.cumul_certified - prev.cumul_certified) : '—'}</div></td>
                    <td><input type="number" defaultValue={r.cumul_cost || ''} onBlur={e => setHistRows(h => h.map((x,i) => i===idx ? {...x, cumul_cost: +e.target.value} : x))} className="grid-input" /></td>
                    <td><div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#2d5a9a', fontWeight: 600 }}>{prev ? fmt(r.cumul_cost - prev.cumul_cost) : '—'}</div></td>
                    <td style={{ textAlign: 'center', padding: '0 4px' }}>
                      {role !== 'viewer' && (
                        <button onClick={() => setHistRows(h => h.filter((_,i) => i !== idx))}
                          className="p-1 rounded text-red-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-gray-400 mt-3">Yellow cells editable. Monthly columns auto-calculate. Click Save History to persist.</p>
        </div>
      )}
    </div>
  )
}
