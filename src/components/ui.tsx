import { clx } from '@/lib/utils'

// ── Page Header ───────────────────────────────────────────────────────────
// White bar with thin bottom border — matches Stitch header pattern
export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode
}) {
  return (
    <header className="min-h-12 flex items-center justify-between px-4 md:px-8 py-2 md:py-0 md:h-14 bg-white border-b border-outline-variant/20 shrink-0 flex-wrap gap-2">
      <div className="min-w-0">
        <h2 className="text-base md:text-lg font-black text-on-surface tracking-tight uppercase truncate">{title}</h2>
        {subtitle && (
          <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-medium uppercase tracking-widest mt-0.5 hidden sm:flex">
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">{actions}</div>}
    </header>
  )
}

// ── Section Panel ─────────────────────────────────────────────────────────
// White card with thin top colour accent bar — matches Stitch panel pattern
export function Panel({ children, accent = 'primary', className }: {
  children: React.ReactNode
  accent?: 'primary' | 'error' | 'tertiary' | 'amber' | 'outline'
  className?: string
}) {
  const bar: Record<string, string> = {
    primary:  'bg-primary',
    error:    'bg-cvr-value',
    tertiary: 'bg-tertiary',
    amber:    'bg-cvr-profit',
    outline:  'bg-outline-variant',
  }
  return (
    <div className={clx('bg-surface-container-lowest overflow-hidden', className)}>
      <div className={clx('h-1 w-full', bar[accent])} />
      {children}
    </div>
  )
}

// ── Section Header (inside panels) ────────────────────────────────────────
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center mb-5">
      <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">{children}</h3>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, trend, accent = 'default' }: {
  label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral'
  accent?: 'default' | 'profit' | 'loss' | 'warning'
}) {
  const valueColour: Record<string, string> = {
    default: 'text-on-surface',
    profit:  'text-tertiary',
    loss:    'text-error',
    warning: 'text-amber-600',
  }
  const trendIcon: Record<string, string> = { up: 'trending_up', down: 'trending_down', neutral: 'trending_flat' }
  const trendColour: Record<string, string> = { up: 'text-tertiary', down: 'text-error', neutral: 'text-on-surface-variant' }

  return (
    <div className="bg-surface-container-low p-4 flex flex-col justify-between h-24">
      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
      <div>
        <span className={clx('text-2xl font-black tabular-nums tracking-tight', valueColour[accent])}>
          {value}
        </span>
        {sub && (
          <div className={clx('flex items-center gap-1 text-[10px] font-bold mt-1',
            trend ? trendColour[trend] : 'text-on-surface-variant')}>
            {trend && <span className="material-symbols-outlined mat-xs">{trendIcon[trend]}</span>}
            <span>{sub}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'default', className }: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  className?: string
}) {
  const styles: Record<string, string> = {
    default: 'bg-surface-container text-on-surface-variant border border-outline-variant/30',
    success: 'bg-tertiary/10 text-tertiary border border-tertiary/20',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200',
    error:   'bg-error/10 text-error border border-error/20',
    info:    'bg-primary-container text-on-primary-container border border-primary/20',
  }
  return (
    <span className={clx('inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-sm', className || styles[variant])}>
      {children}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'; disabled?: boolean; type?: 'button' | 'submit'
}) {
  const v: Record<string, string> = {
    primary:   'bg-primary text-on-primary hover:bg-primary-dim',
    secondary: 'bg-white text-on-surface border border-outline-variant hover:bg-surface-container-low',
    danger:    'bg-cvr-value text-white hover:bg-red-800',
    ghost:     'text-on-surface-variant hover:bg-surface-container',
  }
  const s: Record<string, string> = {
    sm: 'px-3 py-1 text-[10px] font-bold uppercase tracking-tight',
    md: 'px-4 py-1.5 text-xs font-bold uppercase tracking-tight',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={clx('inline-flex items-center gap-1.5 rounded transition-colors disabled:opacity-40', v[variant], s[size])}>
      {children}
    </button>
  )
}

// ── Table helpers ─────────────────────────────────────────────────────────
// Header accent colours map to CVR semantic colours
const TH_STYLES: Record<string, string> = {
  default:   'bg-surface-container-high text-on-surface-variant',
  primary:   'bg-primary text-on-primary',
  value:     'bg-cvr-value text-white',
  profit:    'bg-cvr-profit text-on-surface',
  forecast:  'bg-tertiary text-on-tertiary',
  dark:      'bg-on-surface text-surface-container-low',
}

export function Th({ children, right, accent = 'default', className }: {
  children: React.ReactNode; right?: boolean
  accent?: keyof typeof TH_STYLES; className?: string
}) {
  return (
    <th className={clx(
      'px-3 py-2.5 text-[10px] font-bold whitespace-nowrap sticky top-0 uppercase tracking-wide',
      right ? 'text-right' : 'text-left',
      TH_STYLES[accent] || TH_STYLES.default,
      className
    )}>
      {children}
    </th>
  )
}

export function Td({ children, right, bold, muted, className }: {
  children: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean; className?: string
}) {
  return (
    <td className={clx(
      'px-3 py-2 text-xs border-b border-outline-variant/10 whitespace-nowrap',
      right  ? 'text-right tabular-nums' : 'text-left',
      bold   ? 'font-bold'  : 'font-medium',
      muted  ? 'text-on-surface-variant' : 'text-on-surface',
      className
    )}>
      {children}
    </td>
  )
}

// ── Movement cell (period comparison) ────────────────────────────────────
export function MovCell({ value, formatted }: { value: number; formatted: string }) {
  if (value === 0) return <span className="text-outline-variant tabular-nums">–</span>
  return (
    <span className={clx('tabular-nums font-bold flex items-center gap-0.5 justify-end',
      value > 0 ? 'text-tertiary' : 'text-error')}>
      <span className="material-symbols-outlined mat-xs">
        {value > 0 ? 'arrow_drop_up' : 'arrow_drop_down'}
      </span>
      {formatted}
    </span>
  )
}

// ── Status RAG chip ───────────────────────────────────────────────────────
export function RagChip({ status }: { status: 'green' | 'amber' | 'red' }) {
  const cfg = {
    green: { bg: 'bg-tertiary/10 border-tertiary/20 text-tertiary', label: 'On Track' },
    amber: { bg: 'bg-amber-50 border-amber-200 text-amber-700',     label: 'At Risk'  },
    red:   { bg: 'bg-error/10 border-error/20 text-error',          label: 'Critical' },
  }
  return (
    <span className={clx('px-2 py-0.5 text-[9px] font-black uppercase tracking-wide rounded-sm border', cfg[status].bg)}>
      {cfg[status].label}
    </span>
  )
}
