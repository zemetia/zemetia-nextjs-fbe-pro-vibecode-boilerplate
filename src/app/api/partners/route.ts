import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import { countryIso2FilterForOrigin } from '@/lib/partner';
import { createWithPartnerCode } from '@/lib/partner-code';
import { PARTNER_INCLUDE, toPartnerDTO, toPartnerDetailDTO } from '@/lib/partner-dto';
import { toPartnerColumns } from '@/lib/partner-write';
import {
  createPartnerSchema,
  partnerListQuerySchema,
  type PartnerListQuery,
} from '@/lib/validations';

/** Filter status verifikasi, dengan `EXPIRED` diterjemahkan jadi kondisi tanggal. */
function verificationFilter(
  state: PartnerListQuery['verification'],
): Prisma.PartnerWhereInput {
  if (!state) return {};

  const now = new Date();

  if (state === 'EXPIRED') {
    return { verificationStatus: 'VERIFIED', verifiedUntil: { lte: now } };
  }

  if (state === 'VERIFIED') {
    // Dibungkus `AND` karena `OR` di level ini sudah dipakai pencarian teks —
    // dua kunci `OR` di satu objek akan saling menimpa tanpa error apa pun.
    return {
      verificationStatus: 'VERIFIED',
      AND: [{ OR: [{ verifiedUntil: null }, { verifiedUntil: { gt: now } }] }],
    };
  }

  return { verificationStatus: state };
}

export async function GET(request: Request) {
  try {
    await requirePermission('partners:list');

    const query = parseListQuery(request, partnerListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.PartnerWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      // Role and origin are separate filters on purpose: the picker on a
      // purchase form wants "any local supplier", and the two axes are
      // independent — a partner we sell to abroad may also supply us locally.
      //
      // Origin has no column: it is the country, so the filter reaches through
      // the relation instead of reading a flag that could contradict it.
      ...(query.role === 'supplier' ? { isSupplier: true } : {}),
      ...(query.role === 'customer' ? { isCustomer: true } : {}),
      ...(query.origin
        ? { country: { iso2: countryIso2FilterForOrigin(query.origin) } }
        : {}),
      ...(query.country_id ? { countryId: query.country_id } : {}),
      // `EXPIRED` bukan nilai kolom — ia "VERIFIED yang tanggalnya lewat", dan
      // `VERIFIED` karenanya harus mengecualikan yang sudah lewat. Menyaring
      // statusnya saja akan menaruh mitra kedaluwarsa di daftar terverifikasi,
      // persis kebalikan dari yang dicari orang yang membuka filter itu.
      ...verificationFilter(query.verification),
      ...(query.is_active === undefined ? {} : { isActive: query.is_active }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { legalName: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
        include: PARTNER_INCLUDE,
      }),
      prisma.partner.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedDTO(rows, total, query, toPartnerDTO));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission('partners:create');

    const body = createPartnerSchema.parse(await request.json());

    // Both are `Restrict` relations — reject them here so the failure reads as
    // "negara tidak ditemukan" instead of a foreign-key error.
    const [country, currency, contactCountry] = await Promise.all([
      prisma.country.findUnique({ where: { id: body.country_id } }),
      prisma.currency.findUnique({ where: { code: body.currency_code } }),
      body.contact_country_id
        ? prisma.country.findUnique({ where: { id: body.contact_country_id } })
        : null,
    ]);
    if (!country) throw new NotFoundError('Negara yang dipilih tidak ditemukan.');
    if (!currency) throw new NotFoundError('Mata uang yang dipilih tidak ditemukan.');
    if (body.contact_country_id && !contactCountry) {
      throw new NotFoundError('Kewarganegaraan kontak yang dipilih tidak ditemukan.');
    }

    const duplicate = await prisma.partner.findFirst({
      where: { name: { equals: body.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictError('Mitra dengan nama ini sudah terdaftar.');

    const partner = await createWithPartnerCode((code) =>
      prisma.partner.create({
        data: {
          ...toPartnerColumns(body),
          code,
          countryId: country.id,
          currencyCode: currency.code,
        },
        include: PARTNER_INCLUDE,
      }),
    );

    return NextResponse.json(toPartnerDetailDTO(partner), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
