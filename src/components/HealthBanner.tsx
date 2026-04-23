'use client'
import { useState } from 'react'
import { clx } from '@/lib/utils'
import type { HealthIssue, Severity } from '@/lib/healthCheck'
import { useRouter } from 'next/navigation'

const SEVERITY_CONFIG: Record<Severity, {
  bg: string; border: string; icon: string; iconCol: string; labelBg: string; labelText: string; label: string
}> = {
  error: {
    bg: '#FEF2F2', border: '#FECACA', icon: 'error',
    iconCol: '#9f403d', labelBg: '#FEE2E2', labelText: '#7f1d1d', label: 'Critical',
  },
  warning: {
    bg: '#FFFBEB', border: '#FDE68A', icon: 'warning',
    iconCol: '#92400e', labelBg: '#FEF3C7', labelText: '#78350f', label: 'Warning',
  },
  info: {
    bg: '#EFF6FF', border: '#BFDBFE', icon: 'info',
    iconCol: '#1e40af', labelBg: '#DBEAFE', labelText: '#1e3a8a', label: 'Info',
  },
}

function IssueRow({ issue, projectId, onDismiss }: {
  issue: HealthIssue; projectId: string; onDismiss: (id: string) => void
}) {
  const cfg = SEVERITY_CONFIG[issue.severity]
  const router = useRouter()

  return (
    <div className={clx('flex items-start gap-3 px-4 py-2.5 border-b last:border-0')}
      style={{ borderColor: cfg.border + '80' }}>
      <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: 15, color: cfg.iconCol }}>
        {cfg.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-on-surface">{issue.title}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: cfg.labelBg, color: cfg.labelText }}>
            {cfg.label}
          </span>
        </div>
        <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">{issue.detail}</p>
      </div>
      {issue.href && (
        <button
          onClick={() => router.push(`/${projectId}/${issue.href}`)}
          className="text-[11px] font-medium whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded border transition-colors hover:opacity-80"
          style={{ borderColor: cfg.border, color: cfg.iconCol, background: cfg.labelBg }}>
          Fix →
        </button>
      )}
      <button
        onClick={() => onDismiss(issue.id)}
        className="text-on-surface-variant/40 hover:text-on-surface-variant flex-shrink-0 transition-colors"
        title="Dismiss">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
      </button>
    </div>
  )
}

export default function HealthBanner({ issues, projectId }: {
  issues: HealthIssue[]; projectId: string
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(false)

  function dismiss(id: string) {
    setDismissed(prev => new Set([...Array.from(prev), id]))
  }

  const visible = issues.filter(i => !dismissed.has(i.id))
  if (visible.length === 0) return null

  const errors   = visible.filter(i => i.severity === 'error')
  const warnings = visible.filter(i => i.severity === 'warning')
  const infos    = visible.filter(i => i.severity === 'info')

  // Banner border/bg follows highest severity
  const topSev = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info'
  const cfg = SEVERITY_CONFIG[topSev]

  return (
    <div className="mx-6 mt-4 rounded-lg border overflow-hidden flex-shrink-0"
      style={{ borderColor: cfg.border, background: cfg.bg }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: cfg.border, background: cfg.labelBg + '80' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: cfg.iconCol }}>
          health_and_safety
        </span>
        <span className="text-xs font-bold text-on-surface flex-1">
          CVR Health Check
          <span className="ml-2 font-normal text-on-surface-variant">
            {visible.length} issue{visible.length !== 1 ? 's' : ''} found
            {errors.length > 0 && <span className="ml-1 text-[#9f403d]">· {errors.length} critical</span>}
            {warnings.length > 0 && <span className="ml-1 text-amber-700">· {warnings.length} warning{warnings.length > 1 ? 's' : ''}</span>}
          </span>
        </span>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-on-surface-variant hover:text-on-surface transition-colors text-[11px] flex items-center gap-1">
          {collapsed ? 'Show' : 'Hide'}
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            {collapsed ? 'expand_more' : 'expand_less'}
          </span>
        </button>
        <button
          onClick={() => visible.forEach(i => dismiss(i.id))}
          className="text-[11px] text-on-surface-variant hover:text-on-surface transition-colors ml-1">
          Dismiss all
        </button>
      </div>

      {/* Issues */}
      {!collapsed && (
        <div>
          {/* Errors first */}
          {errors.map(i => <IssueRow key={i.id} issue={i} projectId={projectId} onDismiss={dismiss} />)}
          {warnings.map(i => <IssueRow key={i.id} issue={i} projectId={projectId} onDismiss={dismiss} />)}
          {infos.map(i => <IssueRow key={i.id} issue={i} projectId={projectId} onDismiss={dismiss} />)}
        </div>
      )}
    </div>
  )
}
