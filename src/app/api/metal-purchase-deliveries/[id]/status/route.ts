import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { METAL_PURCHASE_DELIVERY_STATUS_LABELS } from '@/lib/metal-purchase';
import {
  METAL_PURCHASE_DELIVERY_DETAIL_INCLUDE,
  toMetalPurchaseDeliveryDetailDTO,
} from '@/lib/metal-purchase-delivery-dto';
import {
  postReceiptJournal,
  postShipmentJournal,
  voidDeliveryJournals,
} from '@/lib/metal-purchase-journal';
import { voidMetalPurchaseDeliverySchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

const setStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('IN_TRANSIT') }),
  z.object({ status: z.literal('CONFIRMED') }),
  z.object({ status: z.literal('VOID') }).extend(voidMetalPurchaseDeliverySchema.shape),
]);

function refuse(current: string, what: string): never {
  const label =
    METAL_PURCHASE_DELIVERY_STATUS_LABELS[
      current as keyof typeof METAL_PURCHASE_DELIVERY_STATUS_LABELS
    ] ?? current;
  throw new ConflictError(`Tanda terima ini berstatus ${label}, jadi tidak bisa ${what}.`);
}

/**
 * `DRAFT ─(ship)→ IN_TRANSIT ─(receive)→ CONFIRMED`, atau `DRAFT ─(receive)→ CONFIRMED`
 * langsung untuk barang yang diserahkan di tempat (lihat komentar
 * `MetalPurchaseDeliveryStatus` di `purchase.prisma`). Jurnal ditulis di
 * `src/lib/metal-purchase-journal.ts`, dalam transaksi yang sama dengan
 * perubahan statusnya — TTB yang berubah status tanpa jurnal adalah kebohongan
 * yang tidak akan ketahuan buku besar.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = setStatusSchema.parse(await request.json());

    await requirePermission(
      body.status === 'VOID' ? 'goods-receipts:void' : 'goods-receipts:confirm',
    );
    const session = await requireAuth();
    const actorId = session.user.id;
    const now = new Date();

    const existing = await prisma.goodsReceipt.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundError('Tanda terima yang dipilih tidak ditemukan.');

    await prisma.$transaction(async (tx) => {
      if (body.status === 'IN_TRANSIT') {
        if (existing.status !== 'DRAFT') refuse(existing.status, 'diberangkatkan');
        await postShipmentJournal(id, actorId, tx);
        await tx.goodsReceipt.update({
          where: { id },
          data: { status: 'IN_TRANSIT', shippedAt: now, shippedById: actorId },
        });
        return;
      }

      if (body.status === 'CONFIRMED') {
        if (existing.status !== 'DRAFT' && existing.status !== 'IN_TRANSIT') {
          refuse(existing.status, 'dikonfirmasi diterima');
        }
        await postReceiptJournal(id, existing.status === 'IN_TRANSIT', actorId, tx);
        await tx.goodsReceipt.update({
          where: { id },
          data: { status: 'CONFIRMED', confirmedById: actorId, confirmedAt: now },
        });
        return;
      }

      // VOID
      if (existing.status === 'VOID') throw new ConflictError('Tanda terima ini sudah dibatalkan.');
      if (existing.status === 'DRAFT') {
        throw new ConflictError('Draft tidak perlu dibatalkan — hapus saja tanda terimanya.');
      }
      await voidDeliveryJournals(id, actorId, body.void_reason, tx);
      await tx.goodsReceipt.update({
        where: { id },
        data: { status: 'VOID', voidedById: actorId, voidedAt: now, voidReason: body.void_reason },
      });
    });

    const delivery = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: METAL_PURCHASE_DELIVERY_DETAIL_INCLUDE,
    });
    if (!delivery) throw new NotFoundError('Tanda terima yang dipilih tidak ditemukan.');

    return NextResponse.json(toMetalPurchaseDeliveryDetailDTO(delivery));
  } catch (error) {
    return handleApiError(error);
  }
}
