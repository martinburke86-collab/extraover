'use client'
import { useState, useEffect } from 'react'
import { Sigma } from 'lucide-react'
import { clx } from '@/lib/utils'
import BreakdownPane from './BreakdownPane'

interface Props {
  projectId:   string
  parentId:    string
  parentType:  'forecast' | 'committed' | 'prelim' | 'ctd'
  parentField: 'qty' | 'rate' | 'total'
  parentLabel: string
  value:       number
  onSave:      (v: number) => void
  isBuiltUp?:  boolean      // passed in from parent if known
  width?:      string
  className?:  string
}

// Global cache: parentId+field → { isBuiltUp, total }
const buCache: Record<string, { isBuiltUp: boolean; total: number }> = {}

export default function BreakdownCell({
  projectId, parentId, parentType, parentField,
  parentLabel, value, onSave, width = 'w-28', className,
}: Props) {
  const cacheKey = `${parentId}:${parentField}`
  const [paneOpen, setPaneOpen]   = useState(false)
  const [isBuiltUp, setIsBuiltUp] = useState(buCache[cacheKey]?.isBuiltUp ?? false)
  const [buTotal, setBuTotal]     = useState(buCache[cacheKey]?.total ?? value)
  const [editing, setEditing]     = useState(false)
  const [raw, setRaw]             = useState('')

  // Check if a breakdown exists for this cell (lazy load)
  useEffect(() => {
    if (buCache[cacheKey] !== undefined) return
    fetch(`/api/projects/${projectId}/breakdowns?parentId=${parentId}&parentType=${parentType}&parentField=${parentField}`)
      .then(r => r.json())
      .then(data => {
        const hasRows = (data.rows?.length || 0) > 0
        const tot     = data.total || 0
        buCache[cacheKey] = { isBuiltUp: hasRows, total: tot }
        setIsBuiltUp(hasRows)
        if (hasRows) setBuTotal(tot)
      })
  }, [cacheKey, parentId, parentType, parentField, projectId])

  function handleApply(total: number) {
    buCache[cacheKey] = { isBuiltUp: true, total }
    setIsBuiltUp(true)
    setBuTotal(total)
    onSave(total)
  }

  const displayValue = isBuiltUp ? buTotal : value
  const fmtVal = displayValue
    ? displayValue.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : ''

  return (
    <>
      <div className={clx('flex items-center gap-0.5', className)}>
        {/* Value input */}
        {editing ? (
          <input
            type="text"
            autoFocus
            value={raw}
            onChange={e => setRaw(e.target.value.replace(/[^0-9.-]/g, ''))}
            onBlur={() => {
              setEditing(false)
              const v = parseFloat(raw) || 0
              // Editing directly clears the built-up state
              buCache[cacheKey] = { isBuiltUp: false, total: v }
              setIsBuiltUp(false)
              onSave(v)
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className={clx(width, 'no-spin border rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#565e74]')}
            style={{ background: '#FFFFC7', borderColor: '#565e74' }}
          />
        ) : (
          <input
            type="text"
            readOnly
            value={fmtVal}
            placeholder="0.00"
            title={isBuiltUp ? `Built-up total: ${fmtVal}` : 'Click to edit (hard key)'}
            onFocus={() => { setEditing(true); setRaw(displayValue ? String(displayValue) : '') }}
            className={clx(
              width, 'border rounded px-1.5 py-0.5 text-xs text-right cursor-text focus:outline-none',
              isBuiltUp
                ? 'border-[#DEE5B5] font-semibold'  // built-up style
                : 'border-gray-200'                   // hard-keyed style
            )}
            style={{
              background: isBuiltUp ? '#F1F4E0' : '#FFFFC7',
              color: isBuiltUp ? '#456919' : '#1F2937',
            }}
          />
        )}

        {/* Σ button */}
        <button
          onClick={e => { e.stopPropagation(); setPaneOpen(true) }}
          title={isBuiltUp ? 'Edit breakdown (built-up value)' : 'Add rate/quantity breakdown'}
          className={clx(
            'flex-shrink-0 flex items-center justify-center rounded transition-all',
            'w-6 h-[22px] border text-[10px]',
            isBuiltUp
              ? 'border-[#DEE5B5] text-[#456919] hover:bg-[#DEE5B5]'
              : 'border-gray-200 text-gray-400 hover:border-[#565e74] hover:text-[#565e74]'
          )}
          style={{ background: isBuiltUp ? '#F1F4E0' : 'white' }}>
          <Sigma size={11} strokeWidth={isBuiltUp ? 2.5 : 1.5} />
        </button>
      </div>

      {/* Built-up indicator label */}
      {isBuiltUp && (
        <div className="text-[9px] mt-0.5 flex items-center gap-0.5" style={{ color: '#456919' }}>
          <Sigma size={8} />
          built-up
        </div>
      )}

      {paneOpen && (
        <BreakdownPane
          projectId={projectId}
          parentId={parentId}
          parentType={parentType}
          parentField={parentField}
          parentLabel={parentLabel}
          currentValue={displayValue}
          onClose={() => setPaneOpen(false)}
          onApply={handleApply}
        />
      )}
    </>
  )
}
