import { getSession } from '@/lib/getSession'
import { redirect } from 'next/navigation'
import { initDB, db } from '@/lib/db'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/portfolio')

  await initDB()
  const countR = await db.execute('SELECT COUNT(*) as n FROM users')
  const count  = Number((countR.rows[0] as any)?.n || 0)
  if (count === 0) redirect('/admin/setup')

  return <LoginClient />
}
