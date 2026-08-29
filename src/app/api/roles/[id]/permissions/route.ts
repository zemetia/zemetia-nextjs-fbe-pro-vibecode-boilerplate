import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { replaceRolePermissionsSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    await requirePermission('roles:set-permissions');
    const { id } = await params;

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundError('Role tidak ditemukan.');
    if (role.isSystem) throw new ForbiddenError('Izin role sistem tidak bisa diubah.');

    const body = replaceRolePermissionsSchema.parse(await request.json());
    const keys = Array.from(new Set(body.permission_keys));

    const permissions = await prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== keys.length) {
      // The unknown keys go to the log, not to the screen — they are internal
      // identifiers and mean nothing to the person clicking Simpan.
      throw new ValidationError(
        'Ada izin yang sudah tidak berlaku. Muat ulang halaman lalu simpan lagi.',
      );
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })),
      }),
    ]);

    return NextResponse.json({ permission_keys: permissions.map((permission) => permission.key) });
  } catch (error) {
    return handleApiError(error);
  }
}
