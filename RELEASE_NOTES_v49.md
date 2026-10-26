# ExtraOver v49 - One margin status rule

## Margin status measured against the project's own target
The red / amber / green status on forecast margin used different bars on
different screens. The dashboard called anything under 8% "At Risk", while
the portfolio called anything over 5% "On track", so the Harbour View demo
(6.8%, ahead of its tender margin) showed "At Risk" on its dashboard and
"On track" on the portfolio. An 8% bar marked most healthy Irish main
contractor jobs as at risk.

Every screen, export and PDF now uses one rule, measured against the
project's own target margin % (Original Margin / adjusted contract sum, the
same % shown in Settings):
- On track (green): forecast margin % at target, above it, or no more than
  1 point below it
- Below target (amber): more than 1 point below target, but still a profit
- Loss (red): a forecast loss
- Projects with no target margin set are measured against a 5% default, and
  the dashboard says so ("default target 5.0%")

## Where it applies
- Dashboard: header chip, Financial Position chip and the Forecast Margin
  KPI, which now reads e.g. "On track, target 5.9%" instead of "At Risk"
- Portfolio: status dot and label in the table and cards, and the filters,
  now All / On track / Below target / Loss / Critical flags. Projects with no
  EFC yet show "No data" in grey instead of amber
- Portfolio KPI strip: "x at risk" under Projects in profit now reads
  "x forecasting a loss", which is what it always counted
- Excel export: Forecast Margin and Margin % tile shading, with the status
  added to the Margin % label
- PDF report: status under the cover Margin figure, and the Executive
  Summary Margin % box coloured by status with the target alongside

## Housekeeping
- The rule lives in `marginRag()` in `src/lib/utils.ts`, with the labels and
  colours in `MARGIN_RAG`. No screen keeps its own thresholds
- New `caution` amber colour token (`#b6740a`) in `tailwind.config.js`, used
  by the amber status chip and KPI card instead of Tailwind's default amber.
  Portfolio status dots now use the Costline green, amber and red
- No schema change, no Turso reseed required
- Version label to v49

## Not changed
- Health checks: the forecast loss over 10% error and the margin over 40%
  warning are integrity checks, not a status, and are unchanged
- Trade-level budget status on the Budget sheet and in the PDF trade table
  (on budget / near limit / over budget) is a different measure and is
  unchanged

## Verification
- Harbour View demo created on a fresh database: 6.8% forecast against a
  5.9% target reads "On track" on every screen
- Rule checked at the boundaries: exactly 1 point below target is green,
  just under is amber, 0% is amber, any loss is red, and no target falls
  back to 5%
- `npm run build` and `tsc --noEmit` clean
