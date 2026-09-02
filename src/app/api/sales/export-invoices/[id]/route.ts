import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import {
  SALES_INVOICE_DETAIL_INCLUDE,
  toSalesInvoiceDetailDTO,
} from '@/lib/sales-dto';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('export-invoices:detail');
    const { id } = await params;

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id, order: { type: 'EXPORT' } },
      include: SALES_INVOICE_DETAIL_INCLUDE,
    });
    if (!invoice) throw new NotFoundError('Faktur ekspor yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesInvoiceDetailDTO(invoice));
  } catch (error) {
    return handleApiError(error);
  }
}
