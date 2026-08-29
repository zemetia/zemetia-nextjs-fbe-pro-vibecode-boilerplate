import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import { toSupplyDTO } from '@/lib/supply-dto';
import { setSupplyStatusSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/**
 * Dinonaktifkan, tidak pernah dihapus — permintaan pembelian lama tetap menunjuk
 * barang ini, dan barang yang berhenti dibeli masih harus bisa dibaca di baris
 * yang pernah dibuatnya.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('supplies:set-status');
    const { id } = await params;

    const existing = await prisma.supply.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Barang non-logam tidak ditemukan.');

    const body = setSupplyStatusSchema.parse(await request.json());

    const supply = await prisma.supply.update({
      where: { id },
      data: { isActive: body.is_active },
    });

    return NextResponse.json(toSupplyDTO(supply));
  } catch (error) {
    return handleApiError(error);
  }
}
