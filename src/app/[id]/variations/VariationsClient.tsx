'use client'
import React from 'react'
import { useRef, useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { useGridNav } from '@/lib/tableUtils'
import GridInput from '@/components/GridInput'
import ViewerBanner from '@/components/ViewerBanner'
import { Plus, Trash2 } from 'lucide-react'
import type { Role } from '@/lib/roleUtils'

type Variation = {
  id: string; ref: string; description: string; status: string
  instructed_by: string | null; category: string | null
  date_instructed: string | null; date_submitted: string | null; date_approved: string | null
  income_value: number; cost_estimate: number; cost_actual: number
  pct_complete: number; notes: string | null
}

const STATUSES = ['Instructed','Submitted','Under Review','Approved','Rejected','On Hold'] as const
const CATEGORIES = [
  "Architect's Instruction","Engineer's Instruction","Client Direct Instruction",
  "Provisional Sum","Dayworks","Employer's Requirement Change",
  "RFI Response","Unforeseen Condition","Omission","Other",
]

const STATUS_CFG: Record<string, { bg: string; text: string; dot: string }> = {
  'Instructed':   { bg: '#F0F4FF', text: '#3730a3', dot: '#4338ca' },
  'Submitted':    { bg: '#EEF2FF', text: '#565e74', dot: '#565e74' },
  'Under Review': { bg: '#FEF9C3', text: '#854F0B', dot: '#CA8A04' },
  'Approved':     { bg: '#F1F4E0', text: '#456919', dot: '#3B6D11' },
  'Rejected':     { bg: '#FEE2E2', text: '#991B1B', dot: '#A32D2D' },
  'On Hold':      { bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG['Submitted']
  return (
    <span style={{ background: cfg.bg, color: cfg.text, padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {status}
    </span>
  )
}

export default function VariationsClient({ variations: initial, projectId, role = 'editor' }: {
  variations: Variation[]; projectId: string; role?: Role
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const gridNav = useGridNav()

  // ── Local state (uncontrolled per-cell) ────────────────────────────────────
  const localVals = useRef<Record<string, any>>({})
  const [vars, setVars]         = useState<Variation[]>(initial)
  const [statusFilter, setFilter] = useState('All')
  const [adding, setAdding]     = useState(false)
  const [newRow, setNewRow]     = useState<Partial<Variation>>({ status: 'Instructed', pct_complete: 0 })
  const [saving, setSaving]     = useState(false)

  function getVal(id: string, field: string): any {
    const key = `${id}:${field}`
    if (key in localVals.current) return localVals.current[key]
    return (vars.find(v => v.id === id) as any)?.[field]
  }

  // Fire-and-forget cell save
  function saveCell(id: string, field: string, value: any) {
    localVals.current[`${id}:${field}`] = value
    const v = vars.find(v => v.id === id)!
    const body: any = {}
    const fields = ['ref','description','status','category','instructed_by',
      'date_instructed','date_submitted','date_approved','income_value',
      'cost_estimate','cost_actual','pct_complete','notes']
    for (const f of fields) {
      body[f] = f === field ? value : (localVals.current[`${id}:${f}`] ?? (v as any)[f])
    }
    fetch(`/api/projects/${projectId}/variations`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
  }

  async function add() {
    if (!newRow.description) return
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/variations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRow),
    })
    const { id, ref } = await res.json()
    setVars(p => [...p, { ...newRow, id, ref } as Variation])
    setAdding(false); setNewRow({ status: 'Instructed', pct_complete: 0 }); setSaving(false)
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

  const filtered = statusFilter === 'All' ? vars : vars.filter(v => v.status === statusFilter)

  const totals = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const v of vars) byStatus[v.status] = (byStatus[v.status] ?? 0) + 1
    const approved  = vars.filter(v => v.status === 'Approved')
    const submitted = vars.filter(v => ['Submitted','Under Review'].includes(v.status))
    return {
      byStatus,
      approvedIncome:  approved.reduce((s,v)  => s + v.income_value, 0),
      approvedMargin:  approved.reduce((s,v)  => s + v.income_value - (v.cost_actual || v.cost_estimate), 0),
      submittedIncome: submitted.reduce((s,v) => s + v.income_value, 0),
      totalCostEst:    vars.reduce((s,v)      => s + v.cost_estimate, 0),
      pipelineIncome:  vars.filter(v => v.status !== 'Rejected').reduce((s,v) => s + v.income_value, 0),
    }
  }, [vars])

  // Inline text cell
  function TextCell({ id, field, placeholder = '', align = 'left' }: {
    id: string; field: string; placeholder?: string; align?: 'left'|'right'
  }) {
    return (
      <input
        defaultValue={getVal(id, field) ?? ''}
        onBlur={e => saveCell(id, field, e.target.value)}
        className="grid-input"
        style={{ textAlign: align }}
        placeholder={placeholder}
        disabled={role === 'viewer'}
      />
    )
  }

  // Select cell
  function SelectCell({ id, field, opts }: { id: string; field: string; opts: readonly string[] }) {
    const val = getVal(id, field) ?? opts[0]
    return (
      <select
        defaultValue={val}
        onChange={e => saveCell(id, field, e.target.value)}
        disabled={role === 'viewer'}
        className="w-full border-0 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary px-1 py-1"
        style={{ background: '#FFFFC7', fontWeight: 600, color: STATUS_CFG[val]?.text ?? '#374151' }}>
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Variations Register"
        subtitle="Track all contract variations — status, income, cost and recovery"
        actions={
          role !== 'viewer' ? (
            <button onClick={() => { setAdding(true); setNewRow({ status: 'Instructed', pct_complete: 0 }) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold text-white bg-primary hover:bg-primary-dim">
              <Plus size={14} /> Add Variation
            </button>
          ) : null
        }
      />
      <ViewerBanner role={role} />

      {/* Summary strip */}
      <div className="bg-[#1e3a5f] px-6 py-2.5 flex items-center gap-6 flex-shrink-0 flex-wrap">
        {[
          { label: 'Approved income',    val: fmt(totals.approvedIncome),  col: '#DEE5B5' },
          { label: 'Approved margin',    val: fmt(totals.approvedMargin),  col: totals.approvedMargin >= 0 ? '#DEE5B5' : '#FECACA' },
          { label: 'Submitted / review', val: fmt(totals.submittedIncome), col: '#FDE68A' },
          { label: 'Pipeline (excl. rejected)', val: fmt(totals.pipelineIncome), col: '#ccd4ee' },
          { label: 'Total cost estimate', val: fmt(totals.totalCostEst),   col: '#ccd4ee' },
        ].map(k => (
          <div key={k.label} className="flex-shrink-0">
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'rgba(168,196,224,0.55)' }}>{k.label}</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: k.col }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-2 flex-shrink-0 overflow-x-auto">
        <button onClick={() => setFilter('All')}
          className={clx('flex-shrink-0 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all',
            statusFilter === 'All' ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-[#6b7280] border-[#e5e7eb]')}>
          All ({vars.length})
        </button>
        {STATUSES.map(s => {
          const cfg = STATUS_CFG[s]
          const count = totals.byStatus[s] ?? 0
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setFilter(active ? 'All' : s)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all"
              style={active
                ? { background: cfg.bg, color: cfg.text, borderColor: cfg.dot, boxShadow: `0 0 0 2px ${cfg.bg}` }
                : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot }} />
              {s}
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: active ? cfg.dot : '#f3f4f6', color: active ? '#fff' : '#6b7280' }}>
                {count}
              </span>
            </button>
          )
        })}
        <span className="ml-auto text-[11px] text-on-surface-variant flex-shrink-0">{filtered.length} of {vars.length}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="ss-table" style={{ minWidth: 1200 }} onKeyDown={gridNav}>
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: 'center' }}>#</th>
              <th style={{ width: 70,  textAlign: 'left' }}>Ref</th>
              <th style={{ minWidth: 220, textAlign: 'left' }}>Description</th>
              <th style={{ width: 130, textAlign: 'left' }}>Category</th>
              <th style={{ width: 120, textAlign: 'center' }}>Status</th>
              <th style={{ width: 100, textAlign: 'left' }}>Instructed by</th>
              <th style={{ width: 95,  textAlign: 'center' }}>Date instr.</th>
              <th style={{ width: 95,  textAlign: 'center' }}>Date subm.</th>
              <th style={{ width: 95,  textAlign: 'center' }}>Date appr.</th>
              <th style={{ width: 110, textAlign: 'right' }}>Income value</th>
              <th style={{ width: 110, textAlign: 'right' }}>Cost est.</th>
              <th style={{ width: 80,  textAlign: 'right' }}>% Complete</th>
              <th style={{ width: 110, textAlign: 'right' }}>Margin</th>
              <th style={{ minWidth: 150, textAlign: 'left' }}>Notes</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {adding && (
              <tr data-row={-1} style={{ background: '#FFFDE8' }}>
                <td className="row-num">+</td>
                <td style={{ padding: '3px 4px' }}>
                  <input className="grid-input" style={{ textAlign: 'left' }} placeholder="Auto"
                    onBlur={e => setNewRow(p => ({ ...p, ref: e.target.value }))} />
                </td>
                <td data-col={0} style={{ padding: '3px 4px' }}>
                  <input className="grid-input" style={{ textAlign: 'left' }} placeholder="Description of variation…" autoFocus
                    onBlur={e => setNewRow(p => ({ ...p, description: e.target.value }))} />
                </td>
                <td style={{ padding: '3px 4px' }}>
                  <select onChange={e => setNewRow(p => ({ ...p, category: e.target.value }))}
                    className="w-full border rounded px-1 py-1 text-xs focus:outline-none" style={{ background: '#FFFFC7' }}>
                    <option value="">—</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ padding: '3px 4px' }}>
                  <select defaultValue="Instructed" onChange={e => setNewRow(p => ({ ...p, status: e.target.value }))}
                    className="w-full border rounded px-1 py-1 text-xs focus:outline-none" style={{ background: '#FFFFC7' }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: '3px 4px' }}>
                  <input className="grid-input" style={{ textAlign: 'left' }} placeholder="e.g. AI-012"
                    onBlur={e => setNewRow(p => ({ ...p, instructed_by: e.target.value }))} />
                </td>
                <td style={{ padding: '3px 4px' }}>
                  <input type="date" className="grid-input" onChange={e => setNewRow(p => ({ ...p, date_instructed: e.target.value }))} />
                </td>
                <td /><td />
                <td data-col={1}><GridInput value={0} onSave={v => setNewRow(p => ({ ...p, income_value: v }))} /></td>
                <td data-col={2}><GridInput value={0} onSave={v => setNewRow(p => ({ ...p, cost_estimate: v }))} /></td>
                <td data-col={3}><GridInput value={0} onSave={v => setNewRow(p => ({ ...p, pct_complete: v }))} /></td>
                <td />
                <td style={{ padding: '3px 4px' }}>
                  <input className="grid-input" style={{ textAlign: 'left' }} placeholder="Notes…"
                    onBlur={e => setNewRow(p => ({ ...p, notes: e.target.value }))} />
                </td>
                <td style={{ padding: '3px 6px' }}>
                  <div className="flex gap-1">
                    <button onClick={add} disabled={saving || !newRow.description}
                      style={{ background: '#456919', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer', opacity: !newRow.description ? 0.5 : 1 }}>
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

            {filtered.length === 0 && !adding && (
              <tr><td colSpan={15} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No variations{statusFilter !== 'All' ? ` with status "${statusFilter}"` : ''}. Click Add Variation to get started.
              </td></tr>
            )}

            {filtered.map((v, idx) => {
              const income   = getVal(v.id, 'income_value')  ?? v.income_value
              const costEst  = getVal(v.id, 'cost_estimate') ?? v.cost_estimate
              const margin   = income - costEst
              const status   = getVal(v.id, 'status') ?? v.status

              return (
                <tr key={v.id} data-row={idx} className="group"
                  style={idx % 2 === 1 ? { background: '#fafcff' } : {}}>
                  <td className="row-num">{idx + 1}</td>
                  <td><div className="ss-cell-ro" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#565e74', fontSize: 11 }}>{v.ref}</div></td>
                  <td data-col={0} style={{ padding: '2px 4px' }}><TextCell id={v.id} field="description" placeholder="Description…" /></td>
                  <td style={{ padding: '2px 4px' }}>
                    <select defaultValue={v.category ?? ''}
                      onChange={e => saveCell(v.id, 'category', e.target.value)}
                      disabled={role === 'viewer'}
                      className="w-full text-[11px] focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-1"
                      style={{ background: '#FFFFC7', border: '0.5px solid #e5e7eb' }}>
                      <option value="">—</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <select defaultValue={v.status}
                      onChange={e => saveCell(v.id, 'status', e.target.value)}
                      disabled={role === 'viewer'}
                      className="w-full text-[11px] focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-1"
                      style={{ background: STATUS_CFG[status]?.bg ?? '#FFFFC7', color: STATUS_CFG[status]?.text ?? '#374151', fontWeight: 600, border: '0.5px solid #e5e7eb' }}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td data-col={1} style={{ padding: '2px 4px' }}><TextCell id={v.id} field="instructed_by" placeholder="AI-012" /></td>
                  <td style={{ padding: '2px 4px' }}>
                    <input type="date" defaultValue={v.date_instructed ?? ''}
                      onBlur={e => saveCell(v.id, 'date_instructed', e.target.value)}
                      disabled={role === 'viewer'}
                      className="grid-input" style={{ fontSize: 11 }} />
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <input type="date" defaultValue={v.date_submitted ?? ''}
                      onBlur={e => saveCell(v.id, 'date_submitted', e.target.value)}
                      disabled={role === 'viewer'}
                      className="grid-input" style={{ fontSize: 11 }} />
                  </td>
                  <td style={{ padding: '2px 4px' }}>
                    <input type="date" defaultValue={v.date_approved ?? ''}
                      onBlur={e => saveCell(v.id, 'date_approved', e.target.value)}
                      disabled={role === 'viewer'}
                      className="grid-input" style={{ fontSize: 11 }} />
                  </td>
                  <td data-col={2}><GridInput value={v.income_value}  onSave={v2 => saveCell(v.id, 'income_value',  v2)} /></td>
                  <td data-col={3}><GridInput value={v.cost_estimate} onSave={v2 => saveCell(v.id, 'cost_estimate', v2)} /></td>
                  <td data-col={4}><GridInput value={v.pct_complete ?? 0} onSave={v2 => saveCell(v.id, 'pct_complete', v2)} /></td>
                  <td>
                    <div className="ss-cell-ro ss-cell-ro-r font-bold"
                      style={{ color: margin >= 0 ? '#27500A' : '#991B1B' }}>
                      {fmt(margin)}
                    </div>
                  </td>
                  <td data-col={5} style={{ padding: '2px 4px' }}><TextCell id={v.id} field="notes" placeholder="Notes…" /></td>
                  <td style={{ textAlign: 'center', padding: '0 4px' }}>
                    {role !== 'viewer' && (
                      <button onClick={() => del(v.id, v.ref)}
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
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f0f4fa', borderTop: '2px solid #1e3a5f' }}>
                <td colSpan={9} style={{ padding: '6px 12px', fontWeight: 700, fontSize: 11, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Totals ({filtered.length} variations)
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1e3a5f' }}>
                  {fmt(filtered.reduce((s, v) => s + (getVal(v.id, 'income_value') ?? v.income_value), 0))}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#565e74' }}>
                  {fmt(filtered.reduce((s, v) => s + (getVal(v.id, 'cost_estimate') ?? v.cost_estimate), 0))}
                </td>
                <td />
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {(() => {
                    const m = filtered.reduce((s, v) =>
                      s + (getVal(v.id, 'income_value') ?? v.income_value) - (getVal(v.id, 'cost_estimate') ?? v.cost_estimate), 0)
                    return <span style={{ color: m >= 0 ? '#27500A' : '#991B1B' }}>{fmt(m)}</span>
                  })()}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="px-6 py-2 bg-white border-t text-[10px] text-on-surface-variant flex-shrink-0">
        Tab / Enter / Arrow keys to navigate · Changes save automatically on blur · Yellow = editable
      </div>
    </div>
  )
}
