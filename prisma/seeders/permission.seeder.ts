import type { Permission } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { PERMISSION_CATALOG } from '@/lib/permissions';

/**
 * Mirrors `src/lib/permissions.ts` into the permissions table: upserts every
 * declared key (refreshing copy) and deletes rows the catalog no longer
 * declares, which cascades to `role_permissions`.
 *
 * Idempotent — safe to run on every deploy.
 */
export async function seedPermissions(): Promise<Permission[]> {
  const permissions = await Promise.all(
    PERMISSION_CATALOG.map(({ key, resource, action, description }) =>
      prisma.permission.upsert({
        where: { key },
        update: { resource, action, description },
        create: { resource, action, key, description },
      }),
    ),
  );

  const pruned = await prisma.permission.deleteMany({
    where: { key: { notIn: PERMISSION_CATALOG.map((entry) => entry.key) } },
  });

  console.log(
    `Permissions: ${permissions.length} in sync` +
      (pruned.count > 0 ? `, ${pruned.count} pruned` : ''),
  );

  return permissions;
}
