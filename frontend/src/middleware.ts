import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedPrefixes = ['/dashboard', '/profile', '/stations', '/logbook', '/spots/new', '/admin']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const { pathname } = request.nextUrl

  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))
  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/stations/:path*', '/logbook/:path*', '/spots/new', '/admin/:path*']
}
