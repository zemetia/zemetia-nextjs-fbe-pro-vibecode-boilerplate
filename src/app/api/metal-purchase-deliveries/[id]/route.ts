import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import {
  METAL_PURCHASE_DELIVERY_DETAIL_INCLUDE,
  toMetalPurchaseDeliveryDetailDTO,
} from '@/lib/metal-purchase-delivery-dto';
import { findDeliveryJournals } from '@/lib/metal-purchase-journal';
import {
  assertDeliveryDraft,
  assertLinesBelongToPurchase,
  deleteMetalPurchaseDelivery,
  metalPurchaseDeliveryColumns,
  toDeliveryChargeRows,
  toDeliveryLineRows,
} from '@/lib/metal-purchase-delivery-write';
import { updateMetalPurchaseDeliverySchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('goods-receipts:detail');
    const { id } = await params;

    const delivery = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: METAL_PURCHASE_DELIVERY_DETAIL_INCLUDE,
    });
    if (!delivery) throw new NotFoundError('Tanda terima yang dipilih tidak ditemukan.');

    const journals = await findDeliveryJournals(id);
    return NextResponse.json(
      toMetalPurchaseDeliveryDetailDTO(delivery, journals.at(-1) ?? null),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('goods-receipts:update');
    const { id } = await params;

    await assertDeliveryDraft(id);
    const body = updateMetalPurchaseDeliverySchema.parse(await request.json());

    await assertLinesBelongToPurchase(
      body.purchase_id,
      body.lines.map((line) => line.purchase_item_id),
    );

    const delivery = await prisma.$transaction(async (tx) => {
      await tx.goodsReceiptLine.deleteMany({ where: { deliveryId: id } });
      await tx.goodsReceiptCharge.deleteMany({ where: { deliveryId: id } });

      return tx.goodsReceipt.update({
        where: { id },
        data: {
          ...metalPurchaseDeliveryColumns(body),
          lines: { create: toDeliveryLineRows(body.lines) },
          charges: { create: toDeliveryChargeRows(body.charges) },
        },
        include: METAL_PURCHASE_DELIVERY_DETAIL_INCLUDE,
      });
    });

    return NextResponse.json(toMetalPurchaseDeliveryDetailDTO(delivery));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePermission('goods-receipts:delete');
    const { id } = await params;

    await deleteMetalPurchaseDelivery(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
