import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getSession } from '@/lib/auth';
import { getUserPermissions, hasPermission } from '@/lib/rbac';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Landing route for `/admin` — sign-in and the sidebar both point here. It has
 * no content of its own yet, so it forwards to the first section the viewer can
 * actually open. Replace with a real dashboard when there is something to show.
 */
export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');

  const permissions = await getUserPermissions(session.user.id);
  if (hasPermission(permissions, 'users:list')) redirect('/admin/users');
  if (hasPermission(permissions, 'roles:list')) redirect('/admin/roles');

  redirect('/');
}
