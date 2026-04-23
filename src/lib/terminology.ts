// Default terminology — users can override these per-project in Settings
export const DEFAULT_TERMS = {
  variations:  'Variations',
  committed:   'Committed',
  costToDate:  'Cost to Date',
  prelims:     'Preliminaries',
  forecast:    'Forecast',
  cvr:         'CVR Table',
}

export type Terms = typeof DEFAULT_TERMS

export function parseTerminology(raw: string | null | undefined): Terms {
  if (!raw) return { ...DEFAULT_TERMS }
  try {
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_TERMS, ...parsed }
  } catch {
    return { ...DEFAULT_TERMS }
  }
}
