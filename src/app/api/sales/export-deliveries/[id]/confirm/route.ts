import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import {
  SALES_DELIVERY_DETAIL_INCLUDE,
  toSalesDeliveryDetailDTO,
} from '@/lib/sales-dto';
import { postDeliveryIssueAndCogs } from '@/lib/sales-journal';
import { SALES_DELIVERY_STATUS_LABELS } from '@/lib/sales';

type Params = { params: Promise<{ id: string }> };

/** `DRAFT → CONFIRMED` — konfirmasi serah terima ke kargo pengawal (Brinks/Malca-Amit). */
export async function PATCH(_request: Request, { params }: Params) {
  try {
    await requirePermission('export-deliveries:confirm');
    const session = await requireAuth();
    const { id } = await params;

    const existing = await prisma.salesDelivery.findUnique({
      where: { id, order: { type: 'EXPORT' } },
      select: { status: true },
    });
    if (!existing) throw new NotFoundError('Surat jalan ekspor yang dipilih tidak ditemukan.');
    if (existing.status !== 'DRAFT') {
      throw new ConflictError(
        `Surat jalan ini berstatus ${SALES_DELIVERY_STATUS_LABELS[existing.status]}, jadi tidak bisa dikonfirmasi.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await postDeliveryIssueAndCogs(id, session.user.id, tx);
      await tx.salesDelivery.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedById: session.user.id, confirmedAt: new Date() },
      });
    });

    const delivery = await prisma.salesDelivery.findUnique({
      where: { id },
      include: SALES_DELIVERY_DETAIL_INCLUDE,
    });
    if (!delivery) throw new NotFoundError('Surat jalan ekspor yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesDeliveryDetailDTO(delivery));
  } catch (error) {
    return handleApiError(error);
  }
}
