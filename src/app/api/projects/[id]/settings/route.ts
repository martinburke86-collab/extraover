import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  await db.execute({
    sql: `UPDATE projects SET name=?, code=?, client=?, contract_type=?, prepared_by=?,
          contract_sum=?, approved_vars=?, original_budget=?, original_margin=?,
          contract_start=?, contract_finish=?, revised_start=?, revised_finish=?,
          updated_at=datetime('now') WHERE id=?`,
    args: [b.name, b.code, b.client, b.contractType, b.preparedBy,
           b.contractSum, b.approvedVars, b.originalBudget, b.originalMargin,
           b.contractStart || null, b.contractFinish || null,
           b.revisedStart  || null, b.revisedFinish  || null,
           params.id],
  })
  return NextResponse.json({ ok: true })
}
