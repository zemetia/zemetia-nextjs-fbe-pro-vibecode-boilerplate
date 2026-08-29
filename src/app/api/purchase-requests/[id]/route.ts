import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import {
  deletePurchaseRequest,
  orderedQuantityByRequestItem,
  PURCHASE_REQUEST_DETAIL_INCLUDE,
  toPurchaseRequestWriteInput,
  updatePurchaseRequest,
  type PurchaseRequestDetailRow,
} from '@/lib/purchase-request-write';
import { toPurchaseRequestDetailDTO } from '@/lib/purchase-request-dto';
import { updatePurchaseRequestSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/** Sisa tiap barisnya diagregasi sekali di sini, bukan sekali per baris. */
async function detailResponse(request: PurchaseRequestDetailRow) {
  const ordered = await orderedQuantityByRequestItem(request.items.map((item) => item.id));

  return NextResponse.json(toPurchaseRequestDetailDTO(request, ordered));
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('purchase-requests:detail');
    const { id } = await params;

    const row = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: PURCHASE_REQUEST_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundError('Permintaan pembelian yang dipilih tidak ditemukan.');

    return await detailResponse(row);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('purchase-requests:update');
    const { id } = await params;

    const body = updatePurchaseRequestSchema.parse(await request.json());

    return await detailResponse(await updatePurchaseRequest(id, toPurchaseRequestWriteInput(body)));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Hanya draft yang bisa dihapus — yang sudah disetujui dibatalkan, bukan dihapus. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePermission('purchase-requests:delete');
    const { id } = await params;

    await deletePurchaseRequest(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
