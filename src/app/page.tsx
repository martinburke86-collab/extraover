import { redirect } from 'next/navigation'
import { initDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Home() {
  await initDB()
  redirect('/portfolio')
}
