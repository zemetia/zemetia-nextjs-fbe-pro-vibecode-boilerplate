import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import {
  createPurchaseRequest,
  orderedQuantityByRequestItem,
  PURCHASE_REQUEST_INCLUDE,
  toPurchaseRequestWriteInput,
} from '@/lib/purchase-request-write';
import { toPurchaseRequestDetailDTO, toPurchaseRequestDTO } from '@/lib/purchase-request-dto';
import { createPurchaseRequestSchema, purchaseRequestListQuerySchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    await requirePermission('purchase-requests:list');

    const query = parseListQuery(request, purchaseRequestListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.PurchaseRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.date_from || query.date_to
        ? {
            date: {
              ...(query.date_from ? { gte: toUtcDateOnly(query.date_from) } : {}),
              ...(query.date_to ? { lte: toUtcDateOnly(query.date_to) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' as const } },
              { department: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        include: PURCHASE_REQUEST_INCLUDE,
      }),
      prisma.purchaseRequest.count({ where }),
    ]);

    // Satu agregasi untuk seluruh halaman: menanyakannya per dokumen berarti dua
    // puluh round trip untuk tabel yang belum digulir siapa pun.
    const ordered = await orderedQuantityByRequestItem(
      rows.flatMap((row) => row.items.map((item) => item.id)),
    );

    return NextResponse.json(
      buildPaginatedDTO(rows, total, query, (row) => toPurchaseRequestDTO(row, ordered)),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission('purchase-requests:create');
    const session = await requireAuth();

    const body = createPurchaseRequestSchema.parse(await request.json());

    const created = await createPurchaseRequest(toPurchaseRequestWriteInput(body), session.user.id);

    // Permintaan yang baru lahir belum punya PO, jadi tidak ada yang perlu
    // diagregasi dan tidak ada yang perlu ditanyakan ke basis data.
    return NextResponse.json(toPurchaseRequestDetailDTO(created, new Map()), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
