import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { db } from './db'

export type Role = 'owner' | 'editor' | 'viewer'

export async function getSessionUser() {
  const session = await getServerSession(authOptions)
  return session?.user as { id: string; email: string; name: string; globalRole: string } | undefined
}

export async function getProjectRole(projectId: string): Promise<Role | null> {
  const user = await getSessionUser()
  if (!user) return null
  if (user.globalRole === 'owner') return 'owner'

  const r = await db.execute({
    sql:  'SELECT role FROM user_projects WHERE user_id=? AND project_id=?',
    args: [user.id, projectId],
  })
  const role = r.rows[0]?.role as string | undefined
  if (!role) return null
  return role as Role
}

export function canEdit(role: Role | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canAdmin(role: Role | null): boolean {
  return role === 'owner'
}

export function requireRole(role: Role | null, minRole: Role): boolean {
  if (!role) return false
  const order: Role[] = ['viewer', 'editor', 'owner']
  return order.indexOf(role) >= order.indexOf(minRole)
}
