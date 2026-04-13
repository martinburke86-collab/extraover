import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import * as XLSX from 'xlsx'

type ImportType = 'cost-codes' | 'committed' | 'forecast' | 'prelims'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await initDB()
  const pid = params.id

  const formData = await req.formData()
  const file     = formData.get('file') as File
  const type     = formData.get('type') as ImportType

  if (!file || !type) {
    return NextResponse.json({ error: 'Missing file or type' }, { status: 400 })
  }

  const buf  = Buffer.from(await file.arrayBuffer())
  const wb   = XLSX.read(buf, { type: 'buffer' })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

  // Normalise header keys
  const norm = rows.map(r =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k.toString().trim().toLowerCase().replace(/[\s\/\-\(\)%]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''),
        v,
      ])
    )
  )

  let inserted = 0
  let skipped  = 0
  const errors: string[] = []

  // Helper: get cost code id by code string
  async function codeIdForCode(code: string): Promise<string | null> {
    const r = await db.execute({
      sql:  `SELECT id FROM cost_codes WHERE project_id=? AND code=?`,
      args: [pid, code.trim()],
    })
    return (r.rows[0]?.id as string) ?? null
  }

  // ══════════════════════════════════════════════════════════════════════
  if (type === 'cost-codes') {
    for (let i = 0; i < norm.length; i++) {
      const r    = norm[i]
      const code = String(r.code ?? r.cost_code ?? '').trim()
      const desc = String(r.description ?? r.desc ?? '').trim()
      const trade= String(r.trade ?? r.trade_element ?? r.element ?? '').trim()
      const notes= String(r.notes ?? r.note ?? '').trim()

      if (!code || !desc) { skipped++; continue }

      try {
        await db.execute({
          sql:  `INSERT INTO cost_codes VALUES (?,?,?,?,?,?,?)
                 ON CONFLICT(project_id, code) DO UPDATE SET
                   description=excluded.description,
                   trade=excluded.trade,
                   category=excluded.category,
                   notes=excluded.notes`,
          args: [cuid(), pid, code, desc, trade, '', notes || null],
        })
        inserted++
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`)
        skipped++
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  else if (type === 'committed') {
    for (let i = 0; i < norm.length; i++) {
      const r    = norm[i]
      const code = String(r.code ?? r.cost_code ?? '').trim()
      if (!code) { skipped++; continue }

      const ccId = await codeIdForCode(code)
      if (!ccId) {
        errors.push(`Row ${i + 2}: Code "${code}" not found in Cost Codes`)
        skipped++; continue
      }

      const qty      = Number(r.qty ?? r.quantity ?? '') || null
      const unitRate = Number(r.unit_rate ?? r.rate ?? r.price ?? '') || null
      const lump     = Number(r.total ?? r.total_price ?? r.amount ?? '') || 0
      const total    = qty && unitRate ? qty * unitRate : lump

      const validStatuses = ['Placed','Pending','Provisional','Forecast','On Hold','Cancelled']
      const status = validStatuses.find(s => s.toLowerCase() === String(r.status ?? '').trim().toLowerCase()) ?? 'Placed'

      try {
        await db.execute({
          sql:  `INSERT INTO committed_lines VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          args: [cuid(), pid, ccId,
                 String(r.supplier ?? r.vendor ?? '').trim() || null,
                 String(r.description ?? r.item ?? r.desc ?? '').trim() || null,
                 status, qty, String(r.unit ?? '').trim() || null,
                 unitRate, total, String(r.notes ?? '').trim() || null],
        })
        inserted++
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`)
        skipped++
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  else if (type === 'forecast') {
    const validStatuses = ['Estimate','Quote','Final','Variation - Recoverable','Variation - Non Recoverable','Contingency']
    const maxOrd = await db.execute({
      sql:  `SELECT MAX(sort_order) as m FROM forecast_lines WHERE project_id=?`,
      args: [pid],
    })
    let sortOrder = (Number((maxOrd.rows[0] as any)?.m) || 0) + 1

    for (let i = 0; i < norm.length; i++) {
      const r    = norm[i]
      const code = String(r.code ?? r.cost_code ?? '').trim()
      if (!code) { skipped++; continue }

      const ccId = await codeIdForCode(code)
      if (!ccId) {
        errors.push(`Row ${i + 2}: Code "${code}" not found in Cost Codes`)
        skipped++; continue
      }

      const factor   = Number(r.factor ?? '') || null
      const qty      = Number(r.qty ?? r.quantity ?? '') || null
      const rate     = Number(r.rate ?? r.unit_rate ?? r.price ?? '') || null
      const lump     = Number(r.total ?? r.amount ?? '') || null
      const total    = lump ?? (factor && qty && rate ? factor * qty * rate : qty && rate ? qty * rate : rate ?? 0)
      const status   = validStatuses.find(s => s.toLowerCase() === String(r.status ?? '').trim().toLowerCase()) ?? 'Estimate'

      try {
        await db.execute({
          sql:  `INSERT INTO forecast_lines VALUES (?,?,?,NULL,?,?,?,?,?,?,?,?,?)`,
          args: [cuid(), pid, ccId, sortOrder++,
                 String(r.supplier ?? '').trim() || null,
                 status, factor, qty,
                 String(r.unit ?? '').trim() || null,
                 rate, total,
                 String(r.comment ?? r.notes ?? '').trim() || null],
        })
        inserted++
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`)
        skipped++
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  else if (type === 'prelims') {
    // Expected: Section, Code, Description, Budget, CTD, Committed, Qty, Unit, Rate, Util%, Start Week, Finish Week, Notes
    const maxOrd = await db.execute({
      sql:  `SELECT MAX(sort_order) as m FROM prelim_items WHERE project_id=?`,
      args: [pid],
    })
    let sortOrder = (Number((maxOrd.rows[0] as any)?.m) ?? -1) + 1

    const VALID_UNITS = ['Weeks','weeks','nr','each','m','m2','m²','m3','m³','t','kg','Item','item','LS','ls','Months','months']

    for (let i = 0; i < norm.length; i++) {
      const r    = norm[i]
      const desc = String(r.description ?? r.desc ?? '').trim()
      if (!desc) { skipped++; continue }

      const section  = String(r.section ?? r.element ?? r.area ?? 'Other').trim()
      const code     = String(r.code ?? r.cost_code ?? '').trim() || null
      const budget   = Number(r.budget ?? '') || 0
      const ctd      = Number(r.ctd ?? r.cost_to_date ?? '') || 0
      const committed= Number(r.committed ?? '') || 0
      const qty      = Number(r.qty ?? r.quantity ?? 1) || 1
      const rawUnit  = String(r.unit ?? 'Weeks').trim()
      // Normalise unit — accept case-insensitive
      const unit     = VALID_UNITS.find(u => u.toLowerCase() === rawUnit.toLowerCase()) ?? 'Weeks'
      const rate     = Number(r.rate ?? r.unit_rate ?? '') || 0
      const util     = Number(r.util ?? r.util_ ?? r.utilisation ?? r.utilisation_pct ?? 100)
      const startWk  = Number(r.start_week ?? r.start ?? r.start_wk ?? 1) || 1
      const finishWk = Number(r.finish_week ?? r.finish ?? r.finish_wk ?? r.end ?? 52) || 52
      const notes    = String(r.notes ?? r.note ?? '').trim() || null

      try {
        await db.execute({
          sql:  `INSERT INTO prelim_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [cuid(), pid, section, code, desc,
                 budget, ctd, committed,
                 qty, unit, rate, util,
                 startWk, finishWk, sortOrder++, notes],
        })
        inserted++
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`)
        skipped++
      }
    }
  }

  return NextResponse.json({
    ok:      true,
    inserted,
    skipped,
    errors:  errors.slice(0, 20),
    total:   norm.length,
  })
}
