'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { clx } from '@/lib/utils'
import { navVisibleForRole, type Role } from '@/lib/roleUtils'
import { type Terms, DEFAULT_TERMS } from '@/lib/terminology'

async function handleSignOut() {
  await fetch('/api/auth/signout', { method: 'POST' })
  window.location.href = '/login'
}

const NAV = [
  { href: 'periods',       label: 'Period History',  icon: 'calendar_month' },
  { href: 'dashboard',     label: 'Dashboard',       icon: 'dashboard' },
  { href: 'trade',         label: 'CVR Table',       icon: 'analytics' },
  { href: 'budget',        label: 'Budget',           icon: 'account_balance' },
  { href: 'value',         label: 'Value / Claims',  icon: 'payments' },
  { href: 'variations',    label: 'Variations',      icon: 'difference' },
  { href: 'prelims',       label: 'Prelims',         icon: 'engineering' },
  { href: 'forecast',      label: 'Forecast',        icon: 'trending_up' },
  { href: 'efc-breakdown', label: 'EFC Breakdown',   icon: 'table_chart' },
  { href: 'cost-to-date',  label: 'Cost to Date',    icon: 'receipt_long' },
  { href: 'committed',     label: 'Committed',       icon: 'shopping_cart' },
  { href: 's-curve',       label: 'Cashflow',        icon: 'show_chart' },
  { href: 'cost-codes',    label: 'Cost Codes',      icon: 'tag' },
  { href: 'audit',         label: 'Audit Log',       icon: 'history' },
  { href: 'checks',        label: 'Checks',          icon: 'fact_check' },
  { href: 'settings',      label: 'Settings',        icon: 'settings' },
]

const ROLE_BADGE: Record<Role, { label: string; bg: string; text: string }> = {
  owner:  { label: 'Owner',  bg: '#F0F4FF', text: '#3730a3' },
  editor: { label: 'Editor', bg: '#F1F4E0', text: '#456919' },
  viewer: { label: 'Viewer', bg: '#E6F1FB', text: '#0C447C' },
}

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
        <span>Switch project</span>
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
        </div>
      )}
    </div>
  )
}

function SidebarContents({
  params, role, userName, terms = DEFAULT_TERMS, onNav,
}: {
  params: { id: string }; role: Role; userName: string; terms?: Terms; onNav?: () => void
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const [exporting, setExporting] = useState(false)

  // Apply terminology overrides to nav labels
  const navLabels: Record<string, string> = {
    trade:        terms.cvr,
    variations:   terms.variations,
    prelims:      terms.prelims,
    forecast:     terms.forecast,
    'cost-to-date': terms.costToDate,
    committed:    terms.committed,
  }
  const [exportingPDF, setExportingPDF] = useState(false)

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

  async function exportPDF() {
    setExportingPDF(true)
    try {
      const res  = await fetch(`/api/projects/${params.id}/report`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? 'CVR_Report.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExportingPDF(false) }
  }

  const badge = ROLE_BADGE[role]
  const visibleNav = NAV.filter(n => navVisibleForRole(n.href, role))

  return (
    <div className="flex flex-col h-full py-4">
      {/* Back + branding */}
      <div className="px-4 mb-3">
        <a href="/portfolio"
          className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-700 transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_back</span>
          All projects
        </a>
      </div>
      <div className="px-4 mb-5">
        <img src="/logo.png" alt="ExtraOver" style={{ width: 140, height: 'auto' }} />
        <p className="text-[10px] text-slate-500 font-medium px-0.5 uppercase tracking-wider mt-1">Cost Reporting</p>
      </div>

      {/* Nav — filtered by role */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ href, label, icon }) => {
          const full   = `/${params.id}/${href}`
          const active = pathname === full || pathname.startsWith(full + '/')
          return (
            <Link key={href} href={full} onClick={onNav}
              className={clx(
                'flex items-center gap-3 px-4 py-2 text-xs font-semibold transition-colors',
                active
                  ? 'border-l-2 border-slate-700 bg-slate-200/50 text-slate-900'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/30 border-l-2 border-transparent'
              )}>
              <span className="material-symbols-outlined mat-sm flex-shrink-0">{icon}</span>
              <span>{navLabels[href] ?? label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-4 space-y-3 pt-4 border-t border-slate-200/70">
        <button onClick={exportExcel} disabled={exporting}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded font-bold text-xs text-white transition-all disabled:opacity-50 hover:opacity-90 active:scale-95"
          style={{ background: '#456919', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
            {exporting ? 'hourglass_empty' : 'download'}
          </span>
          <span>{exporting ? 'Exporting…' : '⬇ Export to Excel'}</span>
        </button>

        <button onClick={exportPDF} disabled={exportingPDF}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded font-bold text-xs text-white transition-all disabled:opacity-50 hover:opacity-90 active:scale-95"
          style={{ background: '#9f403d', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
            {exportingPDF ? 'hourglass_empty' : 'picture_as_pdf'}
          </span>
          <span>{exportingPDF ? 'Generating…' : '⬇ Export PDF Report'}</span>
        </button>

        <ProjectSwitcher />

        {/* User identity + role */}
        <div className="flex items-center justify-between bg-slate-200/40 px-2.5 py-2 rounded">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-700 truncate">{userName}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: badge.bg, color: badge.text }}>
                {badge.label}
              </span>
            </div>
          </div>
          <button onClick={handleSignOut}
            title="Sign out"
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
          </button>
        </div>

        {/* Admin link — owner only */}
        {role === 'owner' && (
          <a href="/admin/users"
            className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-900 transition-colors">
            <span className="material-symbols-outlined mat-sm">admin_panel_settings</span>
            <span>Manage users</span>
          </a>
        )}

        <div className="text-[10px] text-slate-400 text-center pb-0.5 select-none">
          ExtraOver v27
        </div>
      </div>
    </div>
  )
}

export default function LayoutClient({
  children, params, role, userName, terms = DEFAULT_TERMS,
}: {
  children: React.ReactNode
  params: { id: string }
  role: Role
  userName: string
  terms?: Terms
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setDrawerOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[208px] border-r border-slate-200 bg-slate-100 flex-col z-50">
        <SidebarContents params={params} role={role} userName={userName} terms={terms} />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2.5 bg-[#1e3a5f] shadow-md">
        <button onClick={() => setDrawerOpen(true)} className="text-white p-1 rounded hover:bg-white/10">
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>menu</span>
        </button>
        <img src="/logo.png" alt="ExtraOver" style={{ width: 90, height: 'auto', filter: 'invert(1) brightness(2)' }} />
        <a href="/portfolio" className="text-white p-1 rounded hover:bg-white/10">
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>grid_view</span>
        </a>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="lg:hidden fixed left-0 top-0 h-screen w-[240px] bg-slate-100 border-r border-slate-200 z-50 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-slate-200">
              <img src="/logo.png" alt="ExtraOver" style={{ width: 110, height: 'auto' }} />
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <SidebarContents params={params} role={role} userName={userName} terms={terms} onNav={() => setDrawerOpen(false)} />
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden lg:ml-[208px] pt-[48px] lg:pt-0">
        {children}
      </main>
    </div>
  )
}
