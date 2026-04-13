'use client'
import { useCallback } from 'react'

export function useTableNav() {
  return useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const NAV_KEYS = ['Tab', 'Enter', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']
    if (!NAV_KEYS.includes(e.key)) return

    const target = e.target as HTMLInputElement
    const td     = target.closest('td')
    const tr     = td?.closest('tr')
    const table  = tr?.closest('table')
    if (!td || !tr || !table) return

    // For ArrowLeft/Right: only move to adjacent cell if cursor is at the edge
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      if (isInput) {
        const pos = target.selectionStart ?? 0
        const len = (target.value ?? '').length
        if (e.key === 'ArrowLeft'  && pos > 0)  return
        if (e.key === 'ArrowRight' && pos < len) return
      }
    }

    const allRows = Array.from(table.querySelectorAll('tr')) as HTMLTableRowElement[]
    const colIdx  = Array.from(tr.children).indexOf(td)
    const rowIdx  = allRows.indexOf(tr as HTMLTableRowElement)

    // Find the nearest row in a direction that actually has a focusable input
    function findFocusableRow(startIdx: number, direction: 1 | -1): number {
      let i = startIdx
      while (i >= 0 && i < allRows.length) {
        const row = allRows[i]
        const hasInput = row.querySelector(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
        if (hasInput) return i
        i += direction
      }
      return -1
    }

    function focusCell(targetRowIdx: number, targetColIdx: number, direction: 1 | -1 = 1) {
      // Skip over section header rows (rows with no inputs) in the given direction
      const focusableRowIdx = findFocusableRow(targetRowIdx, direction)
      if (focusableRowIdx < 0) return

      const row   = allRows[focusableRowIdx]
      const cells = Array.from(row.children) as HTMLElement[]

      // Try the exact column first, then scan nearby columns for an input
      const tryFocusCell = (cell: HTMLElement): boolean => {
        if (!cell) return false
        const inp = cell.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
        if (inp) {
          e.preventDefault()
          inp.focus()
          setTimeout(() => (inp as HTMLInputElement).select?.(), 0)
          return true
        }
        return false
      }

      // Try exact column, then scan right, then scan left for nearest input
      if (tryFocusCell(cells[targetColIdx])) return
      for (let offset = 1; offset < cells.length; offset++) {
        if (tryFocusCell(cells[targetColIdx + offset])) return
        if (tryFocusCell(cells[targetColIdx - offset])) return
      }
    }

    const lastCol = tr.children.length - 1

    if      (e.key === 'Tab' && !e.shiftKey) {
      if (colIdx < lastCol) focusCell(rowIdx, colIdx + 1, 1)
      else focusCell(rowIdx + 1, 0, 1)
    }
    else if (e.key === 'Tab' && e.shiftKey) {
      if (colIdx > 0) focusCell(rowIdx, colIdx - 1, -1)
      else focusCell(rowIdx - 1, lastCol, -1)
    }
    else if (e.key === 'Enter')     { focusCell(rowIdx + 1, colIdx, 1) }
    else if (e.key === 'ArrowDown') { focusCell(rowIdx + 1, colIdx, 1) }
    else if (e.key === 'ArrowUp')   { focusCell(rowIdx - 1, colIdx, -1) }
    else if (e.key === 'ArrowRight'){ focusCell(rowIdx, colIdx + 1, 1) }
    else if (e.key === 'ArrowLeft') { focusCell(rowIdx, colIdx - 1, -1) }

    if (['Tab', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) e.preventDefault()
  }, [])
}

export function fmtInput(n: number | string): string {
  const num = Number(String(n).replace(/,/g, '')) || 0
  if (num === 0) return ''
  return num.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
