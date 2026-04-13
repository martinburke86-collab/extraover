'use client'
import { useState, useTransition, useMemo } from 'react'
import { fmt, clx, STATUS_COLOURS, CATEGORY_COLOURS } from '@/lib/utils'
import { PageHeader, Badge } from '@/components/ui'
import { useTableNav } from '@/lib/tableUtils'
import BreakdownCell from '@/components/BreakdownCell'
import { Plus, Trash2, Upload } from 'lucide-react'
import UploadModal from '@/components/UploadModal'
import { useRouter } from 'next/navigation'

type Line = {
  id: string; supplier: string | null; description: string | null; status: string
  quantity: number | null; unit: string | null; unit_rate: number | null; total: number
  notes: string | null; code: string; trade: string; category: string
}
type CC = { code: string; description: string; trade: string; category: string }
const STATUSES = ['Placed','Pending','Provisional','Forecast','On Hold','Cancelled']

export default function CommittedClient({ lines, costCodes, projectId }: { lines: Line[]; costCodes: CC[]; projectId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [statusFilter, setStatus] = useState('All')
  const [tradeFilter, setTrade]   = useState('All')
  const [search, setSearch]       = useState('')
  const [adding, setAdding]       = useState(false)
  const tableNav = useTableNav()
  const [showUpload, setShowUpload] = useState(false)
  const [newLine, setNewLine]     = useState<any>({})

  const trades  = useMemo(() => ['All', ...Array.from(new Set(lines.map(l => l.trade))).sort()], [lines])
  const filtered = lines.filter(l => {
    if (statusFilter !== 'All' && l.status !== statusFilter) return false
    if (tradeFilter  !== 'All' && l.trade  !== tradeFilter)  return false
    if (search) {
      const q = search.toLowerCase()
      return l.code.toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q) || (l.supplier || '').toLowerCase().includes(q)
    }
    return true
  })

  const grandTotal = lines.reduce((s, l) => s + l.total, 0)
  const placedTotal = lines.filter(l => l.status === 'Placed').reduce((s, l) => s + l.total, 0)

  async function addLine() {
    if (!newLine.code) return
    const qty  = newLine.quantity ? Number(newLine.quantity) : null
    const rate = newLine.unitRate ? Number(newLine.unitRate) : null
    const total = qty && rate ? qty * rate : (newLine.total ? Number(newLine.total) : 0)
    await fetch(`/api/projects/${projectId}/committed`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLine, quantity: qty, unitRate: rate, total }),
    })
    setAdding(false); setNewLine({})
    startTransition(() => router.refresh())
  }

  async function del(id: string) {
    if (!confirm('Delete this committed line?')) return
    await fetch(`/api/projects/${projectId}/committed`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineId: id }),
    })
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Committed Costs Register"
        subtitle="Orders, subcontracts & commitments"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(true)}
              className="border border-[#565e74] text-[#565e74] px-3 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#E8EDF7]">
              <Upload size={14} /> Import Excel
            </button>
            <button onClick={() => setAdding(true)}
              className="bg-primary text-white px-4 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#1A3A7A]">
              <Plus size={14} /> Add Commitment
            </button>
          </div>
        }
      />

      {/* Summary bar */}
      <div className="bg-primary px-6 py-2.5 flex items-center gap-8 flex-shrink-0">
        <div className="text-white">
          <div className="text-xs opacity-70">Total Committed</div>
          <div className="text-xl font-bold tabular-nums">{fmt(grandTotal)}</div>
        </div>
        <div className="text-white">
          <div className="text-xs opacity-70">Placed Orders</div>
          <div className="text-lg font-bold tabular-nums text-[#E2EFDA]">{fmt(placedTotal)}</div>
        </div>
        {(['Pending','Provisional'] as string[]).map(s => {
          const v = lines.filter(l => l.status === s).reduce((sum, l) => sum + l.total, 0)
          return v > 0 ? (
            <div key={s} className="text-white">
              <div className="text-xs opacity-70">{s}</div>
              <div className="text-base font-bold tabular-nums text-[#FFC000]">{fmt(v)}</div>
            </div>
          ) : null
        })}
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-[#565e74]" />
        <select value={tradeFilter} onChange={e => setTrade(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#565e74]">
          {trades.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#565e74]">
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-on-surface-variant ml-auto">{filtered.length} of {lines.length}</span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {['Code','Trade','Supplier','Description','Status','Qty','Unit','Unit Rate','Total',''].map((h,i) => (
                <th key={i} className={clx('px-4 py-2.5 text-xs font-bold text-white bg-primary whitespace-nowrap',
                  i >= 5 && i <= 8 ? 'text-right' : 'text-left')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="bg-[#FFFFC7] border-b border-amber-200">
                <td className="px-3 py-2">
                  <input value={newLine.code ?? ''} list="cc-list2" placeholder="Code"
                    onChange={e => setNewLine((p: any) => ({ ...p, code: e.target.value }))}
                    className="w-24 border rounded px-2 py-1 text-xs focus:outline-none" />
                  <datalist id="cc-list2">{costCodes.map(c => <option key={c.code} value={c.code}>{c.description}</option>)}</datalist>
                </td>
                <td className="px-3 py-2 text-xs text-on-surface-variant">{costCodes.find(c => c.code === newLine.code)?.trade}</td>
                <td className="px-3 py-2"><input value={newLine.supplier ?? ''} onChange={e => setNewLine((p: any) => ({ ...p, supplier: e.target.value }))} placeholder="Supplier" className="w-32 border rounded px-2 py-1 text-xs focus:outline-none" /></td>
                <td className="px-3 py-2"><input value={newLine.description ?? ''} onChange={e => setNewLine((p: any) => ({ ...p, description: e.target.value }))} placeholder="Description" className="w-40 border rounded px-2 py-1 text-xs focus:outline-none" /></td>
                <td className="px-3 py-2">
                  <select value={newLine.status ?? 'Placed'} onChange={e => setNewLine((p: any) => ({ ...p, status: e.target.value }))} className="border rounded px-2 py-1 text-xs focus:outline-none">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input type="number" value={newLine.quantity ?? ''} onChange={e => setNewLine((p: any) => ({ ...p, quantity: e.target.value }))} className="w-20 border rounded px-2 py-1 text-xs text-right focus:outline-none" /></td>
                <td className="px-3 py-2"><input value={newLine.unit ?? ''} onChange={e => setNewLine((p: any) => ({ ...p, unit: e.target.value }))} className="w-14 border rounded px-2 py-1 text-xs text-center focus:outline-none" /></td>
                <td className="px-3 py-2"><input type="number" value={newLine.unitRate ?? ''} onChange={e => setNewLine((p: any) => ({ ...p, unitRate: e.target.value }))} className="w-28 border rounded px-2 py-1 text-xs text-right focus:outline-none" /></td>
                <td className="px-3 py-2 text-right text-xs font-bold">
                  {fmt((newLine.quantity && newLine.unitRate) ? newLine.quantity * newLine.unitRate : (newLine.total || 0))}
                </td>
                <td className="px-3 py-2 flex gap-1">
                  <button onClick={addLine} className="bg-primary text-white px-2 py-1 rounded text-xs">Add</button>
                  <button onClick={() => setAdding(false)} className="bg-gray-200 px-2 py-1 rounded text-xs">✕</button>
                </td>
              </tr>
            )}

            {filtered.map((l, idx) => (
              <tr key={l.id} className={clx('border-b border-outline-variant/10 group hover:bg-surface-container-low transition-colors', idx % 2 === 0 ? 'bg-white' : 'bg-surface-container-low/30')}>
                <td className="px-4 py-2"><span className="font-mono font-bold text-[#565e74] text-xs">{l.code}</span></td>
                <td className="px-4 py-2 text-xs text-on-surface-variant max-w-[100px]"><span className="truncate block">{l.trade}</span></td>
                <td className="px-4 py-2 text-sm max-w-[140px]"><span className="truncate block">{l.supplier || '–'}</span></td>
                <td className="px-4 py-2 text-sm max-w-[180px]"><span className="truncate block">{l.description || '–'}</span></td>
                <td className="px-4 py-2">
                  <span className={clx('px-1.5 py-0.5 rounded text-xs font-medium', STATUS_COLOURS[l.status] || 'bg-gray-100 text-on-surface-variant')}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-sm text-on-surface-variant">{l.quantity?.toLocaleString() ?? '–'}</td>
                <td className="px-4 py-2 text-center text-sm text-on-surface-variant">{l.unit || '–'}</td>
                <td className="px-4 py-2 text-right tabular-nums text-sm text-on-surface-variant">
                    <BreakdownCell projectId={projectId} parentId={l.id}
                      parentType="committed" parentField="rate"
                      parentLabel={`${l.code}`}
                      value={Number(l.unit_rate) || 0} onSave={v => {}} width="w-24" />
                  </td>
                  <td className="px-2 py-1">
                    <BreakdownCell projectId={projectId} parentId={l.id}
                      parentType="committed" parentField="total"
                      parentLabel={`${l.code}`}
                      value={Number(l.total) || 0} onSave={v => {}} width="w-24" />
                  </td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => del(l.id)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && !adding && (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-on-surface-variant">No commitments match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showUpload && <UploadModal projectId={projectId} type="committed" onClose={() => setShowUpload(false)} />}
    </div>
  )
}
