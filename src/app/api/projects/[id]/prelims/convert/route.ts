import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { getTradeSummaries, getPrelimsReconciliation } from '@/lib/calculations'
import { writeAudit, auditMoney } from '@/lib/audit'
import { getSession } from '@/lib/getSession'
import { requireProjectApi } from '@/lib/apiAuth'

// Moves pre-v49 CTD / Committed typed on the prelims sheet onto Cost to Date
// and Committed lines, so the lines stay the single source. Only the amount
// the lines on that code do not already hold is posted, so nothing is counted
// twice. The sheet's stored figures on those codes are then cleared.
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()

  const trades = await getTradeSummaries(params.id)
  const { sheetOnly } = await getPrelimsReconciliation(params.id, trades)
  const postable = sheetOnly.filter(x => x.postable && x.code)
  if (postable.length === 0) return NextResponse.json({ ok: true, posted: 0, skipped: sheetOnly.length })

  const periodR = await db.execute({
    sql: `SELECT id FROM report_periods WHERE project_id=? AND is_current=1 ORDER BY period_date DESC LIMIT 1`,
    args: [params.id],
  })
  const periodId = (periodR.rows[0] as any)?.id ?? null

  const codesR = await db.execute({
    sql: `SELECT id, code, description FROM cost_codes WHERE project_id=?`, args: [params.id],
  })
  const codeRow: Record<string, any> = {}
  for (const r of codesR.rows as any[]) codeRow[String(r.code)] = r

  const note = 'Moved from prelims sheet (v49)'
  const stmts: { sql: string; args: any[] }[] = []
  for (const x of postable) {
    const cc = codeRow[x.code!]
    if (!cc) continue
    if (x.ctd > 0) stmts.push({
      sql: `INSERT INTO cost_lines
              (id, project_id, period_id, cost_code_id, posted_cost, accruals, sub_recon, notes, variation_id)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [cuid(), params.id, periodId, cc.id, x.ctd, 0, 0, note, null],
    })
    if (x.committed > 0) stmts.push({
      sql: `INSERT INTO committed_lines
              (id, project_id, cost_code_id, supplier, description, status, quantity, unit, unit_rate, total, notes, variation_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [cuid(), params.id, cc.id, null, x.description, 'Placed', null, null, null, x.committed, note, null],
    })
    stmts.push({
      sql: `UPDATE prelim_items SET ctd=0, committed=0 WHERE project_id=? AND cost_code=?`,
      args: [params.id, x.code],
    })
  }
  await db.batch(stmts, 'write')

  const userName = (await getSession())?.name ?? 'Unknown'
  for (const x of postable) {
    const cc = codeRow[x.code!]
    if (!cc) continue
    const label = `${cc.code} · ${cc.description}`
    if (x.ctd > 0) await writeAudit(params.id, 'CTD', 'Created', label, 'Total', null, auditMoney(x.ctd), userName)
    if (x.committed > 0) await writeAudit(params.id, 'Committed', 'Created', label, 'Total', null, auditMoney(x.committed), userName)
    await writeAudit(params.id, 'Prelims', 'Updated', label, 'Sheet CTD / Committed', auditMoney(x.ctd + x.committed), 'Moved to lines', userName)
  }

  return NextResponse.json({ ok: true, posted: postable.length, skipped: sheetOnly.length - postable.length })
}
