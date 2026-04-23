'use client'
import { useRef, useState, useTransition } from 'react'
import { clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { Plus, Pencil, Trash2, Check, X, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useGridNav } from '@/lib/tableUtils'
import UploadModal from '@/components/UploadModal'

type Code = { id: string; code: string; description: string; trade: string; notes: string | null }
interface Props { codes: Code[]; projectId: string; trades: string[] }

export default function CostCodesClient({ codes: initial, projectId, trades }: Props) {
  const router = useRouter()
  const [, start] = useTransition()
  const gridNav = useGridNav()
  const [codes, setCodes]         = useState<Code[]>(initial)
  const [search, setSearch]       = useState('')
  const [tradeFilter, setTrade]   = useState('All')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState<Partial<Code>>({})
  const [newForm, setNewForm]     = useState<Partial<Code>>({ code:'', description:'', trade: trades[0]||'', notes:'' })
  const [adding, setAdding]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const filtered = codes.filter(c => {
    if (tradeFilter !== 'All' && c.trade !== tradeFilter) return false
    if (search && !c.code.toLowerCase().includes(search.toLowerCase()) && !c.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const uniqueTrades = ['All', ...Array.from(new Set(codes.map(c => c.trade).filter(Boolean))).sort()]

  async function saveEdit(id: string) {
    setSaving(true)
    await fetch(`/api/projects/${projectId}/cost-codes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setCodes(p => p.map(c => c.id === id ? { ...c, ...editForm } as Code : c))
    setEditingId(null); setSaving(false)
    start(() => router.refresh())
  }

  async function add() {
    if (!newForm.code || !newForm.description) return
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/cost-codes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    const { id } = await res.json()
    setCodes(p => [...p, { id, code: newForm.code!, description: newForm.description!, trade: newForm.trade||'', notes: newForm.notes||null }])
    setAdding(false)
    setNewForm({ code:'', description:'', trade: trades[0]||'', notes:'' })
    setSaving(false)
    start(() => router.refresh())
  }

  async function del(id: string, code: string) {
    if (!confirm(`Delete cost code ${code}?`)) return
    await fetch(`/api/projects/${projectId}/cost-codes/${id}`, { method: 'DELETE' })
    setCodes(p => p.filter(c => c.id !== id))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Cost Code Register"
        subtitle={`${codes.length} codes · ${uniqueTrades.length - 1} trades`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-outline rounded text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
              <Upload size={13} /> Import CSV
            </button>
            <button onClick={() => { setAdding(true); setNewForm({ code:'', description:'', trade: trades[0]||'', notes:'' }) }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-bold hover:bg-primary-dim transition-colors">
              <Plus size={13} /> Add Code
            </button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description…"
          className="border border-outline-variant/40 rounded px-3 py-1.5 text-xs w-60 focus:outline-none focus:ring-1 focus:ring-primary" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {uniqueTrades.map(t => (
            <button key={t} onClick={() => setTrade(t)}
              className={clx('px-2.5 py-1 rounded text-[11px] font-medium border transition-all',
                tradeFilter === t
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-white text-on-surface-variant border-outline-variant/40 hover:bg-surface-container-low')}>
              {t}{t !== 'All' && <span className="ml-1 opacity-60">{codes.filter(c=>c.trade===t).length}</span>}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-on-surface-variant">{filtered.length} of {codes.length}</span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="ss-table" onKeyDown={gridNav}>
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: 'center' }}>#</th>
              <th style={{ width: 100, textAlign: 'left' }}>Code</th>
              <th style={{ minWidth: 280, textAlign: 'left' }}>Description</th>
              <th style={{ width: 180, textAlign: 'left' }}>Trade / Element</th>
              <th style={{ minWidth: 180, textAlign: 'left' }}>Notes</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {adding && (
              <tr data-row={-1} style={{ background: '#FFFDE8' }}>
                <td className="row-num">+</td>
                <td data-col={0} style={{ padding: '3px 4px' }}>
                  <input defaultValue={newForm.code} onBlur={e => setNewForm(p=>({...p,code:e.target.value}))}
                    className="grid-input" style={{ textAlign: 'left', fontFamily: 'monospace' }} placeholder="PRE-010" />
                </td>
                <td data-col={1} style={{ padding: '3px 4px' }}>
                  <input defaultValue={newForm.description} onBlur={e => setNewForm(p=>({...p,description:e.target.value}))}
                    className="grid-input" style={{ textAlign: 'left' }} placeholder="Description…" />
                </td>
                <td data-col={2} style={{ padding: '3px 4px' }}>
                  <select value={newForm.trade||''} onChange={e=>setNewForm(p=>({...p,trade:e.target.value}))}
                    className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{ background: '#FFFFC7' }}>
                    {trades.map(t => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td data-col={3} style={{ padding: '3px 4px' }}>
                  <input defaultValue={newForm.notes||''} onBlur={e => setNewForm(p=>({...p,notes:e.target.value}))}
                    className="grid-input" style={{ textAlign: 'left' }} placeholder="Notes…" />
                </td>
                <td style={{ padding: '3px 6px' }}>
                  <div className="flex gap-1">
                    <button onClick={add} disabled={saving||!newForm.code||!newForm.description}
                      className="p-1 rounded text-white disabled:opacity-40" style={{ background: '#456919' }}><Check size={13}/></button>
                    <button onClick={() => setAdding(false)} className="p-1 rounded bg-gray-200"><X size={13}/></button>
                  </div>
                </td>
              </tr>
            )}

            {filtered.length === 0 && !adding && (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                {search || tradeFilter !== 'All' ? 'No codes match the current filter.' : 'No cost codes yet. Click Add Code or Import CSV.'}
              </td></tr>
            )}

            {filtered.map((c, idx) => {
              const isEditing = editingId === c.id
              return (
                <tr key={c.id} data-row={idx} className="group" style={idx % 2 === 1 ? { background: '#fafcff' } : {}}>
                  <td className="row-num">{idx + 1}</td>
                  {isEditing ? (
                    <>
                      <td data-col={0} style={{ padding: '3px 4px' }}>
                        <input defaultValue={editForm.code} onBlur={e=>setEditForm(p=>({...p,code:e.target.value}))}
                          className="grid-input" style={{ textAlign: 'left', fontFamily: 'monospace' }} />
                      </td>
                      <td data-col={1} style={{ padding: '3px 4px' }}>
                        <input defaultValue={editForm.description} onBlur={e=>setEditForm(p=>({...p,description:e.target.value}))}
                          className="grid-input" style={{ textAlign: 'left' }} />
                      </td>
                      <td data-col={2} style={{ padding: '3px 4px' }}>
                        <select value={editForm.trade||''} onChange={e=>setEditForm(p=>({...p,trade:e.target.value}))}
                          className="w-full border rounded px-2 py-1 text-xs focus:outline-none"
                          style={{ background: '#FFFFC7' }}>
                          {trades.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td data-col={3} style={{ padding: '3px 4px' }}>
                        <input defaultValue={editForm.notes||''} onBlur={e=>setEditForm(p=>({...p,notes:e.target.value}))}
                          className="grid-input" style={{ textAlign: 'left' }} />
                      </td>
                      <td style={{ padding: '3px 6px' }}>
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(c.id)} className="p-1 rounded text-white" style={{ background: '#456919' }}><Check size={13}/></button>
                          <button onClick={() => setEditingId(null)} className="p-1 rounded bg-gray-200"><X size={13}/></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><div className="ss-cell-ro" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#565e74', fontSize: 11 }}>{c.code}</div></td>
                      <td><div className="ss-cell-ro" style={{ color: '#111' }}>{c.description}</div></td>
                      <td><div className="ss-cell-ro" style={{ color: '#6b7280' }}>{c.trade || <span style={{ color: '#991B1B', fontSize: 10, fontWeight: 700 }}>Missing</span>}</div></td>
                      <td><div className="ss-cell-ro" style={{ color: '#6b7280', fontSize: 11 }}>{c.notes || ''}</div></td>
                      <td style={{ padding: '0 6px', textAlign: 'center' }}>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-center">
                          <button onClick={() => { setEditingId(c.id); setEditForm({ code:c.code, description:c.description, trade:c.trade, notes:c.notes||'' }) }}
                            className="p-1 rounded text-slate-400 hover:text-primary hover:bg-blue-50"><Pencil size={12}/></button>
                          <button onClick={() => del(c.id, c.code)}
                            className="p-1 rounded text-red-200 hover:text-red-500 hover:bg-red-50"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex-shrink-0 bg-white border-t px-6 py-2 text-[10px] text-on-surface-variant">
        Tab / Arrow keys to navigate · Enter to edit · Category column removed — use trade grouping instead
      </div>

      {showUpload && <UploadModal projectId={projectId} type="cost-codes" onClose={() => { setShowUpload(false); start(() => router.refresh()) }} />}
    </div>
  )
}
