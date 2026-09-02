import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import { METAL_PURCHASE_DETAIL_INCLUDE, toMetalPurchaseDetailDTO } from '@/lib/metal-purchase-dto';
import { confirmMetalPurchase, voidMetalPurchase } from '@/lib/metal-purchase-write';
import { z } from 'zod';
import { voidMetalPurchaseSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

const setStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('CONFIRMED') }),
  z.object({ status: z.literal('VOID') }).extend(voidMetalPurchaseSchema.shape),
]);

/**
 * `DRAFT → CONFIRMED → VOID`. Mengkonfirmasi PO **tidak menjurnal** — komitmen
 * belum memindahkan aset atau kewajiban apa pun; itu baru terjadi saat TTB-nya
 * dikonfirmasi (`src/lib/metal-purchase-journal.ts`).
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = setStatusSchema.parse(await request.json());

    await requirePermission(body.status === 'VOID' ? 'local-purchases:void' : 'local-purchases:confirm');
    const session = await requireAuth();

    if (body.status === 'CONFIRMED') {
      await confirmMetalPurchase(id, session.user.id, prisma);
    } else {
      await voidMetalPurchase(id, session.user.id, body.void_reason, prisma);
    }

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
