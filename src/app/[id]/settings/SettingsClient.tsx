'use client'
import MoneyInput from '@/components/MoneyInput'
import { useState, useTransition, useEffect } from 'react'
import { fmt, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { Save, Lock, Plus } from 'lucide-react'


// ── Global Settings (Elements, Trades) ────────────────────────────────────
function GlobalList({ title, endpoint, colour }: { title: string; endpoint: string; colour: string }) {
  const [items, setItems]   = useState<{ id: string; name: string }[]>([])
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    fetch(endpoint).then(r => r.json()).then(setItems)
  }, [endpoint])

  async function add() {
    if (!newName.trim()) return
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) })
    const { id } = await res.json()
    setItems(p => [...p, { id, name: newName.trim() }])
    setNewName('')
  }

  async function save(id: string) {
    await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: editName.trim() }) })
    setItems(p => p.map(i => i.id === id ? { ...i, name: editName.trim() } : i))
    setEditing(null)
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    await fetch(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setItems(p => p.filter(i => i.id !== id))
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
      <div className="px-5 py-3 font-bold text-sm" style={{ background: colour, color: 'white' }}>{title}</div>
      <div className="p-4">
        <div className="flex gap-2 mb-3">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder={`Add new ${title.toLowerCase()} name…`}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={add} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5 bg-primary text-on-primary hover:bg-primary-dim rounded px-4 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors">
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 bg-surface-container-low rounded-lg px-3 py-2 group">
              {editing === item.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') save(item.id) }}
                    autoFocus className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={() => save(item.id)} className="text-xs px-2 py-1 rounded text-white bg-primary text-on-primary hover:bg-primary-dim rounded px-4 py-1.5 text-xs font-bold uppercase tracking-tight transition-colors">Save</button>
                  <button onClick={() => setEditing(null)} className="text-xs px-2 py-1 rounded bg-gray-200">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-on-surface">{item.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(item.id); setEditName(item.name) }}
                      className="text-xs text-blue-500 hover:underline">Edit</button>
                    <button onClick={() => del(item.id, item.name)}
                      className="text-xs text-red-400 hover:underline">Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-on-surface-variant text-center py-4">No items yet</p>}
        </div>
        <p className="text-xs text-on-surface-variant mt-2">These are shared across all projects and appear in breakdown pane dropdowns.</p>
      </div>
    </div>
  )
}

function TradeBudgets({ projectId }: { projectId: string }) {
  const [trades, setTrades]   = useState<any[]>([])
  const [saving, setSaving]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/trades`).then(r => r.json()).then(setTrades)
  }, [projectId])

  async function save(tradeId: string, patch: Record<string, any>) {
    setSaving(tradeId)
    const t = trades.find(x => x.id === tradeId)
    if (!t) return
    await fetch(`/api/projects/${projectId}/trades`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId,
        valueCertified:  Number(t.value_certified) || 0,
        varsNotAgreed:   Number(t.vars_not_agreed)  || 0,
        adjustments:     Number(t.adjustments)      || 0,
        budget:          Number(patch.budget          ?? t.budget)          || 0,
        forecastMethod:  patch.forecastMethod        ?? t.forecast_method   ?? 'budget_remaining',
        forecastHardKey: patch.forecastHardKey !== undefined ? patch.forecastHardKey : t.forecast_hard_key,
      }),
    })
    setTrades(prev => prev.map(x => x.id === tradeId ? { ...x, ...patch } : x))
    setSaving(null)
  }

  const METHODS = [
    { value: 'budget_remaining', label: 'Budget Remaining' },
    { value: 'forecast_sheet',   label: 'Forecast Sheet'   },
    { value: 'hard_key',         label: 'Hard Key'         },
    { value: 'prelims',          label: 'Prelims Calc'     },
  ]

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          {['Trade', 'Budget (€)', 'Forecast Method', 'Hard Key EFC (€)', ''].map((h, i) => (
            <th key={i} className="px-4 py-2 text-left text-xs font-bold text-white" style={{ background: '#565e74' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {trades.map((t, i) => (
          <tr key={t.id} className="border-b border-outline-variant/10" style={i % 2 ? { background: '#F9FAFB' } : {}}>
            <td className="px-4 py-2 font-semibold text-sm">{t.name}</td>
            <td className="px-3 py-1.5">
              <MoneyInput value={Number(t.budget) || 0}
                onSave={v => save(t.id, { budget: v })}
                className="w-36 border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            </td>
            <td className="px-3 py-1.5">
              <select value={t.forecast_method || 'budget_remaining'}
                onChange={e => save(t.id, { forecast_method: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {METHODS.filter(m => m.value !== 'prelims' || t.name === 'Preliminaries').map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </td>
            <td className="px-3 py-1.5">
              {t.forecast_method === 'hard_key' && (
                <MoneyInput value={Number(t.forecast_hard_key) || 0}
                  onSave={v => save(t.id, { forecast_hard_key: v })}
                  className="w-36 border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
              )}
            </td>
            <td className="px-3 py-2 text-xs text-on-surface-variant">{saving === t.id ? 'Saving…' : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
import { useRouter } from 'next/navigation'

export default function SettingsClient({ project: p, trades, projectId }: { project: any; trades: any[]; projectId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [locking, setLocking] = useState(false)

  const [form, setForm] = useState({
    name:          p?.name           || '',
    code:          p?.code           || '',
    client:        p?.client         || '',
    contractType:  p?.contract_type  || '',
    preparedBy:    p?.prepared_by    || '',
    contractSum:   Number(p?.contract_sum)   || 0,
    approvedVars:  Number(p?.approved_vars)  || 0,
    originalBudget:Number(p?.original_budget)|| 0,
    originalMargin:Number(p?.original_margin)|| 0,
    contractStart: p?.contract_start  ? p.contract_start.slice(0,10) : '',
    contractFinish:p?.contract_finish ? p.contract_finish.slice(0,10) : '',
    revisedStart:  p?.revised_start   ? p.revised_start.slice(0,10)  : '',
    revisedFinish: p?.revised_finish  ? p.revised_finish.slice(0,10) : '',
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))

  async function save() {
    setSaving(true)
    await fetch(`/api/projects/${projectId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    startTransition(() => router.refresh())
  }

  async function lockPeriod() {
    if (!confirm('Lock this period and save snapshot? This will set previous period values for movement tracking.')) return
    setLocking(true)
    await fetch(`/api/projects/${projectId}/periods/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setLocking(false)
    startTransition(() => router.refresh())
  }

  function Field({ label, field, type = 'text', wide = false }: {
    label: string; field: keyof typeof form; type?: string; wide?: boolean
  }) {
    if (type === 'number') {
      return (
        <div className={wide ? 'col-span-2' : ''}>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">{label}</label>
          <MoneyInput
            value={Number(form[field]) || 0}
            onSave={v => setForm(p => ({ ...p, [field]: v }))}
            className="w-full border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )
    }
    return (
      <div className={wide ? 'col-span-2' : ''}>
        <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">{label}</label>
        <input
          key={field}
          type={type}
          defaultValue={form[field] as string}
          onBlur={set(field)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        />
      </div>
    )
  }

  const adjustedSum = form.contractSum + form.approvedVars

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Project Settings"
        subtitle="Control sheet — all values feed the workbook"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={lockPeriod} disabled={locking}
              className="border border-[#FFC000] text-[#7F4500] px-4 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#FFF2CC] disabled:opacity-50">
              <Lock size={14} /> {locking ? 'Locking…' : 'Lock Period'}
            </button>
            <button onClick={save} disabled={saving}
              className="bg-primary text-white px-4 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#1A3A7A] disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-3xl space-y-8">

          {/* Project Info */}
          <div className="bg-white rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="bg-[#17375E] px-5 py-3 text-white font-bold text-sm">PROJECT INFORMATION</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <Field label="Project Name"   field="name"   wide />
              <Field label="Project Code"   field="code" />
              <Field label="Client"         field="client" />
              <Field label="Contract Type"  field="contractType" />
              <Field label="Prepared By"    field="preparedBy" />
            </div>
          </div>

          {/* Contract Financials */}
          <div className="bg-white rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="bg-[#17375E] px-5 py-3 text-white font-bold text-sm">CONTRACT FINANCIALS</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <Field label="Original Contract Sum (€)"   field="contractSum"    type="number" />
              <Field label="Approved Variations (€)"     field="approvedVars"   type="number" />
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Adjusted Contract Sum</label>
                <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-[#F1F4E0] font-bold text-primary tabular-nums">
                  {fmt(adjustedSum)}
                </div>
              </div>
              <Field label="Original Budget Cost (€)"    field="originalBudget" type="number" />
              <Field label="Original Margin (€)"         field="originalMargin" type="number" />
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Original Margin %</label>
                <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-surface-container-low text-on-surface-variant tabular-nums">
                  {adjustedSum ? (form.originalMargin / adjustedSum * 100).toFixed(1) + '%' : '–'}
                </div>
              </div>
            </div>
          </div>

          {/* Programme Dates */}
          <div className="bg-white rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="bg-[#17375E] px-5 py-3 text-white font-bold text-sm">PROGRAMME DATES</div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <Field label="Original Contract Start"   field="contractStart"  type="date" />
              <Field label="Original Contract Finish"  field="contractFinish" type="date" />
              <Field label="Revised Start (Actual)"    field="revisedStart"   type="date" />
              <Field label="Revised Finish (with EoT)" field="revisedFinish"  type="date" />
            </div>
          </div>

          {/* Trades */}
          <div className="bg-white rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="bg-[#1A3A7A] px-5 py-3 text-white font-bold text-sm">TRADES / ELEMENTS</div>
            <div className="p-5">
              <p className="text-xs text-on-surface-variant mb-3">Trade names are used as the primary grouping key. They must match the 'trade' field on Cost Codes exactly.</p>
              <div className="space-y-2">
                {trades.map(t => (
                  <div key={t.id} className="flex items-center gap-3 bg-surface-container-low rounded-lg px-3 py-2">
                    <span className="text-xs font-mono text-on-surface-variant w-6">{t.sort_order}</span>
                    <span className="font-medium text-sm text-gray-800 flex-1">{t.name}</span>
                    <span className="text-xs text-on-surface-variant font-mono">{t.code_prefix}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant mt-3">To modify trade names, edit via Cost Codes page. Set budgets below.</p>
            </div>
          </div>

          {/* Trade Budgets */}
          <div className="bg-white rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="px-5 py-3 font-bold text-sm bg-tertiary-container text-on-tertiary-container px-5 py-3 font-black text-xs uppercase tracking-widest">TRADE BUDGETS &amp; FORECAST METHOD</div>
            <div className="p-5">
              <p className="text-xs text-on-surface-variant mb-3">Set the budget for each trade. This drives the <strong>Budget Remaining</strong> EFC calculation on CVR Trade (EFC = CTD + Committed + max(0, Budget − CTD − Committed)).</p>
              <TradeBudgets projectId={projectId} />
            </div>
          </div>

          {/* Global Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="px-5 py-3 font-bold text-sm bg-primary text-on-primary px-5 py-3 font-black text-xs uppercase tracking-widest">GLOBAL SETTINGS — Elements, Trades & Cost Codes</div>
            <div className="p-5">
              <p className="text-xs text-on-surface-variant mb-4">These lists are shared across all projects. They populate the dropdown options in the Rate/Quantity Breakdown pane.</p>
              <div className="grid grid-cols-2 gap-4">
                <GlobalList title="Elements" endpoint="/api/global/elements" colour="#2d6a1c" />
                <GlobalList title="Trades / Disciplines" endpoint="/api/global/trades" colour="#565e74" />
              </div>
            </div>
          </div>

          {/* Lock Period instructions */}
          <div className="bg-[#FFF2CC] border border-[#FFC000] rounded-xl p-5">
            <div className="font-bold text-[#7F4500] text-sm mb-2 flex items-center gap-2">
              <Lock size={14} /> End of Month — Lock Period Procedure
            </div>
            <ol className="text-xs text-[#7F4500] space-y-1.5 list-decimal list-inside">
              <li>Update Cost to Date, Committed and Forecast with final month figures</li>
              <li>Update the Value sheet with latest application and certificate amounts</li>
              <li>Review the CVR Dashboard and Checks page — resolve all ✖ issues</li>
              <li>Click <strong>Lock Period</strong> above — this saves a snapshot of current P/L, EFC and KPIs as "Previous Period" data</li>
              <li>The movement columns on the Dashboard and CVR Trade will now show changes vs the locked snapshot</li>
            </ol>
          </div>

        </div>
      </div>
    </div>
  )
}
