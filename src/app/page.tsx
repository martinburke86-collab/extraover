import { redirect } from 'next/navigation'
import { db, initDB } from '@/lib/db'

export default async function Home() {
  await initDB()
  const result = await db.execute('SELECT id FROM projects LIMIT 1')
  const projectId = result.rows[0]?.id as string | undefined
  if (projectId) redirect(`/${projectId}/dashboard`)
  redirect('/setup')
}
