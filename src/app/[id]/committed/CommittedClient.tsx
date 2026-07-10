'use client'
import { useRef, useState, useTransition, useMemo } from 'react'
import { fmt, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { useGridNav } from '@/lib/tableUtils'
import GridInput from '@/components/GridInput'
import { Plus, Trash2, Upload } from 'lucide-react'
import UploadModal from '@/components/UploadModal'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'

type Line = {
  id: string; supplier: string | null; description: string | null; status: string
  quantity: number | null; unit: string | null; unit_rate: number | null; total: number
  notes: string | null; code: string; trade: string; category: string
  variation_id: string | null
}
type CC = { code: string; description: string; trade: string; category: string }
type VO = { id: string; ref: string; description: string }
const STATUSES = ['Placed','Pending','Provisional','Forecast','On Hold','Cancelled']

const STATUS_CFG: Record<string, { bg: string; text: string }> = {
  Placed:       { bg: '#e7f6ee', text: '#0a6e44' },
  Pending:      { bg: '#fcf2e2', text: '#b6740a' },
  Provisional:  { bg: '#eef2ff', text: '#1a45c0' },
  Forecast:     { bg: '#eef2ff', text: '#1a45c0' },
  'On Hold':    { bg: '#f1f2f5', text: '#5b626e' },
  Cancelled:    { bg: '#fbeae6', text: '#a23015' },
}

export default function CommittedClient({ lines, costCodes, variations, projectId }: { lines: Line[]; costCodes: CC[]; variations: VO[]; projectId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const { toast } = useToast()
  const gridNav = useGridNav()

  // ── Local value store ──────────────────────────────────────────────────────
  const localVals = useRef<Record<string, any>>({})
  const [tick, setTick] = useState(0)

  function getVal(id: string, field: string): any {
    const key = `${id}:${field}`
    if (key in localVals.current) return localVals.current[key]
    const l = lines.find(l => l.id === id)
    return (l as any)?.[field]
  }

  function saveCell(lineId: string, field: string, value: any) {
    localVals.current[`${lineId}:${field}`] = value
    setTick(t => t + 1)
    const l = lines.find(l => l.id === lineId)!
    const qty   = field === 'quantity'  ? value : (getVal(lineId, 'quantity')  ?? l.quantity)
    const rate  = field === 'unit_rate' ? value : (getVal(lineId, 'unit_rate') ?? l.unit_rate)
    const total = qty && rate ? qty * rate : (field === 'total' ? value : (getVal(lineId, 'total') ?? l.total))
    fetch(`/api/projects/${projectId}/committed`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineId,
        supplier:    getVal(lineId, 'supplier')    ?? l.supplier,
        description: getVal(lineId, 'description') ?? l.description,
        status:      getVal(lineId, 'status')      ?? l.status,
        quantity: qty, unit: getVal(lineId, 'unit') ?? l.unit,
        unitRate: rate, total,
        notes: getVal(lineId, 'notes') ?? l.notes,
        variationId: (field === 'variation_id' ? value : (getVal(lineId, 'variation_id') ?? l.variation_id)) || null,
      }),
    }).catch(() => toast('Save failed', 'error'))
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  const [statusFilter, setStatus] = useState('All')
  const [tradeFilter, setTrade]   = useState('All')
  const [search, setSearch]       = useState('')
  const [adding, setAdding]       = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [newLine, setNewLine]     = useState<any>({})

  const trades = useMemo(() => ['All', ...Array.from(new Set(lines.map(l => l.trade))).sort()], [lines])
  const filtered = useMemo(() => lines.filter(l => {
    if (statusFilter !== 'All' && l.status !== statusFilter) return false
    if (tradeFilter  !== 'All' && l.trade  !== tradeFilter)  return false
    if (search) {
      const q = search.toLowerCase()
      return l.code.toLowerCase().includes(q) || (l.description||'').toLowerCase().includes(q) || (l.supplier||'').toLowerCase().includes(q)
    }
    return true
  }), [lines, search, tradeFilter, statusFilter])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { grandTotal, placedTotal } = useMemo(() => ({
    grandTotal:  lines.reduce((s, l) => s + (getVal(l.id, 'total') ?? l.total), 0),
    placedTotal: lines.filter(l => (getVal(l.id, 'status') ?? l.status) === 'Placed').reduce((s, l) => s + (getVal(l.id, 'total') ?? l.total), 0),
  }), [tick, lines]) // eslint-disable-line

  async function addLine() {
    if (!newLine.code) { toast('Select a cost code first', 'error'); return }
    const qty   = newLine.quantity ? Number(newLine.quantity) : null
    const rate  = newLine.unitRate ? Number(newLine.unitRate) : null
    const total = qty && rate ? qty * rate : (newLine.total ? Number(newLine.total) : 0)
    const res = await fetch(`/api/projects/${projectId}/committed`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLine, quantity: qty, unitRate: rate, total }),
    })
    if (!res.ok) { toast('Add failed', 'error'); return }
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
      <PageHeader title="Committed Costs Register" subtitle="Remaining commitment \u2014 reduce each line as costs are invoiced. EFC = Cost to Date + Committed + Uncommitted"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(true)}
              className="border border-[#5b626e] text-[#5b626e] px-3 py-1.5 rounded text-xs flex items-center gap-1.5 hover:bg-[#E8EDF7]">
              <Upload size={13} /> Import Excel
            </button>
            <button onClick={() => setAdding(true)}
              className="bg-primary text-white px-3 py-1.5 rounded text-xs flex items-center gap-1.5 hover:bg-[#1A3A7A] font-semibold">
              <Plus size={13} /> Add Commitment
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="bg-[#1a1d23] px-6 py-2.5 flex items-center gap-8 flex-shrink-0">
        {[
          { label: 'Total committed', val: fmt(grandTotal), col: '#9aa3b2' },
          { label: 'Placed orders',   val: fmt(placedTotal), col: '#DEE5B5' },
          ...(['Pending','Provisional'] as string[]).map(s => ({
            label: s,
            val: fmt(lines.filter(l => l.status === s).reduce((sum, l) => sum + l.total, 0)),
            col: '#FDE68A',
          })).filter(k => lines.some(l => l.status === k.label)),
        ].map(k => (
          <div key={k.label} className="flex-shrink-0">
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#6f7787' }}>{k.label}</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: k.col }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <input placeholder="Search supplier, description, code…" value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded px-2.5 py-1 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-primary" />
        <select value={tradeFilter} onChange={e => setTrade(e.target.value)}
          className="border rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          {trades.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-on-surface-variant">{filtered.length} of {lines.length}</span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="ss-table" onKeyDown={gridNav}>
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: 'center' }}>#</th>
              <th style={{ width: 80,  textAlign: 'left' }}>Code</th>
              <th style={{ width: 130, textAlign: 'left' }}>Trade</th>
              <th style={{ width: 160, textAlign: 'left' }}>Supplier</th>
              <th style={{ minWidth: 180, textAlign: 'left' }}>Description</th>
              <th style={{ width: 110, textAlign: 'center' }}>Status</th>
              <th style={{ width: 80,  textAlign: 'right' }}>Qty</th>
              <th style={{ width: 60,  textAlign: 'center' }}>Unit</th>
              <th style={{ width: 120, textAlign: 'right' }}>Unit rate</th>
              <th style={{ width: 130, textAlign: 'right' }}>Total</th>
              <th style={{ width: 90, textAlign: 'center' }} title="Tag this order to a variation. Tagged lines drive the Coded cost column on the Variations register.">VO</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {adding && (
              <tr data-row={-1} style={{ background: '#FFFDE8' }}>
                <td className="row-num">+</td>
                <td style={{ padding: '4px 6px' }}>
                  <input value={newLine.code ?? ''} list="cc-committed" placeholder="Code" autoFocus
                    onChange={e => setNewLine((p: any) => ({ ...p, code: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{ background: '#eef2ff' }} />
                  <datalist id="cc-committed">{costCodes.map(c => <option key={c.code} value={c.code}>{c.description}</option>)}</datalist>
                </td>
                <td style={{ padding: '4px 6px', fontSize: 11, color: '#5b626e' }}>
                  {costCodes.find(c => c.code === newLine.code)?.trade || '—'}
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input value={newLine.supplier ?? ''} onChange={e => setNewLine((p: any) => ({ ...p, supplier: e.target.value }))}
                    placeholder="Supplier" className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{ background: '#eef2ff' }} />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input value={newLine.description ?? ''} onChange={e => setNewLine((p: any) => ({ ...p, description: e.target.value }))}
                    placeholder="Description" className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{ background: '#eef2ff' }} />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <select value={newLine.status ?? 'Placed'} onChange={e => setNewLine((p: any) => ({ ...p, status: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-xs focus:outline-none" style={{ background: '#eef2ff' }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td data-col={0}><GridInput value={newLine.quantity ?? 0} onSave={v => setNewLine((p: any) => ({ ...p, quantity: v }))} /></td>
                <td style={{ padding: '4px 4px' }}>
                  <input value={newLine.unit ?? ''} onChange={e => setNewLine((p: any) => ({ ...p, unit: e.target.value }))}
                    placeholder="nr" className="w-full border rounded px-1 py-1 text-xs text-center focus:outline-none"
                    style={{ background: '#eef2ff' }} />
                </td>
                <td data-col={1}><GridInput value={newLine.unitRate ?? 0} onSave={v => setNewLine((p: any) => ({ ...p, unitRate: v }))} /></td>
                <td style={{ textAlign: 'right', padding: '0 10px', fontWeight: 700, fontSize: 12, color: '#1a1d23' }}>
                  {fmt((newLine.quantity && newLine.unitRate) ? newLine.quantity * newLine.unitRate : 0)}
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <div className="flex gap-1">
                    <button onClick={addLine} className="px-2 py-1 rounded text-white text-[11px] font-bold" style={{ background: '#0a8a54' }}>Add</button>
                    <button onClick={() => setAdding(false)} className="px-2 py-1 rounded text-[11px] bg-gray-200">✕</button>
                  </div>
                </td>
              </tr>
            )}

            {filtered.length === 0 && !adding && (
              <tr><td colSpan={12} style={{ padding: '48px', textAlign: 'center', color: '#8b93a1', fontSize: 13 }}>
                No commitments match current filters.
              </td></tr>
            )}

            {filtered.map((l, idx) => {
              const status = getVal(l.id, 'status') ?? l.status
              const qty    = getVal(l.id, 'quantity')  ?? l.quantity
              const rate   = getVal(l.id, 'unit_rate') ?? l.unit_rate
              const total  = qty && rate ? qty * rate : (getVal(l.id, 'total') ?? l.total)
              const cfg    = STATUS_CFG[status] || { bg: '#f1f2f5', text: '#5b626e' }

              return (
                <tr key={l.id} data-row={idx} className="group">
                  <td className="row-num">{idx + 1}</td>
                  <td>
                    <div className="ss-cell-ro" style={{ fontFamily: 'monospace', fontSize: 11, color: '#5b626e', fontWeight: 600 }}>
                      {l.code}
                    </div>
                  </td>
                  <td>
                    <div className="ss-cell-ro" style={{ fontSize: 11, color: '#5b626e' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 125 }}>{l.trade}</span>
                    </div>
                  </td>
                  <td data-col={0}>
                    <input
                      defaultValue={l.supplier ?? ''}
                      onBlur={e => saveCell(l.id, 'supplier', e.target.value)}
                      className="grid-input"
                      style={{ textAlign: 'left' }}
                      placeholder="—"
                    />
                  </td>
                  <td data-col={1}>
                    <input
                      defaultValue={l.description ?? ''}
                      onBlur={e => saveCell(l.id, 'description', e.target.value)}
                      className="grid-input"
                      style={{ textAlign: 'left' }}
                      placeholder="—"
                    />
                  </td>
                  <td data-col={2} style={{ padding: '3px 6px' }}>
                    <select
                      defaultValue={status}
                      onChange={e => saveCell(l.id, 'status', e.target.value)}
                      className="w-full border rounded px-1.5 py-0.5 text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                      style={{ background: cfg.bg, color: cfg.text }}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td data-col={3}><GridInput value={Number(qty) || 0} onSave={v => saveCell(l.id, 'quantity', v)} /></td>
                  <td style={{ padding: '3px 4px' }}>
                    <input
                      defaultValue={l.unit ?? ''}
                      onBlur={e => saveCell(l.id, 'unit', e.target.value)}
                      className="grid-input"
                      style={{ textAlign: 'center' }}
                      placeholder="nr"
                    />
                  </td>
                  <td data-col={4}><GridInput value={Number(rate) || 0} onSave={v => saveCell(l.id, 'unit_rate', v)} /></td>
                  <td><div className="ss-cell-total">{total ? fmt(total) : '—'}</div></td>
                  <td style={{ padding: '2px 4px' }}>
                    {(() => { const vo = String(getVal(l.id, 'variation_id') ?? l.variation_id ?? ''); return (
                      <select value={vo} onChange={e => saveCell(l.id, 'variation_id', e.target.value)}
                        className="w-full text-[10px] focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-1"
                        style={{ background: vo ? '#e7f6ee' : '#fff', border: '0.5px solid #e7e9ee', color: vo ? '#0a6e44' : '#8b93a1', fontWeight: 600 }}>
                        <option value="">{'\u2013'}</option>
                        {variations.map(v => <option key={v.id} value={v.id}>{v.ref}</option>)}
                      </select>
                    )})()}
                  </td>
                  <td style={{ textAlign: 'center', padding: '0 4px' }}>
                    <button onClick={() => del(l.id)}
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
                <td colSpan={9} style={{ textAlign: 'left' }}>TOTAL ({filtered.length} lines)</td>
                <td style={{ textAlign: 'right' }}>
                  {fmt(filtered.reduce((s, l) => {
                    const qty  = getVal(l.id, 'quantity')  ?? l.quantity
                    const rate = getVal(l.id, 'unit_rate') ?? l.unit_rate
                    return s + (qty && rate ? qty * rate : (getVal(l.id, 'total') ?? l.total))
                  }, 0))}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showUpload && <UploadModal projectId={projectId} type="committed" onClose={() => setShowUpload(false)} />}
    </div>
  )
}
