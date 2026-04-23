import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Never intercept API routes, static files, or public pages.
  // API routes handle their own authentication.
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/admin/setup') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // For all other pages, require the session cookie
  const token = req.cookies.get('eo_session')
  if (!token) {
    const url = new URL('/login', req.url)
    url.searchParams.set('from', pathname)
    // Use 302 (not 307) so browsers convert POST→GET on redirect
    return NextResponse.redirect(url, 302)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
}
