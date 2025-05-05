// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add paths that should be publicly accessible (don't require login)
const PUBLIC_PATHS = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('firebaseIdToken'); // Example: assuming you store token in a cookie named 'firebaseIdToken'

  // --- Login is now Optional ---
  // The following block is commented out to allow access to all pages regardless of authentication status.
  // Components should handle UI/feature differences based on the user state from useAuth.
  /*
  // If trying to access a protected route without a token, redirect to login
  if (!PUBLIC_PATHS.includes(pathname) && !sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', pathname); // Optional: redirect back after login
    console.log(`Redirecting unauthenticated user from ${pathname} to /login`);
    return NextResponse.redirect(loginUrl);
  }
  */

  // If trying to access login/signup page while already having a token, redirect to home
  if (PUBLIC_PATHS.includes(pathname) && sessionToken) {
      console.log(`Redirecting authenticated user from ${pathname} to /`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Allow the request to proceed
  return NextResponse.next();
}

// Define the routes the middleware should run on
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

// Note: Storing the Firebase ID token directly in a cookie might not be the most secure approach
// for production apps. Consider using server-side sessions or more robust token management strategies.
// This example uses a simple cookie check for demonstration. You'll need to implement the logic
// to actually set/verify this cookie upon Firebase login/logout.
