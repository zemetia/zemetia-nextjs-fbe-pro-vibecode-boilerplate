import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import {
  approvePurchaseRequest,
  orderedQuantityByRequestItem,
  voidPurchaseRequest,
  type PurchaseRequestDetailRow,
} from '@/lib/purchase-request-write';
import { toPurchaseRequestDetailDTO } from '@/lib/purchase-request-dto';
import { setPurchaseRequestStatusSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/**
 * Dua transisi satu pintu. Masing-masing izinnya sendiri: menyetujui permintaan
 * divisi dan membatalkannya adalah dua wewenang yang berbeda.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = setPurchaseRequestStatusSchema.parse(await request.json());

    await requirePermission(
      body.status === 'APPROVED' ? 'purchase-requests:approve' : 'purchase-requests:void',
    );
    const session = await requireAuth();

    let saved: PurchaseRequestDetailRow;

    if (body.status === 'APPROVED') {
      saved = await approvePurchaseRequest(id, session.user.id);
    } else {
      saved = await voidPurchaseRequest(id, session.user.id, body.void_reason);
    }

    const ordered = await orderedQuantityByRequestItem(saved.items.map((item) => item.id));

    return NextResponse.json(toPurchaseRequestDetailDTO(saved, ordered));
  } catch (error) {
    return handleApiError(error);
  }
}
