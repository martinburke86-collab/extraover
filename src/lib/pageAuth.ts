import { getSession } from './getSession'
import { getEffectiveRole, type Role } from './roles'
import { initDB } from './db'
import { redirect } from 'next/navigation'

export async function requireProjectRole(
  projectId: string,
  minRole: 'viewer' | 'editor' | 'owner' = 'viewer'
): Promise<Role> {
  const session = await getSession()
  if (!session) redirect('/login')

  await initDB()

  const role = await getEffectiveRole(session.userId, session.globalRole, projectId)
  if (!role) redirect('/portfolio')

  const order: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 }
  if (order[role] < order[minRole]) redirect(`/${projectId}/dashboard`)

  return role
}
