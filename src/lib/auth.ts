import { auth } from '@/auth';
import { UnauthorizedError } from '@/lib/errors';
import type { Session } from 'next-auth';

export async function getSession(): Promise<Session | null> {
  return auth();
}

export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError('Sesi Anda sudah berakhir. Silakan masuk kembali.');
  return session;
}
