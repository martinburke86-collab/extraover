import { getSession } from '@/lib/getSession'
import { initDB, db } from '@/lib/db'
import { getEffectiveRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { parseTerminology } from '@/lib/terminology'
import LayoutClient from './LayoutClient'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  await initDB()

  const role = await getEffectiveRole(session.userId, session.globalRole, params.id)
  if (!role) redirect('/portfolio')

  const projR = await db.execute({ sql: 'SELECT terminology FROM projects WHERE id=?', args: [params.id] })
  const terms = parseTerminology((projR.rows[0] as any)?.terminology)

  return (
    <LayoutClient params={params} role={role} userName={session.name} terms={terms}>
      {children}
    </LayoutClient>
  )
}
