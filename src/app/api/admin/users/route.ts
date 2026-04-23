import { NextResponse } from 'next/server'
import { getSession } from '@/lib/getSession'
import { db, initDB, cuid } from '@/lib/db'
import bcrypt from 'bcryptjs'

async function requireOwner() {
  const session = await getSession()
  if (!session) return null
  if (session.globalRole !== 'owner') return null
  return session
}

export async function GET() {
  try {
    const session = await requireOwner()
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await initDB()

    const usersR    = await db.execute('SELECT id, email, name, global_role, created_at FROM users ORDER BY created_at ASC')
    const projectsR = await db.execute('SELECT id, name, code FROM projects ORDER BY name ASC')
    const assignR   = await db.execute(`
      SELECT up.user_id, up.project_id, up.role, p.name as project_name, p.code
      FROM user_projects up JOIN projects p ON p.id = up.project_id ORDER BY p.name ASC
    `)

    const assignments = assignR.rows as any[]
    const users = (usersR.rows as any[]).map(u => ({
      id: String(u.id), email: String(u.email), name: String(u.name),
      globalRole: String(u.global_role), createdAt: String(u.created_at),
      projects: assignments
        .filter(a => a.user_id === u.id)
        .map(a => ({ projectId: String(a.project_id), projectName: String(a.project_name), code: String(a.code), role: String(a.role) })),
    }))

    return NextResponse.json({
      users,
      projects: (projectsR.rows as any[]).map(p => ({ id: String(p.id), name: String(p.name), code: String(p.code) })),
    })
  } catch (err: any) {
    console.error('[users GET]', err)
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await initDB()
    const body = await req.json()

    // First-run setup — bypass auth check, only works when no users exist
    if (body._setup) {
      const countR = await db.execute('SELECT COUNT(*) as n FROM users')
      const count  = Number((countR.rows[0] as any)?.n ?? 0)
      if (count > 0)
        return NextResponse.json({ error: 'Setup already complete — sign in instead' }, { status: 403 })
    } else {
      const session = await requireOwner()
      if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, email, password, globalRole = 'user' } = body

    if (!name || !email || !password)
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    if (String(password).length < 8)
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email=?',
      args: [String(email).toLowerCase().trim()],
    })
    if (existing.rows.length > 0)
      return NextResponse.json({ error: 'That email is already registered' }, { status: 409 })

    const hashed = await bcrypt.hash(String(password), 10)
    const id     = cuid()

    await db.execute({
      sql:  'INSERT INTO users (id, email, name, hashed_password, global_role) VALUES (?,?,?,?,?)',
      args: [id, String(email).toLowerCase().trim(), String(name).trim(), hashed, globalRole],
    })

    return NextResponse.json({ id, email: String(email).toLowerCase().trim(), name: String(name).trim(), globalRole })
  } catch (err: any) {
    console.error('[users POST]', err)
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireOwner()
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await initDB()

    const body = await req.json()
    const { id, name, email, password, globalRole } = body

    if (password) {
      if (String(password).length < 8)
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      const hashed = await bcrypt.hash(String(password), 10)
      await db.execute({ sql: 'UPDATE users SET hashed_password=? WHERE id=?', args: [hashed, id] })
    }

    if (name || email || globalRole) {
      const parts: string[] = [], args: any[] = []
      if (name)       { parts.push('name=?');        args.push(String(name).trim()) }
      if (email)      { parts.push('email=?');       args.push(String(email).toLowerCase().trim()) }
      if (globalRole) { parts.push('global_role=?'); args.push(globalRole) }
      args.push(id)
      await db.execute({ sql: `UPDATE users SET ${parts.join(',')} WHERE id=?`, args })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[users PATCH]', err)
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOwner()
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await initDB()

    const { id } = await req.json()
    if (id === session.userId)
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

    await db.execute({ sql: 'DELETE FROM users WHERE id=?', args: [id] })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[users DELETE]', err)
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
