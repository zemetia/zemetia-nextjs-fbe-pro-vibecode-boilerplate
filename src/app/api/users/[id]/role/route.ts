import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { ROLE_SLUGS } from '@/lib/rbac';
import { assignUserRoleSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('users:assign-role');
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!user) throw new NotFoundError('Pengguna tidak ditemukan.');

    const { role_id } = assignUserRoleSchema.parse(await request.json());
    const nextRole = await prisma.role.findUnique({ where: { id: role_id } });
    if (!nextRole) throw new NotFoundError('Role yang dipilih tidak ditemukan.');

    if (user.role.slug === ROLE_SLUGS.SUPER_ADMIN && nextRole.slug !== ROLE_SLUGS.SUPER_ADMIN) {
      // Deactivated super admins cannot sign in, so they do not count as cover.
      const otherActiveSuperAdmins = await prisma.user.count({
        where: { id: { not: id }, isActive: true, role: { slug: ROLE_SLUGS.SUPER_ADMIN } },
      });
      if (otherActiveSuperAdmins === 0) {
        throw new ConflictError('Super Admin aktif terakhir tidak bisa dipindahkan ke role lain.');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { roleId: role_id },
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
