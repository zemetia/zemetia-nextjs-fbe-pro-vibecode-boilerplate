import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import type { PermissionListDTO } from '@/types/dtos';

export async function GET() {
  try {
    await requirePermission('permissions:list');

    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    const data: PermissionListDTO = {
      data: permissions.map((permission) => ({
        id: permission.id,
        resource: permission.resource,
        action: permission.action,
        key: permission.key,
        description: permission.description,
      })),
    };

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
