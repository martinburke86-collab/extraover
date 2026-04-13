'use client'
import { useState, useTransition } from 'react'
import { fmt, pct, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import type { DashboardKPIs } from '@/lib/calculations'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer
} from 'recharts'
import { useRouter } from 'next/navigation'
import { Save, Plus, Trash2 } from 'lucide-react'

type Row = {
  id: string; month_label: string; month_date: string; sort_order: number
  cumul_claimed: number; cumul_certified: number; cumul_cost: number
}
interface Props { rows: Row[]; kpis: DashboardKPIs; projectId: string }

function fmtM(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}k`
  return `€${n}`
}

export default function SCurveClient({ rows: initialRows, kpis, projectId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [rows, setRows] = useState<(Row & { _dirty?: boolean })[]>(initialRows)
  const [saving, setSaving] = useState(false)

  // Derive monthly deltas for the table
  const tableData = rows.map((r, i) => {
    const prev = rows[i - 1]
    return {
      ...r,
      monthly_claimed:    r.cumul_claimed    - (prev?.cumul_claimed    || 0),
      monthly_certified:  r.cumul_certified  - (prev?.cumul_certified  || 0),
      monthly_cost:       r.cumul_cost       - (prev?.cumul_cost       || 0),
      pct_efc: kpis.efc ? r.cumul_cost / kpis.efc : 0,
    }
  })

  // Chart data
  const chartData = tableData.map(r => ({
    month:    r.month_label,
    Claimed:  r.cumul_claimed,
    Certified:r.cumul_certified,
    Cost:     r.cumul_cost,
  }))

  function updateCell(idx: number, field: keyof Row, value: number) {
    setRows(prev => prev.map((r, i) =>
      i === idx ? { ...r, [field]: value, _dirty: true } : r
    ))
  }

  function addRow() {
    const lastRow = rows[rows.length - 1]
    const newRow: Row & { _dirty?: boolean } = {
      id:              '',
      month_label:     '',
      month_date:      new Date().toISOString().slice(0, 10),
      sort_order:      rows.length,
      cumul_claimed:   lastRow?.cumul_claimed    || 0,
      cumul_certified: lastRow?.cumul_certified  || 0,
      cumul_cost:      lastRow?.cumul_cost        || 0,
      _dirty: true,
    }
    setRows(prev => [...prev, newRow])
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  async function saveAll() {
    setSaving(true)
    // Delete all existing rows and re-insert
    await fetch(`/api/projects/${projectId}/s-curve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: rows.filter(r => r.month_label) }),
    })
    setSaving(false)
    startTransition(() => router.refresh())
  }

  const latestRow = tableData[tableData.length - 1]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="S-Curve & Monthly Cash Flow"
        subtitle="Cumulative Claimed · Certified · Cost to Date"
        actions={
          <button onClick={saveAll} disabled={saving}
            className="bg-[#565e74] text-white px-4 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#1A3A7A] disabled:opacity-50">
            <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        }
      />

      {/* Summary bar */}
      <div className="bg-[#17375E] px-6 py-3 flex items-center gap-8 flex-shrink-0">
        {[
          { label: 'Contract Sum',       val: fmt(kpis.contractSum + kpis.approvedVars) },
          { label: 'EFC',                val: fmt(kpis.efc) },
          { label: 'Cumul Claimed',      val: fmt(latestRow?.cumul_claimed || 0) },
          { label: 'Cumul Certified',    val: fmt(latestRow?.cumul_certified || 0) },
          { label: 'Cumul Cost T/D',     val: fmt(latestRow?.cumul_cost || 0) },
          { label: '% of EFC',           val: pct(latestRow?.pct_efc || 0) },
        ].map(({ label, val }) => (
          <div key={label} className="text-white flex-shrink-0">
            <div className="text-xs opacity-60 uppercase tracking-wide">{label}</div>
            <div className="text-base font-bold tabular-nums">{val}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* Chart */}
        <div className="bg-white border-b px-6 py-4" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={fmtM}
                tick={{ fontSize: 11 }}
                domain={[0, Math.max(kpis.contractSum + kpis.approvedVars, (latestRow?.cumul_claimed || 0) * 1.1)]}
              />
              <Tooltip
                formatter={(value: number, name: string) => [fmt(value), name]}
                contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                y={kpis.contractSum + kpis.approvedVars}
                stroke="#17375E" strokeDasharray="6 3"
                label={{ value: 'Contract Sum', position: 'right', fontSize: 10, fill: '#17375E' }}
              />
              <ReferenceLine
                y={kpis.efc}
                stroke="#565e74" strokeDasharray="4 4"
                label={{ value: 'EFC', position: 'right', fontSize: 10, fill: '#565e74' }}
              />
              <Line type="monotone" dataKey="Claimed"   stroke="#2196F3" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Certified" stroke="#4CAF50" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Cost"      stroke="#C00000" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Data table */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Monthly Data</h3>
            <button onClick={addRow}
              className="text-[#565e74] border border-[#565e74] px-3 py-1 rounded text-xs flex items-center gap-1 hover:bg-[#F1F4E0]">
              <Plus size={12} /> Add Month
            </button>
          </div>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {['Month','Cumul Claimed','Monthly Claim','Cumul Certified','Monthly Cert',
                  'Cumul Cost T/D','Monthly Cost','% of EFC',''].map((h, i) => (
                  <th key={i} className={clx(
                    'px-3 py-2 text-xs font-bold text-white bg-[#17375E] whitespace-nowrap',
                    i === 0 ? 'text-left' : i === 8 ? 'text-center w-10' : 'text-right'
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((r, idx) => (
                <tr key={r.id || idx} className={clx(
                  'border-b border-gray-100',
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40',
                  idx === tableData.length - 1 ? 'bg-[#FFF2CC]' : ''
                )}>
                  <td className="px-2 py-1.5">
                    <input
                      value={r.month_label}
                      onChange={e => updateCell(idx, 'month_label', e.target.value as any)}
                      className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-[#FFFFC7] focus:outline-none focus:ring-1 focus:ring-[#17375E]"
                    />
                  </td>
                  {(['cumul_claimed','monthly_claimed','cumul_certified','monthly_certified','cumul_cost','monthly_cost'] as const).map((field, fi) => {
                    const val = (r as any)[field]
                    const isCalc = field.startsWith('monthly_')
                    const isSource = field.startsWith('cumul_')
                    return (
                      <td key={field} className="px-2 py-1.5">
                        {isSource ? (
                          <input
                            type="number"
                            value={val}
                            onChange={e => updateCell(idx, field as keyof Row, Number(e.target.value))}
                            className="w-28 border border-gray-300 rounded px-1.5 py-0.5 text-xs text-right bg-[#FFFFC7] focus:outline-none focus:ring-1 focus:ring-[#17375E] tabular-nums"
                          />
                        ) : (
                          <span className={clx('tabular-nums text-right block', val < 0 ? 'text-red-500' : 'text-gray-500')}>
                            {fmt(val)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">
                    {pct(r.pct_efc)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => removeRow(idx)} className="text-red-300 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-gray-400 mt-3">
            Yellow cells are editable inputs. Monthly columns calculate automatically from the cumulative figures.
            Hit "Save Changes" to persist.
          </p>
        </div>
      </div>
    </div>
  )
}
