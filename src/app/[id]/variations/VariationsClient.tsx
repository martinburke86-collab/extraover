'use client'
import { useState, useTransition, useMemo } from 'react'
import { fmt, pct, clx, STATUS_COLOURS } from '@/lib/utils'
import { PageHeader, Badge } from '@/components/ui'
import { useTableNav } from '@/lib/tableUtils'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Variation = {
  id: string; ref: string; description: string; status: string
  date_submitted: string | null; date_approved: string | null
  income_value: number; cost_estimate: number; cost_actual: number; notes: string | null
}

const STATUSES = ['Submitted','Pending','Approved','Rejected','On Hold','Instructed - Not Submitted']

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  'Approved':                    { bg: '#F1F4E0', text: '#456919', border: '#DEE5B5' },
  'Submitted':                   { bg: '#E8EDF7', text: '#565e74', border: '#ccd4ee' },
  'Pending':                     { bg: '#FFEEB9', text: '#7F4500', border: '#FFC000' },
  'Rejected':                    { bg: '#FFB9B9', text: '#8B0000', border: '#C00000' },
  'On Hold':                     { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' },
  'Instructed - Not Submitted':  { bg: '#FFF2CC', text: '#7F4500', border: '#FFC000' },
}

export default function VariationsClient({ variations: initial, projectId }: { variations: Variation[]; projectId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [vars, setVars]         = useState<Variation[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState<Partial<Variation>>({})
  const [adding, setAdding]       = useState(false)
  const [newForm, setNewForm]     = useState<Partial<Variation>>({ status: 'Submitted' })
  const [statusFilter, setStatusFilter] = useState('All')
  const tableNav = useTableNav()

  const filtered = statusFilter === 'All' ? vars : vars.filter(v => v.status === statusFilter)

  // Summary totals
  const totals = useMemo(() => ({
    approvedIncome:   vars.filter(v => v.status === 'Approved').reduce((s, v) => s + Number(v.income_value), 0),
    submittedIncome:  vars.filter(v => v.status === 'Submitted' || v.status === 'Pending').reduce((s, v) => s + Number(v.income_value), 0),
    totalCostEst:     vars.reduce((s, v) => s + Number(v.cost_estimate), 0),
    totalCostActual:  vars.reduce((s, v) => s + Number(v.cost_actual), 0),
    approvedCount:    vars.filter(v => v.status === 'Approved').length,
    submittedCount:   vars.filter(v => v.status === 'Submitted' || v.status === 'Pending').length,
    rejectedCount:    vars.filter(v => v.status === 'Rejected').length,
  }), [vars])

  const totalApprovedMargin = totals.approvedIncome - vars.filter(v => v.status === 'Approved').reduce((s, v) => s + (Number(v.cost_actual) || Number(v.cost_estimate)), 0)

  async function saveEdit(id: string) {
    await fetch(`/api/projects/${projectId}/variations`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, id }),
    })
    setVars(p => p.map(v => v.id === id ? { ...v, ...editForm } as Variation : v))
    setEditingId(null)
    startTransition(() => router.refresh())
  }

  async function addNew() {
    if (!newForm.ref || !newForm.description) return
    const res = await fetch(`/api/projects/${projectId}/variations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    const { id } = await res.json()
    setVars(p => [...p, { ...newForm, id } as Variation])
    setAdding(false); setNewForm({ status: 'Submitted' })
    startTransition(() => router.refresh())
  }

  async function del(id: string, ref: string) {
    if (!confirm(`Delete ${ref}?`)) return
    await fetch(`/api/projects/${projectId}/variations`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setVars(p => p.filter(v => v.id !== id))
  }

  function Inp({ field, type = 'text', placeholder, className }: { field: keyof Variation; type?: string; placeholder?: string; className?: string }) {
    return (
      <input type={type} value={String(editForm[field] ?? '')} placeholder={placeholder}
        onChange={e => setEditForm(p => ({ ...p, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() } else { tableNav(e) } }}
        className={clx('border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#565e74]', className)}
        style={{ background: '#FFFFC7' }} />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Variations Register"
        subtitle="Track all contract variations — income, cost and status"
        actions={
          <button onClick={() => { setAdding(true); setNewForm({ status: 'Submitted' }) }}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold text-white bg-primary text-on-primary hover:bg-primary-dim rounded px-4 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors">
            <Plus size={14} /> Add Variation
          </button>
        }
      />

      {/* Summary strip */}
      <div className="bg-primary text-on-primary hover:bg-primary-dim rounded px-4 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors flex-shrink-0 px-6 py-3 flex items-center gap-8">
        {[
          { label: 'Approved Income',   val: fmt(totals.approvedIncome),  col: '#DEE5B5', sub: `${totals.approvedCount} approved` },
          { label: 'Submitted / Pending', val: fmt(totals.submittedIncome), col: '#FFEEB9', sub: `${totals.submittedCount} awaiting` },
          { label: 'Total Cost Estimate', val: fmt(totals.totalCostEst),   col: '#FFB9B9', sub: 'all variations' },
          { label: 'Approved Margin',    val: fmt(totalApprovedMargin),    col: totalApprovedMargin >= 0 ? '#DEE5B5' : '#FFB9B9', sub: 'income − cost' },
          { label: 'Rejected',           val: `${totals.rejectedCount} var${totals.rejectedCount !== 1 ? 's' : ''}`, col: '#FFB9B9', sub: '' },
        ].map(({ label, val, col, sub }) => (
          <div key={label} className="flex-shrink-0">
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(168,196,224,0.65)' }}>{label}</div>
            <div className="text-sm font-bold tabular-nums mt-0.5" style={{ color: col }}>{val}</div>
            {sub && <div className="text-[10px]" style={{ color: 'rgba(168,196,224,0.5)' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {['All', ...STATUSES].map(s => {
            const style = STATUS_STYLE[s] || { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' }
            const active = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-2.5 py-1 rounded text-[11px] font-medium border transition-all"
                style={active
                  ? { background: style.bg, color: style.text, borderColor: style.border, boxShadow: `0 0 0 2px ${style.border}` }
                  : { background: 'white', color: '#6B7280', borderColor: '#E5E7EB' }}>
                {s}
                {s !== 'All' && (
                  <span className="ml-1 font-bold">{vars.filter(v => v.status === s).length}</span>
                )}
              </button>
            )
          })}
        </div>
        <span className="ml-auto text-xs text-on-surface-variant">{filtered.length} of {vars.length} variations</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              {[
                ['Ref', 'left', '80px', '#565e74'],
                ['Description', 'left', '220px', '#565e74'],
                ['Status', 'center', '150px', '#565e74'],
                ['Date Submitted', 'center', '110px', '#4a5268'],
                ['Date Approved', 'center', '110px', '#4a5268'],
                ['Income Value', 'right', '110px', '#8B0000'],
                ['Cost Estimate', 'right', '110px', '#8B0000'],
                ['Cost Actual', 'right', '110px', '#8B0000'],
                ['Margin', 'right', '100px', '#7F4500'],
                ['Notes', 'left', '160px', '#4B5563'],
                ['', 'center', '70px', '#565e74'],
              ].map(([h, align, w, bg], i) => (
                <th key={i} style={{ background: bg as string, minWidth: w as string, textAlign: align as any }}
                  className="px-3 py-2.5 text-white font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {adding && (
              <tr style={{ background: '#FFFFC7' }} className="border-b-2 border-amber-300">
                <td className="px-2 py-1.5"><input value={newForm.ref ?? ''} onChange={e => setNewForm(p=>({...p,ref:e.target.value}))} placeholder="VOI-001" className="border rounded px-2 py-1 text-xs w-20 focus:outline-none" style={{background:'#FFFFC7'}} /></td>
                <td className="px-2 py-1.5"><input value={newForm.description ?? ''} onChange={e => setNewForm(p=>({...p,description:e.target.value}))} placeholder="Description…" className="border rounded px-2 py-1 text-xs w-full focus:outline-none" style={{background:'#FFFFC7'}} /></td>
                <td className="px-2 py-1.5">
                  <select value={newForm.status} onChange={e => setNewForm(p=>({...p,status:e.target.value}))}
                    className="border rounded px-2 py-1 text-xs w-full focus:outline-none">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5"><input type="date" value={newForm.date_submitted ?? ''} onChange={e => setNewForm(p=>({...p,date_submitted:e.target.value}))} className="border rounded px-2 py-1 text-xs w-full focus:outline-none" style={{background:'#FFFFC7'}} /></td>
                <td className="px-2 py-1.5"><input type="date" value={newForm.date_approved ?? ''} onChange={e => setNewForm(p=>({...p,date_approved:e.target.value}))} className="border rounded px-2 py-1 text-xs w-full focus:outline-none" style={{background:'#FFFFC7'}} /></td>
                <td className="px-2 py-1.5"><input type="number" className="no-spin border rounded px-2 py-1 text-xs w-28 text-right focus:outline-none" style={{background:'#FFFFC7'}} onChange={e => setNewForm(p=>({...p,income_value:Number(e.target.value)}))} /></td>
                <td className="px-2 py-1.5"><input type="number" className="no-spin border rounded px-2 py-1 text-xs w-28 text-right focus:outline-none" style={{background:'#FFFFC7'}} onChange={e => setNewForm(p=>({...p,cost_estimate:Number(e.target.value)}))} /></td>
                <td className="px-2 py-1.5"><input type="number" className="no-spin border rounded px-2 py-1 text-xs w-28 text-right focus:outline-none" style={{background:'#FFFFC7'}} onChange={e => setNewForm(p=>({...p,cost_actual:Number(e.target.value)}))} /></td>
                <td />
                <td className="px-2 py-1.5"><input value={newForm.notes ?? ''} onChange={e => setNewForm(p=>({...p,notes:e.target.value}))} placeholder="Notes…" className="border rounded px-2 py-1 text-xs w-full focus:outline-none" /></td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1 justify-center">
                    <button onClick={addNew} className="px-2.5 py-1 rounded text-xs text-white font-semibold" style={{background:'#565e74'}}><Check size={11}/></button>
                    <button onClick={() => setAdding(false)} className="px-2.5 py-1 rounded text-xs bg-gray-200"><X size={11}/></button>
                  </div>
                </td>
              </tr>
            )}

            {filtered.map((v, idx) => {
              const isEditing = editingId === v.id
              const income    = Number(v.income_value)
              const cost      = Number(v.cost_actual) || Number(v.cost_estimate)
              const margin    = income - cost
              const style     = STATUS_STYLE[v.status] || { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' }

              if (isEditing) return (
                <tr key={v.id} style={{ background: '#FFFFC7' }} className="border-b-2 border-amber-200">
                  <td className="px-2 py-1.5"><Inp field="ref" className="w-20" /></td>
                  <td className="px-2 py-1.5"><Inp field="description" className="w-full min-w-[180px]" /></td>
                  <td className="px-2 py-1.5">
                    <select value={editForm.status ?? ''} onChange={e => setEditForm(p => ({...p,status:e.target.value}))}
                      className="border rounded px-2 py-1 text-xs w-full focus:outline-none" style={{background:'#FFFFC7'}}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><Inp field="date_submitted" type="date" className="w-32" /></td>
                  <td className="px-2 py-1.5"><Inp field="date_approved" type="date" className="w-32" /></td>
                  <td className="px-2 py-1.5"><Inp field="income_value" type="number" className="w-28 text-right no-spin" /></td>
                  <td className="px-2 py-1.5"><Inp field="cost_estimate" type="number" className="w-28 text-right no-spin" /></td>
                  <td className="px-2 py-1.5"><Inp field="cost_actual" type="number" className="w-28 text-right no-spin" /></td>
                  <td />
                  <td className="px-2 py-1.5"><Inp field="notes" className="w-full" /></td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => saveEdit(v.id)} className="px-2.5 py-1 rounded text-xs text-white" style={{background:'#565e74'}}><Check size={11}/></button>
                      <button onClick={() => setEditingId(null)} className="px-2.5 py-1 rounded text-xs bg-gray-200"><X size={11}/></button>
                    </div>
                  </td>
                </tr>
              )

              return (
                <tr key={v.id} className={clx('border-b border-outline-variant/10 group hover:bg-surface-container-low transition-colors', idx % 2 === 1 ? 'bg-gray-50/30' : '')}>
                  <td className="px-3 py-2 font-mono font-bold text-xs" style={{ color: '#565e74' }}>{v.ref}</td>
                  <td className="px-3 py-2 text-sm max-w-[220px]"><span className="line-clamp-2">{v.description}</span></td>
                  <td className="px-3 py-2 text-center">
                    <span className="px-2.5 py-1 rounded text-[11px] font-semibold border"
                      style={{ background: style.bg, color: style.text, borderColor: style.border }}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-500">
                    {v.date_submitted ? new Date(v.date_submitted).toLocaleDateString('en-IE', { day:'2-digit', month:'short', year:'2-digit' }) : '–'}
                  </td>
                  <td className="px-3 py-2 text-center" style={{ color: v.date_approved ? '#456919' : '#9CA3AF' }}>
                    {v.date_approved ? new Date(v.date_approved).toLocaleDateString('en-IE', { day:'2-digit', month:'short', year:'2-digit' }) : '–'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium" style={{ color: '#565e74' }}>
                    {income ? income.toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '–'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {Number(v.cost_estimate) ? Number(v.cost_estimate).toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '–'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {Number(v.cost_actual) ? Number(v.cost_actual).toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '–'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold"
                    style={{ color: margin >= 0 ? '#456919' : '#C00000' }}>
                    {income ? (margin >= 0 ? '+' : '') + margin.toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '–'}
                  </td>
                  <td className="px-3 py-2 text-xs text-on-surface-variant max-w-[160px]">
                    <span className="line-clamp-1">{v.notes || ''}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(v.id); setEditForm({ ...v }) }}
                        className="p-1 rounded text-blue-400 hover:bg-blue-50"><Pencil size={13} /></button>
                      <button onClick={() => del(v.id, v.ref)}
                        className="p-1 rounded text-red-300 hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {filtered.length === 0 && !adding && (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-on-surface-variant">No variations yet. Click Add Variation to get started.</td></tr>
            )}

            {/* Totals row */}
            {filtered.length > 0 && (
              <tr className="bg-cvr-profit-lt font-bold border-t-2 border-amber-300">
                <td colSpan={5} className="px-4 py-2.5 text-xs" style={{ color: '#565e74' }}>
                  TOTAL ({filtered.length} variations shown)
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs" style={{ color: '#565e74' }}>
                  {filtered.reduce((s,v)=>s+Number(v.income_value),0).toLocaleString('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0})}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs text-on-surface">
                  {filtered.reduce((s,v)=>s+Number(v.cost_estimate),0).toLocaleString('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0})}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs text-on-surface">
                  {filtered.reduce((s,v)=>s+Number(v.cost_actual),0).toLocaleString('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0})}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs"
                  style={{ color: filtered.reduce((s,v)=>s+Number(v.income_value)-(Number(v.cost_actual)||Number(v.cost_estimate)),0) >= 0 ? '#456919' : '#C00000' }}>
                  {filtered.reduce((s,v)=>{const c=Number(v.cost_actual)||Number(v.cost_estimate);return s+Number(v.income_value)-c},0).toLocaleString('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0})}
                </td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
