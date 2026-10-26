import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { requireUserApi, requireProjectApi } from '@/lib/apiAuth'
import { createProject } from '@/lib/projects'

export async function GET() {
  const guard = await requireUserApi()
  if (!guard.ok) return guard.res
  await initDB()
  // Global owners see every project, everyone else only their assigned ones
  const r = guard.session.globalRole === 'owner'
    ? await db.execute('SELECT id, name, code FROM projects ORDER BY created_at DESC')
    : await db.execute({
        sql: `SELECT p.id, p.name, p.code FROM projects p
              JOIN user_projects up ON up.project_id = p.id
              WHERE up.user_id=? ORDER BY p.created_at DESC`,
        args: [guard.session.userId],
      })
  return NextResponse.json(r.rows)
}

export async function DELETE(req: Request) {
  await initDB()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const guard = await requireProjectApi(String(id), 'owner')
  if (!guard.ok) return guard.res
  // period_snapshots and breakdowns have no project_id, so they do not cascade:
  // a snapshot would block the delete (foreign key) and breakdowns would orphan.
  await db.batch([
    { sql: `DELETE FROM period_snapshots WHERE period_id IN (SELECT id FROM report_periods WHERE project_id=?)`, args: [id] },
    { sql: `DELETE FROM breakdowns WHERE parent_id IN (
              SELECT id FROM forecast_lines  WHERE project_id=? UNION SELECT id FROM committed_lines WHERE project_id=?
              UNION SELECT id FROM prelim_items WHERE project_id=? UNION SELECT id FROM cost_lines WHERE project_id=?)`, args: [id, id, id, id] },
    { sql: `DELETE FROM projects WHERE id=?`, args: [id] },
  ], 'write')
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  const guard = await requireUserApi()
  if (!guard.ok) return guard.res
  await initDB()
  const session = guard.session
  const b = await req.json()
  try {
    const { id } = await createProject(b, session?.userId ?? null)
    return NextResponse.json({ id })
  } catch (err: any) {
    console.error('Project creation failed:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error', detail: String(err) },
      { status: 500 }
    )
  }
}
