import { NextResponse } from 'next/server'
import { initDB, db } from '@/lib/db'
import { getDashboardKPIs, getTradeSummaries, getPrelimItems } from '@/lib/calculations'
// @ts-ignore
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { CVRReport } from '@/lib/pdfReport'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()

  const [kpis, trades, prelims] = await Promise.all([
    getDashboardKPIs(params.id),
    getTradeSummaries(params.id),
    getPrelimItems(params.id),
  ])

  // Project details + app_ref from value periods
  const projR = await db.execute({ sql: 'SELECT * FROM projects WHERE id=?', args: [params.id] })
  const proj  = projR.rows[0] as any
  const vpR   = await db.execute({ sql: 'SELECT app_ref FROM value_periods WHERE project_id=? LIMIT 1', args: [params.id] })
  const appRef = String((vpR.rows[0] as any)?.app_ref || '')

  // Variations
  const varsR = await db.execute({
    sql: 'SELECT * FROM variations WHERE project_id=? ORDER BY ref',
    args: [params.id],
  })
  const variations = (varsR.rows as any[]).map(v => ({
    ref:          String(v.ref || ''),
    description:  String(v.description || ''),
    status:       String(v.status || ''),
    category:     v.category     ? String(v.category)      : null,
    instructedBy: v.instructed_by ? String(v.instructed_by) : null,
    pctComplete:  Number(v.pct_complete) || 0,
    income:       Number(v.income_value)  || 0,
    costEst:      Number(v.cost_estimate) || 0,
    costActual:   Number(v.cost_actual)   || 0,
  }))

  // Current period label
  const periodR = await db.execute({
    sql: 'SELECT label FROM report_periods WHERE project_id=? AND is_current=1 ORDER BY period_date DESC LIMIT 1',
    args: [params.id],
  })
  const periodLabel = (periodR.rows[0] as any)?.label || ''

  // Load logo for PDF
  try {
  } catch {}

  const props = {
    project: {
      name:         String(proj?.name           || ''),
      code:         String(proj?.code           || ''),
      client:       String(proj?.client         || ''),
      contractType: String(proj?.contract_type  || ''),
      preparedBy:   String(proj?.prepared_by    || ''),
      gifa:         Number(proj?.gifa)           || 0,
      startDate:    String(proj?.contract_start  || ''),
      finishDate:   String(proj?.contract_finish || ''),
      revisedStart: String(proj?.revised_start   || ''),
      revisedFinish:String(proj?.revised_finish  || ''),
      appRef:       appRef || String(proj?.app_ref || ''),
    },
    periodLabel,
    kpis,
    trades,
    prelims,
    variations,
    generatedAt: new Date().toLocaleDateString('en-IE', { day: '2-digit', month: 'long', year: 'numeric' }),
  }

  const buffer = await renderToBuffer(createElement(CVRReport, props) as any)

  const filename = `CVR_${proj?.code || 'report'}_${periodLabel.replace(/\s/g, '_')}.pdf`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
