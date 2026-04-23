'use client'
import { useRef, useState } from 'react'
import { fmt, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { useGridNav } from '@/lib/tableUtils'
import GridInput from '@/components/GridInput'

interface Props { vp: any; proj: any; projectId: string }

const APP_VERSION = 'v25b'

export default function ValueClient({ vp, proj, projectId }: Props) {
  const gridNav = useGridNav()
  const vals = useRef<{
    cumul_claimed: number; cumul_certified: number; front_loading: number
    unapproved_claims: number; other_adjustments: number; revenue_received: number
    total_paid: number; risk_value: number; opportunity_value: number; app_ref: string
  }>({
    cumul_claimed:     Number(vp?.cumul_claimed)     || 0,
    cumul_certified:   Number(vp?.cumul_certified)   || 0,
    front_loading:     Number(vp?.front_loading)     || 0,
    unapproved_claims: Number(vp?.unapproved_claims) || 0,
    other_adjustments: Number(vp?.other_adjustments) || 0,
    revenue_received:  Number(vp?.revenue_received)  || 0,
    total_paid:        Number(vp?.total_paid)         || 0,
    risk_value:        Number(vp?.risk_value)         || 0,
    opportunity_value: Number(vp?.opportunity_value) || 0,
    app_ref:           String(vp?.app_ref            || ''),
  })
  const [tick, setTick] = useState(0)
  const [status, setStatus] = useState<'idle'|'saving'|'saved'>('idle')

  function setVal(key: Exclude<keyof typeof vals.current, 'app_ref'>, v: number) {
    vals.current[key] = v
    setTick(t => t + 1)
  }

  const v = vals.current
  const adjustedSum        = (Number(proj?.contract_sum) || 0) + (Number(proj?.approved_vars) || 0)
  const totalAssessedValue = v.cumul_claimed + v.unapproved_claims + v.front_loading + v.other_adjustments
  const cashPosition       = v.revenue_received - v.total_paid
  const overUnder          = v.cumul_claimed - v.cumul_certified

  async function save() {
    setStatus('saving')
    await fetch(`/api/projects/${projectId}/value`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vals.current),
    })
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2000)
  }

  type NumField = Exclude<keyof typeof vals.current, 'app_ref'>
  function Inp({ field, label }: { field: NumField; label: string }) {
    return (
      <tr className="border-b border-gray-100" data-row={Object.keys(vals.current).indexOf(field)}>
        <td className="px-4 py-2 text-xs font-medium text-gray-700">{label}</td>
        <td className="p-0" data-col={0} style={{ width: 140 }}>
          <GridInput
            value={vals.current[field] as number}
            onSave={v => setVal(field, v)}
          />
        </td>
        <td className="px-4 py-2 text-xs text-right tabular-nums font-semibold text-gray-700" style={{ width: 130 }}>
          {fmt(vals.current[field] as number)}
        </td>
      </tr>
    )
  }

  function Total({ label, value, accent }: { label: string; value: number; accent?: string }) {
    const col = accent ?? (value < 0 ? '#991B1B' : '#1e3a5f')
    return (
      <tr style={{ background: '#f0f4fa', borderTop: '1.5px solid #c7d7ed' }}>
        <td className="px-4 py-2 text-xs font-bold text-[#1e3a5f]" colSpan={2}>{label}</td>
        <td className="px-4 py-2 text-xs text-right tabular-nums font-bold" style={{ color: col }}>{fmt(value)}</td>
      </tr>
    )
  }

  function Section({ title, bg, children }: { title: string; bg: string; children: React.ReactNode }) {
    return (
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: '0.5px solid #e2e8f0' }}>
        <div className="px-4 py-2.5 text-white font-bold text-xs uppercase tracking-wide" style={{ background: bg }}>{title}</div>
        <table className="w-full" onKeyDown={gridNav}>
          <thead>
            <tr style={{ background: '#f8f9fb' }}>
              <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide">Item</th>
              <th className="px-4 py-1.5 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide">Input</th>
              <th className="px-4 py-1.5 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wide">Formatted</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Application & Certificate Tracker"
        subtitle={`${proj?.name ?? ''} · ${proj?.code ?? ''}`}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', whiteSpace: 'nowrap' }}>App. Ref</label>
              <input
                defaultValue={vals.current.app_ref}
                onBlur={e => { vals.current.app_ref = e.target.value }}
                placeholder="e.g. Application No. 6"
                style={{
                  border: '0.5px solid #d1d5db', borderRadius: 6, padding: '5px 10px',
                  fontSize: 12, width: 200, background: '#FFFFC7', outline: 'none',
                }}
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px #1e3a5f30'}
              />
            </div>
            <button onClick={save} disabled={status === 'saving'}
              className="bg-primary text-white px-4 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#1A3A7A] disabled:opacity-50 font-semibold">
              {status === 'saving' ? 'Saving…' : status === 'saved' ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="bg-[#1e3a5f] px-6 py-3 flex items-center gap-8 flex-shrink-0">
        {[
          { label: 'Application Ref',     val: vals.current.app_ref || '—', col: '#DEE5B5' },
          { label: 'Adjusted Contract Sum', val: fmt(adjustedSum),       col: '#ccd4ee' },
          { label: 'Cumulative Claimed',    val: fmt(v.cumul_claimed),   col: '#ccd4ee' },
          { label: 'Cumulative Certified',  val: fmt(v.cumul_certified), col: '#ccd4ee' },
          { label: 'Cash Position',         val: fmt(cashPosition),      col: cashPosition < 0 ? '#FECACA' : '#DEE5B5' },
          { label: 'Over / (Under) Claim',  val: fmt(overUnder),         col: overUnder < -50_000 ? '#FECACA' : '#DEE5B5' },
        ].map(({ label, val, col }) => (
          <div key={label} className="flex-shrink-0">
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'rgba(168,196,224,0.55)' }}>{label}</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: col }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="grid grid-cols-3 gap-4 max-w-5xl">

          <Section title="Application" bg="#1e3a5f">
            <Inp field="cumul_claimed" label="Total Claimed to Date" />
            <Total label="Sub-Total Application" value={v.cumul_claimed} />
          </Section>

          <Section title="Certificate / Invoiced" bg="#253f6a">
            <Inp field="cumul_certified" label="Measurement BOQ – Own Work" />
            <Total label="Total Certified" value={v.cumul_certified} />
            <tr style={{ background: '#fafbfc', borderTop: '0.5px solid #e5e7eb' }}>
              <td className="px-4 py-2 text-xs text-gray-500 italic" colSpan={2}>Variance (App – Cert)</td>
              <td className="px-4 py-2 text-xs text-right tabular-nums font-semibold"
                style={{ color: overUnder >= 0 ? '#27500A' : '#991B1B' }}>{fmt(overUnder)}</td>
            </tr>
          </Section>

          <Section title="Value Adjustments" bg="#444441">
            <Inp field="front_loading"     label="Front / Rate Loading" />
            <Inp field="unapproved_claims" label="Unapproved Claims" />
            <Inp field="other_adjustments" label="Other Adjustments" />
            <Total label="Total Assessed Value" value={totalAssessedValue} accent="#856c0b" />
          </Section>

          <Section title="Cash Position" bg="#1e3a5f">
            <Inp field="revenue_received" label="Revenue Received to Date" />
            <Inp field="total_paid"       label="Total Paid to Date (Costs Out)" />
            <Total label="Cash Position" value={cashPosition} accent={cashPosition >= 0 ? '#27500A' : '#991B1B'} />
          </Section>

          <Section title="Risk & Opportunity" bg="#253f6a">
            <Inp field="risk_value"        label="Risk – Most Likely Value" />
            <Inp field="opportunity_value" label="Opportunity – Most Likely" />
            <Total label="Nett R&O Effect" value={v.risk_value + v.opportunity_value} />
          </Section>

        </div>
        <p className="text-[11px] text-gray-400 mt-4">
          Click into any yellow cell to edit. Tab / Enter / Arrow keys to navigate. Click Save Changes to persist.
        </p>
      </div>
    </div>
  )
}
