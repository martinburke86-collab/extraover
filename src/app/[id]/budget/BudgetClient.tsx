'use client'
import { useRef, useState, useTransition } from 'react'
import { fmt, pct } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { useGridNav } from '@/lib/tableUtils'
import GridInput from '@/components/GridInput'
import ViewerBanner from '@/components/ViewerBanner'
import { Plus, Trash2, Upload } from 'lucide-react'
import type { Role } from '@/lib/roleUtils'
import { useRouter } from 'next/navigation'

type Row = {
  id: string; name: string; budget: number; sortOrder: number; codePrefix: string
  efc: number; totalCTD: number; committed: number; uncommitted: number
}

interface Props {
  rows: Row[]; projectId: string; role: Role
  contractSum: number; approvedVars: number; originalBudget: number
}

type RagStatus = 'ok' | 'warn' | 'over'
function rag(budget: number, efc: number): RagStatus {
  if (budget <= 0) return 'ok'
  const ratio = efc / budget
  if (ratio <= 1.0) return 'ok'
  if (ratio <= 1.05) return 'warn'
  return 'over'
}

const RAG_CFG = {
  ok:   { bg: '#F0FCE0', text: '#27500A', label: 'On budget' },
  warn: { bg: '#FEF9C3', text: '#854F0B', label: 'Near limit' },
  over: { bg: '#FEE2E2', text: '#991B1B', label: 'Over budget' },
}

export default function BudgetClient({
  rows: initial, projectId, role,
  contractSum, approvedVars, originalBudget,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const gridNav = useGridNav()

  const localVals = useRef<Record<string, number>>({})
  const [rows, setRows]       = useState<Row[]>(initial)
  const [tick, setTick]       = useState(0)
  const [adding, setAdding]   = useState(false)
  const [newName, setNewName] = useState('')
  const [newBudget, setNewBudget] = useState(0)
  const [saving, setSaving]   = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadMode, setUploadMode] = useState<'add' | 'replace'>('add')
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Adjustment state
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjFrom,   setAdjFrom]     = useState('')
  const [adjTo,     setAdjTo]       = useState('')
  const [adjAmount, setAdjAmount]   = useState(0)
  const [adjMsg,    setAdjMsg]      = useState('')

  function applyAdjustment() {
    if (!adjFrom || !adjTo || adjAmount <= 0) return
    const fromBudget = getBudget(adjFrom)
    if (adjAmount > fromBudget) {
      setAdjMsg(`Cannot move more than the available budget (${fmt(fromBudget)})`)
      return
    }
    const newFrom = fromBudget - adjAmount
    const newTo   = getBudget(adjTo) + adjAmount
    saveBudget(adjFrom, newFrom)
    saveBudget(adjTo,   newTo)
    setAdjMsg(`Moved ${fmt(adjAmount)} from ${rows.find(r => r.id === adjFrom)?.name} to ${rows.find(r => r.id === adjTo)?.name}`)
    setAdjAmount(0)
    setTimeout(() => setAdjMsg(''), 4000)
  }

  function getBudget(id: string): number {
    return id in localVals.current ? localVals.current[id] : (rows.find(r => r.id === id)?.budget ?? 0)
  }

  function saveBudget(id: string, value: number) {
    localVals.current[id] = value
    setTick(t => t + 1)
    fetch(`/api/projects/${projectId}/elements`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeId: id, budget: value }),
    })
  }

  async function addRow() {
    if (!newName.trim()) return
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/elements`, {
      method: 'POST',
      body: (() => {
        const fd = new FormData()
        // Create a tiny CSV in memory for single-row add
        const csvContent = `Name,Budget\n${newName.trim()},${newBudget}`
        fd.append('file', new Blob([csvContent], { type: 'text/csv' }), 'add.csv')
        fd.append('mode', 'add')
        return fd
      })(),
    })
    setSaving(false)
    setAdding(false); setNewName(''); setNewBudget(0)
    startTransition(() => router.refresh())
  }

  async function deleteRow(id: string, name: string) {
    if (!confirm(`Remove "${name}" from this project? This will also remove all cost codes and data linked to this element.`)) return
    await fetch(`/api/projects/${projectId}/elements`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeId: id }),
    })
    setRows(p => p.filter(r => r.id !== id))
  }

  async function handleUpload(file: File) {
    setSaving(true); setUploadStatus(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', uploadMode)
    const res = await fetch(`/api/projects/${projectId}/elements`, { method: 'POST', body: fd })
    const data = await res.json()
    setSaving(false)
    setUploadStatus({
      ok: data.ok,
      message: data.ok
        ? `${data.inserted} added, ${data.updated} updated${data.errors.length ? `, ${data.errors.length} errors` : ''}`
        : data.error,
    })
    if (data.ok) startTransition(() => router.refresh())
  }

  // Totals
  const totalBudget = rows.reduce((s, r) => s + getBudget(r.id), 0)
  const totalEFC    = rows.reduce((s, r) => s + r.efc, 0)
  const totalCTD    = rows.reduce((s, r) => s + r.totalCTD, 0)
  const variance    = totalBudget - totalEFC
  const adjustedSum = contractSum + approvedVars

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Budget Formation"
        subtitle="Set element budgets · Compare against EFC"
        actions={
          role !== 'viewer' ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowUpload(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <Upload size={13} /> Import CSV / XLSX
              </button>
              <button onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white bg-[#1e3a5f] hover:bg-[#253f6a]">
                <Plus size={13} /> Add Element
              </button>
            </div>
          ) : null
        }
      />
      <ViewerBanner role={role} />

      {/* Summary strip */}
      <div className="bg-[#1e3a5f] px-6 py-2.5 flex items-center gap-6 flex-shrink-0 flex-wrap">
        {[
          { label: 'Contract Sum',      val: fmt(adjustedSum),    col: '#ccd4ee' },
          { label: 'Original Budget',   val: fmt(originalBudget), col: '#ccd4ee' },
          { label: 'Total Element Budget', val: fmt(totalBudget), col: '#DEE5B5' },
          { label: 'Total EFC',         val: fmt(totalEFC),       col: '#FAEEDA' },
          { label: 'Budget Variance',   val: fmt(variance),       col: variance >= 0 ? '#DEE5B5' : '#FECACA' },
          { label: 'Cost to Date',      val: fmt(totalCTD),       col: '#ccd4ee' },
        ].map(k => (
          <div key={k.label} className="flex-shrink-0">
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'rgba(168,196,224,0.55)' }}>{k.label}</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: k.col }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-start gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-amber-900 mb-1">Import elements from CSV or XLSX</div>
              <div className="text-[11px] text-amber-700 mb-3">
                Required column: <strong>Name</strong> (or Element, Trade, Section) · Optional: <strong>Budget</strong>, Sort_Order, Code_Prefix
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-amber-800 font-medium">
                  <input type="radio" checked={uploadMode === 'add'} onChange={() => setUploadMode('add')} />
                  Add / update (keep existing)
                </label>
                <label className="flex items-center gap-2 text-xs text-red-700 font-medium">
                  <input type="radio" checked={uploadMode === 'replace'} onChange={() => setUploadMode('replace')} />
                  Replace all elements
                </label>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={saving}
                  className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-[#1e3a5f] hover:bg-[#253f6a] disabled:opacity-50">
                  {saving ? 'Uploading…' : 'Choose file'}
                </button>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
              </div>
              {uploadStatus && (
                <div className={`mt-2 text-xs font-medium px-3 py-1.5 rounded ${uploadStatus.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {uploadStatus.ok ? '✓' : '✗'} {uploadStatus.message}
                </div>
              )}
            </div>
            <button onClick={() => setShowUpload(false)} className="ml-auto text-amber-600 hover:text-amber-900 text-lg font-bold">✕</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="ss-table" onKeyDown={gridNav}>
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: 'center' }}>#</th>
              <th style={{ minWidth: 200, textAlign: 'left' }}>Element / Trade</th>
              <th style={{ width: 130, textAlign: 'right' }}>Budget (€)</th>
              <th style={{ width: 130, textAlign: 'right' }}>EFC</th>
              <th style={{ width: 130, textAlign: 'right' }}>Cost to Date</th>
              <th style={{ width: 130, textAlign: 'right' }}>Committed</th>
              <th style={{ width: 130, textAlign: 'right' }}>Remaining</th>
              <th style={{ width: 120, textAlign: 'right' }}>Variance (B-EFC)</th>
              <th style={{ width: 80,  textAlign: 'right' }}>Var %</th>
              <th style={{ width: 100, textAlign: 'center' }}>Status</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {adding && (
              <tr data-row={-1} style={{ background: '#FFFDE8' }}>
                <td className="row-num">+</td>
                <td data-col={0} style={{ padding: '3px 4px' }}>
                  <input className="grid-input" style={{ textAlign: 'left' }} placeholder="Element name…" autoFocus
                    value={newName} onChange={e => setNewName(e.target.value)} />
                </td>
                <td data-col={1}>
                  <GridInput value={newBudget} onSave={v => setNewBudget(v)} />
                </td>
                <td colSpan={7} />
                <td style={{ padding: '3px 6px' }}>
                  <div className="flex gap-1">
                    <button onClick={addRow} disabled={saving || !newName.trim()}
                      style={{ background: '#456919', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', opacity: !newName.trim() ? 0.5 : 1 }}>
                      Add
                    </button>
                    <button onClick={() => setAdding(false)}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {rows.map((r, idx) => {
              const budget   = getBudget(r.id)
              const varAmt   = budget - r.efc
              const varPct   = budget > 0 ? varAmt / budget : null
              const status   = rag(budget, r.efc)
              const cfg      = RAG_CFG[status]
              const isOver   = status === 'over'

              return (
                <tr key={r.id} data-row={idx} className="group"
                  style={isOver ? { background: '#fff8f8' } : idx % 2 === 1 ? { background: '#fafcff' } : {}}>
                  <td className="row-num">{idx + 1}</td>
                  <td>
                    <div className="ss-cell-ro font-semibold" style={{ color: '#111' }}>{r.name}</div>
                  </td>
                  <td data-col={0}>
                    <GridInput
                      value={budget}
                      onSave={v => saveBudget(r.id, v)}
                      className={role === 'viewer' ? 'grid-input-sm' : 'grid-input'}
                    />
                  </td>
                  <td>
                    <div className="ss-cell-ro ss-cell-ro-r" style={{ color: isOver ? '#991B1B' : '#1e3a5f', fontWeight: 700 }}>
                      {r.efc ? fmt(r.efc) : '—'}
                    </div>
                  </td>
                  <td>
                    <div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#565e74' }}>
                      {r.totalCTD ? fmt(r.totalCTD) : '—'}
                    </div>
                  </td>
                  <td>
                    <div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#856c0b' }}>
                      {r.committed ? fmt(r.committed) : '—'}
                    </div>
                  </td>
                  <td>
                    <div className="ss-cell-ro ss-cell-ro-r" style={{ color: '#565e74' }}>
                      {r.uncommitted ? fmt(r.uncommitted) : '—'}
                    </div>
                  </td>
                  <td>
                    <div className="ss-cell-ro ss-cell-ro-r font-bold"
                      style={{ color: varAmt >= 0 ? '#27500A' : '#991B1B' }}>
                      {budget > 0 ? fmt(varAmt) : '—'}
                    </div>
                  </td>
                  <td>
                    <div className="ss-cell-ro ss-cell-ro-r text-[11px]"
                      style={{ color: varPct !== null && varPct >= 0 ? '#27500A' : '#991B1B' }}>
                      {varPct !== null ? pct(varPct) : '—'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '3px 6px' }}>
                    {budget > 0 && r.efc > 0 && (
                      <span style={{ background: cfg.bg, color: cfg.text, fontSize: 10, fontWeight: 600,
                        padding: '2px 8px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                        {cfg.label}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', padding: '0 4px' }}>
                    {role !== 'viewer' && (
                      <button onClick={() => deleteRow(r.id, r.name)}
                        className="p-1 rounded text-red-200 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Totals footer */}
          <tfoot>
            <tr style={{ background: '#f0f4fa', borderTop: '2px solid #1e3a5f' }}>
              <td colSpan={2} style={{ padding: '7px 12px', fontWeight: 700, fontSize: 11, color: '#1e3a5f', textTransform: 'uppercase' }}>
                Total ({rows.length} elements)
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1e3a5f' }}>
                {fmt(totalBudget)}
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1e3a5f' }}>
                {fmt(totalEFC)}
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#565e74' }}>
                {fmt(totalCTD)}
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#856c0b' }}>
                {fmt(rows.reduce((s, r) => s + r.committed, 0))}
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#565e74' }}>
                {fmt(rows.reduce((s, r) => s + r.uncommitted, 0))}
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: variance >= 0 ? '#27500A' : '#991B1B' }}>{fmt(variance)}</span>
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontSize: 11 }}>
                <span style={{ color: variance >= 0 ? '#27500A' : '#991B1B' }}>
                  {totalBudget > 0 ? pct(variance / totalBudget) : '—'}
                </span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Budget adjustment panel */}
      <div className="border-t border-slate-200 bg-slate-50 flex-shrink-0">
        <div
          className="px-6 py-2 flex items-center gap-2 cursor-pointer select-none"
          onClick={() => setShowAdjust(p => !p)}>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Budget Adjustments</span>
          <span className="text-[10px] text-slate-400 ml-1">— reallocate between elements, total stays the same</span>
          <span className="ml-auto text-slate-400 text-[11px]">{showAdjust ? '▲' : '▼'}</span>
        </div>
        {showAdjust && (
          <div className="px-6 pb-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">From element</label>
                <select value={adjFrom} onChange={e => setAdjFrom(e.target.value)}
                  style={{ border: '0.5px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 12, background: '#FEF2F2', color: '#991B1B', cursor: 'pointer', minWidth: 200 }}>
                  <option value="">Select…</option>
                  {rows.map(r => <option key={r.id} value={r.id}>{r.name} ({fmt(getBudget(r.id))})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">To element</label>
                <select value={adjTo} onChange={e => setAdjTo(e.target.value)}
                  style={{ border: '0.5px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 12, background: '#F0FCE0', color: '#27500A', cursor: 'pointer', minWidth: 200 }}>
                  <option value="">Select…</option>
                  {rows.filter(r => r.id !== adjFrom).map(r => <option key={r.id} value={r.id}>{r.name} ({fmt(getBudget(r.id))})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Amount (€)</label>
                <input type="number" value={adjAmount} onChange={e => setAdjAmount(Number(e.target.value))}
                  placeholder="0"
                  style={{ border: '0.5px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 12, width: 130, textAlign: 'right', background: '#FFFFC7' }} />
              </div>
              <button
                onClick={applyAdjustment}
                disabled={!adjFrom || !adjTo || !adjAmount || adjAmount <= 0}
                style={{
                  background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  opacity: (!adjFrom || !adjTo || !adjAmount) ? 0.5 : 1,
                }}>
                Apply
              </button>
              {adjMsg && (
                <span className="text-xs text-slate-500 italic">{adjMsg}</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Moves budget from one element to another. Total budget stays the same. Changes save immediately.
            </p>
          </div>
        )}
      </div>

      <div className="px-6 py-2 bg-white border-t text-[10px] text-on-surface-variant flex-shrink-0">
        Budget cells are yellow and editable · Saves automatically · Variance = Budget − EFC · Green = on budget, Amber = within 5%, Red = over
      </div>
    </div>
  )
}
