'use client'
import { useRef, useEffect } from 'react'

// Uncontrolled numeric input for grid tables.
// - Never loses focus during typing (no onChange state update in parent)
// - Enter blurs + saves, then lets the table keydown nav move focus
// - Tab lets the browser handle naturally (correct order)
// - onSave fires asynchronously (via microtask) so nav completes first

interface Props {
  value: number
  onSave: (n: number) => void
  allowDecimals?: boolean
  className?: string
  readOnly?: boolean
  placeholder?: string
  dimZero?: boolean
}

function fmt(n: number, decimals: boolean): string {
  if (!n && n !== 0) return ''
  if (decimals) return n.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return Math.round(n).toLocaleString('en-IE')
}

function parse(s: string): number {
  return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0
}

export default function GridInput({
  value, onSave, allowDecimals = false, className, readOnly, placeholder = '', dimZero,
}: Props) {
  const ref       = useRef<HTMLInputElement>(null)
  const focused   = useRef(false)
  const committed = useRef(value)

  // Sync display value only when not actively editing
  useEffect(() => {
    if (ref.current && !focused.current) {
      ref.current.value = fmt(value, allowDecimals)
      committed.current = value
    }
  }, [value, allowDecimals])

  if (readOnly) {
    return (
      <div className="w-full px-2.5 py-1 text-xs text-right tabular-nums text-on-surface-variant select-none">
        {dimZero && !value ? '—' : fmt(value, allowDecimals)}
      </div>
    )
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      defaultValue={fmt(value, allowDecimals)}
      placeholder={placeholder}
      className={className ?? 'grid-input'}

      onFocus={(e) => {
        focused.current = true
        // Show raw number while editing
        e.target.value = committed.current ? String(
          allowDecimals ? committed.current : Math.round(committed.current)
        ) : ''
        // Select all for easy overwrite
        e.target.select()
      }}

      onBlur={(e) => {
        focused.current = false
        const v = parse(e.target.value)
        committed.current = v
        // Reformat for display
        e.target.value = fmt(v, allowDecimals)
        // Fire save in a microtask so focus navigation completes first
        queueMicrotask(() => onSave(v))
      }}

      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          // Prevent the keydown from bubbling to the table nav handler
          // BEFORE we blur — otherwise nav fires on the current cell again
          e.stopPropagation()
          e.preventDefault()
          const v = parse((e.target as HTMLInputElement).value)
          committed.current = v
          focused.current = false
          ;(e.target as HTMLInputElement).value = fmt(v, allowDecimals)
          queueMicrotask(() => onSave(v))
          // Manually move down one row using the data attributes
          const td    = (e.target as HTMLElement).closest('td[data-col]') as HTMLElement | null
          const tr    = (e.target as HTMLElement).closest('tr[data-row]') as HTMLElement | null
          const table = (e.target as HTMLElement).closest('table') as HTMLElement | null
          if (td && tr && table) {
            const row = parseInt(tr.getAttribute('data-row')!, 10)
            const col = parseInt(td.getAttribute('data-col')!, 10)
            const nextTr = table.querySelector(`tr[data-row="${row + 1}"]`)
            const nextTd = nextTr?.querySelector(`td[data-col="${col}"]`)
            const nextInput = nextTd?.querySelector<HTMLElement>('input:not([disabled])')
            nextInput?.focus()
            ;(nextInput as HTMLInputElement)?.select?.()
          }
        }
        // All other keys (Tab, Arrows) bubble up to the table handler normally
      }}
    />
  )
}
