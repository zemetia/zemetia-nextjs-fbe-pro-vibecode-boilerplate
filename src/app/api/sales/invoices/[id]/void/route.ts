import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import {
  SALES_INVOICE_DETAIL_INCLUDE,
  toSalesInvoiceDetailDTO,
} from '@/lib/sales-dto';
import { voidSalesJournals } from '@/lib/sales-journal';
import { voidSalesInvoiceSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('local-invoices:void');
    const session = await requireAuth();
    const { id } = await params;

    const body = voidSalesInvoiceSchema.parse(await request.json());

    const existing = await prisma.salesInvoice.findUnique({
      where: { id, order: { type: 'LOCAL' } },
      select: { status: true },
    });
    if (!existing) throw new NotFoundError('Faktur yang dipilih tidak ditemukan.');
    if (existing.status !== 'POSTED') {
      throw new ConflictError('Hanya faktur yang sudah diposting yang bisa dibatalkan.');
    }

    await prisma.$transaction(async (tx) => {
      await voidSalesJournals({ invoiceId: id }, session.user.id, body.void_reason, tx);
      await tx.salesInvoice.update({
        where: { id },
        data: { status: 'VOID', voidedById: session.user.id, voidedAt: new Date(), voidReason: body.void_reason },
      });
    });

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: SALES_INVOICE_DETAIL_INCLUDE,
    });
    if (!invoice) throw new NotFoundError('Faktur yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesInvoiceDetailDTO(invoice));
  } catch (error) {
    return handleApiError(error);
  }
}
