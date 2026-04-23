import { getSession } from '@/lib/getSession'
import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { writeAudit, auditChanges, auditMoney } from '@/lib/audit'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const r = await db.execute({
    sql: `SELECT * FROM variations WHERE project_id=? ORDER BY ref`,
    args: [params.id],
  })
  return NextResponse.json(r.rows)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()

  // Auto-generate ref if not provided
  let ref = b.ref
  if (!ref) {
    const countR = await db.execute({
      sql: `SELECT COUNT(*) as n FROM variations WHERE project_id=?`,
      args: [params.id],
    })
    const n = Number((countR.rows[0] as any)?.n || 0) + 1
    ref = `VO-${String(n).padStart(3, '0')}`
  }

  const id = cuid()
  await db.execute({
    sql: `INSERT INTO variations
          (id,project_id,ref,description,status,instructed_by,category,
           date_instructed,date_submitted,date_approved,
           income_value,cost_estimate,cost_actual,pct_complete,notes)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, params.id, ref,
      b.description || '',
      b.status || 'Instructed',
      b.instructed_by || null,
      b.category || null,
      b.date_instructed || null,
      b.date_submitted || null,
      b.date_approved || null,
      b.income_value || 0,
      b.cost_estimate || 0,
      b.cost_actual || 0,
      b.pct_complete || 0,
      b.notes || null,
    ],
  })
  await writeAudit(params.id, 'Variation', 'Created',
    `${ref} · ${b.description}`, 'Status', null, b.status || 'Instructed')
  return NextResponse.json({ id, ref })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()

  const old = await db.execute({
    sql: `SELECT ref, description, status, income_value, cost_estimate FROM variations WHERE id=? AND project_id=?`,
    args: [b.id, params.id],
  })
  const o = old.rows[0] as any

  await db.execute({
    sql: `UPDATE variations SET
          ref=?, description=?, status=?, instructed_by=?, category=?,
          date_instructed=?, date_submitted=?, date_approved=?,
          income_value=?, cost_estimate=?, cost_actual=?, pct_complete=?, notes=?
          WHERE id=? AND project_id=?`,
    args: [
      b.ref, b.description, b.status,
      b.instructed_by || null, b.category || null,
      b.date_instructed || null, b.date_submitted || null, b.date_approved || null,
      b.income_value || 0, b.cost_estimate || 0, b.cost_actual || 0,
      b.pct_complete || 0,
      b.notes || null,
      b.id, params.id,
    ],
  })

  if (o) {
    const _session = await getSession()
    const userName = _session?.name ?? 'Unknown'
  await auditChanges(params.id, 'Variation', `${o.ref} · ${o.description}`, [
      { field: 'Status',        old: String(o.status || ''),              next: String(b.status || '') },
      { field: 'Income value',  old: auditMoney(Number(o.income_value)),  next: auditMoney(b.income_value || 0) },
      { field: 'Cost estimate', old: auditMoney(Number(o.cost_estimate)), next: auditMoney(b.cost_estimate || 0) },
    ], userName)
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const { id } = await req.json()
  const old = await db.execute({
    sql: `SELECT ref, description FROM variations WHERE id=? AND project_id=?`,
    args: [id, params.id],
  })
  const o = old.rows[0] as any
  await db.execute({ sql: `DELETE FROM variations WHERE id=? AND project_id=?`, args: [id, params.id] })
  if (o) await writeAudit(params.id, 'Variation', 'Deleted', `${o.ref} · ${o.description}`)
  return NextResponse.json({ ok: true })
}
