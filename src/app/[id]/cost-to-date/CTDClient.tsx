'use client'
import MoneyInput from '@/components/MoneyInput'
import { useState, useTransition, useMemo } from 'react'
import { fmt, clx, CATEGORY_COLOURS } from '@/lib/utils'
import { PageHeader, Badge } from '@/components/ui'
import { useTableNav } from '@/lib/tableUtils'
import { Plus, Trash2, AlertTriangle, Upload } from 'lucide-react'
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
  const [search, setSearch]     = useState('')
  const [tradeFilter, setTrade] = useState('All')
  const [adding, setAdding]     = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [newLine, setNewLine]   = useState<{ code: string; posted: number; accruals: number; subRecon: number }>({ code: '', posted: 0, accruals: 0, subRecon: 0 })
  const [pending, setPending]   = useState<Record<string, Partial<Line>>>({})
  const tableNav = useTableNav()

  const trades = useMemo(() => ['All', ...Array.from(new Set(lines.map(l => l.trade))).sort()], [lines])

  const filtered = lines.filter(l => {
    if (tradeFilter !== 'All' && l.trade !== tradeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return l.code.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
    }
    return true
  })

  // Trade summaries
  const tradeSums = useMemo(() => {
    const m: Record<string, { posted: number; accruals: number; total: number }> = {}
    lines.forEach(l => {
      const cur = pending[l.id]
      const posted = Number(cur?.posted_cost ?? l.posted_cost)
      const acc    = Number(cur?.accruals     ?? l.accruals)
      m[l.trade] = m[l.trade] || { posted: 0, accruals: 0, total: 0 }
      m[l.trade].posted   += posted
      m[l.trade].accruals += acc
      m[l.trade].total    += posted + acc + Number(l.sub_recon)
    })
    return m
  }, [lines, pending])

  async function updateLine(id: string, field: string, value: number) {
    setPending(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
    const line = lines.find(l => l.id === id)
    if (!line) return
    const updated = {
      lineId: id,
      postedCost: field === 'posted_cost' ? value : Number(pending[id]?.posted_cost ?? line.posted_cost),
      accruals:   field === 'accruals'    ? value : Number(pending[id]?.accruals    ?? line.accruals),
      subRecon:   field === 'sub_recon'   ? value : Number(pending[id]?.sub_recon   ?? line.sub_recon),
      notes: line.notes,
    }
    const res = await fetch(`/api/projects/${projectId}/cost-to-date`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated),
    })
    if (res.ok) toast('Cost line saved', 'success')
    else toast('Save failed', 'error')
    startTransition(() => router.refresh())
  }

  async function addLine() {
    if (!newLine.code) return
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

  function NumInput({ lineId, field, value }: { lineId: string; field: string; value: number }) {
    return (
      <MoneyInput value={value}
        onSave={v => updateLine(lineId, field, v)}
        onKeyDown={tableNav}
        className="w-full border-gray-300 rounded py-0.5 text-xs"
      />
    )
  }

  const grandTotal = Object.values(tradeSums).reduce((s, v) => s + v.total, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Cost to Date Register"
        subtitle="Posted costs & accruals by cost code · linked to CVR Trade"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)}
              className="border border-[#565e74] text-[#565e74] px-4 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#F1F4E0]">
              <Upload size={14} /> Import CSV
            </button>
            <button onClick={() => setAdding(true)}
              className="bg-[#565e74] text-white px-4 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#1A3A7A]">
              <Plus size={14} /> Add Line
            </button>
          </div>
        }
      />

      {showImport && (
        <ImportModal
          projectId={projectId}
          costCodes={costCodes}
          onClose={() => setShowImport(false)}
          onDone={() => { toast('Import complete', 'success'); startTransition(() => router.refresh()) }}
        />
      )}

      {/* Grand total bar */}
      <div className="bg-[#565e74] px-6 py-2.5 flex items-center gap-6 flex-shrink-0">
        <div className="text-white">
          <span className="text-xs opacity-70 mr-2">Total CTD</span>
          <span className="text-lg font-bold tabular-nums">{fmt(grandTotal)}</span>
        </div>
        <div className="flex gap-4 overflow-x-auto">
          {Object.entries(tradeSums).map(([trade, sums]) => (
            <div key={trade} className="bg-white/10 rounded px-3 py-1 flex-shrink-0 text-center">
              <div className="text-[10px] text-white/60 truncate max-w-[80px]">{trade}</div>
              <div className="text-xs text-white font-bold tabular-nums">{fmt(sums.total)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        <input placeholder="Search code or description…" value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-[#565e74]" />
        <select value={tradeFilter} onChange={e => setTrade(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#565e74]">
          {trades.map(t => <option key={t}>{t}</option>)}
        </select>
        <span className="text-xs text-on-surface-variant ml-auto">{filtered.length} lines</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {[
                ['Code','left','w-28'],['Description','left',''],['Trade','left','w-36'],
                ['Category','left','w-32'],['Posted Cost','right','w-32'],
                ['Accruals','right','w-28'],['Sub Recon','right','w-28'],
                ['Total CTD','right','w-32'],['','center','w-12'],
              ].map(([h,align,w],i) => (
                <th key={i} className={clx('px-4 py-2.5 text-xs font-bold text-white bg-[#565e74]', w, `text-${align}`)}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {adding && (
              <tr className="bg-[#FFFFC7] border-b border-amber-200">
                <td className="px-3 py-2">
                  <input value={newLine.code} onChange={e => setNewLine(p => ({ ...p, code: e.target.value }))}
                    list="cc-list" placeholder="Code…"
                    className="w-24 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#565e74]" />
                  <datalist id="cc-list">{costCodes.map(c => <option key={c.code} value={c.code}>{c.description}</option>)}</datalist>
                </td>
                <td className="px-3 py-2 text-xs text-on-surface-variant">{costCodes.find(c => c.code === newLine.code)?.description}</td>
                <td className="px-3 py-2 text-xs text-on-surface-variant">{costCodes.find(c => c.code === newLine.code)?.trade}</td>
                <td />
                <td className="px-3 py-2"><input type="number" value={newLine.posted} onChange={e => setNewLine(p => ({ ...p, posted: Number(e.target.value) }))} className="w-full border rounded px-2 py-1 text-xs text-right focus:outline-none" /></td>
                <td className="px-3 py-2"><input type="number" value={newLine.accruals} onChange={e => setNewLine(p => ({ ...p, accruals: Number(e.target.value) }))} className="w-full border rounded px-2 py-1 text-xs text-right focus:outline-none" /></td>
                <td className="px-3 py-2"><input type="number" value={newLine.subRecon} onChange={e => setNewLine(p => ({ ...p, subRecon: Number(e.target.value) }))} className="w-full border rounded px-2 py-1 text-xs text-right focus:outline-none" /></td>
                <td className="px-4 py-2 text-right tabular-nums text-xs font-bold">{fmt(newLine.posted + newLine.accruals + newLine.subRecon)}</td>
                <td className="px-3 py-2 flex gap-1">
                  <button onClick={addLine} className="bg-[#565e74] text-white px-2 py-1 rounded text-xs">Add</button>
                  <button onClick={() => setAdding(false)} className="bg-gray-200 px-2 py-1 rounded text-xs">✕</button>
                </td>
              </tr>
            )}

            {filtered.map((l, idx) => {
              const p = pending[l.id]
              const posted  = Number(p?.posted_cost ?? l.posted_cost)
              const acc     = Number(p?.accruals     ?? l.accruals)
              const sub     = Number(p?.sub_recon    ?? l.sub_recon)
              const total   = posted + acc + sub
              const oddRow  = idx % 2 === 0

              return (
                <tr key={l.id} className={clx('border-b border-outline-variant/10 group hover:bg-blue-50/30 transition-colors', oddRow ? 'bg-white' : 'bg-surface-container-low/50')}>
                  <td className="px-4 py-1.5"><span className="font-mono font-bold text-[#565e74] text-xs">{l.code}</span></td>
                  <td className="px-4 py-1.5 text-sm text-on-surface max-w-[220px]"><span className="truncate block">{l.description}</span></td>
                  <td className="px-4 py-1.5 text-xs text-on-surface-variant">{l.trade}</td>
                  <td className="px-4 py-1.5"><Badge className={CATEGORY_COLOURS[l.category] || 'bg-gray-100 text-on-surface-variant'}>{l.category}</Badge></td>
                  <td className="px-3 py-1"><NumInput lineId={l.id} field="posted_cost" value={posted} /></td>
                  <td className="px-3 py-1"><NumInput lineId={l.id} field="accruals"    value={acc} /></td>
                  <td className="px-3 py-1"><NumInput lineId={l.id} field="sub_recon"   value={sub} /></td>
                  <td className={clx('px-4 py-1.5 text-right tabular-nums font-semibold text-sm', total > 0 ? 'text-on-surface' : 'text-on-surface-variant')}>{fmt(total)}</td>
                  <td className="px-4 py-1.5 text-center">
                    <button onClick={() => deleteLine(l.id)}
                      className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}

            {/* Trade sub-totals per trade group */}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-on-surface-variant">No lines match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
