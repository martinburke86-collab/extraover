'use client'
import { useState, useTransition, useMemo } from 'react'
import { fmt, pct, clx, STATUS_COLOURS, CATEGORY_COLOURS } from '@/lib/utils'
import { PageHeader, Badge } from '@/components/ui'
import { useTableNav } from '@/lib/tableUtils'
import BreakdownCell from '@/components/BreakdownCell'
import { Plus, ChevronRight, ChevronDown, Trash2, Edit3, Upload } from 'lucide-react'
import UploadModal from '@/components/UploadModal'
import { useRouter } from 'next/navigation'

type FLine = {
  id: string; cost_code_id: string; parent_id: string | null; sort_order: number
  supplier: string; status: string; factor: number | null; quantity: number | null
  unit: string | null; rate: number | null; total: number; comment: string | null
  cc_code: string; cc_desc: string; trade: string; category: string
}
type CostCode = { code: string; description: string; trade: string; category: string }

interface Props { lines: FLine[]; costCodes: CostCode[]; projectId: string }

const STATUSES = ['Estimate','Quote','Final','Variation - Recoverable','Variation - Non Recoverable','Contingency']
const TRADES   = ['All Trades','Preliminaries','Design','Civil Works','Electrical Works','Mechanical Works','Commissioning','Other / Contingency']

export default function ForecastClient({ lines, costCodes, projectId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [expanded, setExpanded]       = useState<Set<string>>(new Set())
  const [tradeFilter, setTradeFilter] = useState('All Trades')
  const [statusFilter, setStatus]     = useState('All')
  const [search, setSearch]           = useState('')
  const [addingTo, setAddingTo]       = useState<string | null>(null)
  const tableNav = useTableNav()
  const [showUpload, setShowUpload]   = useState(false)  // parentId or 'root'
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<Partial<FLine & { code: string }>>({})

  // Build tree
  const parents = lines.filter(l => !l.parent_id)
  const childMap = useMemo(() => {
    const m: Record<string, FLine[]> = {}
    lines.forEach(l => {
      if (l.parent_id) {
        m[l.parent_id] = [...(m[l.parent_id] || []), l]
      }
    })
    return m
  }, [lines])

  // EFC by trade
  const efcByTrade = useMemo(() => {
    const m: Record<string, number> = {}
    lines.forEach(l => {
      m[l.trade] = (m[l.trade] || 0) + l.total
    })
    return m
  }, [lines])
  const totalEfc = Object.values(efcByTrade).reduce((s, v) => s + v, 0)

  // Filter
  const filtered = parents.filter(l => {
    if (tradeFilter !== 'All Trades' && l.trade !== tradeFilter) return false
    if (statusFilter !== 'All' && l.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!l.cc_code.toLowerCase().includes(q) && !l.cc_desc.toLowerCase().includes(q) && !(l.supplier || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function calcTotal(f: Partial<FLine>): number {
    if (f.factor && f.quantity && f.rate) return f.factor * f.quantity * f.rate
    if (f.quantity && f.rate) return f.quantity * f.rate
    if (f.rate) return f.rate
    return 0
  }

  async function submitForm(parentId?: string) {
    const total = calcTotal(form)
    const payload = { ...form, total, parentId: parentId ?? null }
    const method  = editingId ? 'PATCH' : 'POST'
    const body    = editingId ? { ...payload, lineId: editingId } : payload

    await fetch(`/api/projects/${projectId}/forecast`, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setAddingTo(null); setEditingId(null); setForm({})
    startTransition(() => router.refresh())
  }

  async function deleteLine(id: string) {
    if (!confirm('Delete this line and all sub-items?')) return
    await fetch(`/api/projects/${projectId}/forecast`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineId: id }),
    })
    startTransition(() => router.refresh())
  }

  function startEdit(l: FLine) {
    setEditingId(l.id)
    setForm({ ...l, code: l.cc_code })
    setAddingTo(l.parent_id ?? 'root')
  }

  function FormRow({ parentId }: { parentId?: string }) {
    const cc = costCodes.find(c => c.code === form.code)
    return (
      <tr className="bg-[#FFFFC7] border-b border-amber-200">
        <td className="px-2 py-1.5" colSpan={parentId ? 1 : 0}>
          <input placeholder="Code" value={form.code ?? ''} list="codes-list"
            onChange={e => { setForm(p => ({ ...p, code: e.target.value })) }}
            className="w-24 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#565e74]" />
          <datalist id="codes-list">
            {costCodes.map(c => <option key={c.code} value={c.code}>{c.description}</option>)}
          </datalist>
        </td>
        <td className="px-2 py-1.5">
          <span className="text-xs text-gray-500">{cc?.description ?? '–'}</span>
        </td>
        <td className="px-2 py-1.5">
          <span className="text-xs text-gray-500">{cc?.trade ?? '–'}</span>
        </td>
        <td className="px-2 py-1.5">
          <input placeholder="Supplier" value={form.supplier ?? ''}
            onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
            className="w-28 border rounded px-2 py-1 text-xs focus:outline-none" />
        </td>
        <td className="px-2 py-1.5">
          <select value={form.status ?? 'Estimate'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
            className="border rounded px-1.5 py-1 text-xs focus:outline-none">
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </td>
        <td className="px-2 py-1.5">
          <input type="number" placeholder="Factor" value={form.factor ?? ''}
            onChange={e => setForm(p => ({ ...p, factor: e.target.value ? Number(e.target.value) : null }))}
            className="w-16 border rounded px-2 py-1 text-xs text-right focus:outline-none" />
        </td>
        <td className="px-2 py-1.5">
          <input type="number" placeholder="Qty" value={form.quantity ?? ''}
            onChange={e => setForm(p => ({ ...p, quantity: e.target.value ? Number(e.target.value) : null }))}
            className="w-20 border rounded px-2 py-1 text-xs text-right focus:outline-none" />
        </td>
        <td className="px-2 py-1.5">
          <input placeholder="Unit" value={form.unit ?? ''}
            onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
            className="w-14 border rounded px-2 py-1 text-xs text-center focus:outline-none" />
        </td>
        <td className="px-2 py-1.5">
          <input type="number" placeholder="Rate / Lump" value={form.rate ?? ''}
            onChange={e => setForm(p => ({ ...p, rate: e.target.value ? Number(e.target.value) : null }))}
            className="w-28 border rounded px-2 py-1 text-xs text-right focus:outline-none" />
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-bold tabular-nums">{fmt(calcTotal(form))}</td>
        <td className="px-2 py-1.5">
          <input placeholder="Comment" value={form.comment ?? ''}
            onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
            className="w-36 border rounded px-2 py-1 text-xs focus:outline-none" />
        </td>
        <td className="px-2 py-1.5 flex gap-1">
          <button onClick={() => submitForm(parentId)}
            className="bg-primary text-white px-2 py-1 rounded text-xs hover:bg-primary-dim">
            {editingId ? 'Save' : 'Add'}
          </button>
          <button onClick={() => { setAddingTo(null); setEditingId(null); setForm({}) }}
            className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-300">
            Cancel
          </button>
        </td>
      </tr>
    )
  }

  function renderLine(l: FLine, isChild = false): React.ReactNode {
    const children = childMap[l.id] || []
    const hasChildren = children.length > 0
    const isOpen = expanded.has(l.id)
    const totalIncChildren = l.total + children.reduce((s, c) => s + c.total, 0)
    const isEditing = editingId === l.id

    return (
      <>
        {isEditing ? (
          <FormRow parentId={l.parent_id ?? undefined} />
        ) : (
          <tr key={l.id} className={clx(
            'border-b border-gray-100 hover:bg-gray-50 group transition-colors',
            isChild ? 'bg-[#F8FAF8]' : ''
          )}>
            <td className="px-2 py-1.5">
              <div className={clx('flex items-center gap-1', isChild ? 'pl-6' : '')}>
                {!isChild && (
                  <button onClick={() => toggle(l.id)}
                    className={clx('text-gray-400 hover:text-gray-700 transition-transform',
                      hasChildren ? 'visible' : 'invisible')}>
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                )}
                <span className={clx('font-mono font-bold text-xs',
                  isChild ? 'text-primary-dim' : 'text-primary')}>
                  {l.cc_code}
                </span>
              </div>
            </td>
            <td className="px-3 py-1.5 text-xs max-w-[200px]">
              <div className="truncate">{l.cc_desc}</div>
            </td>
            <td className="px-3 py-1.5 text-xs text-gray-500 max-w-[100px]">
              <div className="truncate">{l.trade}</div>
            </td>
            <td className="px-3 py-1.5 text-xs text-gray-600 max-w-[120px]">
              <div className="truncate">{l.supplier || '–'}</div>
            </td>
            <td className="px-2 py-1.5">
              <span className={clx('px-1.5 py-0.5 rounded text-xs font-medium', STATUS_COLOURS[l.status] || 'bg-gray-100 text-gray-600')}>
                {l.status}
              </span>
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-xs text-gray-500">{l.factor ?? '–'}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-xs text-gray-500">{l.quantity?.toLocaleString() ?? '–'}</td>
            <td className="px-3 py-1.5 text-center text-xs text-gray-500">{l.unit ?? '–'}</td>
            <td className="px-2 py-1">
              <BreakdownCell
                projectId={projectId} parentId={l.id}
                parentType="forecast" parentField="rate"
                parentLabel={`${l.cc_code} — ${l.cc_desc}`}
                value={l.rate || 0} onSave={v => {}} width="w-24" />
            </td>
            <td className="px-2 py-1">
              <BreakdownCell
                projectId={projectId} parentId={l.id}
                parentType="forecast" parentField="total"
                parentLabel={`${l.cc_code} — ${l.cc_desc}`}
                value={hasChildren ? totalIncChildren : l.total}
                onSave={v => {}} width="w-24" />
            </td>
            <td className="px-3 py-1.5 text-xs text-gray-400 max-w-[140px]">
              <div className="truncate">{l.comment || ''}</div>
            </td>
            <td className="px-2 py-1.5">
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isChild && (
                  <button title="Add sub-item"
                    onClick={() => { setAddingTo(l.id); setEditingId(null); setForm({}); setExpanded(p => { const n = new Set(Array.from(p)); n.add(l.id); return n }) }}
                    className="text-primary-dim hover:bg-[#E2EFDA] rounded p-0.5">
                    <Plus size={12} />
                  </button>
                )}
                <button onClick={() => startEdit(l)} className="text-blue-500 hover:bg-blue-50 rounded p-0.5">
                  <Edit3 size={12} />
                </button>
                <button onClick={() => deleteLine(l.id)} className="text-red-400 hover:bg-red-50 rounded p-0.5">
                  <Trash2 size={12} />
                </button>
              </div>
            </td>
          </tr>
        )}

        {/* Children */}
        {isOpen && !isEditing && children.map(child => renderLine(child, true))}
        {/* Add child form */}
        {addingTo === l.id && !editingId && <FormRow parentId={l.id} />}
      </>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Forecast / Projected Costs" subtitle="Nested line items · Cost code driven" />

      {/* EFC summary bar */}
      <div className="bg-primary px-6 py-3 flex items-center gap-6 flex-shrink-0">
        <div className="text-white">
          <span className="text-xs opacity-70 uppercase tracking-wide mr-2">Total EFC</span>
          <span className="text-xl font-bold tabular-nums">{fmt(totalEfc)}</span>
        </div>
        <div className="flex-1 flex items-center gap-3 overflow-x-auto">
          {Object.entries(efcByTrade).filter(([,v]) => v > 0).map(([trade, val]) => (
            <div key={trade} className="bg-white/10 rounded px-3 py-1 flex-shrink-0">
              <div className="text-[10px] text-white/60">{trade}</div>
              <div className="text-xs text-white font-bold tabular-nums">{fmt(val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        <input placeholder="Search code, description or supplier..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-1 focus:ring-[#565e74]" />
        <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#565e74]">
          {TRADES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#565e74]">
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowUpload(true)}
          className="border border-primary text-primary px-3 py-1.5 rounded text-sm flex items-center gap-1.5 hover:bg-[#E8EDF7]">
          <Upload size={14} /> Import Excel
        </button>
        <button onClick={() => { setAddingTo('root'); setEditingId(null); setForm({}) }}
          className="bg-primary text-white px-4 py-1.5 rounded text-sm flex items-center gap-1.5 hover:bg-primary-dim">
          <Plus size={14} /> Add Line
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-xs border-collapse" style={{ minWidth: '1100px' }}>
          <thead className="sticky top-0 z-10">
            <tr>
              {[
                ['Code',        'left'],
                ['Description', 'left'],
                ['Trade',       'left'],
                ['Supplier',    'left'],
                ['Status',      'left'],
                ['Factor',      'right'],
                ['Qty',         'right'],
                ['Unit',        'center'],
                ['Rate / Lump', 'right'],
                ['Total',       'right'],
                ['Comment',     'left'],
                ['',            'center'],
              ].map(([label, align], i) => (
                <th key={i} className={clx(
                  'px-3 py-2.5 text-xs font-bold text-white bg-primary whitespace-nowrap sticky top-0',
                  `text-${align}`
                )}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {addingTo === 'root' && !editingId && <FormRow />}
            {filtered.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-400">No forecast lines match the current filters.</td></tr>
            ) : (
              filtered.map(l => renderLine(l))
            )}
          </tbody>
        </table>
      </div>
      {showUpload && <UploadModal projectId={projectId} type="forecast" onClose={() => setShowUpload(false)} />}
    </div>
  )
}
