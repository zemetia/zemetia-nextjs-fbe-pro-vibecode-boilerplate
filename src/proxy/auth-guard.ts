import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { auth } from '@/auth';

/**
 * Coarse first-line gate for /admin/* page routes — decodes the session cookie
 * only, no DB call (Edge/Node-safe). This is NOT the authorization boundary;
 * requirePermission() inside pages/routes is the authoritative check.
 */
export async function applyAuthGuard(request: NextRequest): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith('/admin')) return null;

  const session = await auth();
  if (session?.user?.id) return null;

  const url = new URL('/sign-in', request.url);
  url.searchParams.set('callbackUrl', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}
