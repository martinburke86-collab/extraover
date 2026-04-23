import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const [bandsR, overridesR, incomeR] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM cashflow_bands WHERE project_id=? ORDER BY trade_name', args: [params.id] }),
    db.execute({ sql: 'SELECT * FROM cashflow_month_overrides WHERE project_id=?', args: [params.id] }),
    db.execute({ sql: 'SELECT * FROM cashflow_income_items WHERE project_id=?', args: [params.id] }),
  ])
  return NextResponse.json({ bands: bandsR.rows, overrides: overridesR.rows, income: incomeR.rows })
}

// PUT — upsert a band (start/finish/shape for a trade)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { tradeName, startDate, finishDate, sCurveShape = 3 } = await req.json()
  const existing = await db.execute({
    sql: 'SELECT id FROM cashflow_bands WHERE project_id=? AND trade_name=?',
    args: [params.id, tradeName],
  })
  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE cashflow_bands SET start_date=?, finish_date=?, s_curve_shape=? WHERE project_id=? AND trade_name=?',
      args: [startDate || null, finishDate || null, sCurveShape, params.id, tradeName],
    })
  } else {
    await db.execute({
      sql: 'INSERT INTO cashflow_bands (id, project_id, trade_name, start_date, finish_date, s_curve_shape) VALUES (?,?,?,?,?,?)',
      args: [cuid(), params.id, tradeName, startDate || null, finishDate || null, sCurveShape],
    })
  }
  return NextResponse.json({ ok: true })
}

// PATCH — upsert or delete a monthly cell amount (trade override OR income item)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const body = await req.json()

  if (body.type === 'lag') {
    const { lagMonths } = body
    await db.execute({ sql: 'UPDATE projects SET cashflow_income_lag=? WHERE id=?', args: [lagMonths, params.id] })
  } else if (body.type === 'income') {
    const { label, month, amount } = body
    if (!amount || amount === 0) {
      await db.execute({
        sql: 'DELETE FROM cashflow_income_items WHERE project_id=? AND label=? AND month=?',
        args: [params.id, label, month],
      })
    } else {
      const ex = await db.execute({ sql: 'SELECT id FROM cashflow_income_items WHERE project_id=? AND label=? AND month=?', args: [params.id, label, month] })
      if (ex.rows.length > 0) {
        await db.execute({ sql: 'UPDATE cashflow_income_items SET amount=? WHERE project_id=? AND label=? AND month=?', args: [amount, params.id, label, month] })
      } else {
        await db.execute({ sql: 'INSERT INTO cashflow_income_items (id, project_id, label, month, amount) VALUES (?,?,?,?,?)', args: [cuid(), params.id, label, month, amount] })
      }
    }
  } else {
    const { tradeName, month, amount } = body
    if (!amount || amount === 0) {
      await db.execute({
        sql: 'DELETE FROM cashflow_month_overrides WHERE project_id=? AND trade_name=? AND month=?',
        args: [params.id, tradeName, month],
      })
    } else {
      const ex = await db.execute({ sql: 'SELECT id FROM cashflow_month_overrides WHERE project_id=? AND trade_name=? AND month=?', args: [params.id, tradeName, month] })
      if (ex.rows.length > 0) {
        await db.execute({ sql: 'UPDATE cashflow_month_overrides SET amount=? WHERE project_id=? AND trade_name=? AND month=?', args: [amount, params.id, tradeName, month] })
      } else {
        await db.execute({ sql: 'INSERT INTO cashflow_month_overrides (id, project_id, trade_name, month, amount) VALUES (?,?,?,?,?)', args: [cuid(), params.id, tradeName, month, amount] })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
