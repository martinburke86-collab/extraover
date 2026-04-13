'use client'
import { useState } from 'react'
import { clx } from '@/lib/utils'

// Shared comma-formatted money input
// Shows 100,000 as you type — saves as a plain number on blur
interface Props {
  value: number | null
  onChange?: (n: number) => void   // called on every keystroke (for live totals)
  onSave?: (n: number) => void     // called on blur
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
  placeholder?: string
  allowDecimals?: boolean
}

export default function MoneyInput({ value, onChange, onSave, onKeyDown, className, placeholder = '0', allowDecimals = false }: Props) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw]         = useState('')

  function toDisplay(digits: string): string {
    if (!digits) return ''
    const n = Number(digits.replace(/,/g, ''))
    if (isNaN(n)) return digits
    return n.toLocaleString('en-IE')
  }

  const displayVal = focused
    ? toDisplay(raw)
    : (value ? Math.round(value).toLocaleString('en-IE') : '')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, '')
    setRaw(digits)
    if (onChange) onChange(parseInt(digits, 10) || 0)
  }

  function handleFocus() {
    setFocused(true)
    setRaw(value ? String(Math.round(value)) : '')
  }

  function handleBlur() {
    setFocused(false)
    const n = parseInt(raw.replace(/,/g, ''), 10) || 0
    if (onSave) onSave(n)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayVal}
      placeholder={placeholder}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        onKeyDown?.(e)
      }}
      className={clx(
        'no-spin border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
        className
      )}
      style={{ background: '#FFFFC7' }}
    />
  )
}
