import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import {
  SALES_INVOICE_DETAIL_INCLUDE,
  SALES_INVOICE_INCLUDE,
  toSalesInvoiceDetailDTO,
  toSalesInvoiceDTO,
} from '@/lib/sales-dto';
import { createWithSalesInvoiceNumber } from '@/lib/sales-number';
import {
  assertLinesBelongToOrder,
  assertSalesOrderConfirmed,
  salesInvoiceColumns,
  toInvoiceItemRows,
} from '@/lib/sales-write';
import {
  createSalesInvoiceSchema,
  salesInvoiceListQuerySchema,
} from '@/lib/validations';

/** Faktur Ekspor (`/api/sales/export-invoices`) — Commercial Invoice USD, PPN 0%. */
export async function GET(request: Request) {
  try {
    await requirePermission('export-invoices:list');

    const query = parseListQuery(request, salesInvoiceListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.SalesInvoiceWhereInput = {
      order: { type: 'EXPORT' },
      ...(query.status ? { status: query.status } : {}),
      ...(query.payment_status ? { paymentStatus: query.payment_status } : {}),
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
      prisma.salesInvoice.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        include: SALES_INVOICE_INCLUDE,
      }),
      prisma.salesInvoice.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedDTO(rows, total, query, toSalesInvoiceDTO));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Faktur ekspor baru selalu draft — jurnal piutang/pendapatan lahir saat post. */
export async function POST(request: Request) {
  try {
    await requirePermission('export-invoices:create');
    const session = await requireAuth();

    const body = createSalesInvoiceSchema.parse(await request.json());

    await Promise.all([
      assertSalesOrderConfirmed(body.order_id),
      assertLinesBelongToOrder(body.order_id, body.items.map((item) => item.order_item_id)),
    ]);

    const date = toUtcDateOnly(body.date);

    const invoice = await createWithSalesInvoiceNumber('EXPORT', date, (number) =>
      prisma.salesInvoice.create({
        data: {
          ...salesInvoiceColumns(body),
          type: 'EXPORT',
          number,
          createdById: session.user.id,
          items: { create: toInvoiceItemRows(body.items) },
        },
        include: SALES_INVOICE_DETAIL_INCLUDE,
      }),
    );

    return NextResponse.json(toSalesInvoiceDetailDTO(invoice), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
