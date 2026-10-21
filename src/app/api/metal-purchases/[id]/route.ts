import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import {
  METAL_PURCHASE_DETAIL_INCLUDE,
  toMetalPurchaseDetailDTO,
} from '@/lib/metal-purchase-dto';
import {
  assertMetalPurchaseDraft,
  assertPartnerMatchesType,
  assertProductsUsable,
  deleteMetalPurchase,
  linkMetalPurchaseRequest,
  metalPurchaseColumns,
  prepareMetalPurchaseItems,
  toMetalPurchaseCharges,
} from '@/lib/metal-purchase-write';
import { updateMetalPurchaseSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('local-purchases:detail');
    const { id } = await params;

    const purchase = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: METAL_PURCHASE_DETAIL_INCLUDE,
    });
    if (!purchase) throw new NotFoundError('Pembelian yang dipilih tidak ditemukan.');

    return NextResponse.json(toMetalPurchaseDetailDTO(purchase));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Hanya draft yang boleh diubah — barisnya diganti seluruhnya, sama seperti voucher kas/bank. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('local-purchases:update');
    const { id } = await params;

    await assertMetalPurchaseDraft(id);
    const body = updateMetalPurchaseSchema.parse(await request.json());

    const [, , prLink] = await Promise.all([
      assertPartnerMatchesType(body.partner_id, body.type),
      assertProductsUsable(body.items.map((item) => item.product_id)),
      body.purchase_request_id
        ? linkMetalPurchaseRequest(body.purchase_request_id, body.type)
        : Promise.resolve(null),
    ]);

    const items = await prepareMetalPurchaseItems(body.items, prLink?.itemProductById);
    const goodsAmount = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;

    const purchase = await prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseId: id } });
      await tx.purchaseOrderCharge.deleteMany({ where: { purchaseId: id } });

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...metalPurchaseColumns(body, goodsAmount),
          purchaseRequestId: prLink?.id ?? null,
          items: { create: items },
          charges: { create: toMetalPurchaseCharges(body.charges) },
        },
        include: METAL_PURCHASE_DETAIL_INCLUDE,
      });
    });

    return NextResponse.json(toMetalPurchaseDetailDTO(purchase));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePermission('local-purchases:delete');
    const { id } = await params;

    await deleteMetalPurchase(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
