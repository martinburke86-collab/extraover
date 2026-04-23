import crypto from 'crypto'

const SECRET = process.env.NEXTAUTH_SECRET ?? 'extraover-dev-secret-change-me-32c'

export interface SessionData {
  userId: string
  email: string
  name: string
  globalRole: string
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
}

export function encodeSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function decodeSession(token: string): SessionData | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const payload   = token.slice(0, dot)
    const signature = token.slice(dot + 1)
    if (sign(payload) !== signature) return null
    return JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }
}

export const COOKIE_NAME = 'eo_session'
export const COOKIE_OPTS = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  'lax' as const,
  path:      '/',
  maxAge:    60 * 60 * 24 * 90, // 90 days
}
