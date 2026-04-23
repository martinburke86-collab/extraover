import { initDB, db } from '@/lib/db'
import EFCBreakdownClient from './EFCBreakdownClient'
export const dynamic = 'force-dynamic'

export default async function EFCBreakdownPage({ params }: { params: { id: string } }) {
  await initDB()

  const rows = await db.execute({
    sql: `
      SELECT
        cc.id            AS cost_code_id,
        cc.code,
        cc.description,
        cc.trade,
        cc.category,
        COALESCE(t.sort_order, 999) AS trade_sort,
        COALESCE(ctd.total, 0)  AS ctd,
        COALESCE(com.total, 0)  AS committed,
        COALESCE(ftc.total, 0)  AS forecast
      FROM cost_codes cc
      LEFT JOIN trades t ON t.project_id = cc.project_id AND t.name = cc.trade
      LEFT JOIN (
        SELECT cost_code_id, SUM(posted_cost + accruals + sub_recon) AS total
        FROM   cost_lines WHERE project_id = ? GROUP BY cost_code_id
      ) ctd ON ctd.cost_code_id = cc.id
      LEFT JOIN (
        SELECT cost_code_id, SUM(total) AS total
        FROM   committed_lines
        WHERE  project_id = ? AND COALESCE(status,'') != 'Cancelled'
        GROUP  BY cost_code_id
      ) com ON com.cost_code_id = cc.id
      LEFT JOIN (
        SELECT cost_code_id, SUM(total) AS total
        FROM   forecast_lines WHERE project_id = ? GROUP BY cost_code_id
      ) ftc ON ftc.cost_code_id = cc.id
      WHERE cc.project_id = ?
      ORDER BY COALESCE(t.sort_order, 999), cc.code
    `,
    args: [params.id, params.id, params.id, params.id],
  })

  const lines = (rows.rows as any[]).map(r => ({
    cost_code_id: r.cost_code_id as string,
    code:         r.code as string,
    description:  r.description as string,
    trade:        (r.trade as string) || 'Unassigned',
    category:     (r.category as string) || 'Unassigned',
    tradeSort:    Number(r.trade_sort),
    ctd:          Number(r.ctd),
    committed:    Number(r.committed),
    forecast:     Number(r.forecast),
    efc:          Number(r.ctd) + Number(r.committed) + Number(r.forecast),
  }))

  return <EFCBreakdownClient lines={lines} projectId={params.id} />
}
