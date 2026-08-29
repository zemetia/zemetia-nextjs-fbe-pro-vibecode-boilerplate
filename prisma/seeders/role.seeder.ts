import type { Permission, Role } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ROLE_SLUGS } from '@/lib/rbac';

/**
 * The two roles the app cannot boot without. Both are `isSystem` — the UI locks
 * them from edits and deletion, so the seed is the only place their copy lives.
 */
const SYSTEM_ROLES = [
  {
    slug: ROLE_SLUGS.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'Akses penuh ke seluruh operasi. Tidak bisa diubah atau dihapus.',
  },
  {
    slug: ROLE_SLUGS.MEMBER,
    name: 'Member',
    description: 'Role bawaan tanpa akses admin.',
  },
] as const;

export interface SeededRoles {
  superAdmin: Role;
  member: Role;
}

/**
 * Upserts the system roles and re-grants the **full** permission set to Super
 * Admin, so a newly added module is reachable straight after `db:seed` without
 * anyone ticking boxes. Every other role keeps whatever it was given in the UI.
 *
 * Idempotent — safe to run on every deploy.
 */
export async function seedRoles(permissions: Permission[]): Promise<SeededRoles> {
  const [superAdmin, member] = await Promise.all(
    SYSTEM_ROLES.map(({ slug, name, description }) =>
      prisma.role.upsert({
        where: { slug },
        update: { name, description, isSystem: true },
        create: { slug, name, description, isSystem: true },
      }),
    ),
  );

  // `SYSTEM_ROLES` is a non-empty literal tuple, so both entries always resolve.
  if (!superAdmin || !member) throw new Error('System roles failed to seed');

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: superAdmin.id } }),
    prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: superAdmin.id,
        permissionId: permission.id,
      })),
    }),
  ]);

  console.log(
    `Roles: ${SYSTEM_ROLES.length} system roles in sync, ` +
      `Super Admin granted all ${permissions.length} permissions`,
  );

  return { superAdmin, member };
}
