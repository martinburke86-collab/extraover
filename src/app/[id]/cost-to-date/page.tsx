import { requireProjectRole } from '@/lib/pageAuth'
import { initDB, db } from '@/lib/db'
import CTDClient from './CTDClient'
export const dynamic = 'force-dynamic'

export default async function CTDPage({ params }: { params: { id: string } }) {
  await requireProjectRole(params.id, 'editor')
  await initDB()
  const [linesResult, codesResult, varsResult, certSumsResult] = await Promise.all([
    db.execute({
      sql: `SELECT cl.*, cc.code, cc.description, cc.trade, cc.category
            FROM cost_lines cl JOIN cost_codes cc ON cl.cost_code_id = cc.id
            WHERE cl.project_id=? ORDER BY cc.trade, cc.code`,
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT code, description, trade, category FROM cost_codes WHERE project_id=? ORDER BY code`,
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT id, ref, description FROM variations WHERE project_id=? ORDER BY ref`,
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT c.cost_code_id, cc.code, s.name as supplier,
                   MAX(c.gross_cumulative) as certified
            FROM sub_certs c
            JOIN subcontractors s ON c.subcontractor_id = s.id
            JOIN cost_codes cc ON c.cost_code_id = cc.id
            WHERE c.project_id=? AND c.cost_code_id IS NOT NULL
            GROUP BY c.subcontractor_id, c.cost_code_id`,
      args: [params.id],
    }),
  ])
  // Suggested accruals: sub-certified less posted per cost code
  const postedByCode: Record<string, number> = {}
  for (const l of linesResult.rows as any[]) {
    postedByCode[String(l.cost_code_id)] = (postedByCode[String(l.cost_code_id)] || 0) + (Number(l.posted_cost) || 0)
  }
  const certByCode: Record<string, { code: string; suppliers: string[]; certified: number }> = {}
  for (const r of certSumsResult.rows as any[]) {
    const k = String(r.cost_code_id)
    certByCode[k] ||= { code: String(r.code), suppliers: [], certified: 0 }
    certByCode[k].certified += Number(r.certified) || 0
    certByCode[k].suppliers.push(String(r.supplier))
  }
  const accrualSuggestions = Object.entries(certByCode)
    .map(([costCodeId, v]) => ({
      costCodeId, code: v.code, suppliers: v.suppliers,
      certified: v.certified, posted: postedByCode[costCodeId] || 0,
      suggested: Math.max(0, v.certified - (postedByCode[costCodeId] || 0)),
    }))
    .filter(x => x.suggested > 0)

  return <CTDClient lines={linesResult.rows as any[]} costCodes={codesResult.rows as any[]}
    variations={varsResult.rows as any[]} accrualSuggestions={accrualSuggestions} projectId={params.id} />
}
