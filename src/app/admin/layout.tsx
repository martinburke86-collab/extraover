import { getSession } from '@/lib/getSession'
import { initDB, db } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await initDB()

  // Allow /admin/setup when no users exist yet
  const countR = await db.execute('SELECT COUNT(*) as n FROM users')
  const count  = Number((countR.rows[0] as any)?.n || 0)
  if (count === 0) return <>{children}</>

  const session = await getSession()
  if (!session) redirect('/login')
  if (session.globalRole !== 'owner') redirect('/portfolio')

  return <>{children}</>
}
