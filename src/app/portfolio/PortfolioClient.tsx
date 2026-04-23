'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, clx } from '@/lib/utils'

type Issue = { id: string; severity: 'error' | 'warning' | 'info'; title: string; href?: string }

type ProjectSummary = {
  id: string
  name: string
  code: string
  client: string
  contractSum: number
  approvedVars: number
  originalMargin: number
  efc: number
  adjustedSum: number
  forecastMargin: number
  forecastPct: number
  totalCtd: number
  cashPosition: number
  periodLabel: string
  issueCount: number
  errorCount: number
  issues: Issue[]
}

type Filter = 'all' | 'risk' | 'profit' | 'flags'

function rag(pct: number, hasData: boolean): 'green' | 'amber' | 'red' | 'none' {
  if (!hasData) return 'amber'
  if (pct >= 0.05) return 'green'
  if (pct >= 0) return 'amber'
  return 'red'
}

const RAG_COLOURS = {
  green: { dot: '#3B6D11', text: '#27500A', label: 'On track' },
  amber: { dot: '#BA7517', text: '#633806', label: 'Review' },
  red:   { dot: '#A32D2D', text: '#791F1F', label: 'At risk' },
  none:  { dot: '#888780', text: '#444441', label: 'No data' },
}

function Dot({ status }: { status: 'green' | 'amber' | 'red' | 'none' }) {
  return (
    <span style={{
      width: 10, height: 10, borderRadius: '50%',
      background: RAG_COLOURS[status].dot,
      display: 'inline-block', flexShrink: 0,
    }} />
  )
}

export default function PortfolioClient({ summaries }: { summaries: ProjectSummary[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedFlags, setExpandedFlags] = useState(false)
  const [sort, setSort] = useState<'name' | 'margin' | 'efc' | 'flags'>('name')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  function setSort2(col: typeof sort) {
    if (sort === col) setSortDir(d => d === 1 ? -1 : 1)
    else { setSort(col); setSortDir(1) }
  }

  // Portfolio totals
  const totals = useMemo(() => ({
    portfolioValue: summaries.reduce((s, p) => s + p.adjustedSum, 0),
    totalEfc:       summaries.reduce((s, p) => s + p.efc,         0),
    totalMargin:    summaries.reduce((s, p) => s + p.forecastMargin, 0),
    totalCtd:       summaries.reduce((s, p) => s + p.totalCtd,    0),
    inProfit:       summaries.filter(p => p.forecastPct >= 0 && p.efc > 0).length,
    atRisk:         summaries.filter(p => p.forecastPct < 0  && p.efc > 0).length,
    totalFlags:     summaries.reduce((s, p) => s + p.issueCount,  0),
    totalErrors:    summaries.reduce((s, p) => s + p.errorCount,  0),
  }), [summaries])

  const weightedMarginPct = totals.portfolioValue
    ? totals.totalMargin / totals.portfolioValue : 0

  // All red flags across all projects
  const allFlags = useMemo(() =>
    summaries.flatMap(p =>
      p.issues
        .filter(i => i.severity === 'error' || i.severity === 'warning')
        .map(i => ({ ...i, projectName: p.name, projectId: p.id }))
    ), [summaries])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...summaries]
    if (filter === 'risk')   list = list.filter(p => rag(p.forecastPct, p.efc > 0) === 'red')
    if (filter === 'profit') list = list.filter(p => rag(p.forecastPct, p.efc > 0) === 'green')
    if (filter === 'flags')  list = list.filter(p => p.errorCount > 0)
    list.sort((a, b) => {
      let v = 0
      if (sort === 'name')   v = a.name.localeCompare(b.name)
      if (sort === 'margin') v = a.forecastPct - b.forecastPct
      if (sort === 'efc')    v = a.efc - b.efc
      if (sort === 'flags')  v = a.issueCount - b.issueCount
      return v * sortDir
    })
    return list
  }, [summaries, filter, sort, sortDir])

  function SortTh({ col, label, right }: { col: typeof sort; label: string; right?: boolean }) {
    const active = sort === col
    return (
      <th
        onClick={() => setSort2(col)}
        style={{ cursor: 'pointer', userSelect: 'none', textAlign: right ? 'right' : 'left',
          padding: '9px 12px', fontSize: 10, fontWeight: 500, color: active ? '#1e3a5f' : '#6b7280',
          textTransform: 'uppercase', letterSpacing: '0.07em',
          background: '#f8f9fb', borderBottom: '0.5px solid #e5e7eb',
          whiteSpace: 'nowrap' }}>
        {label} {active ? (sortDir === 1 ? '↑' : '↓') : ''}
      </th>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', fontFamily: 'var(--font-sans)' }}>

      {/* Top bar */}
      <div style={{ background: '#1e3a5f', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="ExtraOver" style={{ width: 110, height: 'auto', filter: 'invert(1) brightness(2)' }} />
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em' }}>Portfolio Overview</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            {summaries.length} project{summaries.length !== 1 ? 's' : ''} · {new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => router.push('/setup')}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6,
              background: '#456919', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            + New project
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>

        {/* Portfolio KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Portfolio value',   val: fmt(totals.portfolioValue), sub: `${summaries.length} projects`, col: '' },
            { label: 'Total EFC',         val: fmt(totals.totalEfc),        sub: 'estimate final cost',          col: '' },
            { label: 'Forecast margin',   val: fmt(totals.totalMargin),
              sub: `${(weightedMarginPct * 100).toFixed(1)}% weighted avg`,
              col: totals.totalMargin >= 0 ? '#27500A' : '#791F1F' },
            { label: 'Projects in profit',val: `${totals.inProfit} / ${summaries.length}`,
              sub: totals.atRisk > 0 ? `${totals.atRisk} at risk` : 'all in profit',
              col: totals.atRisk > 0 ? '#633806' : '#27500A' },
            { label: 'Red flags',         val: String(totals.totalFlags),
              sub: totals.totalErrors > 0 ? `${totals.totalErrors} critical` : 'no critical issues',
              col: totals.totalErrors > 0 ? '#791F1F' : '#27500A' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: '0.5px solid #e5e7eb',
              borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: k.col || '#1a1a1a' }}>{k.val}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Red flags strip */}
        {allFlags.length > 0 && (
          <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8,
            padding: '10px 14px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ color: '#991B1B', fontSize: 13, marginTop: 1, flexShrink: 0 }}>⚑</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#991B1B', marginBottom: 6 }}>
                  Portfolio flags requiring attention · {allFlags.length} issue{allFlags.length !== 1 ? 's' : ''} across {new Set(allFlags.map(f => f.projectId)).size} project{new Set(allFlags.map(f => f.projectId)).size !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(expandedFlags ? allFlags : allFlags.slice(0, 8)).map((f, i) => (
                    <button
                      key={i}
                      onClick={() => router.push(`/${f.projectId}/${f.href || 'dashboard'}`)}
                      style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20,
                        background: f.severity === 'error' ? '#FEE2E2' : '#FEF3C7',
                        color: f.severity === 'error' ? '#991B1B' : '#78350f',
                        border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                      {f.projectName.split(' ').slice(0, 3).join(' ')} — {f.title}
                    </button>
                  ))}
                  {allFlags.length > 8 && (
                    <button
                      onClick={() => setExpandedFlags(e => !e)}
                      style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20,
                        background: 'none', border: '0.5px solid #FECACA',
                        color: '#991B1B', cursor: 'pointer' }}>
                      {expandedFlags ? 'Show less' : `+${allFlags.length - 8} more`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter + table */}
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>

          {/* Table header */}
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #e5e7eb',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              All projects
            </span>
            <div style={{ display: 'flex', gap: 5 }}>
              {([['all', 'All'], ['risk', 'At risk'], ['profit', 'In profit'], ['flags', 'Critical flags']] as [Filter, string][]).map(([f, label]) => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ fontSize: 11, padding: '4px 11px', borderRadius: 20, border: '0.5px solid',
                    borderColor: filter === f ? '#1e3a5f' : '#d1d5db',
                    background: filter === f ? '#1e3a5f' : 'none',
                    color: filter === f ? '#fff' : '#6b7280',
                    cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <SortTh col="name"   label="Project" />
                  <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 500, color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.07em', background: '#f8f9fb',
                    borderBottom: '0.5px solid #e5e7eb', textAlign: 'right' }}>Status</th>
                  <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 500, color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.07em', background: '#f8f9fb',
                    borderBottom: '0.5px solid #e5e7eb', textAlign: 'right' }}>Contract sum</th>
                  <SortTh col="efc"    label="EFC"    right />
                  <SortTh col="margin" label="Forecast margin" right />
                  <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 500, color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.07em', background: '#f8f9fb',
                    borderBottom: '0.5px solid #e5e7eb', textAlign: 'right' }}>Margin %</th>
                  <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 500, color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.07em', background: '#f8f9fb',
                    borderBottom: '0.5px solid #e5e7eb', textAlign: 'right' }}>Total CTD</th>
                  <SortTh col="flags"  label="Flags"  right />
                  <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 500, color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.07em', background: '#f8f9fb',
                    borderBottom: '0.5px solid #e5e7eb', textAlign: 'right' }}>Period</th>
                  <th style={{ padding: '9px 12px', background: '#f8f9fb', borderBottom: '0.5px solid #e5e7eb' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const status = rag(p.forecastPct, p.efc > 0)
                  const cfg = RAG_COLOURS[status]
                  const hasFinancial = p.efc > 0 || p.contractSum > 0
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/${p.id}/dashboard`)}
                      style={{ cursor: 'pointer', background: idx % 2 === 1 ? '#fafbfc' : '#fff',
                        borderBottom: '0.5px solid #f0f0f0' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f4fa')}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 1 ? '#fafbfc' : '#fff')}>

                      {/* Project name */}
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          {p.code}{p.client ? ` · ${p.client}` : ''}
                        </div>
                      </td>

                      {/* RAG */}
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                          <span style={{ fontSize: 11, color: cfg.text, fontWeight: 500 }}>{cfg.label}</span>
                        </div>
                      </td>

                      {/* Contract sum */}
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: 12, color: '#6b7280' }}>
                        {p.adjustedSum > 0 ? fmt(p.adjustedSum) : '—'}
                      </td>

                      {/* EFC */}
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: 12, fontWeight: 500,
                        color: p.efc > p.adjustedSum && p.adjustedSum > 0 ? '#991B1B' : '#1a1a1a' }}>
                        {p.efc > 0 ? fmt(p.efc) : '—'}
                      </td>

                      {/* Forecast margin */}
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: 12, fontWeight: 500,
                        color: !hasFinancial ? '#9ca3af' : p.forecastMargin >= 0 ? '#27500A' : '#991B1B' }}>
                        {hasFinancial ? fmt(p.forecastMargin) : '—'}
                      </td>

                      {/* Margin % */}
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: 12, fontWeight: 500,
                        color: !hasFinancial ? '#9ca3af' : p.forecastPct >= 0 ? '#27500A' : '#991B1B' }}>
                        {hasFinancial ? (p.forecastPct * 100).toFixed(1) + '%' : '—'}
                      </td>

                      {/* CTD */}
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: 12, color: '#6b7280' }}>
                        {p.totalCtd > 0 ? fmt(p.totalCtd) : '—'}
                      </td>

                      {/* Flags */}
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {p.issueCount > 0 ? (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                            background: p.errorCount > 0 ? '#FEE2E2' : '#FEF3C7',
                            color: p.errorCount > 0 ? '#991B1B' : '#78350f',
                            fontWeight: 500 }}>
                            {p.issueCount}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                            background: '#EAF3DE', color: '#27500A', fontWeight: 500 }}>✓</span>
                        )}
                      </td>

                      {/* Period */}
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: 11, color: '#9ca3af' }}>
                        {p.periodLabel || '—'}
                      </td>

                      {/* Open */}
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <span style={{ fontSize: 12, color: '#185FA5', fontWeight: 500 }}>Open →</span>
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                      No projects match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Portfolio totals footer */}
              {filtered.length > 1 && (
                <tfoot>
                  <tr style={{ background: '#f0f4fa', borderTop: '1.5px solid #c7d7ed' }}>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 500, color: '#1e3a5f' }}>
                      Portfolio total ({filtered.length} projects)
                    </td>
                    <td />
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: '#1e3a5f' }}>
                      {fmt(filtered.reduce((s, p) => s + p.adjustedSum, 0))}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: '#1e3a5f' }}>
                      {fmt(filtered.reduce((s, p) => s + p.efc, 0))}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 500,
                      color: filtered.reduce((s, p) => s + p.forecastMargin, 0) >= 0 ? '#27500A' : '#991B1B' }}>
                      {fmt(filtered.reduce((s, p) => s + p.forecastMargin, 0))}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 500,
                      color: '#6b7280' }}>
                      {(() => {
                        const totAdj = filtered.reduce((s, p) => s + p.adjustedSum, 0)
                        const totMar = filtered.reduce((s, p) => s + p.forecastMargin, 0)
                        return totAdj ? (totMar / totAdj * 100).toFixed(1) + '%' : '—'
                      })()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: '#1e3a5f' }}>
                      {fmt(filtered.reduce((s, p) => s + p.totalCtd, 0))}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Footer note on access levels */}
        <div style={{ marginTop: 16, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
          ExtraOver Portfolio · All figures live from project data · Access control coming soon
        </div>
      </div>
    </div>
  )
}
