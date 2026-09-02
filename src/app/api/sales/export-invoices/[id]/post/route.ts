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
import { postInvoiceReceivableJournal } from '@/lib/sales-journal';
import { SALES_INVOICE_STATUS_LABELS } from '@/lib/sales';

type Params = { params: Promise<{ id: string }> };

/** `DRAFT → POSTED` — jurnal piutang ekspor USD / pendapatan PPN 0% (4116). */
export async function PATCH(_request: Request, { params }: Params) {
  try {
    await requirePermission('export-invoices:post');
    const session = await requireAuth();
    const { id } = await params;

    const existing = await prisma.salesInvoice.findUnique({
      where: { id, order: { type: 'EXPORT' } },
      select: { status: true },
    });
    if (!existing) throw new NotFoundError('Faktur ekspor yang dipilih tidak ditemukan.');
    if (existing.status !== 'DRAFT') {
      throw new ConflictError(
        `Faktur ini berstatus ${SALES_INVOICE_STATUS_LABELS[existing.status]}, jadi tidak bisa diposting.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await postInvoiceReceivableJournal(id, session.user.id, tx);
      await tx.salesInvoice.update({
        where: { id },
        data: { status: 'POSTED', directorApprovedById: session.user.id, directorApprovedAt: new Date() },
      });
    });

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id },
      include: SALES_INVOICE_DETAIL_INCLUDE,
    });
    if (!invoice) throw new NotFoundError('Faktur ekspor yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesInvoiceDetailDTO(invoice));
  } catch (error) {
    return handleApiError(error);
  }
}
