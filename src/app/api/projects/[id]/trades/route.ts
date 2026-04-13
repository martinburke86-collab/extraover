import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const result = await db.execute({
    sql: `SELECT * FROM trades WHERE project_id = ? ORDER BY sort_order`,
    args: [params.id],
  })
  return NextResponse.json(result.rows)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { tradeId, valueCertified, varsNotAgreed, adjustments,
          forecastMethod, forecastHardKey, budget } = await req.json()
  await db.execute({
    sql: `UPDATE trades SET
            value_certified=?, vars_not_agreed=?, adjustments=?,
            budget=?, forecast_method=?, forecast_hard_key=?
          WHERE id=? AND project_id=?`,
    args: [
      valueCertified ?? 0, varsNotAgreed ?? 0, adjustments ?? 0,
      budget ?? 0,
      forecastMethod ?? 'budget_remaining', forecastHardKey ?? null,
      tradeId, params.id,
    ],
  })
  return NextResponse.json({ ok: true })
}
