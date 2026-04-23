'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, X, Check, Calculator, ChevronRight } from 'lucide-react'
import { clx } from '@/lib/utils'
import { useTableNav } from '@/lib/tableUtils'

export interface BreakdownRow {
  id: string
  description: string | null
  qty: number
  unit: string
  rate: number
  amount: number
  cost_code: string | null
  trade: string | null
  element: string | null
  notes: string | null
}

interface Props {
  projectId:   string
  parentId:    string
  parentType:  'forecast' | 'committed' | 'prelim' | 'ctd'
  parentField: 'qty' | 'rate' | 'total'
  parentLabel: string           // e.g. "HV Cable Supply & Install — Total"
  currentValue: number
  onClose: () => void
  onApply: (total: number) => void
}

const UNITS = ['nr','m','m²','m³','t','kg','hr','day','Wk','Item','LS','%']

export default function BreakdownPane({
  projectId, parentId, parentType, parentField,
  parentLabel, currentValue, onClose, onApply,
}: Props) {
  const [rows, setRows]         = useState<BreakdownRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [globalTrades, setGT]   = useState<string[]>([])
  const [globalElements, setGE] = useState<string[]>([])
  const [costCodes, setCC]      = useState<{ code: string; description: string }[]>([])
  const [saving, setSaving]     = useState<string | null>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const tableNav = useTableNav()

  const total = rows.reduce((s, r) => s + r.amount, 0)

  // Load everything on open
  useEffect(() => {
    async function load() {
      setLoading(true)
      const [bdRes, gtRes, geRes, ccRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/breakdowns?parentId=${parentId}&parentType=${parentType}&parentField=${parentField}`).then(r => r.json()),
        fetch('/api/global/trades').then(r => r.json()),
        fetch('/api/global/elements').then(r => r.json()),
        fetch(`/api/projects/${projectId}/cost-codes`).then(r => r.json()),
      ])
      setGT(gtRes.map((r: any) => r.name))
      setGE(geRes.map((r: any) => r.name))
      setCC(ccRes.map((r: any) => ({ code: r.code, description: r.description })))

      let existingRows: BreakdownRow[] = bdRes.rows || []

      // Auto-seed 3 blank rows if pane is empty
      if (existingRows.length === 0) {
        const newRows: BreakdownRow[] = []
        for (let i = 0; i < 3; i++) {
          const res = await fetch(`/api/projects/${projectId}/breakdowns`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId, parentType, parentField, qty: 1, rate: 0, unit: 'nr' }),
          })
          const { id } = await res.json()
          newRows.push({ id, description: '', qty: 1, unit: 'nr', rate: 0, amount: 0, cost_code: null, trade: null, element: null, notes: null })
        }
        existingRows = newRows
      }

      setRows(existingRows)
      setLoading(false)
    }
    load()
  }, [projectId, parentId, parentType, parentField])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function addRow() {
    const res = await fetch(`/api/projects/${projectId}/breakdowns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, parentType, parentField, qty: 1, rate: 0, unit: 'nr' }),
    })
    const { id } = await res.json()
    setRows(p => [...p, { id, description: '', qty: 1, unit: 'nr', rate: 0, amount: 0, cost_code: null, trade: null, element: null, notes: null }])
  }

  async function updateRow(id: string, patch: Partial<BreakdownRow>) {
    const current = rows.find(r => r.id === id)
    if (!current) return
    const updated = { ...current, ...patch }
    updated.amount = (Number(updated.qty) || 0) * (Number(updated.rate) || 0)
    setRows(p => p.map(r => r.id === id ? updated : r))
    setSaving(id)
    await fetch(`/api/projects/${projectId}/breakdowns`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updated }),
    })
    setSaving(null)
  }

  async function deleteRow(id: string) {
    await fetch(`/api/projects/${projectId}/breakdowns`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setRows(p => p.filter(r => r.id !== id))
  }

  function fmtN(n: number) {
    return n === 0 ? '–' : n.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function Cell({ children, right, bold, muted, bg }: {
    children: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean; bg?: string
  }) {
    return (
      <td className={clx('px-2 py-1.5 text-xs border-b border-gray-100 whitespace-nowrap',
        right ? 'text-right tabular-nums' : '',
        bold ? 'font-bold' : '',
        muted ? 'text-gray-400' : '')}
        style={bg ? { background: bg } : {}}>
        {children}
      </td>
    )
  }

  function Inp({ row, field, type = 'text', w = 'w-full', options }: {
    row: BreakdownRow; field: keyof BreakdownRow; type?: string; w?: string; options?: string[]
  }) {
    const val = row[field]
    if (options) return (
      <select defaultValue={String(val ?? '')}
        onBlur={e => updateRow(row.id, { [field]: e.target.value } as any)}
        onKeyDown={e => tableNav(e as any)}
        className={clx(w, 'border-0 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-[#565e74] rounded px-1')}
        style={{ background: '#FFFFC7' }}>
        <option value="">–</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    )
    return (
      <input type={type}
        defaultValue={type === 'number' ? (Number(val) || '') as any : String(val ?? '')}
        onBlur={e => {
          const v = type === 'number' ? Number(e.target.value) : e.target.value
          updateRow(row.id, { [field]: v } as any)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          tableNav(e as any)
        }}
        className={clx(w, 'no-spin border-0 bg-transparent text-xs focus:outline-none focus:bg-[#FFFFC7] focus:ring-1 focus:ring-[#565e74] rounded px-1',
          type === 'number' ? 'text-right' : '')}
      />
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Pane — slides in from the right */}
      <div ref={paneRef}
        className="fixed top-0 right-0 h-full z-50 flex flex-col shadow-2xl bg-surface-container-lowest"
        style={{ width: 'min(900px, 90vw)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0 bg-primary">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Calculator size={16} />
              Rate / Quantity Breakdown
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: '#ccd4ee' }}>
              {parentLabel} · {parentField.toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide" style={{ color: '#ccd4ee' }}>Built-up Total</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: total > 0 ? '#DEE5B5' : '#ccd4ee' }}>
                {total > 0 ? total.toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }) : '–'}
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white ml-2"><X size={18} /></button>
          </div>
        </div>

        {/* Comparison bar */}
        <div className="px-5 py-2 flex items-center gap-6 text-xs border-b flex-shrink-0" style={{ background: '#F8F9FA' }}>
          <div>
            <span className="text-gray-500">Current cell value:</span>{' '}
            <span className="font-bold tabular-nums">{currentValue.toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}</span>
          </div>
          <ChevronRight size={14} className="text-gray-400" />
          <div>
            <span className="text-gray-500">Built-up total:</span>{' '}
            <span className="font-bold tabular-nums" style={{ color: total !== currentValue ? '#C00000' : '#456919' }}>
              {total.toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}
            </span>
            {total !== currentValue && total > 0 && (
              <span className="ml-2 text-gray-400">
                (Δ {(total - currentValue).toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })})
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
          ) : (
            <table className="w-full border-collapse text-xs" style={{ minWidth: 820 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {[
                    ['Description', '220px', '#565e74'],
                    ['Cost Code',   '90px',  '#4a5268'],
                    ['Trade',       '100px', '#4a5268'],
                    ['Element',     '100px', '#4a5268'],
                    ['Qty',         '60px',  '#2d6a1c'],
                    ['Unit',        '60px',  '#2d6a1c'],
                    ['Rate (€)',    '100px', '#2d6a1c'],
                    ['Amount (€)',  '110px', '#7F4500'],
                    ['Notes',       '120px', '#4B5563'],
                    ['',            '36px',  '#565e74'],
                  ].map(([h, w, bg], i) => (
                    <th key={i} style={{ background: bg as string, minWidth: w as string }}
                      className={clx('px-2 py-2.5 text-white font-bold whitespace-nowrap sticky top-0',
                        i >= 4 && i <= 6 ? 'text-right' : i === 7 ? 'text-right' : 'text-left')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className={clx('group hover:bg-blue-50/30 transition-colors', idx % 2 === 1 ? 'bg-gray-50/40' : '')}>
                    <td className="px-1 py-1 border-b border-gray-100">
                      <Inp row={row} field="description" />
                    </td>
                    <td className="px-1 py-1 border-b border-gray-100">
                      <select defaultValue={row.cost_code ?? ''}
                        onBlur={e => updateRow(row.id, { cost_code: e.target.value || null })}
                        className="w-full border-0 bg-transparent text-xs focus:outline-none focus:bg-[#FFFFC7] rounded px-1">
                        <option value="">–</option>
                        {costCodes.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1 border-b border-gray-100">
                      <Inp row={row} field="trade" options={globalTrades} w="w-full" />
                    </td>
                    <td className="px-1 py-1 border-b border-gray-100">
                      <Inp row={row} field="element" options={globalElements} w="w-full" />
                    </td>
                    <td className="px-1 py-1 border-b border-gray-100 text-right">
                      <Inp row={row} field="qty" type="number" w="w-14" />
                    </td>
                    <td className="px-1 py-1 border-b border-gray-100">
                      <Inp row={row} field="unit" options={UNITS} w="w-14" />
                    </td>
                    <td className="px-1 py-1 border-b border-gray-100 text-right">
                      <Inp row={row} field="rate" type="number" w="w-24" />
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-100 text-right tabular-nums font-semibold"
                      style={{ color: row.amount > 0 ? '#565e74' : '#9CA3AF', background: '#F1F4E0' }}>
                      {fmtN(row.amount)}
                      {saving === row.id && <span className="ml-1 text-[9px] text-gray-400 font-normal">…</span>}
                    </td>
                    <td className="px-1 py-1 border-b border-gray-100">
                      <Inp row={row} field="notes" />
                    </td>
                    <td className="px-1 py-1 border-b border-gray-100 text-center">
                      <button onClick={() => deleteRow(row.id)}
                        className="text-red-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Add row */}
                <tr>
                  <td colSpan={10} className="px-3 py-2">
                    <button onClick={addRow}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border border-dashed border-gray-300 text-gray-500 hover:border-[#565e74] hover:text-[#565e74] transition-colors">
                      <Plus size={12} /> Add row
                    </button>
                  </td>
                </tr>
              </tbody>

              {/* Total row */}
              {rows.length > 0 && (
                <tfoot className="sticky bottom-0">
                  <tr style={{ background: '#FFEEB9' }} className="border-t-2 border-amber-300">
                    <td colSpan={7} className="px-3 py-2.5 text-xs font-bold" style={{ color: '#565e74' }}>
                      TOTAL ({rows.length} row{rows.length !== 1 ? 's' : ''})
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-bold text-sm" style={{ color: '#565e74' }}>
                      {total.toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t flex-shrink-0" style={{ background: '#F8F9FA' }}>
          <div className="text-xs text-gray-500">
            {rows.length > 0
              ? `${rows.length} rows · Total will replace the current cell value`
              : 'No rows — the current hard-keyed value will be kept'}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded text-sm text-gray-600 border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
            {rows.length > 0 && (
              <button onClick={() => { onApply(total); onClose() }}
                className="px-5 py-2 rounded text-sm font-semibold text-white flex items-center gap-2 bg-primary hover:bg-primary-dim transition-colors">
                <Check size={14} />
                Apply {total.toLocaleString('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} to cell
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
