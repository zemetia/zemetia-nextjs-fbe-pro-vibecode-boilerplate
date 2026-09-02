import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import {
  SALES_ORDER_DETAIL_INCLUDE,
  SALES_ORDER_INCLUDE,
  toSalesOrderDetailDTO,
  toSalesOrderDTO,
} from '@/lib/sales-dto';
import { createWithSalesOrderNumber } from '@/lib/sales-number';
import {
  assertPartnerIsSalesCustomer,
  assertProductsUsable,
  prepareSalesOrderItems,
  salesOrderColumns,
} from '@/lib/sales-write';
import { createSalesOrderSchema, salesOrderListQuerySchema } from '@/lib/validations';

/**
 * SO Ekspor (`/api/sales/orders`) — kontrak penjualan perhiasan ke buyer luar
 * negeri, valas USD. Endpoint kembar `/api/sales/local` untuk lokal; yang
 * membedakan hanya filter `type` dan permission-nya.
 */
export async function GET(request: Request) {
  try {
    await requirePermission('export-sales-orders:list');

    const query = parseListQuery(request, salesOrderListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.SalesOrderWhereInput = {
      type: 'EXPORT',
      ...(query.payment_type ? { paymentType: query.payment_type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.partner_id ? { partnerId: query.partner_id } : {}),
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
              { customerPoNumber: { contains: query.q, mode: 'insensitive' as const } },
              { partner: { name: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        include: SALES_ORDER_INCLUDE,
      }),
      prisma.salesOrder.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedDTO(rows, total, query, toSalesOrderDTO));
  } catch (error) {
    return handleApiError(error);
  }
}

/** SO ekspor baru selalu draft — harga fixing dikunci saat approve. */
export async function POST(request: Request) {
  try {
    await requirePermission('export-sales-orders:create');
    const session = await requireAuth();

    const body = createSalesOrderSchema.parse(await request.json());

    await Promise.all([
      assertPartnerIsSalesCustomer(body.partner_id, 'EXPORT'),
      assertProductsUsable(body.items.map((item) => item.product_id)),
    ]);

    const items = await prepareSalesOrderItems(body.items);
    const goodsAmount = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const date = toUtcDateOnly(body.date);

    const order = await createWithSalesOrderNumber('EXPORT', body.payment_type, date, (number) =>
      prisma.salesOrder.create({
        data: {
          ...salesOrderColumns(body, goodsAmount),
          number,
          createdById: session.user.id,
          items: { create: items },
        },
        include: SALES_ORDER_DETAIL_INCLUDE,
      }),
    );

    return NextResponse.json(toSalesOrderDetailDTO(order), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
