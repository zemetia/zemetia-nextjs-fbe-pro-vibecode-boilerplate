import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import {
  METAL_PURCHASE_DETAIL_INCLUDE,
  METAL_PURCHASE_INCLUDE,
  toMetalPurchaseDetailDTO,
  toMetalPurchaseDTO,
} from '@/lib/metal-purchase-dto';
import { createWithMetalPurchaseNumber } from '@/lib/metal-purchase-number';
import {
  assertPartnerMatchesType,
  assertProductsUsable,
  linkMetalPurchaseRequest,
  metalPurchaseColumns,
  prepareMetalPurchaseItems,
  toMetalPurchaseCharges,
} from '@/lib/metal-purchase-write';
import { createMetalPurchaseSchema, metalPurchaseListQuerySchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    await requirePermission('local-purchases:list');

    const query = parseListQuery(request, metalPurchaseListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(query.type ? { type: query.type } : {}),
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
              { supplierInvoiceNumber: { contains: query.q, mode: 'insensitive' as const } },
              { partner: { name: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        include: METAL_PURCHASE_INCLUDE,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedDTO(rows, total, query, toMetalPurchaseDTO));
  } catch (error) {
    return handleApiError(error);
  }
}

/** PO/kuitansi baru selalu draft — belum menyentuh stok maupun buku besar. */
export async function POST(request: Request) {
  try {
    await requirePermission('local-purchases:create');
    const session = await requireAuth();

    const body = createMetalPurchaseSchema.parse(await request.json());

    await Promise.all([
      assertPartnerMatchesType(body.partner_id, body.type),
      assertProductsUsable(body.items.map((item) => item.product_id)),
    ]);

    const prLink = body.purchase_request_id
      ? await linkMetalPurchaseRequest(body.purchase_request_id, body.type)
      : null;

    const items = await prepareMetalPurchaseItems(body.items);
    const goodsAmount = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const date = toUtcDateOnly(body.date);

    const purchase = await createWithMetalPurchaseNumber(body.payment_type, date, (number) =>
      prisma.purchaseOrder.create({
        data: {
          ...metalPurchaseColumns(body, goodsAmount),
          ...(prLink ? { purchaseRequestId: prLink.id } : {}),
          number,
          createdById: session.user.id,
          items: { create: items },
          charges: { create: toMetalPurchaseCharges(body.charges) },
        },
        include: METAL_PURCHASE_DETAIL_INCLUDE,
      }),
    );

    // Konversi PR → PO: kunci PR-nya sebagai CONVERTED (cermin markPRAsConverted legacy).
    if (prLink) {
      await prisma.purchaseRequest.update({
        where: { id: prLink.id },
        data: {
          convertedPoNumber: purchase.number,
          conversionDate: date,
          convertedBy: session.user.name ?? session.user.id,
        },
      });
    }

    return NextResponse.json(toMetalPurchaseDetailDTO(purchase), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
