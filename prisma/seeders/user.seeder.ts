import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import type { SeededRoles } from './role.seeder';

const PASSWORD_SALT_ROUNDS = 12;

export interface SeedUserDefinition {
  email: string;
  name: string;
  roleId: string;
}

/**
 * Creates seed accounts for each operational role in PT TAN ERP:
 * - Super Admin (admin@tan.local)
 * - Owner / Pemilik (owner@tan.local)
 * - Direktur Utama / Dirut (dirut@tan.local & direktur@tan.local)
 * - Purchasing (purchasing@tan.local)
 * - Vault & Gudang (vault@tan.local)
 * - Produksi Perhiasan (production@tan.local)
 * - Sales & Ekspor (sales@tan.local)
 * - Keuangan & Kasir (finance@tan.local)
 * - Akuntansi SAK EMKM (accounting@tan.local)
 * - Member / Staff (member@tan.local)
 *
 * Password default: `process.env.SEED_DEFAULT_PASSWORD || process.env.SEED_SUPER_ADMIN_PASSWORD || 'TanErp!2026'`
 * Idempotent — aman dijalankan berulang kali pada setiap build / deploy.
 */
export async function seedUsers(roles: SeededRoles): Promise<void> {
  const defaultPassword =
    process.env.SEED_DEFAULT_PASSWORD ||
    process.env.SEED_SUPER_ADMIN_PASSWORD ||
    'TanErp!2026';

  const superAdminEmail = (
    process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@tan.local'
  ).toLowerCase();

  const hashedPassword = await bcrypt.hash(defaultPassword, PASSWORD_SALT_ROUNDS);

  const usersToSeed: SeedUserDefinition[] = [
    {
      email: superAdminEmail,
      name: 'Super Admin',
      roleId: roles.superAdmin.id,
    },
    {
      email: 'owner@tan.local',
      name: 'Bpk. Hendra (Owner PT TAN)',
      roleId: roles.owner.id,
    },
    {
      email: 'dirut@tan.local',
      name: 'Direktur Utama (Dirut)',
      roleId: roles.direktur.id,
    },
    {
      email: 'direktur@tan.local',
      name: 'Direktur Utama PT TAN',
      roleId: roles.direktur.id,
    },
    {
      email: 'purchasing@tan.local',
      name: 'Manager Purchasing',
      roleId: roles.purchasing.id,
    },
    {
      email: 'vault@tan.local',
      name: 'Petugas Vault & Gudang',
      roleId: roles.vaultOfficer.id,
    },
    {
      email: 'production@tan.local',
      name: 'Supervisor Produksi',
      roleId: roles.production.id,
    },
    {
      email: 'sales@tan.local',
      name: 'Sales & Ekspor Executive',
      roleId: roles.sales.id,
    },
    {
      email: 'finance@tan.local',
      name: 'Keuangan & Kasir',
      roleId: roles.finance.id,
    },
    {
      email: 'accounting@tan.local',
      name: 'Akuntan SAK EMKM',
      roleId: roles.accounting.id,
    },
    {
      email: 'member@tan.local',
      name: 'Staff Member',
      roleId: roles.member.id,
    },
  ];

  for (const user of usersToSeed) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        roleId: user.roleId,
        password: hashedPassword,
        isActive: true,
      },
      create: {
        email: user.email,
        name: user.name,
        password: hashedPassword,
        roleId: user.roleId,
        isActive: true,
      },
    });
  }

  console.log(
    `Users: ${usersToSeed.length} accounts in sync across all roles (default password set)`,
  );
}
