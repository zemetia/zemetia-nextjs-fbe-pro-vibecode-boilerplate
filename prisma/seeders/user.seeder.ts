import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const PASSWORD_SALT_ROUNDS = 12;

/**
 * Creates the bootstrap Super Admin — the only account that cannot be made from
 * the UI, since creating users requires being signed in already. Everyone else
 * is added through `POST /api/users`.
 *
 * Re-running it re-asserts the role, reactivates the account and re-hashes the
 * password from the environment, which doubles as the recovery path if the
 * bootstrap admin is locked out. The password is never printed.
 *
 * Idempotent — safe to run on every deploy.
 */
export async function seedUsers(superAdmin: Role): Promise<void> {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      'Users: SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set — skipping bootstrap admin.',
    );
    return;
  }

  const hashed = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { roleId: superAdmin.id, password: hashed, isActive: true },
    create: {
      email: email.toLowerCase(),
      name: 'Super Admin',
      password: hashed,
      roleId: superAdmin.id,
    },
  });

  console.log(`Users: bootstrap Super Admin ready (${email.toLowerCase()})`);
}
