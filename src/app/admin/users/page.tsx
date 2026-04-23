import { getSession } from '@/lib/getSession'


import { initDB, db } from '@/lib/db'
import UsersClient from './UsersClient'
export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const session = await getSession()
  await initDB()

  const usersR = await db.execute(
    'SELECT id, email, name, global_role, created_at FROM users ORDER BY created_at ASC'
  )
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
  const projects = (projectsR.rows as any[]).map(p => ({ id: String(p.id), name: String(p.name), code: String(p.code) }))
  const currentUserId = session?.userId ?? ''

  return <UsersClient users={users} projects={projects} currentUserId={currentUserId} />
}
