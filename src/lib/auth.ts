import { auth } from '@/auth';
import { UnauthorizedError } from '@/lib/errors';
import type { Session } from 'next-auth';

/**
 * Sesi asli — tidak ada lagi sesi mock masa transisi. Halaman login bisa
 * benar-benar tampil, dan halaman/API yang butuh login memakai sesi nyata
 * (cookie NextAuth), bukan admin super palsu.
 */
export async function getSession(): Promise<Session | null> {
  return auth();
}

export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError('Sesi Anda sudah berakhir, silakan masuk kembali.');
  return session;
}
