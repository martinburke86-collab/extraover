import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { getSession } from '@/lib/getSession'
import { auditChanges, auditMoney } from '@/lib/audit'

// The compliance gate: paying or certifying a sub with expired tax clearance is blocked;
// expired insurance is allowed but flagged in the response.
async function complianceCheck(subId: string, projectId: string) {
  const r = await db.execute({
    sql: `SELECT name, tax_clearance_expiry, insurance_expiry FROM subcontractors WHERE id=? AND project_id=?`,
    args: [subId, projectId],
  })
  const sub = r.rows[0] as any
  if (!sub) return { ok: false as const, status: 404, error: 'Subcontractor not found' }
  const today = new Date().toISOString().slice(0, 10)
  if (sub.tax_clearance_expiry && String(sub.tax_clearance_expiry) < today) {
    return { ok: false as const, status: 409,
      error: `Blocked: ${sub.name}'s tax clearance expired ${sub.tax_clearance_expiry}. Update it on the register before certifying or paying.` }
  }
  const insWarning = sub.insurance_expiry && String(sub.insurance_expiry) < today
    ? `${sub.name}'s insurance expired ${sub.insurance_expiry} — proceeding, but chase the renewal.` : null
  return { ok: true as const, sub, insWarning }
}

// POST — create a cert
export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const session = await getSession()
  const userName = session?.name ?? 'Unknown'

  const gate = await complianceCheck(b.subId, params.id)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // Next cert number + previous cumulative for the audit trail
  const prevR = await db.execute({
    sql: `SELECT MAX(cert_no) as n, MAX(gross_cumulative) as g FROM sub_certs WHERE subcontractor_id=?`,
    args: [b.subId],
  })
  const prev = prevR.rows[0] as any
  const certNo = (Number(prev?.n) || 0) + 1
  const prevGross = Number(prev?.g) || 0

  const subR = await db.execute({ sql: `SELECT retention_pct, rct_rate, name FROM subcontractors WHERE id=?`, args: [b.subId] })
  const sub = subR.rows[0] as any

  const id = cuid()
  await db.execute({
    sql: `INSERT INTO sub_certs
            (id, project_id, subcontractor_id, cert_no, cert_date, gross_cumulative,
             retention_pct, rct_rate, cost_code_id, variation_id, status, paid_date, notes)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, params.id, b.subId, certNo, b.certDate ?? null, b.grossCumulative ?? 0,
           Number(sub?.retention_pct) || 0, Number(sub?.rct_rate) || 0,
           b.costCodeId ?? null, b.variationId ?? null, 'Certified', null, b.notes ?? null],
  })

  await auditChanges(params.id, 'Subcontractors', `${sub?.name} cert ${certNo}`, [
    { field: 'Gross cumulative', old: auditMoney(prevGross), next: auditMoney(Number(b.grossCumulative) || 0) },
  ], userName)

  return NextResponse.json({ ok: true, id, certNo, insWarning: gate.insWarning ?? null })
}

// PATCH — update a cert (mark paid runs the gate again) or delete
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const session = await getSession()
  const userName = session?.name ?? 'Unknown'

  const oldR = await db.execute({
    sql: `SELECT sc.*, s.name as sub_name FROM sub_certs sc
          JOIN subcontractors s ON sc.subcontractor_id = s.id
          WHERE sc.id=? AND sc.project_id=?`,
    args: [b.certId, params.id],
  })
  const o = oldR.rows[0] as any
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (b.delete) {
    await db.execute({ sql: `DELETE FROM sub_certs WHERE id=? AND project_id=?`, args: [b.certId, params.id] })
    await auditChanges(params.id, 'Subcontractors', `${o.sub_name} cert ${o.cert_no}`, [
      { field: 'Cert', old: auditMoney(Number(o.gross_cumulative)), next: 'deleted' },
    ], userName)
    return NextResponse.json({ ok: true })
  }

  let insWarning: string | null = null
  if (b.status === 'Paid' && o.status !== 'Paid') {
    const gate = await complianceCheck(String(o.subcontractor_id), params.id)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
    insWarning = gate.insWarning ?? null
  }

  await db.execute({
    sql: `UPDATE sub_certs SET cert_date=?, gross_cumulative=?, cost_code_id=?, variation_id=?, status=?, paid_date=?, notes=?
          WHERE id=? AND project_id=?`,
    args: [b.certDate ?? o.cert_date,
           b.grossCumulative === undefined ? o.gross_cumulative : b.grossCumulative,
           b.costCodeId === undefined ? o.cost_code_id : (b.costCodeId || null),
           b.variationId === undefined ? o.variation_id : (b.variationId || null),
           b.status ?? o.status,
           b.status === 'Paid' ? (b.paidDate ?? new Date().toISOString().slice(0, 10)) : (b.status ? null : o.paid_date),
           b.notes === undefined ? o.notes : b.notes,
           b.certId, params.id],
  })

  const changes = []
  if (b.grossCumulative !== undefined && Number(b.grossCumulative) !== Number(o.gross_cumulative))
    changes.push({ field: `${o.sub_name} cert ${o.cert_no} gross`, old: auditMoney(Number(o.gross_cumulative)), next: auditMoney(Number(b.grossCumulative)) })
  if (b.status && b.status !== o.status)
    changes.push({ field: `${o.sub_name} cert ${o.cert_no} status`, old: String(o.status), next: String(b.status) })
  if (changes.length) await auditChanges(params.id, 'Subcontractors', `${o.sub_name}`, changes, userName)

  return NextResponse.json({ ok: true, insWarning })
}
