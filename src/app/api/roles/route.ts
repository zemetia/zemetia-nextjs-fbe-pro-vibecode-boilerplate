import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError } from '@/lib/errors';
import { createRoleSchema, roleListQuerySchema } from '@/lib/validations';
import { slugify } from '@/lib/utils';
import type { RoleListDTO } from '@/types/dtos';

export async function GET(request: Request) {
  try {
    await requirePermission('roles:list');

    const { searchParams } = new URL(request.url);
    const { page, limit, q } = roleListQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    });

    const where = q ? { name: { contains: q, mode: 'insensitive' as const } } : {};

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { users: true, rolePermissions: true } } },
      }),
      prisma.role.count({ where }),
    ]);

    const data: RoleListDTO = {
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        is_system: role.isSystem,
        user_count: role._count.users,
        permission_count: role._count.rolePermissions,
        created_at: role.createdAt.toISOString(),
        updated_at: role.updatedAt.toISOString(),
      })),
      total,
      page,
      page_size: limit,
    };

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission('roles:create');

    const body = createRoleSchema.parse(await request.json());
    const slug = slugify(body.name);

    const existing = await prisma.role.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Role dengan nama ini sudah ada.');

    const role = await prisma.role.create({
      data: { name: body.name, slug, description: body.description, isSystem: false },
    });

    return NextResponse.json(
      {
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        is_system: role.isSystem,
        user_count: 0,
        permission_count: 0,
        created_at: role.createdAt.toISOString(),
        updated_at: role.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
