import type { DashboardKPIs, TradeSummary, VariationCodedSummary } from './calculations'

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
  extras?: {
    gifa?: number; lockedPeriods?: number; variationCount?: number
    variationsCoded?: VariationCodedSummary[]
    prelims?: { detailBudget: number; detailPFC: number; tradeMethod: string | null }
    subs?: { name: string; overCertified: boolean; taxExpired: boolean; certified: number; orderValue: number }[]
  }
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

  // ── RECONCILIATION ────────────────────────────────────────────────────────
  // These checks tie the sheets together so every headline figure is auditable.

  // Element budgets vs original budget
  const elementBudgetTotal = trades.reduce((s, t) => s + t.budget, 0)
  if (kpis.originalBudget > 0 && elementBudgetTotal > 0) {
    const gap = elementBudgetTotal - kpis.originalBudget
    if (Math.abs(gap) > Math.max(1000, kpis.originalBudget * 0.005)) {
      issues.push({
        id: 'element-budget-mismatch', severity: 'warning',
        title: `Element budgets ${gap > 0 ? 'exceed' : 'fall short of'} original budget by €${Math.round(Math.abs(gap)).toLocaleString('en-IE')}`,
        detail: `Element budgets total €${Math.round(elementBudgetTotal).toLocaleString('en-IE')} vs original budget €${Math.round(kpis.originalBudget).toLocaleString('en-IE')}. Reconcile on the Budget page or update Settings.`,
        href: 'budget',
      })
    }
  }

  // Impossible forecasts: EFC below cost already incurred
  const impossibleTrades = trades.filter(t => t.efc > 0 && t.totalCTD > t.efc + 1)
  if (impossibleTrades.length > 0) {
    issues.push({
      id: 'efc-below-ctd', severity: 'error',
      title: `EFC is below cost to date on ${impossibleTrades.length} element${impossibleTrades.length > 1 ? 's' : ''}`,
      detail: impossibleTrades.slice(0, 3).map(t => t.trade).join(', ') + (impossibleTrades.length > 3 ? ` +${impossibleTrades.length - 3} more` : '') + '. A final cost cannot be less than cost already incurred, review the forecast method or hard key.',
      href: 'forecast',
    })
  }

  // Approved variations with an estimate but no coded cost lines
  const coded = extras?.variationsCoded ?? []
  const uncodedApproved = coded.filter(v => v.status === 'Approved' && v.cost_estimate > 0 && v.coded_cost === 0)
  if (uncodedApproved.length > 0) {
    const est = uncodedApproved.reduce((s, v) => s + v.cost_estimate, 0)
    issues.push({
      id: 'vars-uncoded-cost', severity: 'warning',
      title: `${uncodedApproved.length} approved variation${uncodedApproved.length > 1 ? 's have' : ' has'} no coded cost`,
      detail: uncodedApproved.slice(0, 4).map(v => v.ref).join(', ') + ` carry €${Math.round(est).toLocaleString('en-IE')} of estimated cost that is not tagged to any cost, committed or forecast line, so the outturn may be understated. Tag the lines to the VO on the input sheets.`,
      href: 'variations',
    })
  }

  // Coded cost drifting well past the estimate
  const drifted = coded.filter(v => v.status !== 'Rejected' && v.cost_estimate > 0 && v.coded_cost > 0
    && (v.coded_cost - v.cost_estimate) > Math.max(5000, v.cost_estimate * 0.25))
  if (drifted.length > 0) {
    issues.push({
      id: 'vars-cost-drift', severity: 'info',
      title: `Coded cost exceeds estimate on ${drifted.length} variation${drifted.length > 1 ? 's' : ''}`,
      detail: drifted.slice(0, 4).map(v => `${v.ref} (est €${Math.round(v.cost_estimate).toLocaleString('en-IE')}, coded €${Math.round(v.coded_cost).toLocaleString('en-IE')})`).join(', ') + '. Update the estimate or review the coding.',
      href: 'variations',
    })
  }

  // Prelims detail exists but the Preliminaries element is not driven by it
  if (extras?.prelims && extras.prelims.detailPFC > 0
      && extras.prelims.tradeMethod !== null && extras.prelims.tradeMethod !== 'prelims') {
    issues.push({
      id: 'prelims-not-linked', severity: 'warning',
      title: 'Preliminaries element is not driven by the prelims sheet',
      detail: `The prelims detail projects €${Math.round(extras.prelims.detailPFC).toLocaleString('en-IE')} final cost, but the Preliminaries element uses the '${extras.prelims.tradeMethod}' forecast method, so the two can diverge. Set the element's forecast method to 'prelims' so the detail sheet is the single source.`,
      href: 'prelims',
    })
  }

  // Subcontractor register cross-checks
  const subs = extras?.subs ?? []
  const overCert = subs.filter(x => x.overCertified)
  if (overCert.length > 0) {
    issues.push({
      id: 'subs-over-certified', severity: 'error',
      title: `Certified beyond order value on ${overCert.length} subcontractor account${overCert.length > 1 ? 's' : ''}`,
      detail: overCert.slice(0, 3).map(x => `${x.name} (certified €${Math.round(x.certified).toLocaleString('en-IE')} vs order €${Math.round(x.orderValue).toLocaleString('en-IE')})`).join(', ') + '. Raise a variation to the order or correct the cert.',
      href: 'subcontractors',
    })
  }
  const taxExpired = subs.filter(x => x.taxExpired && x.certified > 0)
  if (taxExpired.length > 0) {
    issues.push({
      id: 'subs-tax-expired', severity: 'warning',
      title: `Tax clearance expired on ${taxExpired.length} active subcontractor${taxExpired.length > 1 ? 's' : ''}`,
      detail: taxExpired.slice(0, 4).map(x => x.name).join(', ') + '. Payments are blocked until clearance is updated on the register.',
      href: 'subcontractors',
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
