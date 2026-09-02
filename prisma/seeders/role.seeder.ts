import type { Permission, Role } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ROLES_CONFIG, ROLE_DEFAULT_PERMISSIONS, ROLE_SLUGS } from '@/config/roles';

export { ROLES_CONFIG, ROLE_DEFAULT_PERMISSIONS, ROLE_SLUGS };

export interface SeededRoles {
  superAdmin: Role;
  owner: Role;
  direktur: Role;
  purchasing: Role;
  vaultOfficer: Role;
  production: Role;
  sales: Role;
  finance: Role;
  accounting: Role;
  member: Role;
}

/**
 * Upserts seluruh role operasional dan mengaitkan izin-izin yang telah didefinisikan.
 * Super Admin diberikan seluruh izin yang ada di database.
 * Idempotent — aman dijalankan berulang kali.
 */
export async function seedRoles(permissions: Permission[]): Promise<SeededRoles> {
  const seededList = await Promise.all(
    ROLES_CONFIG.map(({ slug, name, description, isSystem }) =>
      prisma.role.upsert({
        where: { slug },
        update: { name, description, isSystem },
        create: { slug, name, description, isSystem },
      }),
    ),
  );

  const rolesBySlug = new Map(seededList.map((role) => [role.slug, role]));
  const permissionsByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const superAdmin = rolesBySlug.get(ROLE_SLUGS.SUPER_ADMIN);
  const owner = rolesBySlug.get(ROLE_SLUGS.OWNER);
  const direktur = rolesBySlug.get(ROLE_SLUGS.DIREKTUR);
  const purchasing = rolesBySlug.get(ROLE_SLUGS.PURCHASING);
  const vaultOfficer = rolesBySlug.get(ROLE_SLUGS.VAULT_OFFICER);
  const production = rolesBySlug.get(ROLE_SLUGS.PRODUCTION);
  const sales = rolesBySlug.get(ROLE_SLUGS.SALES);
  const finance = rolesBySlug.get(ROLE_SLUGS.FINANCE);
  const accounting = rolesBySlug.get(ROLE_SLUGS.ACCOUNTING);
  const member = rolesBySlug.get(ROLE_SLUGS.MEMBER);

  if (
    !superAdmin ||
    !owner ||
    !direktur ||
    !purchasing ||
    !vaultOfficer ||
    !production ||
    !sales ||
    !finance ||
    !accounting ||
    !member
  ) {
    throw new Error('Roles failed to seed');
  }

  // Sinkronisasi izin untuk setiap role
  const transactions = [];

  for (const role of seededList) {
    const defaultKeys: readonly string[] =
      (ROLE_DEFAULT_PERMISSIONS as Record<string, readonly string[]>)[role.slug] ?? [];
    let permissionIds: string[] = [];

    if (defaultKeys.includes('*')) {
      // Super Admin: seluruh permission
      permissionIds = permissions.map((p) => p.id);
    } else {
      permissionIds = defaultKeys
        .map((key: string) => permissionsByKey.get(key))
        .filter((id: string | undefined): id is string => Boolean(id));
    }

    transactions.push(
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      }),
    );
  }

  await prisma.$transaction(transactions);

  console.log(
    `Roles: ${seededList.length} roles in sync, ` +
      `Super Admin granted all ${permissions.length} permissions`,
  );

  return {
    superAdmin,
    owner,
    direktur,
    purchasing,
    vaultOfficer,
    production,
    sales,
    finance,
    accounting,
    member,
  };
}
