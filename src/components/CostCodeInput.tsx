'use client'
import { useState, useEffect, useRef } from 'react'

interface CostCode {
  code: string
  description: string
  trade: string
  category: string
}

interface Props {
  projectId: string
  value: string
  field: 'code' | 'description'
  onSelect: (cc: CostCode) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
  placeholder?: string
  inputStyle?: React.CSSProperties
}

// Global cache so we only fetch once per project per session
const cache: Record<string, CostCode[]> = {}

export default function CostCodeInput({ projectId, value, field, onSelect, onKeyDown, className, placeholder, inputStyle }: Props) {
  const [query, setQuery]       = useState(value)
  const [options, setOptions]   = useState<CostCode[]>([])
  const [open, setOpen]         = useState(false)
  const [codes, setCodes]       = useState<CostCode[]>([])
  const ref                     = useRef<HTMLDivElement>(null)

  // Fetch cost codes (cached)
  useEffect(() => {
    if (cache[projectId]) { setCodes(cache[projectId]); return }
    fetch(`/api/projects/${projectId}/cost-codes`)
      .then(r => r.json())
      .then((rows: any[]) => {
        const mapped = rows.map(r => ({ code: r.code, description: r.description, trade: r.trade, category: r.category }))
        cache[projectId] = mapped
        setCodes(mapped)
      })
  }, [projectId])

  // Sync external value changes
  useEffect(() => { setQuery(value) }, [value])

  // Filter on keystroke
  function handleChange(val: string) {
    setQuery(val)
    if (!val.trim()) { setOptions([]); setOpen(false); return }
    const q = val.toLowerCase()
    const filtered = codes.filter(c =>
      field === 'code'
        ? c.code.toLowerCase().includes(q)
        : c.description.toLowerCase().includes(q)
    ).slice(0, 12)
    setOptions(filtered)
    setOpen(filtered.length > 0)
  }

  function select(cc: CostCode) {
    setQuery(field === 'code' ? cc.code : cc.description)
    setOpen(false)
    onSelect(cc)
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder ?? (field === 'code' ? 'Code…' : 'Description…')}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (options.length) setOpen(true) }}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
          onKeyDown?.(e)
        }}
        className={className} style={inputStyle}
      />
      {open && (
        <div className="absolute z-50 left-0 top-full mt-0.5 bg-white border border-gray-200 rounded shadow-lg w-80 max-h-52 overflow-auto text-xs">
          {options.map(cc => (
            <button key={cc.code} type="button"
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-50"
              onMouseDown={() => select(cc)}>
              <span className="font-mono font-bold text-[#565e74] w-20 flex-shrink-0">{cc.code}</span>
              <span className="text-gray-700 flex-1 truncate">{cc.description}</span>
              <span className="text-gray-400 text-[10px] flex-shrink-0">{cc.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
