import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { parseListQuery } from '@/lib/pagination';
import { accountTypeFromCode } from '@/lib/account';
import {
  ACCOUNT_MAX_CHILDREN,
  ACCOUNT_MAX_LEVEL,
  accountCodeLevel,
  childAccountCode,
  nextChildOrdinal,
} from '@/lib/account-code';
import {
  buildAccountTree,
  countAccountNodes,
  filterAccountTree,
  toAccountDTO,
} from '@/lib/account-dto';
import { accountMovements } from '@/lib/journal';
import { isUniqueViolation } from '@/lib/prisma-error';
import { accountTreeQuerySchema, createAccountSchema } from '@/lib/validations';
import type { AccountNodeDTO, AccountTreeDTO } from '@/types/dtos';

/**
 * The whole chart in one response — a COA is a few hundred rows and the page
 * renders it as a tree, so paging it would only hide branches.
 *
 * Filters are applied to the built tree rather than to the query, because a
 * `where` clause would drop the ancestors of a match and leave the result
 * without the path that explains it (see `filterAccountTree`).
 */
export async function GET(request: Request) {
  try {
    await requirePermission('accounts:list');

    const query = parseListQuery(request, accountTreeQuerySchema);

    const [rows, { movements, withMutations }] = await Promise.all([
      prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } }),
      accountMovements(),
    ]);

    let tree = buildAccountTree({ rows, movements, withMutations });

    const keyword = query.q?.toLowerCase();
    const hasFilter =
      keyword !== undefined ||
      query.type !== undefined ||
      query.is_active !== undefined ||
      query.is_tan !== undefined;

    if (hasFilter) {
      const matches = (node: AccountNodeDTO) =>
        (query.type === undefined || node.type === query.type) &&
        (query.is_active === undefined || node.is_active === query.is_active) &&
        (query.is_tan === undefined || node.is_tan === query.is_tan) &&
        (keyword === undefined ||
          node.code.includes(keyword) ||
          node.name.toLowerCase().includes(keyword));

      tree = filterAccountTree(tree, matches);
    }

    const body: AccountTreeDTO = { data: tree, total: countAccountNodes(tree) };

    return NextResponse.json(body);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Creates one node under an existing parent. The client never sends a code —
 * it sends the parent and, optionally, which of the nine slots to take. The
 * code is derived here so it can never point at a branch the caller does not
 * actually hang under.
 */
export async function POST(request: Request) {
  try {
    await requirePermission('accounts:create');

    const body = createAccountSchema.parse(await request.json());

    const parent = await prisma.ledgerAccount.findUnique({
      where: { id: body.parent_id },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        children: { select: { code: true } },
        _count: { select: { lines: true } },
      },
    });
    if (!parent) throw new NotFoundError('Induk akun yang dipilih tidak ditemukan.');

    if (!parent.isActive) {
      throw new ValidationError(
        `Akun ${parent.code} ${parent.name} sedang nonaktif, jadi belum bisa diberi turunan. Aktifkan dulu akun induknya.`,
      );
    }

    if ((accountCodeLevel(parent.code) ?? ACCOUNT_MAX_LEVEL) >= ACCOUNT_MAX_LEVEL) {
      throw new ValidationError(
        `Akun ${parent.code} ${parent.name} sudah berada di level terdalam, jadi tidak bisa punya turunan lagi.`,
      );
    }

    // Leaf-only posting: an account that already carries mutations cannot turn
    // into a header, because its own balance would no longer be part of any
    // leaf and the subtree total would stop matching the books.
    if (parent._count.lines > 0) {
      throw new ConflictError(
        `Akun ${parent.code} ${parent.name} sudah dipakai transaksi, jadi tidak bisa dijadikan folder. Buat akun baru sejajar dengannya.`,
      );
    }

    const usedCodes = parent.children.map((child) => child.code);
    const ordinal = body.ordinal ?? nextChildOrdinal(parent.code, usedCodes);

    if (ordinal === null) {
      throw new ConflictError(
        `Akun ${parent.code} ${parent.name} sudah punya ${ACCOUNT_MAX_CHILDREN} turunan — batas maksimal satu induk. Buat sub-folder baru untuk menampung sisanya.`,
      );
    }

    const code = childAccountCode(parent.code, ordinal);
    const type = accountTypeFromCode(code);
    if (!type) throw new ValidationError('Kode akun yang terbentuk tidak dikenali.');

    const account = await prisma.ledgerAccount
      .create({
        data: {
          code,
          name: body.name,
          type,
          level: accountCodeLevel(code) ?? 1,
          parentId: parent.id,
          description: body.description,
          isTan: body.is_tan,
        },
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new ConflictError(
            `Kode ${code} sudah dipakai akun lain. Pilih urutan yang masih kosong.`,
          );
        }
        throw error;
      });

    return NextResponse.json(toAccountDTO(account), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
