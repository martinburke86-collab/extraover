'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { clx } from '@/lib/utils'

const NAV = [
  { href: 'dashboard',    label: 'Dashboard',      icon: 'dashboard' },
  { href: 'trade',        label: 'CVR Trade',       icon: 'analytics' },
  { href: 'variations',   label: 'Variations',      icon: 'difference' },
  { href: 'prelims',      label: 'Prelims',         icon: 'engineering' },
  { href: 'forecast',     label: 'Forecast',        icon: 'trending_up' },
  { href: 'cost-to-date', label: 'Cost to Date',    icon: 'receipt_long' },
  { href: 'committed',    label: 'Committed',       icon: 'shopping_cart' },
  { href: 'value',        label: 'Value / Claims',  icon: 'payments' },
  { href: 's-curve',      label: 'S-Curve',         icon: 'show_chart' },
  { href: 'cost-codes',   label: 'Cost Codes',      icon: 'tag' },
  { href: 'checks',       label: 'Checks',          icon: 'fact_check' },
  { href: 'settings',     label: 'Settings',        icon: 'settings' },
]

function ProjectSwitcher() {
  const [projects, setProjects] = useState<{ id: string; name: string; code: string }[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (projects.length) { setOpen(o => !o); return }
    setLoading(true)
    const r = await fetch('/api/projects')
    const data = await r.json()
    setProjects(data)
    setLoading(false)
    setOpen(true)
  }

  return (
    <div className="relative">
      <button onClick={load}
        className="flex items-center gap-3 w-full text-left text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors">
        <span className={clx('material-symbols-outlined mat-sm', loading ? 'animate-spin' : '')}>swap_horiz</span>
        <span>Switch Project</span>
      </button>
      {open && projects.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-white rounded border border-slate-200 shadow-xl overflow-hidden z-50">
          {projects.map(p => (
            <a key={p.id} href={`/${p.id}/dashboard`}
              className="flex flex-col px-3 py-2.5 hover:bg-surface-container-low border-b border-slate-100 cursor-pointer last:border-0">
              <span className="text-xs font-semibold text-on-surface">{p.name}</span>
              <span className="text-[10px] text-on-surface-variant">{p.code}</span>
            </a>
          ))}
          <div className="px-3 py-2 border-t border-slate-100">
            <a href="/new-project" className="text-[10px] text-primary hover:underline font-medium">+ New Project</a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AppLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const pathname  = usePathname()
  const [exporting, setExporting] = useState(false)

  async function exportExcel() {
    setExporting(true)
    try {
      const res  = await fetch(`/api/projects/${params.id}/export`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? 'CVR_Export.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 h-screen w-[208px] border-r border-slate-200 bg-slate-100 flex flex-col py-4 z-50">

        {/* Branding */}
        <div className="px-4 mb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-on-primary font-black text-[10px] tracking-tight flex-shrink-0">
              CVR
            </div>
            <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase">ExtraOver</h1>
          </div>
          <p className="text-[10px] text-slate-500 font-medium px-0.5 uppercase tracking-wider">Cost Reporting</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon }) => {
            const full   = `/${params.id}/${href}`
            const active = pathname === full || pathname.startsWith(full + '/')
            return (
              <Link key={href} href={full}
                className={clx(
                  'flex items-center gap-3 px-4 py-2 text-xs font-semibold transition-colors',
                  active
                    ? 'border-l-2 border-slate-700 bg-slate-200/50 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/30 border-l-2 border-transparent'
                )}>
                <span className="material-symbols-outlined mat-sm flex-shrink-0">{icon}</span>
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer actions */}
        <div className="mt-auto px-4 space-y-3 pt-4 border-t border-slate-200/70">
          <button onClick={exportExcel} disabled={exporting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded font-bold text-xs text-white transition-all disabled:opacity-50 hover:opacity-90 active:scale-95"
            style={{ background: exporting ? '#456919' : '#456919', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              {exporting ? 'hourglass_empty' : 'download'}
            </span>
            <span>{exporting ? 'Exporting…' : '⬇ Export to Excel'}</span>
          </button>

          <ProjectSwitcher />

          <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-700 bg-slate-200/40 px-2 py-2 rounded">
            <span className="material-symbols-outlined mat-sm text-slate-500">calendar_today</span>
            <span className="uppercase tracking-wide">Period: Mar 26</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="ml-[208px] flex-1 flex flex-col h-screen overflow-hidden">
        {children}
      </main>
    </div>
  )
}
