// ── Palette (from original Excel Summary sheet) ───────────────────────────
export const C = {
  navy:     '#565e74',   // main headers, sidebar, page header bar
  navyMid:  '#1A3A7A',   // sub-headers, hover
  navyLt:   '#E8EDF7',   // light navy tint
  red:      '#C00000',   // Value / CTD section headers
  redLt:    '#FFB9B9',   // Value certified cells, pale pink
  gold:     '#FFC000',   // Profit / P&L section headers
  goldLt:   '#FFEEB9',   // P&L cells, pale yellow
  olive:    '#DEE5B5',   // Forecast section headers
  oliveLt:  '#F1F4E0',   // Forecast sub-cells, light olive
  input:    '#FFFFC7',   // yellow input cells
  white:    '#FFFFFF',
  gray50:   '#F9FAFB',
  gray100:  '#F3F4F6',
  gray200:  '#E5E7EB',
  gray400:  '#9CA3AF',
  gray600:  '#4B5563',
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

// ── Status badge colours ──────────────────────────────────────────────────
export const STATUS_COLOURS: Record<string, string> = {
  Estimate:                    'bg-gray-100 text-gray-700',
  Quote:                       'bg-[#E8EDF7] text-[#565e74]',
  Final:                       'bg-[#F1F4E0] text-[#456919]',
  'Variation - Recoverable':   'bg-[#FFEEB9] text-[#7F4500]',
  'Variation - Non Recoverable':'bg-[#FFB9B9] text-[#7A0000]',
  Contingency:                 'bg-[#F1F4E0] text-[#456919]',
  Placed:                      'bg-[#F1F4E0] text-[#456919]',
  Pending:                     'bg-[#FFEEB9] text-[#7F4500]',
  Provisional:                 'bg-[#FFB9B9] text-[#7A0000]',
  Forecast:                    'bg-[#E8EDF7] text-[#565e74]',
  'On Hold':                   'bg-gray-100 text-gray-500',
  Cancelled:                   'bg-[#FFB9B9] text-[#7A0000]',
}

export const CATEGORY_COLOURS: Record<string, string> = {
  Labour:        'bg-[#E8EDF7] text-[#565e74]',
  Plant:         'bg-[#F1F4E0] text-[#456919]',
  Materials:     'bg-[#DEE5B5] text-[#456919]',
  Subcontractor: 'bg-[#FFEEB9] text-[#7F4500]',
  Indirect:      'bg-gray-100 text-gray-600',
}
