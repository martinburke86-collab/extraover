// Server-only role helpers — imports DB, do not use in client components.
// For client-safe utilities see roleUtils.ts

export type { Role } from './roleUtils'
export { navVisibleForRole, VIEWER_PAGES, EDITOR_HIDDEN_PAGES, VIEWER_BLOCKED } from './roleUtils'

import { db } from './db'
import type { Role } from './roleUtils'

export async function getEffectiveRole(
  userId: string,
  globalRole: string,
  projectId: string
): Promise<Role | null> {
  if (globalRole === 'owner') return 'owner'

  const r = await db.execute({
    sql:  'SELECT role FROM user_projects WHERE user_id=? AND project_id=?',
    args: [userId, projectId],
  })
  const row = r.rows[0] as any
  if (!row) return null
  return row.role as Role
}
