import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission, ROLE_SLUGS } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { setUserStatusSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requirePermission('users:set-status');
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!user) throw new NotFoundError('Pengguna tidak ditemukan.');

    const { is_active } = setUserStatusSchema.parse(await request.json());

    if (!is_active) {
      if (user.id === session.user.id) {
        throw new ConflictError('Anda tidak bisa menonaktifkan akun Anda sendiri.');
      }
      if (user.role.slug === ROLE_SLUGS.SUPER_ADMIN) {
        const otherActiveSuperAdmins = await prisma.user.count({
          where: { id: { not: id }, isActive: true, role: { slug: ROLE_SLUGS.SUPER_ADMIN } },
        });
        if (otherActiveSuperAdmins === 0) {
          throw new ConflictError('Super Admin aktif terakhir tidak bisa dinonaktifkan.');
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: is_active },
      include: { role: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      image: updated.image,
      role: updated.role,
      is_active: updated.isActive,
      created_at: updated.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
