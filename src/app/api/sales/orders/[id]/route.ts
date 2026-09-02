import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import {
  SALES_ORDER_DETAIL_INCLUDE,
  toSalesOrderDetailDTO,
} from '@/lib/sales-dto';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('export-sales-orders:detail');
    const { id } = await params;

    const order = await prisma.salesOrder.findUnique({
      where: { id, type: 'EXPORT' },
      include: SALES_ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundError('Sales order ekspor yang dipilih tidak ditemukan.');

    return NextResponse.json(toSalesOrderDetailDTO(order));
  } catch (error) {
    return handleApiError(error);
  }
}
