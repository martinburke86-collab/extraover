import { cookies } from 'next/headers'
import { decodeSession, COOKIE_NAME, type SessionData } from './session'

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return decodeSession(token)
}
