'use client'
import { useEffect, useState } from 'react'
import { fmt } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import { useToast } from '@/components/Toast'

type Cert = {
  id: string; cert_no: number; cert_date: string | null; gross_cumulative: number
  retention_pct: number; rct_rate: number; cost_code_id: string | null; cost_code: string | null
  variation_id: string | null; variation_ref: string | null
  status: string; paid_date: string | null; notes: string | null
}
type Sub = {
  id: string; name: string; retention_pct: number; rct_rate: number
  tax_clearance_expiry: string | null; insurance_expiry: string | null
  final_account_status: string; final_account_value: number | null; notes: string | null
  certs: Cert[]; order_value: number; certified_cumulative: number; retention_held: number
  over_certified: boolean; tax_expired: boolean; ins_expired: boolean
}
type CC = { id: string; code: string; description: string; trade: string }
type VO = { id: string; ref: string }

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right' }

function Chip({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }) {
  const c = {
    ok:    { bg: '#e7f6ee', ink: '#0a6e44' },
    warn:  { bg: '#fcf2e2', ink: '#b6740a' },
    bad:   { bg: '#fbeae6', ink: '#a23015' },
    muted: { bg: '#f1f2f5', ink: '#5b626e' },
  }[tone]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 7,
      background: c.bg, color: c.ink, whiteSpace: 'nowrap' }}>{label}</span>
  )
}

// The Irish deduction cascade for a cert's period movement
function cascade(periodGross: number, retPct: number, rctRate: number) {
  const retention = periodGross * retPct / 100
  const beforeRct = periodGross - retention
  const rct = beforeRct * rctRate / 100
  return { retention, beforeRct, rct, netPayable: beforeRct - rct }
}

export default function SubcontractorsClient({ projectId, costCodes, variations, employerRetention }: {
  projectId: string; costCodes: CC[]; variations: VO[]; employerRetention: number
}) {
  const { toast } = useToast()
  const [subs, setSubs] = useState<Sub[]>([])
  const [unregistered, setUnregistered] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  // new cert draft per sub
  const [draft, setDraft] = useState<{ date: string; gross: string; costCodeId: string; variationId: string }>(
    { date: new Date().toISOString().slice(0, 10), gross: '', costCodeId: '', variationId: '' })

  async function load() {
    const r = await fetch(`/api/projects/${projectId}/subcontractors`)
    const d = await r.json()
    setSubs(d.subs || []); setUnregistered(d.unregistered || []); setLoading(false)
  }
  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function importAll() {
    const r = await fetch(`/api/projects/${projectId}/subcontractors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importAll: true }) })
    const d = await r.json()
    toast(`${d.created} account${d.created !== 1 ? 's' : ''} created from Committed`, 'success')
    load()
  }

  async function createSub() {
    if (!newName.trim()) return
    await fetch(`/api/projects/${projectId}/subcontractors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }) })
    setNewName(''); setAdding(false); load()
  }

  async function patchSub(subId: string, body: any) {
    await fetch(`/api/projects/${projectId}/subcontractors`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subId, ...body }) })
    load()
  }

  async function addCert(sub: Sub) {
    const gross = Number(draft.gross.replace(/[^0-9.-]/g, ''))
    if (!gross && gross !== 0) { toast('Enter a cumulative gross value', 'error'); return }
    const r = await fetch(`/api/projects/${projectId}/subcontractors/certs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subId: sub.id, certDate: draft.date, grossCumulative: gross,
        costCodeId: draft.costCodeId || null, variationId: draft.variationId || null }) })
    const d = await r.json()
    if (!r.ok) { toast(d.error || 'Blocked', 'error'); return }
    if (d.insWarning) toast(d.insWarning, 'error')
    toast(`Cert ${d.certNo} recorded for ${sub.name}`, 'success')
    setDraft(p => ({ ...p, gross: '' })); load()
  }

  async function patchCert(certId: string, body: any) {
    const r = await fetch(`/api/projects/${projectId}/subcontractors/certs`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ certId, ...body }) })
    const d = await r.json()
    if (!r.ok) { toast(d.error || 'Blocked', 'error'); return }
    if (d.insWarning) toast(d.insWarning, 'error')
    load()
  }

  const totals = subs.reduce((a, s) => ({
    order: a.order + s.order_value,
    certified: a.certified + s.certified_cumulative,
    retention: a.retention + s.retention_held,
  }), { order: 0, certified: 0, retention: 0 })
  const netRetention = employerRetention - totals.retention

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Subcontractor Register"
        subtitle="Accounts · payment certs · retention & RCT · compliance"
        actions={
          <div className="flex items-center gap-2">
            {unregistered.length > 0 && (
              <button onClick={importAll}
                className="text-xs font-semibold px-3 py-2"
                style={{ background: '#fff', color: '#1a45c0', border: '1px solid #d6e0ff', borderRadius: 9 }}>
                + Add {unregistered.length} from Committed
              </button>
            )}
            <button onClick={() => setAdding(a => !a)}
              className="text-xs font-semibold px-3 py-2 text-white"
              style={{ background: '#1c4ed8', borderRadius: 9 }}>
              + Add subcontractor
            </button>
          </div>
        }
      />

      {/* Summary strip — dark ledger panel */}
      <div style={{ background: '#1a1d23', padding: '10px 24px', display: 'flex', gap: 32, flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { k: 'Order book', v: fmt(totals.order), c: '#e6e8ed' },
          { k: 'Certified to subs', v: fmt(totals.certified), c: '#e6e8ed' },
          { k: 'Retention held vs subs', v: fmt(totals.retention), c: '#f0b35b' },
          { k: 'Employer holds vs you', v: fmt(employerRetention), c: '#f0b35b' },
          { k: 'Net retention position', v: fmt(netRetention), c: netRetention >= 0 ? '#34d399' : '#f0b35b' },
        ].map(x => (
          <div key={x.k}>
            <div style={{ fontSize: 9.5, color: '#6f7787', textTransform: 'uppercase', letterSpacing: '0.08em', ...MONO }}>{x.k}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: x.c, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div>
          </div>
        ))}
      </div>

      {adding && (
        <div className="px-6 py-3 flex items-center gap-3 border-b" style={{ background: '#eef2ff', borderColor: '#d6e0ff', flexShrink: 0 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createSub()}
            placeholder="Subcontractor name"
            className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none"
            style={{ borderColor: '#d6e0ff' }} />
          <button onClick={createSub} className="text-xs font-semibold px-3 py-1.5 text-white" style={{ background: '#1c4ed8', borderRadius: 9 }}>Create</button>
          <button onClick={() => setAdding(false)} className="text-xs" style={{ color: '#5b626e' }}>Cancel</button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="text-sm" style={{ color: '#8b93a1' }}>Loading register…</div>
        ) : subs.length === 0 ? (
          <div className="text-sm" style={{ color: '#8b93a1' }}>
            No subcontractor accounts yet.
            {unregistered.length > 0
              ? ` ${unregistered.length} supplier${unregistered.length !== 1 ? 's' : ''} on the Committed sheet can be imported with one click above.`
              : ' Add one above, or let orders on the Committed sheet seed the register.'}
          </div>
        ) : (
          <div className="space-y-3" style={{ maxWidth: 1100 }}>
            {subs.map(sub => {
              const isOpen = open === sub.id
              const pctCert = sub.order_value > 0 ? sub.certified_cumulative / sub.order_value : 0
              return (
                <div key={sub.id} style={{ background: '#fff', border: '1px solid #e7e9ee', borderRadius: 12, overflow: 'hidden' }}>
                  {/* Account row */}
                  <button onClick={() => setOpen(isOpen ? null : sub.id)}
                    className="w-full text-left"
                    style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12,
                      alignItems: 'center', padding: '12px 16px', background: isOpen ? '#fbfbfc' : '#fff',
                      border: 'none', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1d23' }}>{sub.name}</div>
                      <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                        <Chip label={`RCT ${Number(sub.rct_rate)}%`} tone="muted" />
                        <Chip label={sub.tax_expired ? 'Tax clearance expired' : sub.tax_clearance_expiry ? 'Tax OK' : 'Tax not set'}
                          tone={sub.tax_expired ? 'bad' : sub.tax_clearance_expiry ? 'ok' : 'warn'} />
                        <Chip label={sub.ins_expired ? 'Insurance expired' : sub.insurance_expiry ? 'Ins OK' : 'Ins not set'}
                          tone={sub.ins_expired ? 'warn' : sub.insurance_expiry ? 'ok' : 'warn'} />
                        {sub.over_certified && <Chip label="Over-certified vs order" tone="bad" />}
                        {sub.final_account_status === 'Agreed' && <Chip label="FA agreed" tone="ok" />}
                      </div>
                    </div>
                    {[
                      { k: 'Order', v: sub.order_value ? fmt(sub.order_value) : '\u2013' },
                      { k: 'Certified', v: sub.certified_cumulative ? fmt(sub.certified_cumulative) : '\u2013' },
                      { k: '% of order', v: sub.order_value ? `${(pctCert * 100).toFixed(0)}%` : '\u2013' },
                      { k: 'Retention held', v: sub.retention_held ? fmt(sub.retention_held) : '\u2013' },
                    ].map(x => (
                      <div key={x.k} style={NUM}>
                        <div style={{ fontSize: 9.5, color: '#8b93a1', textTransform: 'uppercase', letterSpacing: '0.06em', ...MONO }}>{x.k}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: sub.over_certified && x.k === 'Certified' ? '#a23015' : '#1a1d23' }}>{x.v}</div>
                      </div>
                    ))}
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#8b93a1' }}>
                      {isOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid #f1f2f5' }}>
                      {/* Account settings */}
                      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center',
                        padding: '10px 16px', background: '#fbfbfc', borderBottom: '1px solid #f1f2f5', fontSize: 11, color: '#5b626e' }}>
                        <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          Retention
                          <input type="number" step="0.5" min={0} max={10} defaultValue={Number(sub.retention_pct)}
                            onBlur={e => patchSub(sub.id, { retentionPct: Number(e.target.value) || 0 })}
                            style={{ width: 48, border: '1px solid #e7e9ee', borderRadius: 6, padding: '2px 6px', fontSize: 11, textAlign: 'right', background: '#eef2ff' }} />%
                        </label>
                        <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          RCT
                          <select defaultValue={String(Number(sub.rct_rate))}
                            onChange={e => patchSub(sub.id, { rctRate: Number(e.target.value) })}
                            style={{ border: '1px solid #e7e9ee', borderRadius: 6, padding: '2px 6px', fontSize: 11, background: '#eef2ff' }}>
                            {['0', '20', '35'].map(r => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </label>
                        <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          Tax clearance to
                          <input type="date" defaultValue={sub.tax_clearance_expiry ?? ''}
                            onBlur={e => patchSub(sub.id, { taxClearanceExpiry: e.target.value })}
                            style={{ border: '1px solid #e7e9ee', borderRadius: 6, padding: '2px 6px', fontSize: 11 }} />
                        </label>
                        <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          Insurance to
                          <input type="date" defaultValue={sub.insurance_expiry ?? ''}
                            onBlur={e => patchSub(sub.id, { insuranceExpiry: e.target.value })}
                            style={{ border: '1px solid #e7e9ee', borderRadius: 6, padding: '2px 6px', fontSize: 11 }} />
                        </label>
                        <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          Order value
                          <input type="number" min={0} defaultValue={sub.order_value || ''}
                            onBlur={e => patchSub(sub.id, { orderValue: Number(e.target.value) || null })}
                            title="Standing order / subcontract value. Held here because Committed decays as costs are invoiced."
                            style={{ width: 90, border: '1px solid #e7e9ee', borderRadius: 6, padding: '2px 6px',
                              fontSize: 11, textAlign: 'right', background: '#eef2ff' }} />
                        </label>
                        <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          Final account
                          <select defaultValue={sub.final_account_status}
                            onChange={e => patchSub(sub.id, { finalAccountStatus: e.target.value })}
                            style={{ border: '1px solid #e7e9ee', borderRadius: 6, padding: '2px 6px', fontSize: 11, background: '#eef2ff' }}>
                            {['Open', 'Agreed'].map(x => <option key={x}>{x}</option>)}
                          </select>
                        </label>
                      </div>

                      {/* Certs */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            {['No', 'Date', 'Cumul. gross', 'Period gross', 'Retention', 'RCT', 'Net payable', 'Code', 'VO', 'Status', ''].map((h, i) => (
                              <th key={h + i} style={{ padding: '7px 10px', fontSize: 9.5, fontWeight: 600, color: '#8b93a1',
                                textTransform: 'uppercase', letterSpacing: '0.06em', ...MONO,
                                textAlign: i >= 2 && i <= 6 ? 'right' : 'left',
                                background: '#fbfbfc', borderBottom: '1px solid #e7e9ee' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sub.certs.map((c, i) => {
                            const prevGross = i > 0 ? Number(sub.certs[i - 1].gross_cumulative) : 0
                            const period = Number(c.gross_cumulative) - prevGross
                            const casc = cascade(period, Number(c.retention_pct), Number(c.rct_rate))
                            return (
                              <tr key={c.id} style={{ borderBottom: '1px solid #f1f2f5' }}>
                                <td style={{ padding: '7px 10px', ...MONO, color: '#8b93a1' }}>{c.cert_no}</td>
                                <td style={{ padding: '7px 10px', ...MONO, fontSize: 11, color: '#5b626e' }}>{c.cert_date || '\u2013'}</td>
                                <td style={{ padding: '7px 10px', ...NUM, fontWeight: 600 }}>{fmt(Number(c.gross_cumulative))}</td>
                                <td style={{ padding: '7px 10px', ...NUM }}>{fmt(period)}</td>
                                <td style={{ padding: '7px 10px', ...NUM, color: '#b6740a' }}>({fmt(casc.retention)})</td>
                                <td style={{ padding: '7px 10px', ...NUM, color: '#b6740a' }}>({fmt(casc.rct)})</td>
                                <td style={{ padding: '7px 10px', ...NUM, fontWeight: 700, color: '#0a6e44' }}>{fmt(casc.netPayable)}</td>
                                <td style={{ padding: '7px 10px', ...MONO, fontSize: 11, color: '#5b626e' }}>{c.cost_code || '\u2013'}</td>
                                <td style={{ padding: '7px 10px', ...MONO, fontSize: 11, color: c.variation_ref ? '#0a6e44' : '#aeb4bf' }}>{c.variation_ref || '\u2013'}</td>
                                <td style={{ padding: '7px 10px' }}>
                                  {c.status === 'Paid'
                                    ? <Chip label={`Paid ${c.paid_date ?? ''}`} tone="ok" />
                                    : <button onClick={() => patchCert(c.id, { status: 'Paid' })}
                                        className="text-[10px] font-bold px-2 py-1"
                                        style={{ background: '#eef2ff', color: '#1a45c0', border: '1px solid #d6e0ff', borderRadius: 7, cursor: 'pointer' }}>
                                        Mark paid
                                      </button>}
                                </td>
                                <td style={{ padding: '7px 6px' }}>
                                  {i === sub.certs.length - 1 && c.status !== 'Paid' && (
                                    <button onClick={() => { if (confirm(`Delete cert ${c.cert_no}?`)) patchCert(c.id, { delete: true }) }}
                                      title="Delete cert" style={{ border: 'none', background: 'none', color: '#aeb4bf', cursor: 'pointer', fontSize: 14 }}>×</button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}

                          {/* New cert row with live cascade preview */}
                          {(() => {
                            const prevGross = sub.certs.length ? Number(sub.certs[sub.certs.length - 1].gross_cumulative) : 0
                            const grossNum = Number(draft.gross.replace(/[^0-9.-]/g, '')) || 0
                            const period = grossNum ? grossNum - prevGross : 0
                            const casc = cascade(period, Number(sub.retention_pct), Number(sub.rct_rate))
                            return (
                              <tr style={{ background: '#fbfbfc' }}>
                                <td style={{ padding: '7px 10px', ...MONO, color: '#aeb4bf' }}>{sub.certs.length + 1}</td>
                                <td style={{ padding: '4px 6px' }}>
                                  <input type="date" value={draft.date} onChange={e => setDraft(p => ({ ...p, date: e.target.value }))}
                                    style={{ border: '1px solid #e7e9ee', borderRadius: 6, padding: '3px 6px', fontSize: 11 }} />
                                </td>
                                <td style={{ padding: '4px 6px' }}>
                                  <input value={draft.gross} placeholder={`cumul. > ${fmt(prevGross)}`}
                                    onChange={e => setDraft(p => ({ ...p, gross: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && addCert(sub)}
                                    style={{ width: 110, border: '1px solid #d6e0ff', borderRadius: 6, padding: '3px 8px',
                                      fontSize: 12, textAlign: 'right', background: '#eef2ff', ...{ fontVariantNumeric: 'tabular-nums' } }} />
                                </td>
                                <td style={{ padding: '7px 10px', ...NUM, color: '#8b93a1' }}>{period ? fmt(period) : '\u2013'}</td>
                                <td style={{ padding: '7px 10px', ...NUM, color: '#b6740a' }}>{period ? `(${fmt(casc.retention)})` : '\u2013'}</td>
                                <td style={{ padding: '7px 10px', ...NUM, color: '#b6740a' }}>{period ? `(${fmt(casc.rct)})` : '\u2013'}</td>
                                <td style={{ padding: '7px 10px', ...NUM, fontWeight: 700, color: '#0a6e44' }}>{period ? fmt(casc.netPayable) : '\u2013'}</td>
                                <td style={{ padding: '4px 6px' }}>
                                  <select value={draft.costCodeId} onChange={e => setDraft(p => ({ ...p, costCodeId: e.target.value }))}
                                    style={{ maxWidth: 110, border: '1px solid #e7e9ee', borderRadius: 6, padding: '3px 4px', fontSize: 10.5 }}>
                                    <option value="">code…</option>
                                    {costCodes.map(cc => <option key={cc.id} value={cc.id}>{cc.code}</option>)}
                                  </select>
                                </td>
                                <td style={{ padding: '4px 6px' }}>
                                  <select value={draft.variationId} onChange={e => setDraft(p => ({ ...p, variationId: e.target.value }))}
                                    style={{ maxWidth: 80, border: '1px solid #e7e9ee', borderRadius: 6, padding: '3px 4px', fontSize: 10.5 }}>
                                    <option value="">VO…</option>
                                    {variations.map(v => <option key={v.id} value={v.id}>{v.ref}</option>)}
                                  </select>
                                </td>
                                <td colSpan={2} style={{ padding: '4px 6px' }}>
                                  <button onClick={() => addCert(sub)}
                                    className="text-[11px] font-bold px-3 py-1.5 text-white"
                                    style={{ background: '#1c4ed8', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                                    Certify
                                  </button>
                                </td>
                              </tr>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
