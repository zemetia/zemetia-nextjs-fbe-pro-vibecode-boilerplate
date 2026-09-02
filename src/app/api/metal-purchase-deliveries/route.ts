import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import {
  METAL_PURCHASE_DELIVERY_DETAIL_INCLUDE,
  METAL_PURCHASE_DELIVERY_INCLUDE,
  toMetalPurchaseDeliveryDetailDTO,
  toMetalPurchaseDeliveryDTO,
} from '@/lib/metal-purchase-delivery-dto';
import { createWithMetalPurchaseDeliveryNumber } from '@/lib/metal-purchase-number';
import {
  assertLinesBelongToPurchase,
  assertPurchaseConfirmed,
  metalPurchaseDeliveryColumns,
  toDeliveryChargeRows,
  toDeliveryLineRows,
} from '@/lib/metal-purchase-delivery-write';
import {
  createMetalPurchaseDeliverySchema,
  metalPurchaseDeliveryListQuerySchema,
} from '@/lib/validations';

export async function GET(request: Request) {
  try {
    await requirePermission('goods-receipts:list');

    const query = parseListQuery(request, metalPurchaseDeliveryListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.GoodsReceiptWhereInput = {
      ...(query.purchase_id ? { purchaseId: query.purchase_id } : {}),
      ...(query.status ? { status: query.status } : {}),
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
              { trackingNumber: { contains: query.q, mode: 'insensitive' as const } },
              { purchase: { number: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        include: METAL_PURCHASE_DELIVERY_INCLUDE,
      }),
      prisma.goodsReceipt.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedDTO(rows, total, query, toMetalPurchaseDeliveryDTO));
  } catch (error) {
    return handleApiError(error);
  }
}

/** TTB baru selalu draft — belum menyentuh stok maupun buku besar. */
export async function POST(request: Request) {
  try {
    await requirePermission('goods-receipts:create');
    const session = await requireAuth();

    const body = createMetalPurchaseDeliverySchema.parse(await request.json());

    await assertPurchaseConfirmed(body.purchase_id);
    await assertLinesBelongToPurchase(
      body.purchase_id,
      body.lines.map((line) => line.purchase_item_id),
    );

    const date = toUtcDateOnly(body.date);

    const delivery = await createWithMetalPurchaseDeliveryNumber(
      date,
      (number) =>
        prisma.goodsReceipt.create({
          data: {
            ...metalPurchaseDeliveryColumns(body),
            number,
            createdById: session.user.id,
            lines: { create: toDeliveryLineRows(body.lines) },
            charges: { create: toDeliveryChargeRows(body.charges) },
          },
          include: METAL_PURCHASE_DELIVERY_DETAIL_INCLUDE,
        }),
      body.number,
    );

    return NextResponse.json(toMetalPurchaseDeliveryDetailDTO(delivery), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
