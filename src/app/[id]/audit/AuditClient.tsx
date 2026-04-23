'use client'
import { useState, useMemo } from 'react'
import { clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'

type Entry = {
  id: string
  createdAt: string
  category: string
  action: string
  recordLabel: string | null
  field: string | null
  oldValue: string | null
  newValue: string | null
  userName: string | null
}

const ACTION_STYLES: Record<string, { bg: string; text: string }> = {
  Created: { bg: '#EAF3DE', text: '#27500A' },
  Updated: { bg: '#E6F1FB', text: '#0C447C' },
  Deleted: { bg: '#FCEBEB', text: '#791F1F' },
}

const CATEGORY_COLOURS: Record<string, string> = {
  'CTD':       '#565e74',
  'Committed': '#856c0b',
  'Forecast':  '#456919',
  'CVR Trade': '#185FA5',
  'Settings':  '#444441',
  'Variation': '#993556',
}

function formatDate(s: string) {
  try {
    const d = new Date(s.endsWith('Z') ? s : s + 'Z')
    return d.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  } catch { return s }
}

export default function AuditClient({ entries, projectId }: { entries: Entry[]; projectId: string }) {
  const [catFilter, setCatFilter] = useState('All')
  const [actionFilter, setActionFilter] = useState('All')
  const [search, setSearch] = useState('')

  const categories = useMemo(() =>
    ['All', ...Array.from(new Set(entries.map(e => e.category))).sort()], [entries])

  const filtered = useMemo(() => entries.filter(e => {
    if (catFilter !== 'All' && e.category !== catFilter) return false
    if (actionFilter !== 'All' && e.action !== actionFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (e.recordLabel || '').toLowerCase().includes(q)
          || (e.field       || '').toLowerCase().includes(q)
          || (e.category    || '').toLowerCase().includes(q)
    }
    return true
  }), [entries, catFilter, actionFilter, search])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Audit Log"
        subtitle="Change history across all input sheets · newest first · last 300 entries"
      />

      {/* Filter bar */}
      <div className="bg-white border-b px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search record or field…"
          className="border rounded px-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          {['All', 'Created', 'Updated', 'Deleted'].map(a => <option key={a}>{a}</option>)}
        </select>
        <span className="ml-auto text-xs text-on-surface-variant">
          {filtered.length} of {entries.length} entries
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant gap-3">
            <span className="material-symbols-outlined text-4xl opacity-30">history</span>
            <p className="text-sm">No audit entries yet.</p>
            <p className="text-xs opacity-60">Changes to CTD, Committed, Forecast, Trades, Settings and Variations are logged here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-on-surface-variant text-sm">
            No entries match the current filter.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {[
                  ['Timestamp',  'left',  'w-44'],
                  ['By',         'left',  'w-28'],
                  ['Category',   'left',  'w-28'],
                  ['Action',     'left',  'w-20'],
                  ['Record',     'left',  ''],
                  ['Field',      'left',  'w-36'],
                  ['Old value',  'right', 'w-32'],
                  ['New value',  'right', 'w-32'],
                ].map(([h, align, w]) => (
                  <th key={h} className={clx(
                    'px-4 py-2.5 text-[10px] font-bold text-white bg-[#565e74] uppercase tracking-wide',
                    w, `text-${align}`
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, idx) => {
                const actionStyle = ACTION_STYLES[e.action] || { bg: '#f1f0e8', text: '#444' }
                const catColour = CATEGORY_COLOURS[e.category] || '#888'
                return (
                  <tr key={e.id}
                    className={clx(
                      'border-b border-outline-variant/10 hover:bg-surface-container-low/30 transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-surface-container-low/20'
                    )}>
                    <td className="px-4 py-2">
                      <span className="text-[11px] text-on-surface-variant tabular-nums font-mono">
                        {formatDate(e.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[11px] font-semibold text-on-surface">
                        {e.userName || <span className="text-on-surface-variant/40 font-normal">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded"
                        style={{ color: catColour, background: catColour + '18' }}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded"
                        style={{ background: actionStyle.bg, color: actionStyle.text }}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 max-w-[240px]">
                      <span className="text-xs text-on-surface block truncate" title={e.recordLabel || ''}>
                        {e.recordLabel || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-on-surface-variant">{e.field || '—'}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {e.oldValue ? (
                        <span className="text-xs font-mono text-[#9f403d] bg-[#FCEBEB] px-1.5 py-0.5 rounded">
                          {e.oldValue}
                        </span>
                      ) : <span className="text-on-surface-variant/30 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {e.newValue ? (
                        <span className="text-xs font-mono text-[#27500A] bg-[#EAF3DE] px-1.5 py-0.5 rounded">
                          {e.newValue}
                        </span>
                      ) : <span className="text-on-surface-variant/30 text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-surface-container-low border-t px-6 py-2 text-[11px] text-on-surface-variant flex-shrink-0">
        Audit log is append-only. Entries cannot be edited or deleted. Logs are retained indefinitely.
      </div>
    </div>
  )
}
