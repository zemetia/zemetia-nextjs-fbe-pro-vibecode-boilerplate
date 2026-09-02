import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import {
  SALES_DELIVERY_DETAIL_INCLUDE,
  toSalesDeliveryDetailDTO,
} from '@/lib/sales-dto';
import { voidSalesDelivery } from '@/lib/sales-write';
import { voidSalesJournals } from '@/lib/sales-journal';
import { voidSalesDeliverySchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('local-deliveries:void');
    const session = await requireAuth();
    const { id } = await params;

    const body = voidSalesDeliverySchema.parse(await request.json());

    const existing = await prisma.salesDelivery.findUnique({
      where: { id, order: { type: 'LOCAL' } },
      select: { status: true },
    });
    if (!existing) throw new NotFoundError('Surat jalan yang dipilih tidak ditemukan.');

    await prisma.$transaction(async (tx) => {
      await voidSalesDelivery(id, session.user.id, body.void_reason, tx);
      await voidSalesJournals({ deliveryId: id }, session.user.id, body.void_reason, tx);
    });

    const delivery = await prisma.salesDelivery.findUnique({
      where: { id },
      include: SALES_DELIVERY_DETAIL_INCLUDE,
    });
    if (!delivery) throw new NotFoundError('Surat jalan yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesDeliveryDetailDTO(delivery));
  } catch (error) {
    return handleApiError(error);
  }
}
