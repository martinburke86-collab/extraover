import { getSession } from '@/lib/getSession'
import { NextResponse } from 'next/server'


import { db, initDB, cuid } from '@/lib/db'

async function requireOwner() {
  const session = await getSession()
  if (!session) return null
  if (session.globalRole !== 'owner') return null
  return session
}

// PUT — set role for user on a project (upsert)
export async function PUT(req: Request) {
  const session = await requireOwner()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await initDB()

  const { userId, projectId, role } = await req.json()

  if (!role) {
    // Remove assignment
    await db.execute({
      sql: 'DELETE FROM user_projects WHERE user_id=? AND project_id=?',
      args: [userId, projectId],
    })
    return NextResponse.json({ ok: true, removed: true })
  }

  // Upsert
  const existing = await db.execute({
    sql: 'SELECT id FROM user_projects WHERE user_id=? AND project_id=?',
    args: [userId, projectId],
  })

  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE user_projects SET role=? WHERE user_id=? AND project_id=?',
      args: [role, userId, projectId],
    })
  } else {
    await db.execute({
      sql: 'INSERT INTO user_projects (id, user_id, project_id, role) VALUES (?,?,?,?)',
      args: [cuid(), userId, projectId, role],
    })
  }

  return NextResponse.json({ ok: true })
}
