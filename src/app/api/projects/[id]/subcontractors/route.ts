import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { getSession } from '@/lib/getSession'
import { auditChanges } from '@/lib/audit'

// GET — subcontractor accounts with aggregates, plus unregistered suppliers
export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const [subsR, certsR, ordersR, unregR] = await Promise.all([
    db.execute({ sql: `SELECT * FROM subcontractors WHERE project_id=? ORDER BY name`, args: [params.id] }),
    db.execute({
      sql: `SELECT sc.*, cc.code as cost_code, v.ref as variation_ref
            FROM sub_certs sc
            LEFT JOIN cost_codes cc ON sc.cost_code_id = cc.id
            LEFT JOIN variations v ON sc.variation_id = v.id
            WHERE sc.project_id=? ORDER BY sc.subcontractor_id, sc.cert_no`,
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT supplier, SUM(total) as order_value FROM committed_lines
            WHERE project_id=? AND supplier IS NOT NULL AND supplier != ''
            GROUP BY supplier`,
      args: [params.id],
    }),
    db.execute({
      sql: `SELECT DISTINCT supplier FROM committed_lines
            WHERE project_id=? AND supplier IS NOT NULL AND supplier != ''
              AND supplier NOT IN (SELECT name FROM subcontractors WHERE project_id=?)`,
      args: [params.id, params.id],
    }),
  ])

  const orderMap = Object.fromEntries((ordersR.rows as any[]).map(r => [String(r.supplier), Number(r.order_value) || 0]))
  const certsBySub: Record<string, any[]> = {}
  for (const c of certsR.rows as any[]) {
    ;(certsBySub[String(c.subcontractor_id)] ||= []).push(c)
  }

  const subs = (subsR.rows as any[]).map(sub => {
    const certs = certsBySub[String(sub.id)] || []
    const latest = certs.length ? certs[certs.length - 1] : null
    const certifiedCum = latest ? Number(latest.gross_cumulative) || 0 : 0
    const retentionHeld = certifiedCum * (Number(sub.retention_pct) || 0) / 100
    // Convention A: committed lines decay as invoiced, so the standing order value
    // lives on the account (snapshotted at import, editable). Live sum is the fallback.
    const orderValue = sub.order_value != null ? Number(sub.order_value) : (orderMap[String(sub.name)] || 0)
    const today = new Date().toISOString().slice(0, 10)
    return {
      ...sub,
      certs,
      order_value: orderValue,
      certified_cumulative: certifiedCum,
      retention_held: retentionHeld,
      over_certified: orderValue > 0 && certifiedCum > orderValue + 1,
      tax_expired: !!sub.tax_clearance_expiry && String(sub.tax_clearance_expiry) < today,
      ins_expired: !!sub.insurance_expiry && String(sub.insurance_expiry) < today,
    }
  })

  return NextResponse.json({ subs, unregistered: (unregR.rows as any[]).map(r => String(r.supplier)) })
}

// POST — create account(s). body: {name, ...fields} or {importAll: true}
export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const session = await getSession()
  const userName = session?.name ?? 'Unknown'

  if (b.importAll) {
    const unregR = await db.execute({
      sql: `SELECT DISTINCT supplier FROM committed_lines
            WHERE project_id=? AND supplier IS NOT NULL AND supplier != ''
              AND supplier NOT IN (SELECT name FROM subcontractors WHERE project_id=?)`,
      args: [params.id, params.id],
    })
    // Snapshot the current committed sum as the standing order value at import time
    const sumsR = await db.execute({
      sql: `SELECT supplier, SUM(total) as v FROM committed_lines
            WHERE project_id=? GROUP BY supplier`,
      args: [params.id],
    })
    const sums = Object.fromEntries((sumsR.rows as any[]).map(r => [String(r.supplier), Number(r.v) || 0]))
    for (const r of unregR.rows as any[]) {
      await db.execute({
        sql: `INSERT INTO subcontractors (id, project_id, name, order_value) VALUES (?,?,?,?)`,
        args: [cuid(), params.id, String(r.supplier), sums[String(r.supplier)] ?? null],
      })
    }
    await auditChanges(params.id, 'Subcontractors', 'Register', [
      { field: 'Accounts created from Committed', old: '', next: String(unregR.rows.length) },
    ], userName)
    return NextResponse.json({ ok: true, created: unregR.rows.length })
  }

  if (!b.name || !String(b.name).trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }
  const id = cuid()
  await db.execute({
    sql: `INSERT INTO subcontractors (id, project_id, name, retention_pct, rct_rate, tax_clearance_expiry, insurance_expiry, notes)
          VALUES (?,?,?,?,?,?,?,?)`,
    args: [id, params.id, String(b.name).trim(), b.retentionPct ?? 3, b.rctRate ?? 20,
           b.taxClearanceExpiry ?? null, b.insuranceExpiry ?? null, b.notes ?? null],
  })
  return NextResponse.json({ ok: true, id })
}

// PATCH — update account fields
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const b = await req.json()
  const session = await getSession()
  const userName = session?.name ?? 'Unknown'

  const oldR = await db.execute({ sql: `SELECT * FROM subcontractors WHERE id=? AND project_id=?`, args: [b.subId, params.id] })
  const o = oldR.rows[0] as any
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.execute({
    sql: `UPDATE subcontractors SET retention_pct=?, rct_rate=?, tax_clearance_expiry=?, insurance_expiry=?,
          final_account_status=?, final_account_value=?, order_value=?, notes=? WHERE id=? AND project_id=?`,
    args: [b.retentionPct ?? o.retention_pct, b.rctRate ?? o.rct_rate,
           b.taxClearanceExpiry === undefined ? o.tax_clearance_expiry : (b.taxClearanceExpiry || null),
           b.insuranceExpiry === undefined ? o.insurance_expiry : (b.insuranceExpiry || null),
           b.finalAccountStatus ?? o.final_account_status,
           b.finalAccountValue === undefined ? o.final_account_value : b.finalAccountValue,
           b.orderValue === undefined ? o.order_value : (b.orderValue || null),
           b.notes === undefined ? o.notes : b.notes,
           b.subId, params.id],
  })

  const changes = []
  if (b.retentionPct !== undefined && Number(b.retentionPct) !== Number(o.retention_pct))
    changes.push({ field: `${o.name} retention %`, old: String(o.retention_pct), next: String(b.retentionPct) })
  if (b.rctRate !== undefined && Number(b.rctRate) !== Number(o.rct_rate))
    changes.push({ field: `${o.name} RCT rate`, old: `${o.rct_rate}%`, next: `${b.rctRate}%` })
  if (b.orderValue !== undefined && Number(b.orderValue) !== Number(o.order_value))
    changes.push({ field: `${o.name} order value`, old: String(o.order_value ?? '\u2013'), next: String(b.orderValue) })
  if (b.finalAccountStatus !== undefined && b.finalAccountStatus !== o.final_account_status)
    changes.push({ field: `${o.name} final account`, old: String(o.final_account_status), next: String(b.finalAccountStatus) })
  if (changes.length) await auditChanges(params.id, 'Subcontractors', String(o.name), changes, userName)

  return NextResponse.json({ ok: true })
}
