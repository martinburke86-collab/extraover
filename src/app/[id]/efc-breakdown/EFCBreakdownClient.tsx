'use client'
import { useState, useMemo } from 'react'
import { fmt, clx, CATEGORY_COLOURS } from '@/lib/utils'
import { PageHeader, Badge } from '@/components/ui'

type Line = {
  cost_code_id: string
  code: string
  description: string
  trade: string
  category: string
  tradeSort: number
  ctd: number
  committed: number
  forecast: number
  efc: number
}

type View = 'element' | 'costcode' | 'type'

const VIEW_LABELS: Record<View, string> = {
  element:  'By element',
  costcode: 'By cost code',
  type:     'By type',
}

// Colour helpers for CTD/committed/forecast/EFC columns
const COL = {
  ctd:       'text-[#565e74] font-medium',
  committed: 'text-[#856c0b] font-medium',
  forecast:  'text-on-surface-variant',
  efc:       'text-on-surface font-semibold',
}

const TYPE_COLOURS: Record<string, string> = {
  Labour:        'bg-blue-50 text-blue-800',
  Materials:     'bg-green-50 text-green-800',
  Subcontractor: 'bg-amber-50 text-amber-800',
  Indirect:      'bg-gray-100 text-gray-700',
  Unassigned:    'bg-red-50 text-red-700',
}

function Money({ v, cls }: { v: number; cls?: string }) {
  return (
    <span className={clx('tabular-nums', cls, v === 0 ? 'text-on-surface-variant/40' : '')}>
      {v === 0 ? '–' : fmt(v)}
    </span>
  )
}

function VarBadge({ budget, efc }: { budget: number; efc: number }) {
  if (!budget) return <span className="text-on-surface-variant/40 text-xs">–</span>
  const diff = efc - budget
  const pct  = budget ? ((diff / budget) * 100).toFixed(1) : '0'
  if (Math.abs(diff) < 1) return <span className="text-on-surface-variant/40 text-xs">–</span>
  return (
    <span className={clx('text-xs font-medium tabular-nums', diff > 0 ? 'text-error' : 'text-tertiary')}>
      {diff > 0 ? '+' : ''}{fmt(diff)}
      <span className="text-[10px] ml-1 opacity-70">({diff > 0 ? '+' : ''}{pct}%)</span>
    </span>
  )
}

// ─── By Element (trade) ──────────────────────────────────────────────────────
function ByElement({ lines }: { lines: Line[] }) {
  const groups = useMemo(() => {
    const m: Record<string, { ctd: number; committed: number; forecast: number; efc: number; count: number; sort: number }> = {}
    lines.forEach(l => {
      if (!m[l.trade]) m[l.trade] = { ctd: 0, committed: 0, forecast: 0, efc: 0, count: 0, sort: l.tradeSort }
      m[l.trade].ctd       += l.ctd
      m[l.trade].committed += l.committed
      m[l.trade].forecast  += l.forecast
      m[l.trade].efc       += l.efc
      m[l.trade].count     += 1
    })
    return Object.entries(m).sort((a, b) => a[1].sort - b[1].sort)
  }, [lines])

  const totals = useMemo(() => groups.reduce((s, [, v]) => ({
    ctd: s.ctd + v.ctd, committed: s.committed + v.committed,
    forecast: s.forecast + v.forecast, efc: s.efc + v.efc,
  }), { ctd: 0, committed: 0, forecast: 0, efc: 0 }), [groups])

  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 z-10">
        <tr>
          {[
            ['Element / Trade', 'left', 'w-[28%]'],
            ['Cost codes',      'right','w-16'],
            ['CTD',             'right','w-[15%]'],
            ['Committed',       'right','w-[15%]'],
            ['Forecast to complete','right','w-[15%]'],
            ['EFC',             'right','w-[15%]'],
            ['% of total',      'right','w-[12%]'],
          ].map(([h, align, w]) => (
            <th key={h} className={clx('px-4 py-2.5 text-[10px] font-bold text-white bg-[#565e74] uppercase tracking-wide', w, `text-${align}`)}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groups.map(([trade, v], idx) => (
          <tr key={trade} className={clx('border-b border-outline-variant/10 hover:bg-blue-50/20 transition-colors', idx % 2 === 0 ? 'bg-white' : 'bg-surface-container-low/30')}>
            <td className="px-4 py-2.5 font-semibold text-on-surface">{trade}</td>
            <td className="px-4 py-2.5 text-right text-xs text-on-surface-variant">{v.count}</td>
            <td className="px-4 py-2.5 text-right"><Money v={v.ctd} cls={COL.ctd} /></td>
            <td className="px-4 py-2.5 text-right"><Money v={v.committed} cls={COL.committed} /></td>
            <td className="px-4 py-2.5 text-right"><Money v={v.forecast} cls={COL.forecast} /></td>
            <td className="px-4 py-2.5 text-right"><Money v={v.efc} cls={COL.efc} /></td>
            <td className="px-4 py-2.5 text-right">
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs tabular-nums text-on-surface-variant">
                  {totals.efc ? ((v.efc / totals.efc) * 100).toFixed(1) : '0'}%
                </span>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#565e74] rounded-full" style={{ width: `${totals.efc ? Math.min((v.efc / totals.efc) * 100, 100) : 0}%` }} />
                </div>
              </div>
            </td>
          </tr>
        ))}
        <tr className="bg-[#565e74]/5 border-t-2 border-[#565e74]/30">
          <td className="px-4 py-2.5 font-bold text-on-surface text-sm">Total</td>
          <td className="px-4 py-2.5 text-right text-xs text-on-surface-variant">{lines.length}</td>
          <td className="px-4 py-2.5 text-right font-bold text-sm"><Money v={totals.ctd} cls={COL.ctd} /></td>
          <td className="px-4 py-2.5 text-right font-bold text-sm"><Money v={totals.committed} cls={COL.committed} /></td>
          <td className="px-4 py-2.5 text-right font-bold text-sm"><Money v={totals.forecast} cls={COL.forecast} /></td>
          <td className="px-4 py-2.5 text-right font-bold text-sm text-on-surface"><Money v={totals.efc} /></td>
          <td className="px-4 py-2.5 text-right text-xs font-bold text-on-surface-variant">100%</td>
        </tr>
      </tbody>
    </table>
  )
}

// ─── By Cost Code ────────────────────────────────────────────────────────────
function ByCostCode({ lines }: { lines: Line[] }) {
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All')
  const [catFilter, setCatFilter]     = useState('All')

  const trades = useMemo(() => ['All', ...Array.from(new Set(lines.map(l => l.trade))).sort()], [lines])
  const cats   = useMemo(() => ['All', ...Array.from(new Set(lines.map(l => l.category))).sort()], [lines])

  const filtered = useMemo(() => lines.filter(l => {
    if (tradeFilter !== 'All' && l.trade !== tradeFilter) return false
    if (catFilter   !== 'All' && l.category !== catFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return l.code.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
    }
    return true
  }), [lines, tradeFilter, catFilter, search])

  const totals = useMemo(() => filtered.reduce((s, l) => ({
    ctd: s.ctd + l.ctd, committed: s.committed + l.committed,
    forecast: s.forecast + l.forecast, efc: s.efc + l.efc,
  }), { ctd: 0, committed: 0, forecast: 0, efc: 0 }), [filtered])

  const grandEfc = useMemo(() => lines.reduce((s, l) => s + l.efc, 0), [lines])

  return (
    <>
      {/* Sub-filters */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description…"
          className="border rounded px-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-[#565e74]" />
        <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#565e74]">
          {trades.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#565e74]">
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
        <span className="text-xs text-on-surface-variant ml-auto">{filtered.length} of {lines.length} codes</span>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            {[
              ['Code',        'left', 'w-24'],
              ['Description', 'left', 'w-[22%]'],
              ['Trade',       'left', 'w-[14%]'],
              ['Category',    'left', 'w-[11%]'],
              ['CTD',         'right','w-[12%]'],
              ['Committed',   'right','w-[12%]'],
              ['Forecast',    'right','w-[12%]'],
              ['EFC',         'right','w-[12%]'],
              ['% of total',  'right','w-[9%]'],
            ].map(([h, align, w]) => (
              <th key={h} className={clx('px-3 py-2.5 text-[10px] font-bold text-white bg-[#565e74] uppercase tracking-wide', w, `text-${align}`)}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((l, idx) => (
            <tr key={l.cost_code_id} className={clx('border-b border-outline-variant/10 hover:bg-blue-50/20 transition-colors', idx % 2 === 0 ? 'bg-white' : 'bg-surface-container-low/30')}>
              <td className="px-3 py-2 font-mono font-bold text-[#565e74] text-xs">{l.code}</td>
              <td className="px-3 py-2 text-on-surface max-w-0"><span className="block truncate">{l.description}</span></td>
              <td className="px-3 py-2 text-xs text-on-surface-variant">{l.trade}</td>
              <td className="px-3 py-2">
                <span className={clx('px-1.5 py-0.5 rounded text-[10px] font-medium', TYPE_COLOURS[l.category] || 'bg-gray-100 text-gray-600')}>
                  {l.category}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-xs"><Money v={l.ctd} cls={COL.ctd} /></td>
              <td className="px-3 py-2 text-right text-xs"><Money v={l.committed} cls={COL.committed} /></td>
              <td className="px-3 py-2 text-right text-xs"><Money v={l.forecast} cls={COL.forecast} /></td>
              <td className="px-3 py-2 text-right text-xs"><Money v={l.efc} cls={COL.efc} /></td>
              <td className="px-3 py-2 text-right">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] tabular-nums text-on-surface-variant">
                    {grandEfc ? ((l.efc / grandEfc) * 100).toFixed(1) : '0'}%
                  </span>
                  <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#565e74] rounded-full" style={{ width: `${grandEfc ? Math.min((l.efc / grandEfc) * 100, 100) : 0}%` }} />
                  </div>
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-12 text-center text-on-surface-variant text-sm">No cost codes match the current filter.</td></tr>
          )}
          {filtered.length > 0 && (
            <tr className="bg-[#565e74]/5 border-t-2 border-[#565e74]/30">
              <td colSpan={4} className="px-3 py-2.5 font-bold text-on-surface text-sm">Total ({filtered.length} codes)</td>
              <td className="px-3 py-2.5 text-right font-bold text-sm"><Money v={totals.ctd} cls={COL.ctd} /></td>
              <td className="px-3 py-2.5 text-right font-bold text-sm"><Money v={totals.committed} cls={COL.committed} /></td>
              <td className="px-3 py-2.5 text-right font-bold text-sm"><Money v={totals.forecast} cls={COL.forecast} /></td>
              <td className="px-3 py-2.5 text-right font-bold text-sm text-on-surface">{fmt(totals.efc)}</td>
              <td className="px-3 py-2.5 text-right text-xs font-bold text-on-surface-variant">
                {grandEfc ? ((totals.efc / grandEfc) * 100).toFixed(1) : '100'}%
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}

// ─── By Type ─────────────────────────────────────────────────────────────────
function ByType({ lines }: { lines: Line[] }) {
  const ORDER = ['Labour', 'Materials', 'Subcontractor', 'Indirect', 'Unassigned']

  const groups = useMemo(() => {
    const m: Record<string, { ctd: number; committed: number; forecast: number; efc: number; count: number }> = {}
    lines.forEach(l => {
      const key = l.category || 'Unassigned'
      if (!m[key]) m[key] = { ctd: 0, committed: 0, forecast: 0, efc: 0, count: 0 }
      m[key].ctd       += l.ctd
      m[key].committed += l.committed
      m[key].forecast  += l.forecast
      m[key].efc       += l.efc
      m[key].count     += 1
    })
    return ORDER
      .filter(k => m[k])
      .map(k => [k, m[k]] as [string, typeof m[string]])
  }, [lines])

  const totals = useMemo(() => groups.reduce((s, [, v]) => ({
    ctd: s.ctd + v.ctd, committed: s.committed + v.committed,
    forecast: s.forecast + v.forecast, efc: s.efc + v.efc,
  }), { ctd: 0, committed: 0, forecast: 0, efc: 0 }), [groups])

  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 z-10">
        <tr>
          {[
            ['Cost type',   'left', 'w-[22%]'],
            ['Codes',       'right','w-16'],
            ['CTD',         'right','w-[16%]'],
            ['Committed',   'right','w-[16%]'],
            ['Forecast to complete','right','w-[16%]'],
            ['EFC',         'right','w-[16%]'],
            ['% of EFC',    'right','w-[14%]'],
          ].map(([h, align, w]) => (
            <th key={h} className={clx('px-4 py-2.5 text-[10px] font-bold text-white bg-[#565e74] uppercase tracking-wide', w, `text-${align}`)}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groups.map(([category, v]) => (
          <tr key={category} className="border-b border-outline-variant/10 hover:bg-blue-50/20 transition-colors bg-white">
            <td className="px-4 py-3">
              <span className={clx('px-2.5 py-1 rounded text-xs font-semibold', TYPE_COLOURS[category] || 'bg-gray-100 text-gray-600')}>
                {category}
              </span>
            </td>
            <td className="px-4 py-3 text-right text-xs text-on-surface-variant">{v.count}</td>
            <td className="px-4 py-3 text-right"><Money v={v.ctd} cls={COL.ctd} /></td>
            <td className="px-4 py-3 text-right"><Money v={v.committed} cls={COL.committed} /></td>
            <td className="px-4 py-3 text-right"><Money v={v.forecast} cls={COL.forecast} /></td>
            <td className="px-4 py-3 text-right font-semibold text-on-surface">{fmt(v.efc)}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-sm font-semibold tabular-nums text-on-surface">
                  {totals.efc ? ((v.efc / totals.efc) * 100).toFixed(1) : '0'}%
                </span>
                <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={clx('h-full rounded-full', {
                    Labour:        'bg-blue-400',
                    Materials:     'bg-green-400',
                    Subcontractor: 'bg-amber-400',
                    Indirect:      'bg-gray-400',
                  }[category] || 'bg-[#565e74]')} style={{ width: `${totals.efc ? Math.min((v.efc / totals.efc) * 100, 100) : 0}%` }} />
                </div>
              </div>
            </td>
          </tr>
        ))}
        <tr className="bg-[#565e74]/5 border-t-2 border-[#565e74]/30">
          <td className="px-4 py-2.5 font-bold text-on-surface text-sm">Total</td>
          <td className="px-4 py-2.5 text-right text-xs text-on-surface-variant">{lines.length}</td>
          <td className="px-4 py-2.5 text-right font-bold text-sm"><Money v={totals.ctd} cls={COL.ctd} /></td>
          <td className="px-4 py-2.5 text-right font-bold text-sm"><Money v={totals.committed} cls={COL.committed} /></td>
          <td className="px-4 py-2.5 text-right font-bold text-sm"><Money v={totals.forecast} cls={COL.forecast} /></td>
          <td className="px-4 py-2.5 text-right font-bold text-sm text-on-surface">{fmt(totals.efc)}</td>
          <td className="px-4 py-2.5 text-right text-sm font-bold text-on-surface-variant">100%</td>
        </tr>
      </tbody>
    </table>
  )
}

// ─── Main Client ─────────────────────────────────────────────────────────────
export default function EFCBreakdownClient({ lines, projectId }: { lines: Line[]; projectId: string }) {
  const [view, setView] = useState<View>('element')

  const totals = useMemo(() => lines.reduce((s, l) => ({
    ctd: s.ctd + l.ctd, committed: s.committed + l.committed,
    forecast: s.forecast + l.forecast, efc: s.efc + l.efc,
  }), { ctd: 0, committed: 0, forecast: 0, efc: 0 }), [lines])

  const KPI_ITEMS = [
    { label: 'Total CTD',             value: totals.ctd,       sub: 'posted + accruals + sub recon', colour: 'text-[#565e74]' },
    { label: 'Total committed',       value: totals.committed, sub: 'excl. cancelled',               colour: 'text-[#856c0b]' },
    { label: 'Forecast to complete',  value: totals.forecast,  sub: 'remaining works',               colour: 'text-on-surface-variant' },
    { label: 'EFC',                   value: totals.efc,       sub: 'estimate final cost',           colour: 'text-on-surface' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="EFC Breakdown"
        subtitle="Estimate final cost · CTD + Committed + Forecast to complete · read-only"
      />

      {/* KPI strip */}
      <div className="bg-[#565e74] px-6 py-3 flex items-center gap-8 flex-shrink-0">
        {KPI_ITEMS.map(({ label, value, sub }) => (
          <div key={label} className="text-white">
            <div className="text-[10px] uppercase tracking-wide opacity-60">{label}</div>
            <div className="text-lg font-bold tabular-nums">{fmt(value)}</div>
            <div className="text-[10px] opacity-50">{sub}</div>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-4 text-white/60">
          <div className="flex items-center gap-1.5 text-[11px]"><span className="w-3 h-2 bg-[#565e74] border border-white/30 rounded-sm inline-block" /> CTD</div>
          <div className="flex items-center gap-1.5 text-[11px]"><span className="w-3 h-2 bg-[#856c0b] rounded-sm inline-block" /> Committed</div>
          <div className="flex items-center gap-1.5 text-[11px]"><span className="w-3 h-2 bg-gray-400 rounded-sm inline-block" /> Forecast</div>
          <div className="flex items-center gap-1.5 text-[11px]"><span className="w-3 h-2 bg-white/80 rounded-sm inline-block" /> EFC</div>
        </div>
      </div>

      {/* View switcher */}
      <div className="bg-white border-b px-6 py-2.5 flex items-center gap-2 flex-shrink-0">
        {(Object.keys(VIEW_LABELS) as View[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={clx(
              'px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              view === v
                ? 'bg-[#565e74] text-white border-[#565e74]'
                : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low'
            )}>
            {VIEW_LABELS[v]}
          </button>
        ))}
        <span className="ml-auto text-xs text-on-surface-variant">{lines.length} cost codes</span>
      </div>

      {/* Panel with accent bar */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="h-1 bg-[#565e74]" />
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant gap-3">
            <span className="material-symbols-outlined text-4xl opacity-30">table_chart</span>
            <p className="text-sm">No cost codes set up yet.</p>
            <p className="text-xs opacity-70">Add cost codes and enter costs in the CTD, Committed, and Forecast sheets.</p>
          </div>
        ) : (
          <>
            {view === 'element'  && <ByElement  lines={lines} />}
            {view === 'costcode' && <ByCostCode lines={lines} />}
            {view === 'type'     && <ByType     lines={lines} />}
          </>
        )}
      </div>

      {/* Footer note */}
      <div className="bg-surface-container-low border-t px-6 py-2 text-[11px] text-on-surface-variant flex-shrink-0">
        EFC = Cost to Date + Committed (excl. Cancelled) + Forecast to Complete · All values from live data · Edit in CTD, Committed, and Forecast sheets
      </div>
    </div>
  )
}
