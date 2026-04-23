'use client'
import { useRef, useState, useMemo, useTransition } from 'react'
import { fmt, clx, CATEGORY_COLOURS } from '@/lib/utils'
import { PageHeader, Badge } from '@/components/ui'
import { useGridNav } from '@/lib/tableUtils'
import GridInput from '@/components/GridInput'
import { Plus, Trash2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import ImportModal from '@/components/ImportModal'

type Line = {
  id: string; cost_code_id: string; posted_cost: number; accruals: number
  sub_recon: number; notes: string | null; code: string; description: string
  trade: string; category: string
}
type CC = { code: string; description: string; trade: string; category: string }

export default function CTDClient({ lines, costCodes, projectId }: { lines: Line[]; costCodes: CC[]; projectId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const { toast } = useToast()
  const gridNav = useGridNav()

  // ── Local value store (ref = no re-renders on cell edits) ─────────────────
  const localVals = useRef<Record<string, number>>({})
  const [tick, setTick] = useState(0)   // incremented after each save → rerenders totals only

  function getVal(id: string, field: string): number {
    const key = `${id}:${field}`
    return key in localVals.current
      ? localVals.current[key]
      : Number((lines.find(l => l.id === id) as any)?.[field] ?? 0)
  }

  // Fire-and-forget save — NO router.refresh(), NO blocking setState
  function saveCell(lineId: string, field: string, value: number) {
    const key = `${lineId}:${field}`
    localVals.current[key] = value
    setTick(t => t + 1)   // re-render totals only

    fetch(`/api/projects/${projectId}/cost-to-date`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineId,
        postedCost: field === 'posted_cost' ? value : getVal(lineId, 'posted_cost'),
        accruals:   field === 'accruals'    ? value : getVal(lineId, 'accruals'),
        subRecon:   field === 'sub_recon'   ? value : getVal(lineId, 'sub_recon'),
        notes: lines.find(l => l.id === lineId)?.notes ?? null,
      }),
    }).catch(() => toast('Save failed', 'error'))
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search, setSearch]     = useState('')
  const [tradeFilter, setTrade] = useState('All')
  const [adding, setAdding]     = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [newLine, setNewLine]   = useState({ code: '', posted: 0, accruals: 0, subRecon: 0 })

  const trades = useMemo(() => ['All', ...Array.from(new Set(lines.map(l => l.trade))).sort()], [lines])

  const filtered = useMemo(() => lines.filter(l => {
    if (tradeFilter !== 'All' && l.trade !== tradeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return l.code.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
    }
    return true
  }), [lines, search, tradeFilter])

  // ── Totals (recomputed on tick) ────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { grandTotal, tradeSums } = useMemo(() => {
    const tradeSums: Record<string, { posted: number; accruals: number; total: number }> = {}
    let grandTotal = 0
    lines.forEach(l => {
      const posted  = getVal(l.id, 'posted_cost')
      const acc     = getVal(l.id, 'accruals')
      const sub     = getVal(l.id, 'sub_recon')
      const tot     = posted + acc + sub
      tradeSums[l.trade] = tradeSums[l.trade] || { posted: 0, accruals: 0, total: 0 }
      tradeSums[l.trade].posted   += posted
      tradeSums[l.trade].accruals += acc
      tradeSums[l.trade].total    += tot
      grandTotal += tot
    })
    return { grandTotal, tradeSums }
  // tick is the real dependency — ESLint doesn't understand that
  }, [tick, lines]) // eslint-disable-line

  // ── Add / delete ──────────────────────────────────────────────────────────
  async function addLine() {
    if (!newLine.code) { toast('Select a cost code first', 'error'); return }
    const res = await fetch(`/api/projects/${projectId}/cost-to-date`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newLine.code, postedCost: newLine.posted, accruals: newLine.accruals, subRecon: newLine.subRecon }),
    })
    if (res.ok) toast('Line added', 'success')
    else toast((await res.json()).error || 'Add failed', 'error')
    setAdding(false); setNewLine({ code: '', posted: 0, accruals: 0, subRecon: 0 })
    startTransition(() => router.refresh())
  }

  async function deleteLine(id: string) {
    if (!confirm('Delete this cost line?')) return
    await fetch(`/api/projects/${projectId}/cost-to-date`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineId: id }),
    })
    toast('Line deleted', 'warning')
    startTransition(() => router.refresh())
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Cost to Date"
        subtitle="Posted costs & accruals by cost code"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)}
              className="border border-[#565e74] text-[#565e74] px-3 py-1.5 rounded text-xs flex items-center gap-1.5 hover:bg-[#F1F4E0]">
              <Upload size={13} /> Import CSV
            </button>
            <button onClick={() => setAdding(true)}
              className="bg-primary text-white px-3 py-1.5 rounded text-xs flex items-center gap-1.5 hover:bg-primary-dim font-semibold">
              <Plus size={13} /> Add Line
            </button>
          </div>
        }
      />

      {/* Trade summary strip */}
      <div className="bg-[#1e3a5f] px-5 py-2 flex items-center gap-6 overflow-x-auto flex-shrink-0">
        {Object.entries(tradeSums).map(([trade, s]) => (
          <div key={trade} className="flex-shrink-0 cursor-pointer" onClick={() => setTrade(tradeFilter === trade ? 'All' : trade)}>
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'rgba(168,196,224,0.55)' }}>{trade}</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: tradeFilter === trade ? '#9edd6e' : '#ccd4ee' }}>{fmt(s.total)}</div>
          </div>
        ))}
        <div className="flex-shrink-0 ml-auto">
          <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'rgba(168,196,224,0.55)' }}>Grand total</div>
          <div className="text-sm font-black tabular-nums text-white">{fmt(grandTotal)}</div>
        </div>
      </div>

      {/* Search / filter bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description…"
          className="border rounded px-2.5 py-1 text-xs w-52 focus:outline-none focus:ring-1 focus:ring-primary" />
        <select value={tradeFilter} onChange={e => setTrade(e.target.value)}
          className="border rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          {trades.map(t => <option key={t}>{t}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-on-surface-variant">{filtered.length} lines</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="ss-table" onKeyDown={gridNav}>
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: 'center' }}>#</th>
              <th style={{ width: 80, textAlign: 'left' }}>Code</th>
              <th style={{ textAlign: 'left', minWidth: 180 }}>Description</th>
              <th style={{ width: 130, textAlign: 'left' }}>Trade</th>
              <th style={{ width: 120, textAlign: 'right' }}>Posted cost</th>
              <th style={{ width: 120, textAlign: 'right' }}>Accruals</th>
              <th style={{ width: 120, textAlign: 'right' }}>Sub recon</th>
              <th style={{ width: 130, textAlign: 'right' }}>Total CTD</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {adding && (
              <tr data-row={-1}>
                <td className="row-num">+</td>
                <td colSpan={3} style={{ padding: '4px 8px' }}>
                  <select value={newLine.code} autoFocus onChange={e => setNewLine(p => ({ ...p, code: e.target.value }))}
                    className="border rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{ background: '#FFFFC7' }}>
                    <option value="">— Select cost code —</option>
                    {costCodes.map(c => <option key={c.code} value={c.code}>{c.code} · {c.description}</option>)}
                  </select>
                </td>
                <td data-col={0}>
                  <GridInput value={newLine.posted} onSave={v => setNewLine(p => ({ ...p, posted: v }))} />
                </td>
                <td data-col={1}>
                  <GridInput value={newLine.accruals} onSave={v => setNewLine(p => ({ ...p, accruals: v }))} />
                </td>
                <td data-col={2}>
                  <GridInput value={newLine.subRecon} onSave={v => setNewLine(p => ({ ...p, subRecon: v }))} />
                </td>
                <td />
                <td style={{ padding: '4px 6px' }}>
                  <div className="flex gap-1">
                    <button onClick={addLine} className="px-2 py-1 rounded text-white text-[11px] font-bold" style={{ background: '#456919' }}>Add</button>
                    <button onClick={() => setAdding(false)} className="px-2 py-1 rounded text-[11px] bg-gray-200">✕</button>
                  </div>
                </td>
              </tr>
            )}

            {filtered.length === 0 && !adding && (
              <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No cost lines yet. Click "Add Line" to start entering costs.
              </td></tr>
            )}

            {filtered.map((l, idx) => {
              const posted = getVal(l.id, 'posted_cost')
              const acc    = getVal(l.id, 'accruals')
              const sub    = getVal(l.id, 'sub_recon')
              const total  = posted + acc + sub
              const catCol = (CATEGORY_COLOURS as any)[l.category] || '#565e74'

              return (
                <tr key={l.id} data-row={idx} className="group">
                  <td className="row-num">{idx + 1}</td>
                  <td>
                    <div className="ss-cell-ro" style={{ fontFamily: 'monospace', fontSize: 11, color: '#565e74', fontWeight: 600 }}>
                      {l.code}
                    </div>
                  </td>
                  <td>
                    <div className="ss-cell-ro" title={l.description}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{l.description}</span>
                    </div>
                  </td>
                  <td>
                    <div className="ss-cell-ro">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: catCol + '18', color: catCol }}>
                        {l.trade}
                      </span>
                    </div>
                  </td>
                  <td data-col={0}>
                    <GridInput value={posted} onSave={v => saveCell(l.id, 'posted_cost', v)} />
                  </td>
                  <td data-col={1}>
                    <GridInput value={acc} onSave={v => saveCell(l.id, 'accruals', v)} />
                  </td>
                  <td data-col={2}>
                    <GridInput value={sub} onSave={v => saveCell(l.id, 'sub_recon', v)} />
                  </td>
                  <td>
                    <div className="ss-cell-total">{total ? fmt(total) : '—'}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '0 4px' }}>
                    <button onClick={() => deleteLine(l.id)}
                      className="p-1 rounded text-red-200 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {filtered.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'left' }}>TOTAL ({filtered.length} lines)</td>
                <td style={{ textAlign: 'right' }}>{fmt(filtered.reduce((s, l) => s + getVal(l.id, 'posted_cost'), 0))}</td>
                <td style={{ textAlign: 'right' }}>{fmt(filtered.reduce((s, l) => s + getVal(l.id, 'accruals'), 0))}</td>
                <td style={{ textAlign: 'right' }}>{fmt(filtered.reduce((s, l) => s + getVal(l.id, 'sub_recon'), 0))}</td>
                <td style={{ textAlign: 'right' }}>{fmt(filtered.reduce((s, l) => s + getVal(l.id, 'posted_cost') + getVal(l.id, 'accruals') + getVal(l.id, 'sub_recon'), 0))}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showImport && (
        <ImportModal projectId={projectId} costCodes={costCodes as any}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); startTransition(() => router.refresh()) }} />
      )}
    </div>
  )
}
