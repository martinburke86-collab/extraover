import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db, initDB } from './db'

// Single source of truth for the secret — used by both authOptions and any
// server-side calls. Must match what was used to sign existing tokens.
export const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? 'extraover-dev-secret-32-chars-min!'

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null

          await initDB()

          const r = await db.execute({
            sql:  'SELECT * FROM users WHERE email=?',
            args: [credentials.email.toLowerCase().trim()],
          })

          const user = r.rows[0] as any
          if (!user) {
            console.log('[auth] user not found:', credentials.email)
            return null
          }

          const valid = await bcrypt.compare(
            credentials.password,
            String(user.hashed_password)
          )

          if (!valid) {
            console.log('[auth] wrong password for:', credentials.email)
            return null
          }

          console.log('[auth] sign-in success:', credentials.email)
          return {
            id:         String(user.id),
            email:      String(user.email),
            name:       String(user.name),
            globalRole: String(user.global_role),
          }
        } catch (err) {
          console.error('[auth] authorize error:', err)
          return null
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id         = user.id
        token.globalRole = (user as any).globalRole
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        ;(session.user as any).id         = token.id
        ;(session.user as any).globalRole = token.globalRole
      }
      return session
    },
  },
}
