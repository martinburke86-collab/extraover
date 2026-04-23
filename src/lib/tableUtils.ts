'use client'
import { useCallback } from 'react'

// ── New: data-attribute based navigation ────────────────────────────────────
// Requires: tr[data-row="N"] and td[data-col="N"] on your table rows/cells.
// This is reliable because it uses explicit positions, not fragile DOM counting.

function seekAndFocus(table: HTMLElement, row: number, col: number, colDir: 1 | -1 | 0 = 0): boolean {
  const tr = table.querySelector(`tr[data-row="${row}"]`) as HTMLElement | null
  if (!tr) return false

  function tryCol(c: number): boolean {
    if (c < 0 || c > 50) return false
    const td = tr!.querySelector(`td[data-col="${c}"]`) as HTMLElement | null
    if (!td) return false
    const inp = td.querySelector<HTMLElement>('input:not([disabled]):not([readonly]), select:not([disabled])')
    if (!inp) return false
    inp.focus()
    ;(inp as HTMLInputElement).select?.()
    return true
  }

  if (tryCol(col)) return true
  const allCols = Array.from(tr.querySelectorAll('td[data-col]'))
  const maxCol  = allCols.length ? Math.max(...allCols.map(t => parseInt(t.getAttribute('data-col')!, 10))) : 0
  for (let offset = 1; offset <= maxCol + 1; offset++) {
    if (colDir >= 0 && tryCol(col + offset)) return true
    if (colDir <= 0 && tryCol(col - offset)) return true
  }
  return false
}

// ── Fallback: DOM-position based navigation ─────────────────────────────────
// Used automatically on tables that don't have data-row/data-col attributes.

function fallbackNav(e: React.KeyboardEvent<HTMLElement>) {
  const target = e.target as HTMLInputElement
  const td     = target.closest('td')
  const tr     = td?.closest('tr')
  const table  = tr?.closest('table')
  if (!td || !tr || !table) return

  const allRows = Array.from(table.querySelectorAll('tr')) as HTMLTableRowElement[]
  const colIdx  = Array.from(tr.children).indexOf(td as HTMLElement)
  const rowIdx  = allRows.indexOf(tr as HTMLTableRowElement)

  function findFocusableRow(startIdx: number, direction: 1 | -1): number {
    let i = startIdx
    while (i >= 0 && i < allRows.length) {
      if (allRows[i].querySelector('input:not([disabled]), select:not([disabled])')) return i
      i += direction
    }
    return -1
  }

  function focusCell(targetRowIdx: number, targetColIdx: number, direction: 1 | -1 = 1) {
    const focusableRowIdx = findFocusableRow(targetRowIdx, direction)
    if (focusableRowIdx < 0) return
    const row   = allRows[focusableRowIdx]
    const cells = Array.from(row.children) as HTMLElement[]

    const tryFocusCell = (cell: HTMLElement): boolean => {
      if (!cell) return false
      const inp = cell.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled])')
      if (inp) { e.preventDefault(); inp.focus(); setTimeout(() => (inp as HTMLInputElement).select?.(), 0); return true }
      return false
    }

    if (tryFocusCell(cells[targetColIdx])) return
    for (let offset = 1; offset < cells.length; offset++) {
      if (tryFocusCell(cells[targetColIdx + offset])) return
      if (tryFocusCell(cells[targetColIdx - offset])) return
    }
  }

  const lastCol = tr.children.length - 1
  if      (e.key === 'Tab' && !e.shiftKey) { if (colIdx < lastCol) focusCell(rowIdx, colIdx + 1, 1);  else focusCell(rowIdx + 1, 0, 1) }
  else if (e.key === 'Tab' && e.shiftKey)  { if (colIdx > 0) focusCell(rowIdx, colIdx - 1, -1); else focusCell(rowIdx - 1, lastCol, -1) }
  else if (e.key === 'Enter')     { focusCell(rowIdx + 1, colIdx, 1) }
  else if (e.key === 'ArrowDown') { focusCell(rowIdx + 1, colIdx, 1) }
  else if (e.key === 'ArrowUp')   { focusCell(rowIdx - 1, colIdx, -1) }
  else if (e.key === 'ArrowRight'){ focusCell(rowIdx, colIdx + 1, 1) }
  else if (e.key === 'ArrowLeft') { focusCell(rowIdx, colIdx - 1, -1) }
  if (['Tab', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) e.preventDefault()
}

// ── Unified hook ────────────────────────────────────────────────────────────
// Automatically detects which mode to use based on data attributes.

export function useGridNav() {
  return useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const NAV = ['Tab','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape']
    if (!NAV.includes(e.key)) return

    const el = e.target as HTMLInputElement
    if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA') return

    // Arrow L/R: only leave cell at text cursor boundary
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (el.tagName === 'INPUT') {
        const pos = el.selectionStart ?? 0
        const len = el.value.length
        if (e.key === 'ArrowLeft'  && pos > 0)  return
        if (e.key === 'ArrowRight' && pos < len) return
      }
    }

    if (e.key === 'Escape') { el.blur(); e.preventDefault(); return }

    // Choose mode: data-attribute (preferred) or DOM-position fallback
    const tr    = el.closest('tr')    as HTMLElement | null
    const table = el.closest('table') as HTMLElement | null
    if (!table) return

    const hasDataAttrs = tr?.hasAttribute('data-row') && el.closest('td')?.hasAttribute('data-col')

    if (hasDataAttrs && tr && table) {
      const row = parseInt(tr.getAttribute('data-row')!, 10)
      const col = parseInt((el.closest('td[data-col]') as HTMLElement).getAttribute('data-col')!, 10)
      let moved = false

      if      (e.key === 'Tab' && !e.shiftKey) moved = seekAndFocus(table, row, col + 1,  1) || seekAndFocus(table, row + 1, 0, 1)
      else if (e.key === 'Tab' && e.shiftKey)  moved = seekAndFocus(table, row, col - 1, -1) || seekAndFocus(table, row - 1, 999, -1)
      else if (e.key === 'Enter' || e.key === 'ArrowDown') moved = seekAndFocus(table, row + 1, col, 0)
      else if (e.key === 'ArrowUp')   moved = seekAndFocus(table, row - 1, col, 0)
      else if (e.key === 'ArrowRight') moved = seekAndFocus(table, row, col + 1,  1)
      else if (e.key === 'ArrowLeft')  moved = seekAndFocus(table, row, col - 1, -1)

      if (moved || ['Tab', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) e.preventDefault()
    } else {
      fallbackNav(e)
    }
  }, [])
}

// Alias so existing pages that import useTableNav still work
export const useTableNav = useGridNav
