import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { encodeSession, COOKIE_NAME, COOKIE_OPTS } from '@/lib/session'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email    = String(body.email    ?? '').toLowerCase().trim()
    const password = String(body.password ?? '')

    if (!email || !password)
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

    await initDB()

    const r    = await db.execute({ sql: 'SELECT * FROM users WHERE email=?', args: [email] })
    const user = r.rows[0] as any

    if (!user)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    const valid = await bcrypt.compare(password, String(user.hashed_password))
    if (!valid)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    const token = encodeSession({
      userId:     String(user.id),
      email:      String(user.email),
      name:       String(user.name),
      globalRole: String(user.global_role),
    })

    const res = NextResponse.json({ ok: true, name: String(user.name) })
    res.cookies.set(COOKIE_NAME, token, COOKIE_OPTS)
    return res
  } catch (err: any) {
    console.error('[signin]', err)
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
