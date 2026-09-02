import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import {
  SALES_DELIVERY_DETAIL_INCLUDE,
  SALES_DELIVERY_INCLUDE,
  toSalesDeliveryDetailDTO,
  toSalesDeliveryDTO,
} from '@/lib/sales-dto';
import { createWithSalesDeliveryNumber } from '@/lib/sales-number';
import {
  assertLinesBelongToOrder,
  assertSalesOrderConfirmed,
  salesDeliveryColumns,
  toDeliveryChargeRows,
  toDeliveryLineRows,
} from '@/lib/sales-write';
import {
  createSalesDeliverySchema,
  salesDeliveryListQuerySchema,
} from '@/lib/validations';

/** Surat Jalan Lokal (`/api/sales/deliveries`) — pengeluaran emas IDR. */
export async function GET(request: Request) {
  try {
    await requirePermission('local-deliveries:list');

    const query = parseListQuery(request, salesDeliveryListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.SalesDeliveryWhereInput = {
      order: { type: 'LOCAL' },
      ...(query.status ? { status: query.status } : {}),
      ...(query.order_id ? { orderId: query.order_id } : {}),
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
              { order: { number: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.salesDelivery.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        include: SALES_DELIVERY_INCLUDE,
      }),
      prisma.salesDelivery.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedDTO(rows, total, query, toSalesDeliveryDTO));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Surat jalan baru selalu draft — belum menyentuh stok maupun buku besar. */
export async function POST(request: Request) {
  try {
    await requirePermission('local-deliveries:create');
    const session = await requireAuth();

    const body = createSalesDeliverySchema.parse(await request.json());

    await Promise.all([
      assertSalesOrderConfirmed(body.order_id),
      assertLinesBelongToOrder(body.order_id, body.lines.map((line) => line.order_item_id)),
    ]);

    const date = toUtcDateOnly(body.date);

    const delivery = await createWithSalesDeliveryNumber('LOCAL', date, (number) =>
      prisma.salesDelivery.create({
        data: {
          ...salesDeliveryColumns(body),
          number,
          createdById: session.user.id,
          lines: { create: toDeliveryLineRows(body.lines) },
          charges: { create: toDeliveryChargeRows(body.charges) },
        },
        include: SALES_DELIVERY_DETAIL_INCLUDE,
      }),
    );

    return NextResponse.json(toSalesDeliveryDetailDTO(delivery), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
