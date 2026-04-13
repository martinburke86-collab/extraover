'use client'
import { useState, useTransition, useMemo } from 'react'
import { fmt, pct, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { Plus, Trash2, ChevronDown, ChevronRight, Upload } from 'lucide-react'
import UploadModal from '@/components/UploadModal'
import { useRouter } from 'next/navigation'
import type { PrelimItem } from '@/lib/calculations'
import { useTableNav } from '@/lib/tableUtils'
import BreakdownCell from '@/components/BreakdownCell'
import CostCodeInput from '@/components/CostCodeInput'

interface Props {
  items: PrelimItem[]
  weeksElapsed: number
  totalWeeks: number
  projectId: string
  revisedStart: string
  revisedFinish: string
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

// Comma-formatted money input — shows live comma formatting as you type
// e.g. typing 100000 shows 100,000 in real time
function MoneyInput({ value, onSave, className, tabNav }: {
  value: number; onSave: (v: number) => void; className?: string
  tabNav?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw]         = useState('')

  // Format a raw string with commas as the user types (no decimals while typing)
  function formatLive(str: string): string {
    const digits = str.replace(/[^0-9]/g, '')
    if (!digits) return '';
    return Number(digits).toLocaleString('en-IE')
  }

  // What to show in the box
  const displayVal = focused
    ? formatLive(raw)
    : (value ? value.toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip everything except digits — keep raw as digits only for parsing
    const digitsOnly = e.target.value.replace(/[^0-9]/g, '')
    setRaw(digitsOnly)
  }

  function handleFocus() {
    setFocused(true)
    setRaw(value ? String(Math.round(value)) : '')
  }

  function handleBlur() {
    setFocused(false)
    onSave(parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayVal}
      placeholder="0"
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={e => {
        if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() }
        else tabNav?.(e)
      }}
      className={clx('no-spin border rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary', className)}
      style={{ background: '#FFFFC7' }}
    />
  )
}

// Small integer input (weeks, qty) — keep spinners, these are small numbers
function IntInput({ value, onSave, min, max, w = 'w-14', tabNav }: {
  value: number; onSave: (v: number) => void; min?: number; max?: number; w?: string
  tabNav?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <input
      type="number"
      defaultValue={value}
      min={min} max={max}
      onBlur={e => onSave(Number(e.target.value))}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else tabNav?.(e) }}
      className={clx(w, 'border border-gray-200 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary')}
      style={{ background: '#FFFFC7' }}
    />
  )
}

export default function PrelimsClient({ items: initial, weeksElapsed, totalWeeks, projectId, revisedStart, revisedFinish }: Props) {
  const router      = useRouter()
  const [, start]   = useTransition()
  const [items, setItems]         = useState<PrelimItem[]>(initial)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [saving, setSaving]       = useState<string | null>(null)
  const [adding, setAdding]       = useState(false)
  const [newItem, setNewItem]     = useState<Partial<PrelimItem>>({
    section: 'Site Management', unit: 'Weeks', qty: 1, rate: 0,
    utilisation_pct: 100, start_week: 1, finish_week: totalWeeks,
  })
  const tableNav = useTableNav()
  const [showUpload, setShowUpload] = useState(false)

  const sections = useMemo(() => {
    const map: Record<string, PrelimItem[]> = {}
    items.forEach(item => { (map[item.section] = map[item.section] || []).push(item) })
    return map
  }, [items])

  const totals = useMemo(() => items.reduce((acc, it) => ({
    budget:    acc.budget    + it.budget,
    ctd:       acc.ctd       + it.ctd,
    committed: acc.committed + it.committed,
    amount:    acc.amount    + calcAmount(it, weeksElapsed),
    pfc:       acc.pfc       + calcPFC(it, weeksElapsed),
  }), { budget:0, ctd:0, committed:0, amount:0, pfc:0 }), [items, weeksElapsed])

  function toggleSection(s: string) {
    setCollapsed(p => { const n = new Set(Array.from(p)); n.has(s) ? n.delete(s) : n.add(s); return n })
  }

  async function saveItem(item: PrelimItem) {
    setSaving(item.id)
    await fetch(`/api/projects/${projectId}/prelims`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item),
    })
    setSaving(null)
    start(() => router.refresh())
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
      ...newItem as PrelimItem, id,
      amount: calcAmount(newItem, weeksElapsed),
      projected_final_cost: calcPFC(newItem, weeksElapsed),
      vs_budget: 0, sort_order: p.length,
    }])
    setAdding(false)
    setNewItem({ section:'Site Management', unit:'Weeks', qty:1, rate:0, utilisation_pct:100, start_week:1, finish_week:totalWeeks })
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
            <div className="text-xs px-3 py-1.5 rounded font-semibold" style={{ background: '#FFEEB9', color: '#7F4500' }}>
              Projected Final Cost: {fmt(totals.pfc)}
            </div>
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white bg-primary text-on-primary hover:bg-primary-dim rounded px-4 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors">
              <Plus size={13} /> Add Item
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="bg-primary text-on-primary hover:bg-primary-dim rounded px-4 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors flex-shrink-0 border-b border-blue-800">
        <div className="px-6 py-2.5 flex items-center gap-8">
          {[
            { label: 'Budget',                 val: fmt(totals.budget),                  col: '#ccd4ee' },
            { label: 'Cost to Date',           val: fmt(totals.ctd),                     col: '#FFB9B9' },
            { label: 'Committed',              val: fmt(totals.committed),               col: '#FFB9B9' },
            { label: 'Uncommitted Remaining',  val: fmt(totals.amount),                  col: '#DEE5B5' },
            { label: 'Projected Final Cost',   val: fmt(totals.pfc),                     col: '#FFEEB9' },
            { label: '▲ vs Budget',            val: fmt(totals.budget - totals.pfc),
              col: totals.budget - totals.pfc >= 0 ? '#DEE5B5' : '#FFB9B9' },
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
          <span className="font-semibold text-[#565e74]">{revisedStart ? new Date(revisedStart).toLocaleDateString('en-IE',{day:'2-digit',month:'short',year:'2-digit'}) : '–'}</span>
          &nbsp;→&nbsp;
          <span className="font-semibold text-[#565e74]">{revisedFinish ? new Date(revisedFinish).toLocaleDateString('en-IE',{day:'2-digit',month:'short',year:'2-digit'}) : '–'}</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full border-collapse text-xs" style={{ minWidth: 1200 }}>
          <thead className="sticky top-0 z-20">
            {/* Group row */}
            <tr>
              <th colSpan={5} style={{ background: '#565e74', color: 'white', top: 0 }}
                className="px-3 py-2 text-center text-[11px] font-bold sticky">ITEM</th>
              <th colSpan={3} style={{ background: '#8B0000', color: 'white', top: 0 }}
                className="px-3 py-2 text-center text-[11px] font-bold sticky border-l-2 border-white/20">COSTS</th>
              <th colSpan={5} style={{ background: '#2d6a1c', color: 'white', top: 0 }}
                className="px-3 py-2 text-center text-[11px] font-bold sticky border-l-2 border-white/20">RATE BUILD-UP → UNCOMMITTED</th>
              <th colSpan={3} style={{ background: '#7F4500', color: 'white', top: 0 }}
                className="px-3 py-2 text-center text-[11px] font-bold sticky border-l-2 border-white/20">PROJECTED FINAL COST</th>
              <th style={{ background: '#565e74', top: 0 }} className="px-3 py-2 sticky" />
            </tr>
            {/* Column row */}
            <tr>
              <TH bg="#4a5268" top={32}>Section</TH>
              <TH bg="#4a5268" top={32}>Cost Code</TH>
              <TH bg="#4a5268" top={32}>Description</TH>
              <TH bg="#4a5268" right top={32}>Budget</TH>
              <TH bg="#4a5268" right top={32}>Notes</TH>
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
              <TH bg="#565e74" top={32}>{""}</TH>
            </tr>
          </thead>
          <tbody>
            {/* New item row */}
            {adding && (
              <tr style={{ background: '#FFFFC7' }} className="border-b-2 border-amber-300">
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
                    style={{ background: '#FFFFC7' }}
                    onChange={e => setNewItem(p => ({...p, budget: parseFloat(e.target.value.replace(/,/g,''))||0}))} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" className="border rounded px-1.5 py-0.5 text-xs w-28 focus:outline-none"
                    onChange={e => setNewItem(p => ({...p, notes: e.target.value}))} placeholder="Notes…" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" className="no-spin border rounded px-1.5 py-0.5 text-xs w-24 text-right focus:outline-none"
                    style={{ background: '#FFFFC7' }}
                    onChange={e => setNewItem(p => ({...p, ctd: parseFloat(e.target.value.replace(/,/g,''))||0}))} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="text" className="no-spin border rounded px-1.5 py-0.5 text-xs w-24 text-right focus:outline-none"
                    style={{ background: '#FFFFC7' }}
                    onChange={e => setNewItem(p => ({...p, committed: parseFloat(e.target.value.replace(/,/g,''))||0}))} />
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">
                  {fmt((newItem.ctd||0)+(newItem.committed||0))}
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
                    style={{ background: '#FFFFC7' }}
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
                <td className="px-3 py-1.5 text-right tabular-nums font-bold" style={{ color: '#565e74' }}>{fmt(calcPFC(newItem, weeksElapsed))}</td>
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
                    <div className="flex items-center gap-2 font-bold text-[11px]" style={{ color: '#565e74' }}>
                      {isOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                      {section}
                      <span className="font-normal text-gray-500">({sItems.length})</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold" style={{ color: '#8B0000' }}>{fmt(secTot.ctd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold" style={{ color: '#8B0000' }}>{fmt(secTot.committed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold text-gray-600">{fmt(secTot.ctd+secTot.committed)}</td>
                  <td colSpan={4} />
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold" style={{ color: '#7F4500' }}>{fmt(secTot.amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold" style={{ color: '#565e74' }}>{fmt(secTot.pfc)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold"
                    style={{ color: secTot.budget-secTot.pfc >= 0 ? '#2d6a1c' : '#C00000' }}>
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
                    <tr key={item.id} className="border-b border-gray-100 group hover:bg-blue-50/20"
                      style={idx%2===1 ? { background: 'rgba(0,0,0,0.012)' } : {}}>

                      {/* Section */}
                      <td className="px-2 py-1">
                        <select value={item.section}
                          onChange={e => updAndSave(item.id, 'section', e.target.value)}
                          onKeyDown={tableNav}
                          className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none"
                          style={{ background: '#FFFFC7', minWidth: 110 }}>
                          {SECTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* Cost Code — bidirectional */}
                      <td className="px-2 py-1">
                        <CostCodeInput projectId={projectId} value={item.cost_code ?? ''} field="code"
                          onSelect={cc => updAndSave(item.id, 'cost_code', cc.code)}
                          onKeyDown={tableNav}
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs w-24 font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Code…" />
                      </td>

                      {/* Description — bidirectional */}
                      <td className="px-2 py-1">
                        <CostCodeInput projectId={projectId} value={item.description} field="description"
                          onSelect={cc => {
                            setItems(prev => prev.map(it => it.id === item.id ? { ...it, cost_code: cc.code, description: cc.description } : it))
                            saveItem({ ...item, cost_code: cc.code, description: cc.description })
                          }}
                          onKeyDown={tableNav}
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Description…" />
                      </td>

                      {/* Budget */}
                      <td className="px-2 py-1">
                        <MoneyInput value={item.budget} onSave={v => updAndSave(item.id, 'budget', v)}
                          className="w-24" tabNav={tableNav} />
                      </td>

                      {/* Notes */}
                      <td className="px-2 py-1">
                        <input defaultValue={item.notes ?? ''}
                          onBlur={e => updAndSave(item.id, 'notes', e.target.value)}
                          onKeyDown={tableNav}
                          className="border border-gray-100 rounded px-1.5 py-0.5 text-xs w-28 text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300" />
                      </td>

                      {/* CTD */}
                      <td className="px-2 py-1">
                        <MoneyInput value={item.ctd} onSave={v => updAndSave(item.id, 'ctd', v)}
                          className="w-24" tabNav={tableNav} />
                      </td>

                      {/* Committed */}
                      <td className="px-2 py-1">
                        <MoneyInput value={item.committed} onSave={v => updAndSave(item.id, 'committed', v)}
                          className="w-24" tabNav={tableNav} />
                      </td>

                      {/* Total Costs (read-only) */}
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 text-xs">
                        {(item.ctd + item.committed) ? (item.ctd + item.committed).toLocaleString('en-IE', { minimumFractionDigits: 2 }) : '–'}
                      </td>

                      {/* Util % */}
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-0.5">
                          <IntInput value={item.utilisation_pct} min={0} max={100} w="w-12"
                            onSave={v => updAndSave(item.id, 'utilisation_pct', Math.min(100, Math.max(0, v)))}
                            tabNav={tableNav} />
                          <span className="text-gray-400 text-[10px]">%</span>
                        </div>
                      </td>

                      {/* Qty */}
                      <td className="px-2 py-1">
                        <IntInput value={item.qty} min={0} w="w-14"
                          onSave={v => updAndSave(item.id, 'qty', v)} tabNav={tableNav} />
                      </td>

                      {/* Unit */}
                      <td className="px-2 py-1">
                        <select value={item.unit}
                          onChange={e => updAndSave(item.id, 'unit', e.target.value)}
                          onKeyDown={tableNav}
                          className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none"
                          style={{ background: '#FFFFC7' }}>
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>

                      {/* Rate — with breakdown pane */}
                      <td className="px-2 py-1">
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
                      <td className="px-2 py-1">
                        {isWks ? (
                          <div className="flex items-center gap-0.5 text-xs">
                            <IntInput value={item.start_week} min={1} max={totalWeeks} w="w-10"
                              onSave={v => updAndSave(item.id, 'start_week', v)} tabNav={tableNav} />
                            <span className="text-gray-400">–</span>
                            <IntInput value={item.finish_week} min={1} max={totalWeeks} w="w-10"
                              onSave={v => updAndSave(item.id, 'finish_week', v)} tabNav={tableNav} />
                            <span className="text-[10px] text-gray-400 ml-0.5 whitespace-nowrap">({rem}rem)</span>
                          </div>
                        ) : <span className="text-gray-300 text-xs px-2">–</span>}
                      </td>

                      {/* Uncommitted amount */}
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium" style={{ color: '#7F4500' }}>
                        {amount ? amount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}
                      </td>

                      {/* PFC */}
                      <td className="px-3 py-1.5 text-right tabular-nums font-bold" style={{ color: '#565e74' }}>
                        {pfc.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {saving === item.id && <span className="ml-1 text-[9px] text-gray-400 font-normal">…</span>}
                      </td>

                      {/* vs Budget */}
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium"
                        style={{ color: vsBudget === null ? '#9CA3AF' : vsBudget >= 0 ? '#2d6a1c' : '#C00000' }}>
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

            {/* Grand Total */}
            <tr className="bg-cvr-profit-lt font-bold border-t-2 border-amber-300">
              <td colSpan={5} className="px-4 py-2.5 text-xs" style={{ color: '#565e74' }}>TOTAL PRELIMINARIES</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs" style={{ color: '#8B0000' }}>
                {fmt(totals.ctd)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs" style={{ color: '#8B0000' }}>
                {fmt(totals.committed)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs text-gray-600">
                {fmt(totals.ctd + totals.committed)}
              </td>
              <td colSpan={4} />
              <td className="px-3 py-2.5 text-right tabular-nums text-xs" style={{ color: '#7F4500' }}>{fmt(totals.amount)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs" style={{ color: '#565e74' }}>{fmt(totals.pfc)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-xs"
                style={{ color: totals.budget - totals.pfc >= 0 ? '#2d6a1c' : '#C00000' }}>
                {totals.budget ? fmt(totals.budget - totals.pfc) : '–'}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex-shrink-0 bg-white border-t px-6 py-2 flex items-center gap-6 text-[10px] text-gray-400">
        <span>Click a cell to edit · Tab/↑↓←→ to navigate · Enter to move down</span>
        <span>Uncommitted = Qty × Rate × Remaining Weeks × Util%&nbsp;&nbsp;|&nbsp;&nbsp;Proj Final Cost = CTD + Committed + Uncommitted</span>
      </div>
    </div>
  )
}
