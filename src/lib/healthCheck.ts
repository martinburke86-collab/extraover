import type { DashboardKPIs, TradeSummary } from './calculations'

export type Severity = 'error' | 'warning' | 'info'

export interface HealthIssue {
  id:       string
  severity: Severity
  title:    string
  detail:   string
  href?:    string   // relative path within project, e.g. 'settings'
}

export function runHealthChecks(
  kpis: DashboardKPIs,
  trades: TradeSummary[],
  projectId: string,
  extras?: { gifa?: number; lockedPeriods?: number; variationCount?: number }
): HealthIssue[] {
  const issues: HealthIssue[] = []
  const adj = kpis.contractSum + kpis.approvedVars

  // ── ERRORS ────────────────────────────────────────────────────────────────

  if (!kpis.contractSum || kpis.contractSum === 0) {
    issues.push({
      id: 'no-contract-sum', severity: 'error',
      title: 'Contract sum not set',
      detail: 'Without a contract sum the dashboard KPIs cannot calculate correctly.',
      href: 'settings',
    })
  }

  if (adj > 0 && kpis.efc > 0 && kpis.forecastMarginPct < -0.10) {
    const lossAmt = Math.abs(kpis.forecastMargin)
    const lossPct = Math.abs(kpis.forecastMarginPct * 100).toFixed(1)
    issues.push({
      id: 'significant-loss', severity: 'error',
      title: `Forecast loss of €${Math.round(lossAmt).toLocaleString('en-IE')} (${lossPct}%)`,
      detail: 'EFC significantly exceeds adjusted contract sum. Review trade forecasts and variations.',
      href: 'trade',
    })
  }

  // ── WARNINGS ──────────────────────────────────────────────────────────────

  if (adj > 0 && kpis.efc > adj) {
    const over = kpis.efc - adj
    issues.push({
      id: 'efc-over-contract', severity: 'warning',
      title: `EFC exceeds adjusted contract sum by €${Math.round(over).toLocaleString('en-IE')}`,
      detail: 'Estimate Final Cost is greater than Contract Sum + Approved Variations.',
      href: 'trade',
    })
  }

  const noBudgetTrades = trades.filter(t => t.budget === 0)
  if (noBudgetTrades.length > 0 && noBudgetTrades.length < trades.length) {
    issues.push({
      id: 'missing-budgets', severity: 'warning',
      title: `${noBudgetTrades.length} element${noBudgetTrades.length > 1 ? 's' : ''} have no budget set`,
      detail: noBudgetTrades.slice(0, 4).map(t => t.trade).join(', ') + (noBudgetTrades.length > 4 ? ` +${noBudgetTrades.length - 4} more` : ''),
      href: 'settings',
    })
  }

  if (trades.length > 0 && trades.every(t => t.budget === 0)) {
    issues.push({
      id: 'no-budgets-at-all', severity: 'warning',
      title: 'No element budgets set',
      detail: 'Budget vs EFC comparison is unavailable. Add budgets in Settings or the setup wizard.',
      href: 'settings',
    })
  }

  const overrunTrades = trades.filter(t =>
    t.budget > 0 && t.totalCTD > t.budget && ((t.totalCTD - t.budget) / t.budget) > 0.02
  )
  if (overrunTrades.length > 0) {
    issues.push({
      id: 'ctd-over-budget', severity: 'warning',
      title: `CTD exceeds budget on ${overrunTrades.length} element${overrunTrades.length > 1 ? 's' : ''}`,
      detail: overrunTrades.slice(0, 3).map(t => `${t.trade} (+€${Math.round(t.totalCTD - t.budget).toLocaleString('en-IE')})`).join(', ') + (overrunTrades.length > 3 ? ` +${overrunTrades.length - 3} more` : ''),
      href: 'cost-to-date',
    })
  }

  if (kpis.contractSum > 0 && kpis.totalClaimed === 0) {
    issues.push({
      id: 'no-claims', severity: 'warning',
      title: 'No cumulative claim entered',
      detail: 'Value / Claims sheet has no data. Cash position and over/under claim cannot be calculated.',
      href: 'value',
    })
  }

  if (kpis.originalBudget === 0 && kpis.contractSum > 0) {
    issues.push({
      id: 'no-original-budget', severity: 'warning',
      title: 'Original budget not set',
      detail: 'Savings / overrun vs target cannot be tracked without an original budget.',
      href: 'settings',
    })
  }

  if (adj > 0 && kpis.forecastMarginPct > 0.40) {
    issues.push({
      id: 'unrealistic-margin', severity: 'warning',
      title: `Forecast margin of ${(kpis.forecastMarginPct * 100).toFixed(1)}% seems high`,
      detail: 'Check that all costs have been entered and forecasts are realistic.',
      href: 'trade',
    })
  }

  // ── INFO ──────────────────────────────────────────────────────────────────

  if (!extras?.gifa || extras.gifa === 0) {
    issues.push({
      id: 'no-gifa', severity: 'info',
      title: 'GIFA not set',
      detail: 'Gross Internal Floor Area is needed for cost per m² analysis. Add it in Settings.',
      href: 'settings',
    })
  }

  if ((extras?.lockedPeriods ?? 0) === 0) {
    issues.push({
      id: 'no-locked-periods', severity: 'info',
      title: 'No periods locked yet',
      detail: 'Lock the current period at month end to start building period history and comparisons.',
      href: 'periods',
    })
  }

  if (kpis.approvedVars > 0 && (extras?.variationCount ?? 0) === 0) {
    issues.push({
      id: 'vars-no-register', severity: 'info',
      title: 'Approved variations set but no variation entries',
      detail: `€${Math.round(kpis.approvedVars).toLocaleString('en-IE')} in approved vars is recorded but the Variations register is empty.`,
      href: 'variations',
    })
  }

  return issues
}
