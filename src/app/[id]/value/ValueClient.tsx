'use client'
import { useState, useTransition } from 'react'
import { fmt, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  vp: any
  proj: any
  projectId: string
}

export default function ValueClient({ vp, proj, projectId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    cumul_claimed:     Number(vp?.cumul_claimed)     || 0,
    cumul_certified:   Number(vp?.cumul_certified)   || 0,
    front_loading:     Number(vp?.front_loading)     || 0,
    unapproved_claims: Number(vp?.unapproved_claims) || 0,
    other_adjustments: Number(vp?.other_adjustments) || 0,
    revenue_received:  Number(vp?.revenue_received)  || 0,
    total_paid:        Number(vp?.total_paid)         || 0,
    risk_value:        Number(vp?.risk_value)         || 0,
    opportunity_value: Number(vp?.opportunity_value) || 0,
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: Number(e.target.value) }))

  // Derived
  const adjustedSum       = (Number(proj?.contract_sum) || 0) + (Number(proj?.approved_vars) || 0)
  const totalAssessedValue = form.cumul_claimed + form.unapproved_claims + form.front_loading + form.other_adjustments
  const cashPosition       = form.revenue_received - form.total_paid
  const overUnder          = form.cumul_claimed - form.cumul_certified

  async function save() {
    setSaving(true)
    await fetch(`/api/projects/${projectId}/value`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    startTransition(() => router.refresh())
  }

  function Inp({ field, label }: { field: keyof typeof form; label: string }) {
    return (
      <tr className="border-b border-gray-100">
        <td className="px-4 py-2.5 text-sm text-gray-700">{label}</td>
        <td className="px-3 py-2">
          <input
            type="number"
            value={form[field]}
            onChange={set(field)}
            className="w-full bg-[#FFFFC7] border border-gray-300 rounded px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#17375E] tabular-nums"
          />
        </td>
        <td className="px-4 py-2.5 text-sm text-right tabular-nums font-medium text-gray-700">
          {fmt(form[field])}
        </td>
      </tr>
    )
  }

  function Total({ label, value, green }: { label: string; value: number; green?: boolean }) {
    return (
      <tr className={clx('border-b border-gray-200', green ? 'bg-[#FFEEB9]' : 'bg-[#F1F4E0]')}>
        <td className="px-4 py-2.5 text-sm font-bold">{label}</td>
        <td />
        <td className={clx('px-4 py-2.5 text-sm text-right tabular-nums font-bold', value < 0 ? 'text-red-700' : 'text-primary')}>
          {fmt(value)}
        </td>
      </tr>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Application & Certificate Tracker"
        subtitle={`${proj?.name ?? ''} · ${proj?.code ?? ''}`}
        actions={
          <button onClick={save} disabled={saving}
            className="bg-primary text-white px-4 py-2 rounded text-sm flex items-center gap-1.5 hover:bg-[#1A3A7A] disabled:opacity-50">
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        }
      />

      {/* Summary strip */}
      <div className="bg-[#17375E] px-6 py-3 flex items-center gap-8 flex-shrink-0">
        {[
          { label: 'Adjusted Contract Sum', val: fmt(adjustedSum) },
          { label: 'Cumulative Claimed',    val: fmt(form.cumul_claimed) },
          { label: 'Cumulative Certified',  val: fmt(form.cumul_certified) },
          { label: 'Cash Position',         val: fmt(cashPosition), red: cashPosition < 0 },
          { label: 'Over / (Under) Claim',  val: fmt(overUnder), red: overUnder < -50_000 },
        ].map(({ label, val, red }) => (
          <div key={label} className="text-white flex-shrink-0">
            <div className="text-xs opacity-60 uppercase tracking-wide">{label}</div>
            <div className={clx('text-base font-bold tabular-nums', red ? 'text-red-300' : '')}>{val}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6 max-w-5xl">

          {/* Application */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#17375E] px-4 py-2.5 text-white font-bold text-sm">APPLICATION</div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-on-surface-variant bg-gray-50">Item</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Input (€)</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Formatted</th>
                </tr>
              </thead>
              <tbody>
                <Inp field="cumul_claimed" label="Total Claimed to Date" />
                <Total label="Sub-Total Application" value={form.cumul_claimed} />
              </tbody>
            </table>
          </div>

          {/* Certificate */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#1A3A7A] px-4 py-2.5 text-white font-bold text-sm">CERTIFICATE / INVOICED</div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-on-surface-variant bg-gray-50">Item</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Input (€)</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Formatted</th>
                </tr>
              </thead>
              <tbody>
                <Inp field="cumul_certified" label="Measurement BOQ – Own Work" />
                <Total label="Total Certificate / Invoiced" value={form.cumul_certified} />
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2.5 text-sm text-on-surface-variant italic">Variance (App – Cert)</td>
                  <td />
                  <td className={clx('px-4 py-2.5 text-sm text-right tabular-nums font-medium',
                    overUnder > 0 ? 'text-green-600' : 'text-red-600')}>
                    {fmt(overUnder)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Value Adjustments */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#595959] px-4 py-2.5 text-white font-bold text-sm">VALUE ADJUSTMENTS</div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-on-surface-variant bg-gray-50">Adjustment</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Input (€)</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Formatted</th>
                </tr>
              </thead>
              <tbody>
                <Inp field="front_loading"     label="Front / Rate Loading" />
                <Inp field="unapproved_claims" label="Unapproved Claims" />
                <Inp field="other_adjustments" label="Other Adjustments" />
                <Total label="Total Assessed Value" value={totalAssessedValue} green />
              </tbody>
            </table>
          </div>

          {/* Cash Position */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden col-span-2">
            <div className="bg-[#17375E] px-4 py-2.5 text-white font-bold text-sm">CASH POSITION</div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-on-surface-variant bg-gray-50">Item</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Input (€)</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Formatted</th>
                </tr>
              </thead>
              <tbody>
                <Inp field="revenue_received" label="Revenue Received to Date" />
                <Inp field="total_paid"       label="Total Paid to Date (Costs Out)" />
                <Total label="Cash Position" value={cashPosition} green={cashPosition >= 0} />
              </tbody>
            </table>
          </div>

          {/* Risk & Opportunity */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="bg-[#1A3A7A] px-4 py-2.5 text-white font-bold text-sm">RISK & OPPORTUNITY</div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-on-surface-variant bg-gray-50">Item</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Input (€)</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-on-surface-variant bg-gray-50">Formatted</th>
                </tr>
              </thead>
              <tbody>
                <Inp field="risk_value"        label="Risk – Most Likely Value" />
                <Inp field="opportunity_value" label="Opportunity – Most Likely" />
                <Total label="Nett R&O Effect" value={form.risk_value + form.opportunity_value} />
              </tbody>
            </table>
          </div>

        </div>
        <p className="text-xs text-gray-400 mt-5">Yellow cells = editable input. Formatted column shows the value as currency. Click Save to persist changes.</p>
      </div>
    </div>
  )
}
