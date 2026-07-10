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
  { href: 'dashboard',     label: 'Dashboard',       icon: 'dashboard',        section: 'Reporting' },
  { href: 'trade',         label: 'CVR Table',       icon: 'analytics',        section: 'Reporting' },
  { href: 'efc-breakdown', label: 'EFC Breakdown',   icon: 'table_chart',      section: 'Reporting' },
  { href: 'periods',       label: 'Period History',  icon: 'calendar_month',   section: 'Reporting' },
  { href: 'budget',        label: 'Budget',          icon: 'account_balance',  section: 'Commercial' },
  { href: 'value',         label: 'Value / Claims',  icon: 'payments',         section: 'Commercial' },
  { href: 'variations',    label: 'Variations',      icon: 'difference',       section: 'Commercial' },
  { href: 'prelims',       label: 'Prelims',         icon: 'engineering',      section: 'Commercial' },
  { href: 'forecast',      label: 'Forecast',        icon: 'trending_up',      section: 'Commercial' },
  { href: 'cost-to-date',  label: 'Cost to Date',    icon: 'receipt_long',     section: 'Cost ledger' },
  { href: 'committed',     label: 'Committed',       icon: 'shopping_cart',    section: 'Cost ledger' },
  { href: 'subcontractors', label: 'Subcontractors',  icon: 'handshake',        section: 'Cost ledger' },
  { href: 's-curve',       label: 'Cashflow',        icon: 'show_chart',       section: 'Cost ledger' },
  { href: 'cost-codes',    label: 'Cost Codes',      icon: 'tag',              section: 'Cost ledger' },
  { href: 'audit',         label: 'Audit Log',       icon: 'history',          section: 'Governance' },
  { href: 'checks',        label: 'Checks',          icon: 'fact_check',       section: 'Governance' },
  { href: 'settings',      label: 'Settings',        icon: 'settings',         section: 'Governance' },
]

const ROLE_BADGE: Record<Role, { label: string; bg: string; text: string }> = {
  owner:  { label: 'Owner',  bg: '#eef2ff', text: '#1a45c0' },
  editor: { label: 'Editor', bg: '#f3faf6', text: '#0a8a54' },
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

      {/* Nav — filtered by role, grouped by section */}
      <nav className="flex-1 overflow-y-auto">
        {visibleNav.map(({ href, label, icon, section }, i) => {
          const full   = `/${params.id}/${href}`
          const active = pathname === full || pathname.startsWith(full + '/')
          const newSection = i === 0 || visibleNav[i - 1].section !== section
          return (
            <div key={href}>
              {newSection && (
                <div className="px-4 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a1]"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  {section}
                </div>
              )}
              <Link href={full} onClick={onNav}
                className={clx(
                  'flex items-center gap-3 px-4 py-2 text-xs font-semibold transition-colors border-l-[3px]',
                  active
                    ? 'border-[#1c4ed8] bg-[#eef2ff] text-[#1a1d23]'
                    : 'border-transparent text-[#5b626e] hover:text-[#1a1d23] hover:bg-[#f1f2f5]'
                )}>
                <span className={clx('material-symbols-outlined mat-sm flex-shrink-0', active ? 'text-[#1c4ed8]' : '')}>{icon}</span>
                <span>{navLabels[href] ?? label}</span>
              </Link>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-4 space-y-3 pt-4 border-t border-slate-200/70">
        <button onClick={exportExcel} disabled={exporting}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded font-bold text-xs text-white transition-all disabled:opacity-50 hover:opacity-90 active:scale-95"
          style={{ background: '#1c4ed8', boxShadow: '0 1px 2px rgba(28,78,216,0.25)', borderRadius: 9 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
            {exporting ? 'hourglass_empty' : 'download'}
          </span>
          <span>{exporting ? 'Exporting…' : '⬇ Export to Excel'}</span>
        </button>

        <button onClick={exportPDF} disabled={exportingPDF}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 font-bold text-xs transition-all disabled:opacity-50 hover:opacity-90 active:scale-95"
          style={{ background: '#ffffff', color: '#1a45c0', border: '1px solid #d6e0ff', borderRadius: 9 }}>
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
          ExtraOver v43
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
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[208px] border-r border-[#e7e9ee] bg-[#fbfbfc] flex-col z-50">
        <SidebarContents params={params} role={role} userName={userName} terms={terms} />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2.5 bg-[#1a1d23] shadow-md">
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
          <div className="lg:hidden fixed left-0 top-0 h-screen w-[240px] bg-[#fbfbfc] border-r border-[#e7e9ee] z-50 shadow-2xl overflow-y-auto">
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
