//middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken')?.value;
  const path = request.nextUrl.pathname;

  // Routes publiques
  const publicPaths = ['/login', '/register', '/forgot-password', '/share'];
  const isPublicPath = publicPaths.some((p) => path.startsWith(p));

  // Si route protégée et pas de token → redirect login
  if (!isPublicPath && !accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si déjà connecté et essaie d'accéder login/register → redirect dashboard
  if (isPublicPath && accessToken && (path === '/login' || path === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};