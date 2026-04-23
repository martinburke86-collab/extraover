import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      globalRole: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    globalRole: string
  }
}
