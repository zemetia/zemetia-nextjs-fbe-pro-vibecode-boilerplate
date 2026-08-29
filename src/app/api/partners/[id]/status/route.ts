import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError } from '@/lib/errors';
import { PARTNER_INCLUDE, toPartnerDetailDTO } from '@/lib/partner-dto';
import { setPartnerStatusSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/**
 * Partners are deactivated, never deleted — purchase orders and export sales
 * keep pointing at them, so the row has to survive. Mirrors the user lifecycle
 * in `PATCH /api/users/[id]/status`.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('partners:set-status');
    const { id } = await params;

    const existing = await prisma.partner.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Mitra tidak ditemukan.');

    const body = setPartnerStatusSchema.parse(await request.json());

    const partner = await prisma.partner.update({
      where: { id },
      data: { isActive: body.is_active },
      include: PARTNER_INCLUDE,
    });

    return NextResponse.json(toPartnerDetailDTO(partner));
  } catch (error) {
    return handleApiError(error);
  }
}
