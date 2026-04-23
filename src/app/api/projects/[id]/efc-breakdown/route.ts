import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const pid = params.id

  const rows = await db.execute({
    sql: `
      SELECT
        cc.id            AS cost_code_id,
        cc.code,
        cc.description,
        cc.trade,
        cc.category,
        COALESCE(ctd.total, 0)  AS ctd,
        COALESCE(com.total, 0)  AS committed,
        COALESCE(ftc.total, 0)  AS forecast
      FROM cost_codes cc
      LEFT JOIN (
        SELECT cost_code_id,
               SUM(posted_cost + accruals + sub_recon) AS total
        FROM   cost_lines
        WHERE  project_id = ?
        GROUP  BY cost_code_id
      ) ctd ON ctd.cost_code_id = cc.id
      LEFT JOIN (
        SELECT cost_code_id,
               SUM(total) AS total
        FROM   committed_lines
        WHERE  project_id = ? AND COALESCE(status,'') != 'Cancelled'
        GROUP  BY cost_code_id
      ) com ON com.cost_code_id = cc.id
      LEFT JOIN (
        SELECT cost_code_id,
               SUM(total) AS total
        FROM   forecast_lines
        WHERE  project_id = ?
        GROUP  BY cost_code_id
      ) ftc ON ftc.cost_code_id = cc.id
      WHERE cc.project_id = ?
      ORDER BY cc.code
    `,
    args: [pid, pid, pid, pid],
  })

  const lines = (rows.rows as any[]).map(r => ({
    cost_code_id: r.cost_code_id,
    code:         r.code,
    description:  r.description,
    trade:        r.trade || 'Unassigned',
    category:     r.category || 'Unassigned',
    ctd:          Number(r.ctd),
    committed:    Number(r.committed),
    forecast:     Number(r.forecast),
    efc:          Number(r.ctd) + Number(r.committed) + Number(r.forecast),
  }))

  return NextResponse.json(lines)
}
