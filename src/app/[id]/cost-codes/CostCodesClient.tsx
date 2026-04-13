'use client'
import { useState, useTransition } from 'react'
import { clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { Plus, Pencil, Trash2, Check, X, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTableNav } from '@/lib/tableUtils'
import UploadModal from '@/components/UploadModal'

type Code = { id: string; code: string; description: string; trade: string; notes: string | null }

interface Props { codes: Code[]; projectId: string; trades: string[] }

export default function CostCodesClient({ codes: initial, projectId, trades }: Props) {
  const router       = useRouter()
  const [, start]    = useTransition()
  const tableNav     = useTableNav()
  const [codes, setCodes]       = useState<Code[]>(initial)
  const [search, setSearch]     = useState('')
  const [tradeFilter, setTradeFilter] = useState('All')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editForm, setEditForm]       = useState<Partial<Code>>({})
  const [newForm, setNewForm]         = useState<Partial<Code>>({ code:'', description:'', trade: trades[0]||'', notes:'' })
  const [adding, setAdding]           = useState(false)
  const [saving, setSaving]           = useState(false)
  const [showUpload, setShowUpload]   = useState(false)

  const filtered = codes.filter(c => {
    if (tradeFilter !== 'All' && c.trade !== tradeFilter) return false
    if (search && !c.code.toLowerCase().includes(search.toLowerCase()) && !c.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const uniqueTrades = ['All', ...Array.from(new Set(codes.map(c => c.trade).filter(Boolean))).sort()]

  async function save(id: string) {
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
      body: JSON.stringify({ ...newForm, category: '' }),
    })
    const { id } = await res.json()
    setCodes(p => [...p, { id, code: newForm.code!, description: newForm.description!, trade: newForm.trade||'', notes: newForm.notes||null }])
    setAdding(false)
    setNewForm({ code:'', description:'', trade: trades[0]||'', notes:'' })
    setSaving(false)
    start(() => router.refresh())
  }

  async function del(id: string, code: string) {
    if (!confirm(`Delete cost code ${code}? This cannot be undone.`)) return
    await fetch(`/api/projects/${projectId}/cost-codes/${id}`, { method: 'DELETE' })
    setCodes(p => p.filter(c => c.id !== id))
  }

  function Input({ value, onChange, placeholder, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
    return (
      <input value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); tableNav(e) }}
        className={clx('w-full border border-outline-variant/40 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary', mono ? 'font-mono' : '')}
        style={{ background: '#FFFFC7' }} />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Cost Code Register"
        subtitle={`${codes.length} codes · Master reference for all cost allocation`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-outline rounded text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
              <Upload size={13} /> Import CSV
            </button>
            <button onClick={() => { setAdding(true); setNewForm({ code:'', description:'', trade: trades[0]||'', notes:'' }) }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-bold uppercase tracking-tight hover:bg-primary-dim transition-colors">
              <Plus size={13} /> Add Code
            </button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="bg-white border-b px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description…"
          className="border border-outline-variant/40 rounded px-3 py-1.5 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-primary" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {uniqueTrades.map(t => (
            <button key={t} onClick={() => setTradeFilter(t)}
              className={clx('px-2.5 py-1 rounded text-[11px] font-medium border transition-all',
                tradeFilter === t
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-white text-on-surface-variant border-outline-variant/40 hover:bg-surface-container-low')}>
              {t}
              {t !== 'All' && <span className="ml-1 opacity-60">{codes.filter(c=>c.trade===t).length}</span>}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-on-surface-variant">{filtered.length} of {codes.length}</span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {['Code','Description','Trade / Element','Notes',''].map((h, i) => (
                <th key={i}
                  className="px-3 py-2.5 text-left text-[10px] font-bold text-on-primary uppercase tracking-wide bg-primary sticky top-0"
                  style={{ minWidth: i===0?90:i===1?280:i===2?180:i===3?200:50 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {adding && (
              <tr className="border-b border-outline-variant/10" style={{ background: '#FFFFC7' }}>
                <td className="px-2 py-1.5 w-24"><Input value={newForm.code||''} onChange={v=>setNewForm(p=>({...p,code:v}))} placeholder="PRE-010" mono /></td>
                <td className="px-2 py-1.5"><Input value={newForm.description||''} onChange={v=>setNewForm(p=>({...p,description:v}))} placeholder="Description…" /></td>
                <td className="px-2 py-1.5">
                  <select value={newForm.trade||''} onChange={e=>setNewForm(p=>({...p,trade:e.target.value}))}
                    className="w-full border border-outline-variant/40 rounded px-2 py-1 text-xs focus:outline-none"
                    style={{ background: '#FFFFC7' }}>
                    {trades.map(t => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5"><Input value={newForm.notes||''} onChange={v=>setNewForm(p=>({...p,notes:v}))} placeholder="Notes…" /></td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    <button onClick={add} disabled={saving}
                      className="p-1 rounded bg-primary text-on-primary hover:bg-primary-dim disabled:opacity-40">
                      <Check size={13}/>
                    </button>
                    <button onClick={() => setAdding(false)} className="p-1 rounded bg-surface-container text-on-surface-variant">
                      <X size={13}/>
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {filtered.map((c, idx) => {
              const isEditing = editingId === c.id
              return (
                <tr key={c.id}
                  className="border-b border-outline-variant/10 group hover:bg-surface-container-low transition-colors"
                  style={idx % 2 === 1 ? { background: '#fafcff' } : {}}>
                  {isEditing ? (
                    <>
                      <td className="px-2 py-1.5"><Input value={editForm.code||''} onChange={v=>setEditForm(p=>({...p,code:v}))} mono /></td>
                      <td className="px-2 py-1.5"><Input value={editForm.description||''} onChange={v=>setEditForm(p=>({...p,description:v}))} /></td>
                      <td className="px-2 py-1.5">
                        <select value={editForm.trade||''} onChange={e=>setEditForm(p=>({...p,trade:e.target.value}))}
                          className="w-full border border-outline-variant/40 rounded px-2 py-1 text-xs focus:outline-none"
                          style={{ background: '#FFFFC7' }}>
                          {trades.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><Input value={editForm.notes||''} onChange={v=>setEditForm(p=>({...p,notes:v}))} /></td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <button onClick={() => save(c.id)} className="p-1 rounded bg-primary text-on-primary"><Check size={13}/></button>
                          <button onClick={() => setEditingId(null)} className="p-1 rounded bg-surface-container text-on-surface-variant"><X size={13}/></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-mono font-bold text-primary">{c.code}</td>
                      <td className="px-3 py-2 text-on-surface">{c.description}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{c.trade || <span className="text-error text-[10px] font-bold">Missing</span>}</td>
                      <td className="px-3 py-2 text-on-surface-variant text-[11px]">{c.notes || ''}</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(c.id); setEditForm({ code:c.code, description:c.description, trade:c.trade, notes:c.notes||'' }) }}
                            className="p-1 rounded text-primary hover:bg-primary-container"><Pencil size={13}/></button>
                          <button onClick={() => del(c.id, c.code)}
                            className="p-1 rounded text-error hover:bg-error/10"><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}

            {filtered.length === 0 && !adding && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-on-surface-variant">
                {search || tradeFilter !== 'All' ? 'No codes match the current filter.' : 'No cost codes yet. Click "Add Code" or import a CSV to get started.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex-shrink-0 bg-white border-t px-6 py-2 text-[10px] text-on-surface-variant flex items-center gap-4">
        <span>{codes.length} total codes · {uniqueTrades.length - 1} trades</span>
        <span className="text-outline-variant">·</span>
        <span>Tab/↑↓←→ to navigate · Enter to save row</span>
      </div>

      {showUpload && <UploadModal projectId={projectId} type="cost-codes" onClose={() => { setShowUpload(false); start(() => router.refresh()) }} />}
    </div>
  )
}
