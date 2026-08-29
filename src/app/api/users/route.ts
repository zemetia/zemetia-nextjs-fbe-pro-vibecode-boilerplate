import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { createUserSchema, userListQuerySchema } from '@/lib/validations';
import type { UserListDTO } from '@/types/dtos';

const PASSWORD_SALT_ROUNDS = 12;

export async function GET(request: Request) {
  try {
    await requirePermission('users:list');

    const { searchParams } = new URL(request.url);
    const { page, limit, q } = userListQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    });

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: { role: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    const data: UserListDTO = {
      data: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: { id: user.role.id, name: user.role.name, slug: user.role.slug },
        is_active: user.isActive,
        created_at: user.createdAt.toISOString(),
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
    await requirePermission('users:create');

    const body = createUserSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const role = await prisma.role.findUnique({ where: { id: body.role_id } });
    if (!role) throw new NotFoundError('Role yang dipilih tidak ditemukan.');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError('Email ini sudah dipakai pengguna lain.');

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email,
        password: await bcrypt.hash(body.password, PASSWORD_SALT_ROUNDS),
        roleId: role.id,
      },
      include: { role: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        is_active: user.isActive,
        created_at: user.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
