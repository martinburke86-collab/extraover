'use client'
import { useState, useTransition, useMemo } from 'react'
import { fmt, pct, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { Plus, Trash2, ChevronDown, ChevronRight, Upload } from 'lucide-react'
import UploadModal from '@/components/UploadModal'
import { useRouter } from 'next/navigation'
import type { PrelimItem, PrelimsReconciliation } from '@/lib/calculations'
import { useGridNav } from '@/lib/tableUtils'
import BreakdownCell from '@/components/BreakdownCell'
import CostCodeInput from '@/components/CostCodeInput'
import GridInput from '@/components/GridInput'

interface Props {
  items: PrelimItem[]
  weeksElapsed: number
  totalWeeks: number
  projectId: string
  revisedStart: string
  revisedFinish: string
  sheetOnly: PrelimsReconciliation['sheetOnly']
  unlisted: PrelimsReconciliation['unlisted']
}

const SECTIONS = ['Site Management','Welfare & Offices','Establishment','Running Costs','Surveys','Bond & Insurance','Other']
const UNITS    = ['Weeks','nr','each','m','m²','m³','t','Item','Months']

function calcAmount(item: Partial<PrelimItem>, weeksElapsed: number): number {
  const qty  = item.qty  ?? 1
  const rate = item.rate ?? 0
  const util = (item.utilisation_pct ?? 100) / 100
  const sw   = item.start_week  ?? 1
  const fw   = item.finish_week ?? 1
  if ((item.unit ?? 'Weeks').toLowerCase() === 'weeks') {
    const cur  = Math.max(weeksElapsed, sw - 1)
    const rem  = Math.max(0, fw - cur)
    return qty * rate * rem * util
  }
  return qty * rate * util
}
function calcPFC(item: Partial<PrelimItem>, weeksElapsed: number): number {
  return (item.ctd ?? 0) + (item.committed ?? 0) + calcAmount(item, weeksElapsed)
}

// Small integer input (weeks, qty) — uncontrolled, stable through re-renders
function IntInput({ value, onSave, min, max, w = 'w-14' }: {
  value: number; onSave: (v: number) => void; min?: number; max?: number; w?: string
}) {
  return (
    <input
      type="number"
      defaultValue={value}
      min={min} max={max}
      onBlur={e => onSave(Number(e.target.value))}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={clx(w, 'border border-gray-200 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary')}
      style={{ background: '#eef2ff' }}
    />
  )
}

export default function PrelimsClient({ items: initial, weeksElapsed, totalWeeks, projectId, revisedStart, revisedFinish, sheetOnly: initialSheetOnly, unlisted: initialUnlisted }: Props) {
  const router      = useRouter()
  const [, start]   = useTransition()
  const [items, setItems]         = useState<PrelimItem[]>(initial)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [adding, setAdding]       = useState(false)
  const [templateLoading, setTplLoad] = useState(false)
  const [newItem, setNewItem]     = useState<Partial<PrelimItem>>({
    section: 'Site Management', unit: 'Weeks', qty: 1, rate: 0,
    utilisation_pct: 100, start_week: 1, finish_week: totalWeeks,
  })
  const tableNav = useGridNav()
  const [showUpload, setShowUpload] = useState(false)
  const [sheetOnly, setSheetOnly] = useState(initialSheetOnly)
  const [unlisted, setUnlisted]   = useState(initialUnlisted)
  const [posting, setPosting]     = useState(false)

  // CTD and Committed are read from the lines on each item's cost code, so
  // re-read them after anything that changes which lines an item picks up.
  async function refreshDerived() {
    const res = await fetch(`/api/projects/${projectId}/prelims`)
    if (!res.ok) return
    const data = await res.json()
    const byId: Record<string, PrelimItem> = Object.fromEntries((data.items as PrelimItem[]).map(i => [i.id, i]))
    setItems(prev => prev.map(it => byId[it.id] ? { ...it, ctd: byId[it.id].ctd, committed: byId[it.id].committed } : it))
    setSheetOnly(data.sheetOnly)
    setUnlisted(data.unlisted)
  }

  // Template load and spreadsheet import add rows: take the whole list from
  // the server (router.refresh alone leaves this local state unchanged)
  async function reloadItems() {
    const res = await fetch(`/api/projects/${projectId}/prelims`)
    if (!res.ok) return
    const data = await res.json()
    setItems(data.items)
    setSheetOnly(data.sheetOnly)
    setUnlisted(data.unlisted)
  }

  async function postSheetOnly() {
    const ctd = sheetOnly.reduce((s, x) => s + x.ctd, 0)
    const committed = sheetOnly.reduce((s, x) => s + x.committed, 0)
    if (!confirm(`Post ${fmt(ctd)} cost to date and ${fmt(committed)} committed from this sheet onto the Cost to Date and Committed lines?\n\nOne line per cost code is added in the current period, noted "Moved from prelims sheet". The figures typed on the sheet are then cleared.`)) return
    setPosting(true)
    await fetch(`/api/projects/${projectId}/prelims/convert`, { method: 'POST' })
    await refreshDerived()
    setPosting(false)
    start(() => router.refresh())
  }

  async function loadTemplate() {
    if (!confirm('Load the standard PR100–PR900 prelims template?\n\nThis will add 233 standard items (Management, Site Establishment, Security, Safety, Plant, etc.) to this project, each with its own PR cost code, and add those codes to the cost code register.')) return
    setTplLoad(true)
    await fetch(`/api/projects/${projectId}/prelims-template`, { method: 'POST' })
    await reloadItems()
    setTplLoad(false)
    start(() => router.refresh())
  }

  const sections = useMemo(() => {
    const map: Record<string, PrelimItem[]> = {}
    items.forEach(item => { (map[item.section] = map[item.section] || []).push(item) })
    return map
  }, [items])

  // Preliminaries cost on codes with no item still counts, so the total ties to the element EFC
  const other = useMemo(() => unlisted.reduce((a, x) => ({ ctd: a.ctd + x.ctd, committed: a.committed + x.committed }),
    { ctd: 0, committed: 0 }), [unlisted])
  const totals = useMemo(() => items.reduce((acc, it) => ({
    budget:    acc.budget    + it.budget,
    ctd:       acc.ctd       + it.ctd,
    committed: acc.committed + it.committed,
    amount:    acc.amount    + calcAmount(it, weeksElapsed),
    pfc:       acc.pfc       + calcPFC(it, weeksElapsed),
  }), { budget:0, ctd: other.ctd, committed: other.committed, amount:0, pfc: other.ctd + other.committed }), [items, weeksElapsed, other])

  function toggleSection(s: string) {
    setCollapsed(p => { const n = new Set(Array.from(p)); n.has(s) ? n.delete(s) : n.add(s); return n })
  }

  function saveItem(item: PrelimItem) {
    // Fire and forget — no setSaving, no router.refresh per keystroke
    return fetch(`/api/projects/${projectId}/prelims`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item),
    }).catch(() => {/* silent — toast on delete/add errors only */})
  }

  // Code or budget changes move which lines an item picks up: save, then re-read
  async function saveAndRefresh(id: string, patch: Partial<PrelimItem>) {
    const item = items.find(it => it.id === id)
    if (!item) return
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
    await saveItem({ ...item, ...patch })
    await refreshDerived()
  }

  function upd(id: string, field: keyof PrelimItem, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  function updAndSave(id: string, field: keyof PrelimItem, value: any) {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, [field]: value } : it)
      const item = next.find(it => it.id === id)
      if (item) saveItem(item)
      return next
    })
  }

  async function deleteItem(id: string, desc: string) {
    if (!confirm(`Delete "${desc}"?`)) return
    await fetch(`/api/projects/${projectId}/prelims`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    setItems(p => p.filter(it => it.id !== id))
    start(() => router.refresh())
  }

  async function addItem() {
    if (!newItem.description) return
    const res = await fetch(`/api/projects/${projectId}/prelims`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItem),
    })
    const { id } = await res.json()
    setItems(p => [...p, {
      ...newItem as PrelimItem, id, ctd: 0, committed: 0,
      amount: calcAmount(newItem, weeksElapsed),
      projected_final_cost: calcPFC(newItem, weeksElapsed),
      vs_budget: 0, sort_order: p.length,
    }])
    setAdding(false)
    setNewItem({ section:'Site Management', unit:'Weeks', qty:1, rate:0, utilisation_pct:100, start_week:1, finish_week:totalWeeks })
    await refreshDerived()
    start(() => router.refresh())
  }

  const isWeeks = (u: string) => u.toLowerCase() === 'weeks'
  const weeksRem = Math.max(0, totalWeeks - weeksElapsed)

  // Column header styles
  const TH = ({ children, right, bg, color = 'white', top = 32 }: {
    children: React.ReactNode; right?: boolean; bg: string; color?: string; top?: number
  }) => (
    <th className={clx('px-2 py-2 text-[10px] font-bold whitespace-nowrap sticky', right ? 'text-right' : 'text-left')}
      style={{ background: bg, color, top }}>
      {children}
    </th>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Preliminaries Register"
        subtitle={`Week ${weeksElapsed} of ${totalWeeks} · ${weeksRem} weeks remaining`}
        actions={
          <div className="flex items-center gap-2">
            <div className="text-xs px-3 py-1.5 rounded font-semibold" style={{ background: '#fcf2e2', color: '#7F4500' }}>
              Projected Final Cost: {fmt(totals.pfc)}
            </div>
            {items.length === 0 && (
              <button onClick={loadTemplate} disabled={templateLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a1d23] rounded text-xs font-semibold text-[#1a1d23] hover:bg-blue-50 disabled:opacity-50">
                {templateLoading ? 'Loading…' : '📋 Load standard template'}
              </button>
            )}
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Upload size={13} /> Import Excel
            </button>
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white bg-primary text-on-primary hover:bg-primary-dim px-4 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors">
              <Plus size={13} /> Add Item
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="bg-primary text-on-primary hover:bg-primary-dim rounded px-4 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors flex-shrink-0 border-b border-blue-800">
        <div className="px-6 py-2.5 flex items-center gap-8">
          {[
            { label: 'Budget',                 val: fmt(totals.budget),                  col: '#9aa3b2' },
            { label: 'Cost to Date',           val: fmt(totals.ctd),                     col: '#fbeae6' },
            { label: 'Committed',              val: fmt(totals.committed),               col: '#fbeae6' },
            { label: 'Uncommitted Remaining',  val: fmt(totals.amount),                  col: '#DEE5B5' },
            { label: 'Projected Final Cost',   val: fmt(totals.pfc),                     col: '#fcf2e2' },
            { label: '▲ vs Budget',            val: fmt(totals.budget - totals.pfc),
              col: totals.budget - totals.pfc >= 0 ? '#DEE5B5' : '#fbeae6' },
          ].map(({ label, val, col }) => (
            <div key={label} className="flex-shrink-0">
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(168,196,224,0.65)' }}>{label}</div>
              <div className="text-sm font-bold tabular-nums mt-0.5" style={{ color: col }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Programme bar */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-2 flex items-center gap-4">
        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100,(weeksElapsed/totalWeeks)*100)}%` }} />
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {pct(weeksElapsed / Math.max(totalWeeks, 1))} programme elapsed
        </span>
        <div className="text-xs flex-shrink-0 text-gray-500">
          <span className="font-semibold text-[#5b626e]">{revisedStart ? new Date(revisedStart).toLocaleDateString('en-IE',{day:'2-digit',month:'short',year:'2-digit'}) : '–'}</span>
          &nbsp;→&nbsp;
          <span className="font-semibold text-[#5b626e]">{revisedFinish ? new Date(revisedFinish).toLocaleDateString('en-IE',{day:'2-digit',month:'short',year:'2-digit'}) : '–'}</span>
        </div>
      </div>

      {/* Pre-v51 figures typed on the sheet that are not on the lines */}
      {sheetOnly.length > 0 && (
        <div className="flex-shrink-0 border-b px-6 py-2.5 flex items-center gap-4 text-xs" style={{ background: '#FEF3C7', color: '#92400e' }}>
          <div className="flex-1">
            <span className="font-bold" style={{ color: '#b6740a' }}>
              {fmt(sheetOnly.reduce((s, x) => s + x.ctd + x.committed, 0))} typed on this sheet is not on Cost to Date or Committed.
            </span>{' '}
            Cost to date and committed on this sheet now come from the lines on each cost code, so this amount is missing from the
            dashboard until it is posted ({sheetOnly.slice(0, 5).map(x => x.code ?? `${x.description}, no code`).join('; ')}{sheetOnly.length > 5 ? ` +${sheetOnly.length - 5} more` : ''}).
            {sheetOnly.some(x => !x.postable) && ' Items without a valid cost code need one before they can be posted.'}
          </div>
          {sheetOnly.some(x => x.postable) && (
            <button onClick={postSheetOnly} disabled={posting}
              className="flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold text-white bg-primary hover:bg-primary-dim disabled:opacity-50">
              {posting ? 'Posting…' : 'Post to Cost to Date'}
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-xs" style={{ minWidth: 1200 }} onKeyDown={tableNav}>
          <thead className="sticky top-0 z-20">
            {/* Group row */}
            <tr>
              <th colSpan={5} style={{ background: '#5b626e', color: 'white', top: 0 }}
                className="px-3 py-2 text-center text-[11px] font-bold sticky">ITEM</th>
              <th colSpan={3} style={{ background: '#8B0000', color: 'white', top: 0 }}
                className="px-3 py-2 text-center text-[11px] font-bold sticky border-l-2 border-white/20">COSTS</th>
              <th colSpan={5} style={{ background: '#2d6a1c', color: 'white', top: 0 }}
                className="px-3 py-2 text-center text-[11px] font-bold sticky border-l-2 border-white/20">RATE BUILD-UP → UNCOMMITTED</th>
              <th colSpan={3} style={{ background: '#7F4500', color: 'white', top: 0 }}
                className="px-3 py-2 text-center text-[11px] font-bold sticky border-l-2 border-white/20">PROJECTED FINAL COST</th>
              <th style={{ background: '#5b626e', top: 0 }} className="px-3 py-2 sticky" />
            </tr>
            {/* Column row */}
            <tr>
              <TH bg="#4c525d" top={32}>Section</TH>
              <TH bg="#4c525d" top={32}>Cost Code</TH>
              <TH bg="#4c525d" top={32}>Description</TH>
              <TH bg="#4c525d" right top={32}>Budget</TH>
              <TH bg="#4c525d" right top={32}>Notes</TH>
              <TH bg="#8B0000" right top={32}>CTD</TH>
              <TH bg="#8B0000" right top={32}>Committed</TH>
              <TH bg="#8B0000" right top={32}>Total Costs</TH>
              <TH bg="#2d6a1c" right top={32}>Util %</TH>
              <TH bg="#2d6a1c" right top={32}>Qty</TH>
              <TH bg="#2d6a1c" top={32}>Unit</TH>
              <TH bg="#2d6a1c" right top={32}>Rate</TH>
              <TH bg="#2d6a1c" right top={32}>Wks (start–end)</TH>
              <TH bg="#7F4500" right top={32}>Uncommitted</TH>
              <TH bg="#7F4500" right top={32}>Proj Final Cost</TH>
              <TH bg="#7F4500" right top={32}>▲ vs Budget</TH>
              <TH bg="#5b626e" top={32}>{""}</TH>
            </tr>
          </thead>
          <tbody>
            {/* New item row */}
            {adding && (
              <tr style={{ background: '#eef2ff' }} className="border-b-2 border-amber-300">
                <td className="px-2 py-1.5">
                  <select value={newItem.section} onChange={e => setNewItem(p => ({...p, section: e.target.value}))}
                    className="border rounded px-1.5 py-0.5 text-xs w-full focus:outline-none">
                    {SECTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <CostCodeInput projectId={projectId} value={newItem.cost_code ?? ''} field="code"
                    onSelect={cc => setNewItem(p => ({...p, cost_code: cc.code, description: cc.description}))}
                    className="border rounded px-1.5 py-0.5 text-xs w-24 font-mono focus:outline-none"
                    />
                </td>
                <td className="px-2 py-1.5">
                  <CostCodeInput projectId={projectId} value={newItem.description ?? ''} field="description"
                    onSelect={cc => setNewItem(p => ({...p, cost_code: cc.code, description: cc.description}))}
                    className="border rounded px-1.5 py-0.5 text-xs w-48 focus:outline-none"
                    placeholder="Description…" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" className="no-spin border rounded px-1.5 py-0.5 text-xs w-24 text-right focus:outline-none"
                    style={{ background: '#eef2ff' }}
                    onChange={e => setNewItem(p => ({...p, budget: parseFloat(e.target.value.replace(/,/g,''))||0}))} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" className="border rounded px-1.5 py-0.5 text-xs w-28 focus:outline-none"
                    onChange={e => setNewItem(p => ({...p, notes: e.target.value}))} placeholder="Notes…" />
                </td>
                <td colSpan={3} className="px-3 py-1.5 text-[10px] text-gray-400 text-center">
                  From Cost to Date and Committed lines on the code
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={newItem.utilisation_pct??100} min={0} max={100}
                    onChange={e => setNewItem(p => ({...p, utilisation_pct: Number(e.target.value)}))}
                    className="border rounded px-1.5 py-0.5 text-xs w-14 text-center focus:outline-none" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={newItem.qty??1} min={0}
                    onChange={e => setNewItem(p => ({...p, qty: Number(e.target.value)}))}
                    className="border rounded px-1.5 py-0.5 text-xs w-14 text-right focus:outline-none" />
                </td>
                <td className="px-2 py-1.5">
                  <select value={newItem.unit??'Weeks'} onChange={e => setNewItem(p => ({...p, unit: e.target.value}))}
                    className="border rounded px-1 py-0.5 text-xs focus:outline-none">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" className="no-spin border rounded px-1.5 py-0.5 text-xs w-24 text-right focus:outline-none"
                    style={{ background: '#eef2ff' }}
                    onChange={e => setNewItem(p => ({...p, rate: parseFloat(e.target.value.replace(/,/g,''))||0}))} />
                </td>
                <td className="px-2 py-1.5">
                  {isWeeks(newItem.unit??'Weeks') && (
                    <div className="flex items-center gap-1">
                      <input type="number" value={newItem.start_week??1} onChange={e => setNewItem(p=>({...p,start_week:Number(e.target.value)}))}
                        className="border rounded px-1 py-0.5 text-xs w-12 text-center" />
                      <span className="text-gray-400">–</span>
                      <input type="number" value={newItem.finish_week??totalWeeks} onChange={e => setNewItem(p=>({...p,finish_week:Number(e.target.value)}))}
                        className="border rounded px-1 py-0.5 text-xs w-12 text-center" />
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: '#7F4500' }}>{fmt(calcAmount(newItem, weeksElapsed))}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-bold" style={{ color: '#5b626e' }}>{fmt(calcPFC(newItem, weeksElapsed))}</td>
                <td /><td className="px-2 py-1.5">
                  <div className="flex gap-1">
                    <button onClick={addItem} className="px-2 py-1 rounded text-xs text-white font-semibold bg-primary text-on-primary hover:bg-primary-dim rounded px-4 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors">Add</button>
                    <button onClick={() => setAdding(false)} className="px-2 py-1 rounded text-xs bg-gray-200">✕</button>
                  </div>
                </td>
              </tr>
            )}

            {Object.entries(sections).map(([section, sItems]) => {
              const isOpen  = !collapsed.has(section)
              const secTot  = sItems.reduce((a, it) => ({
                budget: a.budget + it.budget, ctd: a.ctd + it.ctd,
                committed: a.committed + it.committed,
                amount: a.amount + calcAmount(it, weeksElapsed),
                pfc: a.pfc + calcPFC(it, weeksElapsed),
              }), { budget:0, ctd:0, committed:0, amount:0, pfc:0 })

              return [
                <tr key={`hdr-${section}`} onClick={() => toggleSection(section)}
                  className="cursor-pointer select-none bg-primary-container">
                  <td colSpan={5} className="px-3 py-2">
                    <div className="flex items-center gap-2 font-bold text-[11px]" style={{ color: '#5b626e' }}>
                      {isOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                      {section}
                      <span className="font-normal text-gray-500">({sItems.length})</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold" style={{ color: '#8B0000' }}>{fmt(secTot.ctd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold" style={{ color: '#8B0000' }}>{fmt(secTot.committed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold text-gray-600">{fmt(secTot.ctd+secTot.committed)}</td>
                  <td colSpan={5} />
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold" style={{ color: '#7F4500' }}>{fmt(secTot.amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold" style={{ color: '#5b626e' }}>{fmt(secTot.pfc)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold"
                    style={{ color: secTot.budget-secTot.pfc >= 0 ? '#2d6a1c' : '#c8412a' }}>
                    {secTot.budget ? fmt(secTot.budget-secTot.pfc) : '–'}
                  </td>
                  <td />
                </tr>,

                ...(isOpen ? sItems.map((item, idx) => {
                  const amount   = calcAmount(item, weeksElapsed)
                  const pfc      = calcPFC(item, weeksElapsed)
                  const vsBudget = item.budget ? item.budget - pfc : null
                  const isWks    = isWeeks(item.unit)
                  const rem      = isWks ? Math.max(0, item.finish_week - Math.max(weeksElapsed, item.start_week-1)) : null

                  return (
                    <tr key={item.id} data-row={idx} className="border-b border-gray-100 group hover:bg-blue-50/20"
                      style={idx%2===1 ? { background: 'rgba(0,0,0,0.012)' } : {}}>

                      {/* Section */}
                      <td data-col={0} className="px-2 py-1">
                        <select value={item.section}
                          onChange={e => updAndSave(item.id, 'section', e.target.value)}
                          className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none"
                          style={{ background: '#eef2ff', minWidth: 110 }}>
                          {SECTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* Cost Code — bidirectional */}
                      <td data-col={1} className="px-2 py-1">
                        <CostCodeInput projectId={projectId} value={item.cost_code ?? ''} field="code"
                          onSelect={cc => saveAndRefresh(item.id, { cost_code: cc.code })}
                          onKeyDown={tableNav}
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs w-24 font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Code…" />
                      </td>

                      {/* Description — bidirectional */}
                      <td data-col={2} className="px-2 py-1">
                        <CostCodeInput projectId={projectId} value={item.description} field="description"
                          onSelect={cc => saveAndRefresh(item.id, { cost_code: cc.code, description: cc.description })}
                          onKeyDown={tableNav}
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Description…" />
                      </td>

                      {/* Budget (also splits a shared cost code's lines between items) */}
                      <td data-col={3} className="px-2 py-1">
                        <GridInput value={item.budget} onSave={v => saveAndRefresh(item.id, { budget: v })} className="grid-input-sm w-24" />
                      </td>

                      {/* Notes */}
                      <td data-col={4} className="px-2 py-1">
                        <input defaultValue={item.notes ?? ''}
                          onBlur={e => updAndSave(item.id, 'notes', e.target.value)}
                          className="border border-gray-100 rounded px-1.5 py-0.5 text-xs w-28 text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300" />
                      </td>

                      {/* CTD and Committed: read-only, from the lines on this cost code */}
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-gray-600"
                        title="From Cost to Date lines on this cost code">
                        {item.ctd ? item.ctd.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-gray-600"
                        title="From Committed lines on this cost code">
                        {item.committed ? item.committed.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}
                      </td>

                      {/* Total Costs (read-only) */}
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 text-xs">
                        {(item.ctd + item.committed) ? (item.ctd + item.committed).toLocaleString('en-IE', { minimumFractionDigits: 2 }) : '–'}
                      </td>

                      {/* Util % */}
                      <td data-col={7} className="px-2 py-1">
                        <div className="flex items-center gap-0.5">
                          <IntInput value={item.utilisation_pct} min={0} max={100} w="w-12"
                            onSave={v => updAndSave(item.id, 'utilisation_pct', Math.min(100, Math.max(0, v)))} />
                          <span className="text-gray-400 text-[10px]">%</span>
                        </div>
                      </td>

                      {/* Qty */}
                      <td data-col={8} className="px-2 py-1">
                        <IntInput value={item.qty} min={0} w="w-14"
                          onSave={v => updAndSave(item.id, 'qty', v)} />
                      </td>

                      {/* Unit */}
                      <td data-col={9} className="px-2 py-1">
                        <select value={item.unit}
                          onChange={e => updAndSave(item.id, 'unit', e.target.value)}
                          className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none"
                          style={{ background: '#eef2ff' }}>
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>

                      {/* Rate — with breakdown pane */}
                      <td data-col={10} className="px-2 py-1">
                        <BreakdownCell
                          projectId={projectId}
                          parentId={item.id}
                          parentType="prelim"
                          parentField="rate"
                          parentLabel={item.description}
                          value={item.rate}
                          onSave={v => updAndSave(item.id, 'rate', v)}
                          width="w-24"
                        />
                      </td>

                      {/* Weeks start–finish */}
                      <td data-col={11} className="px-2 py-1">
                        {isWks ? (
                          <div className="flex items-center gap-0.5 text-xs">
                            <IntInput value={item.start_week} min={1} max={totalWeeks} w="w-10"
                              onSave={v => updAndSave(item.id, 'start_week', v)} />
                            <span className="text-gray-400">–</span>
                            <IntInput value={item.finish_week} min={1} max={totalWeeks} w="w-10"
                              onSave={v => updAndSave(item.id, 'finish_week', v)} />
                            <span className="text-[10px] text-gray-400 ml-0.5 whitespace-nowrap">({rem}rem)</span>
                          </div>
                        ) : <span className="text-gray-300 text-xs px-2">–</span>}
                      </td>

                      {/* Uncommitted amount */}
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: '#7F4500' }}>
                        {amount ? amount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}
                      </td>

                      {/* PFC */}
                      <td className="px-3 py-1.5 text-right tabular-nums font-bold" style={{ color: '#5b626e' }}>
                        {pfc.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* vs Budget */}
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium"
                        style={{ color: vsBudget === null ? '#8b93a1' : vsBudget >= 0 ? '#2d6a1c' : '#c8412a' }}>
                        {vsBudget !== null ? vsBudget.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}
                      </td>

                      {/* Delete */}
                      <td className="px-2 py-1 text-center">
                        <button onClick={() => deleteItem(item.id, item.description)}
                          className="text-red-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                }) : []),
              ]
            })}

            {/* Preliminaries codes with cost but no item on this sheet */}
            {unlisted.length > 0 && (
              <tr className="border-t border-gray-200" style={{ background: '#fbfbfc' }}>
                <td colSpan={5} className="px-4 py-2 text-xs text-gray-600">
                  Other Preliminaries codes, not on this sheet{' '}
                  <span className="font-mono text-[10px] text-gray-400">
                    {unlisted.slice(0, 6).map(x => x.code).join(', ')}{unlisted.length > 6 ? ` +${unlisted.length - 6}` : ''}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-600">{fmt(other.ctd)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-600">{fmt(other.committed)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-600">{fmt(other.ctd + other.committed)}</td>
                <td colSpan={6} />
                <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-600">{fmt(other.ctd + other.committed)}</td>
                <td colSpan={2} />
              </tr>
            )}

            {/* Grand Total */}
            <tr className="bg-cvr-profit-lt font-bold border-t-2 border-amber-300">
              <td colSpan={5} className="px-4 py-2.5 text-xs" style={{ color: '#5b626e' }}>TOTAL PRELIMINARIES</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs" style={{ color: '#8B0000' }}>
                {fmt(totals.ctd)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs" style={{ color: '#8B0000' }}>
                {fmt(totals.committed)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs text-gray-600">
                {fmt(totals.ctd + totals.committed)}
              </td>
              <td colSpan={5} />
              <td className="px-3 py-2.5 text-right tabular-nums text-xs" style={{ color: '#7F4500' }}>{fmt(totals.amount)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs" style={{ color: '#5b626e' }}>{fmt(totals.pfc)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs"
                style={{ color: totals.budget - totals.pfc >= 0 ? '#2d6a1c' : '#c8412a' }}>
                {totals.budget ? fmt(totals.budget - totals.pfc) : '–'}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex-shrink-0 bg-white border-t px-6 py-2 flex items-center gap-6 text-[10px] text-gray-400">
        <span>Click a cell to edit · Tab/↑↓←→ to navigate · Enter to move down</span>
        <span>CTD and Committed from the lines on each cost code&nbsp;&nbsp;|&nbsp;&nbsp;Uncommitted = Qty × Rate × Remaining Weeks × Util%&nbsp;&nbsp;|&nbsp;&nbsp;Proj Final Cost = CTD + Committed + Uncommitted</span>
      </div>

      {showUpload && (
        <UploadModal
          projectId={projectId}
          type="prelims"
          onClose={() => { setShowUpload(false); reloadItems(); start(() => router.refresh()) }}
        />
      )}
    </div>
  )
}
