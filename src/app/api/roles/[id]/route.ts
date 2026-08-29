import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { updateRoleSchema } from '@/lib/validations';
import type { RoleDetailDTO } from '@/types/dtos';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('roles:detail');
    const { id } = await params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, rolePermissions: true } },
        rolePermissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (!role) throw new NotFoundError('Role tidak ditemukan.');

    const dto: RoleDetailDTO = {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      is_system: role.isSystem,
      user_count: role._count.users,
      permission_count: role._count.rolePermissions,
      permission_keys: role.rolePermissions.map((rp) => rp.permission.key),
      created_at: role.createdAt.toISOString(),
      updated_at: role.updatedAt.toISOString(),
    };

    return NextResponse.json(dto);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('roles:update');
    const { id } = await params;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Role tidak ditemukan.');
    if (existing.isSystem) throw new ForbiddenError('Role sistem tidak bisa diubah.');

    const body = updateRoleSchema.parse(await request.json());
    const role = await prisma.role.update({
      where: { id },
      data: { name: body.name, description: body.description },
      include: { _count: { select: { users: true, rolePermissions: true } } },
    });

    return NextResponse.json({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      is_system: role.isSystem,
      user_count: role._count.users,
      permission_count: role._count.rolePermissions,
      created_at: role.createdAt.toISOString(),
      updated_at: role.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePermission('roles:delete');
    const { id } = await params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundError('Role tidak ditemukan.');
    if (role.isSystem) throw new ForbiddenError('Role sistem tidak bisa dihapus.');
    if (role._count.users > 0) {
      throw new ConflictError('Pindahkan dulu pengguna yang memakai role ini sebelum menghapusnya.');
    }

    await prisma.role.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
