import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { toAccountDTO } from '@/lib/account-dto';
import { setAccountStatusSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/**
 * Closing an account is the normal end of its life — it stops being selectable
 * for new mutations while every posted voucher still resolves to it.
 *
 * A folder can only be closed once its branch is closed: leaving an active leaf
 * under a closed parent would let a posting land inside a branch the books say
 * is shut.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('accounts:set-status');
    const { id } = await params;

    const existing = await prisma.ledgerAccount.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        parentId: true,
        _count: { select: { children: true } },
      },
    });
    if (!existing) throw new NotFoundError('Akun tidak ditemukan.');

    const body = setAccountStatusSchema.parse(await request.json());

    if (!body.is_active && existing._count.children > 0) {
      const activeChildren = await prisma.ledgerAccount.count({
        where: { parentId: id, isActive: true },
      });
      if (activeChildren > 0) {
        throw new ConflictError(
          `Akun ${existing.code} ${existing.name} masih punya turunan yang aktif. Nonaktifkan turunannya lebih dulu.`,
        );
      }
    }

    if (body.is_active && existing.parentId) {
      const parent = await prisma.ledgerAccount.findUnique({
        where: { id: existing.parentId },
        select: { code: true, name: true, isActive: true },
      });
      if (parent && !parent.isActive) {
        throw new ConflictError(
          `Akun induknya (${parent.code} ${parent.name}) masih nonaktif. Aktifkan induknya lebih dulu.`,
        );
      }
    }

    const account = await prisma.ledgerAccount.update({
      where: { id },
      data: { isActive: body.is_active },
      include: { _count: { select: { children: true, lines: true } } },
    });

    return NextResponse.json(
      toAccountDTO(account, account._count.children, undefined, account._count.lines > 0),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
