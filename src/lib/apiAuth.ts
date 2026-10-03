// API route guards. The API counterpart of pageAuth.ts: middleware skips
// /api/*, so every route must check the session and project role itself.
// Returns a ready-made 401/403 response instead of redirecting.
//
//   const auth = await requireProjectApi(params.id, 'editor')
//   if (!auth.ok) return auth.res

import { NextResponse } from 'next/server'
import { getSession } from './getSession'
import { getEffectiveRole, type Role } from './roles'
import { initDB } from './db'
import type { SessionData } from './session'

type Denied = { ok: false; res: NextResponse }
type Granted<T> = { ok: true } & T

const ORDER: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 }

function deny(status: 401 | 403, error: string): Denied {
  return { ok: false, res: NextResponse.json({ error }, { status }) }
}

// Any signed-in user
export async function requireUserApi(): Promise<Granted<{ session: SessionData }> | Denied> {
  const session = await getSession()
  if (!session) return deny(401, 'Not signed in')
  return { ok: true, session }
}

// Global owner (system administrator), e.g. lists shared across all projects
export async function requireGlobalOwnerApi(): Promise<Granted<{ session: SessionData }> | Denied> {
  const session = await getSession()
  if (!session) return deny(401, 'Not signed in')
  if (session.globalRole !== 'owner') return deny(403, 'Administrator access required')
  return { ok: true, session }
}

// Member of the project with at least minRole
export async function requireProjectApi(
  projectId: string,
  minRole: Role,
): Promise<Granted<{ session: SessionData; role: Role }> | Denied> {
  const session = await getSession()
  if (!session) return deny(401, 'Not signed in')

  await initDB()
  const role = await getEffectiveRole(session.userId, session.globalRole, projectId)
  if (!role) return deny(403, 'No access to this project')
  if (ORDER[role] < ORDER[minRole]) {
    return deny(403, minRole === 'owner'
      ? 'Only a project owner can do this'
      : 'Your role on this project is read-only')
  }
  return { ok: true, session, role }
}
