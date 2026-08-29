import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { applyAuthGuard } from './proxy/auth-guard';
import { applyRateLimit } from './proxy/rate-limit';
import { applySecurityHeaders } from './proxy/security-headers';

export async function middleware(request: NextRequest) {
  // Rate limit — returns 429 early for /api/* if threshold exceeded
  const rateLimited = await applyRateLimit(request);
  if (rateLimited) return rateLimited;

  // API routes — skip the auth-guard redirect, only security headers (routes 401/403 as JSON themselves)
  if (request.nextUrl.pathname.startsWith('/api')) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Page routes — redirect unauthenticated /admin/* requests to sign-in
  const authBlocked = await applyAuthGuard(request);
  if (authBlocked) return authBlocked;

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    // All routes except static assets — /api is included so rate limiting applies
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
  // applyAuthGuard pulls in `@/auth` (PrismaAdapter + pg) — not Edge-compatible.
  runtime: 'nodejs',
};
