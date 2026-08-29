import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getSession } from '@/lib/auth';
import { getUserPermissions, hasPermission } from '@/lib/rbac';
import { AdminShell } from './_components/AdminShell';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');

  const permissions = await getUserPermissions(session.user.id);
  if (!hasPermission(permissions, ['roles:list', 'users:list'])) redirect('/');

  return <AdminShell>{children}</AdminShell>;
}
