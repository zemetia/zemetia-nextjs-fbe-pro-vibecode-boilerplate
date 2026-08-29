import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { toAccountDTO } from '@/lib/account-dto';
import { updateAccountSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/**
 * Name, keterangan, and the PT TAN Export flag. Code and parent are not
 * editable here: the code *is* the tree position, so moving a node would have
 * to renumber every descendant and rewrite the codes already printed on posted
 * vouchers.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('accounts:update');
    const { id } = await params;

    const existing = await prisma.ledgerAccount.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Akun tidak ditemukan.');

    const body = updateAccountSchema.parse(await request.json());

    const account = await prisma.ledgerAccount.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        isTan: body.is_tan,
      },
      include: { _count: { select: { children: true, lines: true } } },
    });

    return NextResponse.json(
      toAccountDTO(account, account._count.children, undefined, account._count.lines > 0),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Only for correcting a mistake made moments ago. An account that has turned
 * into a folder or has ever been journalled is closed with `isActive` instead —
 * the ledger must keep resolving every code it references.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePermission('accounts:delete');
    const { id } = await params;

    const account = await prisma.ledgerAccount.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { children: true, lines: true } },
      },
    });
    if (!account) throw new NotFoundError('Akun tidak ditemukan.');

    if (account._count.children > 0) {
      throw new ConflictError(
        `Akun ${account.code} ${account.name} masih punya turunan. Hapus atau pindahkan turunannya lebih dulu.`,
      );
    }
    if (account._count.lines > 0) {
      throw new ConflictError(
        `Akun ${account.code} ${account.name} sudah dipakai transaksi, jadi tidak bisa dihapus. Nonaktifkan saja supaya tidak muncul lagi di pilihan.`,
      );
    }

    await prisma.ledgerAccount.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
