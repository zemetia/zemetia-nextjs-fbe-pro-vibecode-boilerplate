import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';

import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

const findUnique = vi.fn();
const requireAuth = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: () => requireAuth(),
}));

const { getUserPermissions, hasPermission, requirePermission } = await import('@/lib/rbac');

/** Shape returned by the `select` in getUserPermissions. */
function userWithKeys(...keys: string[]) {
  return { role: { rolePermissions: keys.map((key) => ({ permission: { key } })) } };
}

function sessionFor(userId: string, snapshot: string[] = []): Session {
  return {
    user: {
      id: userId,
      roleId: 'role_1',
      roleName: 'Role',
      roleSlug: 'role',
      permissions: snapshot,
    },
    expires: '2099-01-01T00:00:00.000Z',
  } as Session;
}

beforeEach(() => {
  findUnique.mockReset();
  requireAuth.mockReset();
});

describe('hasPermission', () => {
  it('is true when the set contains the key', () => {
    expect(hasPermission(new Set(['roles:list']), 'roles:list')).toBe(true);
  });

  it('is false when the set does not contain the key', () => {
    expect(hasPermission(new Set(['roles:list']), 'users:list')).toBe(false);
  });

  it('is false for an empty permission set', () => {
    expect(hasPermission(new Set(), 'roles:list')).toBe(false);
  });

  it('treats an array of keys as OR — any one is enough', () => {
    const permissions = new Set(['users:list']);
    expect(hasPermission(permissions, ['roles:list', 'users:list'])).toBe(true);
  });

  it('is false when none of the keys in the array match', () => {
    const permissions = new Set(['permissions:list']);
    expect(hasPermission(permissions, ['roles:list', 'users:list'])).toBe(false);
  });

  it('is false for an empty key array — no key can never grant access', () => {
    expect(hasPermission(new Set(['roles:list']), [])).toBe(false);
  });
});

describe('getUserPermissions', () => {
  it('flattens the role → rolePermissions → permission.key chain into a Set', async () => {
    findUnique.mockResolvedValue(userWithKeys('roles:list', 'roles:detail', 'users:list'));

    await expect(getUserPermissions('user_1')).resolves.toEqual(
      new Set(['roles:list', 'roles:detail', 'users:list']),
    );
  });

  it('returns an empty Set when the user no longer exists', async () => {
    findUnique.mockResolvedValue(null);
    await expect(getUserPermissions('ghost')).resolves.toEqual(new Set());
  });

  it('returns an empty Set for a role with no permissions', async () => {
    findUnique.mockResolvedValue(userWithKeys());
    await expect(getUserPermissions('user_1')).resolves.toEqual(new Set());
  });

  it('queries the requested user', async () => {
    findUnique.mockResolvedValue(userWithKeys('roles:list'));
    await getUserPermissions('user_42');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user_42' } }),
    );
  });
});

describe('requirePermission', () => {
  it('returns the session when the DB grants the permission', async () => {
    const session = sessionFor('user_1');
    requireAuth.mockResolvedValue(session);
    findUnique.mockResolvedValue(userWithKeys('roles:list'));

    await expect(requirePermission('roles:list')).resolves.toBe(session);
  });

  it('throws ForbiddenError when the DB does not grant the permission', async () => {
    requireAuth.mockResolvedValue(sessionFor('user_1'));
    findUnique.mockResolvedValue(userWithKeys('users:list'));

    await expect(requirePermission('roles:delete')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('propagates UnauthorizedError and never touches the DB when unauthenticated', async () => {
    requireAuth.mockRejectedValue(new UnauthorizedError('Sesi Anda sudah berakhir.'));

    await expect(requirePermission('roles:list')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('ignores the session snapshot and trusts only the DB', async () => {
    // The JWT claims the permission; the role no longer has it. The DB wins.
    requireAuth.mockResolvedValue(sessionFor('user_1', ['roles:delete']));
    findUnique.mockResolvedValue(userWithKeys());

    await expect(requirePermission('roles:delete')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('grants access when the DB has a permission the stale snapshot lacks', async () => {
    const session = sessionFor('user_1', []);
    requireAuth.mockResolvedValue(session);
    findUnique.mockResolvedValue(userWithKeys('roles:delete'));

    await expect(requirePermission('roles:delete')).resolves.toBe(session);
  });

  it('accepts an array of keys and passes when any one is granted', async () => {
    const session = sessionFor('user_1');
    requireAuth.mockResolvedValue(session);
    findUnique.mockResolvedValue(userWithKeys('users:list'));

    await expect(requirePermission(['roles:list', 'users:list'])).resolves.toBe(session);
  });

  it('rejects an array of keys when none are granted', async () => {
    requireAuth.mockResolvedValue(sessionFor('user_1'));
    findUnique.mockResolvedValue(userWithKeys('permissions:list'));

    await expect(requirePermission(['roles:list', 'users:list'])).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('resolves permissions for the signed-in user, not an arbitrary one', async () => {
    requireAuth.mockResolvedValue(sessionFor('user_99'));
    findUnique.mockResolvedValue(userWithKeys('roles:list'));

    await requirePermission('roles:list');

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user_99' } }));
  });
});
