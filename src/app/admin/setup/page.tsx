import { initDB, db } from '@/lib/db'
import { redirect } from 'next/navigation'
import SetupClient from './SetupClient'

export default async function SetupPage() {
  await initDB()
  const countR = await db.execute('SELECT COUNT(*) as n FROM users')
  const count = Number((countR.rows[0] as any)?.n || 0)
  // If users already exist, send to login
  if (count > 0) redirect('/login')
  return <SetupClient />
}
