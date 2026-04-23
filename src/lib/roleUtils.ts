// Pure role utilities — no server-side imports.
// Safe to use in both server and client components.

export type Role = 'owner' | 'editor' | 'viewer'

// Pages visible to each role in the sidebar
export const VIEWER_PAGES = new Set([
  'periods', 'dashboard', 'efc-breakdown', 's-curve', 'variations',
])

export const EDITOR_HIDDEN_PAGES = new Set([
  'settings',
])

export function navVisibleForRole(href: string, role: Role): boolean {
  if (role === 'owner')  return true
  if (role === 'editor') return !EDITOR_HIDDEN_PAGES.has(href)
  return VIEWER_PAGES.has(href)
}

// Pages blocked entirely for viewers (server redirects to dashboard)
export const VIEWER_BLOCKED = new Set([
  'trade', 'value', 'prelims', 'forecast', 'budget',
  'cost-to-date', 'committed', 'settings', 'cost-codes', 'checks', 'audit',
])
