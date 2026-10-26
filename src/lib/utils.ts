// ── Palette (from original Excel Summary sheet) ───────────────────────────
export const C = {
  navy:     '#5b626e',   // main headers, sidebar, page header bar
  navyMid:  '#1A3A7A',   // sub-headers, hover
  navyLt:   '#E8EDF7',   // light navy tint
  red:      '#c8412a',   // Value / CTD section headers
  redLt:    '#fbeae6',   // Value certified cells, pale pink
  gold:     '#b6740a',   // Profit / P&L section headers
  goldLt:   '#fcf2e2',   // P&L cells, pale yellow
  olive:    '#DEE5B5',   // Forecast section headers
  oliveLt:  '#f3faf6',   // Forecast sub-cells, light olive
  input:    '#eef2ff',   // yellow input cells
  white:    '#FFFFFF',
  gray50:   '#F9FAFB',
  gray100:  '#f1f2f5',
  gray200:  '#e7e9ee',
  gray400:  '#8b93a1',
  gray600:  '#5b626e',
  gray800:  '#1F2937',
}

// ── Formatters ────────────────────────────────────────────────────────────
export function fmt(n: number, decimals = 0): string {
  if (!isFinite(n)) return '–'
  if (n === 0) return '–'
  const sign = n < 0 ? '(' : ''
  const end  = n < 0 ? ')' : ''
  const abs  = Math.abs(n)
  return `${sign}€${abs.toLocaleString('en-IE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${end}`
}

export function pct(n: number): string {
  if (!isFinite(n)) return '–'
  return `${(n * 100).toFixed(1)}%`
}

export function clx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ── Forecast margin status (RAG) ──────────────────────────────────────────
// The one rule for every screen, export and PDF. A project is measured
// against its own target margin % (original margin / adjusted contract sum,
// as shown in Settings):
//   green  forecast margin % at target, above it, or within 1 point below
//   amber  more than 1 point below target, but still a forecast profit
//   red    a forecast loss
// Projects with no target margin set are measured against a 5% default.
export type MarginRag = 'green' | 'amber' | 'red'

export const MARGIN_TARGET_SLACK   = 0.01
export const DEFAULT_TARGET_MARGIN = 0.05

export const MARGIN_RAG: Record<MarginRag, { label: string; colour: string; text: string }> = {
  green: { label: 'On track',     colour: '#0a8a54', text: '#0a6e44' },
  amber: { label: 'Below target', colour: '#b6740a', text: '#7F4500' },
  red:   { label: 'Loss',         colour: '#c8412a', text: '#a23015' },
}

/** Target margin as a fraction of the adjusted sum, or null when not set. */
export function targetMarginPct(originalMargin: number, adjustedSum: number): number | null {
  return adjustedSum > 0 && originalMargin > 0 ? originalMargin / adjustedSum : null
}

export function marginRag(forecastPct: number, originalMargin: number, adjustedSum: number): MarginRag {
  if (forecastPct < 0) return 'red'
  const target = targetMarginPct(originalMargin, adjustedSum) ?? DEFAULT_TARGET_MARGIN
  // Small tolerance so a margin exactly 1 point below target stays green
  return forecastPct + 1e-9 >= target - MARGIN_TARGET_SLACK ? 'green' : 'amber'
}

/** Short status line, e.g. "On track, target 6.0%". */
export function marginRagSub(forecastPct: number, originalMargin: number, adjustedSum: number): string {
  const target = targetMarginPct(originalMargin, adjustedSum)
  const label  = MARGIN_RAG[marginRag(forecastPct, originalMargin, adjustedSum)].label
  return target != null ? `${label}, target ${pct(target)}` : `${label}, default target ${pct(DEFAULT_TARGET_MARGIN)}`
}

// ── Status badge colours ──────────────────────────────────────────────────
export const STATUS_COLOURS: Record<string, string> = {
  Estimate:                    'bg-gray-100 text-gray-700',
  Quote:                       'bg-[#E8EDF7] text-[#5b626e]',
  Final:                       'bg-[#f3faf6] text-[#0a8a54]',
  'Variation - Recoverable':   'bg-[#fcf2e2] text-[#7F4500]',
  'Variation - Non Recoverable':'bg-[#fbeae6] text-[#7A0000]',
  Contingency:                 'bg-[#f3faf6] text-[#0a8a54]',
  Placed:                      'bg-[#f3faf6] text-[#0a8a54]',
  Pending:                     'bg-[#fcf2e2] text-[#7F4500]',
  Provisional:                 'bg-[#fbeae6] text-[#7A0000]',
  Forecast:                    'bg-[#E8EDF7] text-[#5b626e]',
  'On Hold':                   'bg-gray-100 text-gray-500',
  Cancelled:                   'bg-[#fbeae6] text-[#7A0000]',
}

export const CATEGORY_COLOURS: Record<string, string> = {
  Labour:        'bg-[#E8EDF7] text-[#5b626e]',
  Plant:         'bg-[#f3faf6] text-[#0a8a54]',
  Materials:     'bg-[#DEE5B5] text-[#0a8a54]',
  Subcontractor: 'bg-[#fcf2e2] text-[#7F4500]',
  Indirect:      'bg-gray-100 text-gray-600',
}
