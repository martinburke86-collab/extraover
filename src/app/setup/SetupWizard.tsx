'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

// ── BCIS SFCA 4th Edition elements ───────────────────────────────────────────
const SECTIONS = [
  {
    label: 'Substructure',
    elements: [
      { name: 'Substructure', code: '1' },
    ],
  },
  {
    label: 'Superstructure',
    elements: [
      { name: 'Frame',                        code: '2.1' },
      { name: 'Upper Floors',                 code: '2.2' },
      { name: 'Roof',                         code: '2.3' },
      { name: 'Stairs & Ramps',               code: '2.4' },
      { name: 'External Walls',               code: '2.5' },
      { name: 'Windows & External Doors',     code: '2.6' },
      { name: 'Internal Walls & Partitions',  code: '2.7' },
      { name: 'Internal Doors',               code: '2.8' },
    ],
  },
  {
    label: 'Internal Finishes',
    elements: [
      { name: 'Wall Finishes',    code: '3.1' },
      { name: 'Floor Finishes',   code: '3.2' },
      { name: 'Ceiling Finishes', code: '3.3' },
    ],
  },
  {
    label: 'Fittings, Furnishings & Equipment',
    elements: [
      { name: 'Fittings, Furnishings & Equipment', code: '4' },
    ],
  },
  {
    label: 'Services',
    elements: [
      { name: 'Sanitary Installations',            code: '5.1'  },
      { name: 'Disposal Installations',            code: '5.3'  },
      { name: 'Water Installations',               code: '5.4'  },
      { name: 'Heat Source',                       code: '5.5'  },
      { name: 'Space Heating & Air Treatment',     code: '5.6'  },
      { name: 'Ventilation',                       code: '5.7'  },
      { name: 'Electrical Installations',          code: '5.8'  },
      { name: 'Fuel Installations',                code: '5.9'  },
      { name: 'Lift & Conveyor Installations',     code: '5.10' },
      { name: 'Fire & Lightning Protection',       code: '5.11' },
      { name: 'Communication, Security & Control', code: '5.12' },
      { name: 'Specialist Installations',          code: '5.13' },
      { name: "Builder's Work in Connection",      code: '5.14' },
    ],
  },
  {
    label: 'External Works',
    elements: [
      { name: 'Site Preparation Works',      code: '8.1' },
      { name: 'Roads, Paths & Pavings',      code: '8.2' },
      { name: 'Soft Landscaping & Planting', code: '8.3' },
      { name: 'Fencing, Railings & Walls',   code: '8.4' },
      { name: 'External Drainage',           code: '8.6' },
      { name: 'External Services',           code: '8.7' },
    ],
  },
  {
    label: 'Project Costs',
    elements: [
      { name: 'Preliminaries',           code: 'A' },
      { name: "Main Contractor's OHP",   code: 'B' },
      { name: 'Contingencies',           code: 'C' },
    ],
  },
]

const ALL_ELEMENTS = SECTIONS.flatMap(s => s.elements)

// Default: all selected except Fuel Installations and Specialist Installations
const DEFAULT_SELECTED = new Set(
  ALL_ELEMENTS.map(e => e.name).filter(n => !['Fuel Installations','Specialist Installations'].includes(n))
)

function fmt(n: number) {
  if (!n) return '—'
  return '€' + Math.round(n).toLocaleString('en-IE')
}
function parseMoney(s: string) {
  return Number(s.replace(/[€,\s]/g, '')) || 0
}

// ── Step components ───────────────────────────────────────────────────────────

function StepDetails({ data, set }: { data: any; set: (k: string, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project name *">
          <input value={data.name} onChange={e => set('name', e.target.value)}
            placeholder="City Centre Office Block"
            className="w-full border border-outline-variant/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </Field>
        <Field label="Project code *">
          <input value={data.code} onChange={e => set('code', e.target.value)}
            placeholder="PRJ-2024-01"
            className="w-full border border-outline-variant/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </Field>
      </div>
      <Field label="Client">
        <input value={data.client} onChange={e => set('client', e.target.value)}
          placeholder="Dublin City Council"
          className="w-full border border-outline-variant/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Contract type">
          <input value={data.contractType} onChange={e => set('contractType', e.target.value)}
            placeholder="Design & Build (RIAI)"
            className="w-full border border-outline-variant/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </Field>
        <Field label="Prepared by">
          <input value={data.preparedBy} onChange={e => set('preparedBy', e.target.value)}
            placeholder="M. Burke QS"
            className="w-full border border-outline-variant/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </Field>
        <Field label="Report period">
          <input value={data.reportPeriod} onChange={e => set('reportPeriod', e.target.value)}
            placeholder="April 2026"
            className="w-full border border-outline-variant/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </Field>
      </div>
    </div>
  )
}

function StepContract({ data, set }: { data: any; set: (k: string, v: string) => void }) {
  return (
    <div className="space-y-4">
      {/* GIFA highlight */}
      <div className="flex items-center gap-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-blue-700" style={{ fontSize: 18 }}>square_foot</span>
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold text-blue-800 uppercase tracking-wide">Gross Internal Floor Area (GIFA)</div>
          <div className="text-xs text-blue-600">Used to calculate cost per m² across all elements</div>
        </div>
        <div className="relative">
          <input value={data.gifa} onChange={e => set('gifa', e.target.value)}
            placeholder="4,250"
            className="w-32 border border-blue-200 rounded px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 pointer-events-none">m²</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Contract sum">
          <MoneyInput value={data.contractSum} onChange={v => set('contractSum', v)} placeholder="12,500,000" />
        </Field>
        <Field label="Original budget">
          <MoneyInput value={data.originalBudget} onChange={v => set('originalBudget', v)} placeholder="11,800,000" />
        </Field>
        <Field label="Approved variations">
          <MoneyInput value={data.approvedVars} onChange={v => set('approvedVars', v)} placeholder="0" />
        </Field>
        <Field label="Target margin">
          <MoneyInput value={data.originalMargin} onChange={v => set('originalMargin', v)} placeholder="700,000" />
        </Field>
        <Field label="Start on site">
          <input type="date" value={data.startDate} onChange={e => set('startDate', e.target.value)}
            className="w-full border border-outline-variant/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </Field>
        <Field label="Completion date">
          <input type="date" value={data.finishDate} onChange={e => set('finishDate', e.target.value)}
            className="w-full border border-outline-variant/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </Field>
      </div>
      <p className="text-xs text-on-surface-variant">Margin = Contract Sum − Original Budget. All figures can be updated in Settings.</p>
    </div>
  )
}

function StepElements({ selected, toggle, toggleAll }: {
  selected: Set<string>
  toggle: (name: string) => void
  toggleAll: (on: boolean) => void
}) {
  const total = ALL_ELEMENTS.length
  const count = selected.size
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => toggleAll(true)} className="text-xs text-primary hover:underline">Select all</button>
        <span className="text-on-surface-variant/30">·</span>
        <button onClick={() => toggleAll(false)} className="text-xs text-primary hover:underline">Deselect all</button>
        <span className="ml-auto text-xs text-on-surface-variant">{count} of {total} selected</span>
      </div>
      <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 340 }}>
        {SECTIONS.map(sec => (
          <div key={sec.label}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20 pb-1 mb-1.5">{sec.label}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {sec.elements.map(el => {
                const on = selected.has(el.name)
                return (
                  <button key={el.name} onClick={() => toggle(el.name)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-left border transition-colors text-xs ${
                      on ? 'border-primary/40 bg-primary/5 text-on-surface' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                    }`}>
                    <span className={`w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                      on ? 'bg-primary border-primary' : 'border-outline-variant/50'
                    }`}>
                      {on && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    </span>
                    <span className="flex-1 leading-snug">{el.name}</span>
                    <span className="font-mono text-[10px] text-on-surface-variant">{el.code}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepBudgets({ selected, budgets, setBudget }: {
  selected: Set<string>
  budgets: Record<string, string>
  setBudget: (name: string, val: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadMsg, setUploadMsg] = useState('')

  const selectedElements = ALL_ELEMENTS.filter(e => selected.has(e.name))

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
        let matched = 0
        for (const row of rows) {
          if (!row[0] || !row[1]) continue
          const name = String(row[0]).trim()
          const val  = Number(String(row[1]).replace(/[€,\s]/g, ''))
          if (!isNaN(val) && val > 0) {
            const match = ALL_ELEMENTS.find(e => e.name.toLowerCase() === name.toLowerCase())
            if (match) { setBudget(match.name, String(val)); matched++ }
          }
        }
        setUploadMsg(`${matched} budgets imported`)
        setTimeout(() => setUploadMsg(''), 3000)
      } catch {
        setUploadMsg('Could not read file — use CSV or XLSX with two columns: Element, Budget')
        setTimeout(() => setUploadMsg(''), 4000)
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const total = selectedElements.reduce((s, e) => s + parseMoney(budgets[e.name] || ''), 0)

  return (
    <div>
      {/* Upload zone */}
      <div
        className="border-2 border-dashed border-outline-variant/40 rounded-lg p-5 text-center cursor-pointer hover:border-primary/40 hover:bg-surface-container-low transition-colors mb-4"
        onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        <span className="material-symbols-outlined text-tertiary mb-1" style={{ fontSize: 28 }}>upload_file</span>
        <div className="text-sm font-medium text-on-surface">Upload budget spreadsheet</div>
        <div className="text-xs text-on-surface-variant mt-0.5">Two columns: Element name · Budget amount (.xlsx or .csv)</div>
        {uploadMsg && <div className="mt-2 text-xs font-medium text-primary">{uploadMsg}</div>}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-outline-variant/20" />
        <span className="text-xs text-on-surface-variant">or enter manually</span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
        {selectedElements.map(el => (
          <div key={el.name} className="flex items-center gap-3 py-1.5 border-b border-outline-variant/10 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-on-surface truncate">{el.name}</div>
              <div className="text-[10px] font-mono text-on-surface-variant">{el.code}</div>
            </div>
            <div className="relative w-32">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">€</span>
              <input
                value={budgets[el.name] || ''}
                onChange={e => setBudget(el.name, e.target.value)}
                placeholder="0"
                className="w-full border border-outline-variant/30 rounded px-2.5 py-1 pl-5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="mt-2 pt-2 border-t border-outline-variant/20 flex justify-between items-center">
          <span className="text-xs text-on-surface-variant">Total budgets entered</span>
          <span className="text-sm font-bold text-primary">{fmt(total)}</span>
        </div>
      )}
    </div>
  )
}

function StepReview({ details, contract, selected, budgets }: {
  details: any; contract: any; selected: Set<string>; budgets: Record<string, string>
}) {
  const contractSum = parseMoney(contract.contractSum)
  const budget      = parseMoney(contract.originalBudget)
  const margin      = parseMoney(contract.originalMargin)
  const gifa        = parseMoney(contract.gifa)
  const totalBudgets = ALL_ELEMENTS.filter(e => selected.has(e.name))
    .reduce((s, e) => s + parseMoney(budgets[e.name] || ''), 0)

  const months = contract.startDate && contract.finishDate
    ? Math.round((new Date(contract.finishDate).getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Contract sum',  val: contractSum ? fmt(contractSum) : '—' },
          { label: 'GIFA',          val: gifa ? gifa.toLocaleString('en-IE') + ' m²' : '—' },
          { label: 'Elements',      val: String(selected.size) },
          { label: 'Programme',     val: months ? months + ' mo' : '—' },
        ].map(k => (
          <div key={k.label} className="bg-surface-container-low rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-on-surface-variant mb-1">{k.label}</div>
            <div className="text-base font-bold text-on-surface">{k.val}</div>
          </div>
        ))}
      </div>

      {contractSum > 0 && gifa > 0 && (
        <div className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2 flex justify-between items-center">
          <span className="text-xs text-on-surface-variant">Contract sum per m² (GIFA)</span>
          <span className="text-sm font-bold text-primary">{fmt(contractSum / gifa)}/m²</span>
        </div>
      )}

      <div className="border border-outline-variant/30 rounded-lg overflow-hidden text-sm">
        {[
          ['Project', details.name || '—'],
          ['Client', details.client || '—'],
          ['Contract type', details.contractType || '—'],
          ['Prepared by', details.preparedBy || '—'],
          ['Original budget', budget ? fmt(budget) : '—'],
          ['Target margin', margin ? fmt(margin) + (budget ? ` (${((margin/budget)*100).toFixed(1)}%)` : '') : '—'],
          ['Element budgets total', totalBudgets ? fmt(totalBudgets) : 'Not entered'],
        ].map(([label, val], i, arr) => (
          <div key={label} className={`flex justify-between px-3 py-2 ${i < arr.length-1 ? 'border-b border-outline-variant/10' : ''}`}>
            <span className="text-on-surface-variant text-xs">{label}</span>
            <span className={`text-xs font-medium ${label === 'Target margin' ? 'text-tertiary' : 'text-on-surface'}`}>{val}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-on-surface-variant">
        Cost codes are pre-loaded from the BCIS register. You'll land on the dashboard — enter data in the input sheets.
      </p>
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-1">{label}</label>
      {children}
    </div>
  )
}

function MoneyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">€</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-outline-variant/40 rounded pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
    </div>
  )
}

// ── Wizard shell ──────────────────────────────────────────────────────────────

const STEP_LABELS = ['Project details', 'Contract & GIFA', 'Select elements', 'Budgets', 'Review & create']

export default function SetupWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [details, setDetailsRaw] = useState({ name: '', code: '', client: '', contractType: '', preparedBy: '', reportPeriod: '' })
  const [contract, setContractRaw] = useState({ gifa: '', contractSum: '', originalBudget: '', approvedVars: '', originalMargin: '', startDate: '', finishDate: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED))
  const [budgets, setBudgets] = useState<Record<string, string>>({})

  function setDetail(k: string, v: string) { setDetailsRaw(p => ({ ...p, [k]: v })) }
  function setContract(k: string, v: string) { setContractRaw(p => ({ ...p, [k]: v })) }
  function setBudget(name: string, val: string) { setBudgets(p => ({ ...p, [name]: val })) }
  function toggleEl(name: string) {
    setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }
  function toggleAll(on: boolean) {
    setSelected(on ? new Set(ALL_ELEMENTS.map(e => e.name)) : new Set())
  }

  function canAdvance() {
    if (step === 0) return details.name.trim() && details.code.trim()
    if (step === 2) return selected.size > 0
    return true
  }

  async function create() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...details,
          ...contract,
          gifa:            parseMoney(contract.gifa),
          contractSum:     parseMoney(contract.contractSum),
          originalBudget:  parseMoney(contract.originalBudget),
          approvedVars:    parseMoney(contract.approvedVars),
          originalMargin:  parseMoney(contract.originalMargin),
          selectedElements: Array.from(selected),
          budgets: Object.fromEntries(
            Object.entries(budgets).map(([k, v]) => [k, parseMoney(v)])
          ),
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Server error ${res.status}`)
      }
      const { id } = await res.json()
      router.push(`/${id}/dashboard`)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl">

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/20">

          {/* Header */}
          <div style={{ background: '#1e3a5f' }} className="px-7 pt-5 pb-4">
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/logo.png" alt="ExtraOver" style={{ width: 120, height: 'auto', filter: 'brightness(0) invert(1)' }} />
            </div>

            {/* Step dots */}
            <div className="flex items-start">
              {STEP_LABELS.map((label, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 relative">
                  {i < STEP_LABELS.length - 1 && (
                    <div className="absolute top-2.5 left-1/2 w-full h-px bg-white/15" />
                  )}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 text-[10px] font-medium transition-all ${
                    i < step ? 'bg-[#456919] text-white' :
                    i === step ? 'bg-white text-[#1e3a5f] font-bold' :
                    'bg-white/10 text-white/40'
                  }`}>
                    {i < step
                      ? <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      : i + 1}
                  </div>
                  <div className={`text-[9px] text-center leading-tight ${i === step ? 'text-white font-medium' : 'text-white/40'}`}>
                    {label.split(' ').slice(0, 2).join('\n')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="px-7 py-5">
            <h2 className="text-sm font-bold text-on-surface mb-0.5">{STEP_LABELS[step]}</h2>
            <p className="text-xs text-on-surface-variant mb-4">
              {step === 0 && 'Basic information about the project.'}
              {step === 1 && 'Financial overview, floor area, and programme dates.'}
              {step === 2 && 'Tick only the BCIS elements relevant to this project.'}
              {step === 3 && 'Enter element budgets now, or skip and add later in Settings.'}
              {step === 4 && 'Review the summary, then create the project.'}
            </p>

            {step === 0 && <StepDetails data={details} set={setDetail} />}
            {step === 1 && <StepContract data={contract} set={setContract} />}
            {step === 2 && <StepElements selected={selected} toggle={toggleEl} toggleAll={toggleAll} />}
            {step === 3 && <StepBudgets selected={selected} budgets={budgets} setBudget={setBudget} />}
            {step === 4 && <StepReview details={details} contract={contract} selected={selected} budgets={budgets} />}

            {error && <p className="mt-3 text-xs text-error">{error}</p>}
          </div>

          {/* Footer */}
          <div className="px-7 py-4 border-t border-outline-variant/20 flex items-center justify-between">
            <button
              onClick={() => setStep(s => s - 1)}
              style={{ visibility: step > 0 ? 'visible' : 'hidden' }}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors px-3 py-1.5 rounded border border-outline-variant/30 hover:bg-surface-container">
              ← Back
            </button>

            <span className="text-xs text-on-surface-variant">Step {step + 1} of {STEP_LABELS.length}</span>

            <div className="flex items-center gap-2">
              {step === 3 && (
                <button onClick={() => setStep(4)}
                  className="text-xs text-on-surface-variant hover:text-on-surface transition-colors px-3 py-1.5">
                  Skip →
                </button>
              )}
              {step < 4 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canAdvance()}
                  className="bg-[#1e3a5f] text-white text-xs font-bold px-4 py-1.5 rounded disabled:opacity-40 hover:bg-[#16304f] transition-colors">
                  {step === 3 ? 'Save & continue →' : 'Continue →'}
                </button>
              ) : (
                <button
                  onClick={create}
                  disabled={loading}
                  className="bg-[#456919] text-white text-xs font-bold px-5 py-1.5 rounded disabled:opacity-50 hover:bg-[#3a5715] transition-colors">
                  {loading ? 'Creating...' : 'Create project →'}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Existing projects link */}
        <p className="text-center text-xs text-on-surface-variant mt-4">
          Already have a project?{' '}
          <a href="/" className="text-primary hover:underline">Switch project</a>
        </p>
      </div>
    </div>
  )
}
