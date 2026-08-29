import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { PARTNER_INCLUDE, toPartnerDetailDTO } from '@/lib/partner-dto';
import { partnerKypChecklist } from '@/lib/partner-kyp';
import { toPartnerColumns, toPartnerKypSubjectFromInput } from '@/lib/partner-write';
import { updatePartnerSchema } from '@/lib/validations';
import type { Prisma } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('partners:detail');
    const { id } = await params;

    const partner = await prisma.partner.findUnique({
      where: { id },
      include: PARTNER_INCLUDE,
    });
    if (!partner) throw new NotFoundError('Mitra tidak ditemukan.');

    return NextResponse.json(toPartnerDetailDTO(partner));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('partners:update');
    const { id } = await params;

    const existing = await prisma.partner.findUnique({
      where: { id },
      select: {
        id: true,
        isSupplier: true,
        isCustomer: true,
        verificationStatus: true,
      },
    });
    if (!existing) throw new NotFoundError('Mitra tidak ditemukan.');

    const body = updatePartnerSchema.parse(await request.json());

    const [country, currency, contactCountry, duplicate] = await Promise.all([
      prisma.country.findUnique({ where: { id: body.country_id } }),
      prisma.currency.findUnique({ where: { code: body.currency_code } }),
      body.contact_country_id
        ? prisma.country.findUnique({ where: { id: body.contact_country_id } })
        : null,
      prisma.partner.findFirst({
        where: { id: { not: id }, name: { equals: body.name, mode: 'insensitive' } },
        select: { id: true },
      }),
    ]);
    if (!country) throw new NotFoundError('Negara yang dipilih tidak ditemukan.');
    if (!currency) throw new NotFoundError('Mata uang yang dipilih tidak ditemukan.');
    if (body.contact_country_id && !contactCountry) {
      throw new NotFoundError('Kewarganegaraan kontak yang dipilih tidak ditemukan.');
    }
    if (duplicate) throw new ConflictError('Mitra dengan nama ini sudah terdaftar.');

    const holdsVerification =
      existing.verificationStatus === 'VERIFIED' || existing.verificationStatus === 'PENDING';
    const kyp = partnerKypChecklist(toPartnerKypSubjectFromInput(body, country.iso2));

    const verificationReset: Prisma.PartnerUncheckedUpdateInput =
      holdsVerification && !kyp.isComplete
        ? {
            verificationStatus: 'UNVERIFIED',
            verificationRequestedAt: null,
            verificationRequestedById: null,
            verificationReviewedAt: null,
            verificationReviewedById: null,
            verifiedAt: null,
            verifiedUntil: null,
            verificationNote:
              'Verifikasi dicabut otomatis karena data KYP tidak lagi lengkap setelah data mitra diubah.',
          }
        : {};

    // `undefined` leaves a column untouched, `null` clears it — the schema has
    // already turned an emptied optional field into `null`.
    const partner = await prisma.partner.update({
      where: { id },
      data: { ...toPartnerColumns(body), ...verificationReset },
      include: PARTNER_INCLUDE,
    });

    return NextResponse.json(toPartnerDetailDTO(partner));
  } catch (error) {
    return handleApiError(error);
  }
}
