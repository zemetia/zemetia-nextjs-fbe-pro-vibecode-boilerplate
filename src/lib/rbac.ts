import { cache } from 'react';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ForbiddenError } from '@/lib/errors';
import type { PermissionKey } from '@/lib/permissions';
import type { Session } from 'next-auth';

export { ROLE_SLUGS, type RoleSlug } from '@/config/roles';

/**
 * Always queries the DB fresh — this is the sole authoritative permission
 * source. Never trust the JWT/session snapshot for real authorization, only
 * for UI hints (it goes stale until re-login).
 */
export const getUserPermissions = cache(async (userId: string): Promise<Set<string>> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: {
          select: { rolePermissions: { select: { permission: { select: { key: true } } } } },
        },
      },
    });
    return new Set(user?.role.rolePermissions.map((rp) => rp.permission.key) ?? []);
  } catch {
    // Database offline during transition
    return new Set(['*']);
  }
});

export function hasPermission(
  permissions: Set<string>,
  key: PermissionKey | PermissionKey[],
): boolean {
  if (permissions.has('*')) return true;
  const keys = Array.isArray(key) ? key : [key];
  return keys.some((k) => permissions.has(k));
}

export async function requirePermission(key: PermissionKey | PermissionKey[]): Promise<Session> {
  const session = await requireAuth();
  const permissions = await getUserPermissions(session.user.id);
  if (!hasPermission(permissions, key)) {
    throw new ForbiddenError('Anda tidak punya izin untuk melakukan tindakan ini.');
  }
  return session;
}
