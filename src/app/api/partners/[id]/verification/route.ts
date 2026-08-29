import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { formatDateLong } from '@/lib/date';
import { partnerKypChecklist } from '@/lib/partner-kyp';
import { PARTNER_INCLUDE, toPartnerDetailDTO, toPartnerKypSubject } from '@/lib/partner-dto';
import {
  canRequestPartnerVerification,
  partnerVerificationState,
  partnerVerifiedUntil,
} from '@/lib/partner-verification';
import { reviewPartnerVerificationSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

/**
 * Verifikasi mitra (KYP) — dua langkah, dua izin.
 *
 * `POST` mengajukan (`partners:request-verification`), `PATCH` memutuskan
 * (`partners:review-verification`). Dipisah karena centang "Terverifikasi"
 * adalah klaim yang harus bisa dipertanggungjawabkan: kalau satu orang boleh
 * mengajukan sekaligus menyetujui, statusnya tidak lagi berarti apa pun selain
 * "ada yang menekan tombol".
 *
 * Kelengkapan data diperiksa **dua kali** — saat diajukan dan sekali lagi saat
 * disetujui. Di antara keduanya siapa pun yang punya `partners:update` bisa
 * mengosongkan sebuah field, dan menyetujui berdasarkan keadaan kemarin berarti
 * memasang centang di atas data yang sudah bolong hari ini.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await requirePermission('partners:request-verification');
    const { id } = await params;

    const partner = await prisma.partner.findUnique({ where: { id }, include: PARTNER_INCLUDE });
    if (!partner) throw new NotFoundError('Mitra tidak ditemukan.');

    const state = partnerVerificationState(partner.verificationStatus, partner.verifiedUntil);

    if (!canRequestPartnerVerification(state)) {
      throw new ValidationError(
        state === 'PENDING'
          ? 'Pengajuan verifikasi mitra ini masih menunggu keputusan.'
          : `Mitra ini sudah terverifikasi sampai ${formatDateLong(partner.verifiedUntil ?? new Date())}.`,
      );
    }

    const checklist = partnerKypChecklist(toPartnerKypSubject(partner));
    if (!checklist.isComplete) {
      throw new ValidationError(
        `Data KYP belum lengkap. Lengkapi dulu: ${checklist.missing.map((item) => item.label).join(', ')}.`,
      );
    }

    const updated = await prisma.partner.update({
      where: { id },
      data: {
        verificationStatus: 'PENDING',
        verificationRequestedAt: new Date(),
        verificationRequestedById: session.user.id,
        // Keputusan lama tidak boleh menempel di pengajuan baru — alasan
        // penolakan kemarin akan terbaca sebagai penilaian atas data hari ini.
        verificationReviewedAt: null,
        verificationReviewedById: null,
        verificationNote: null,
      },
      include: PARTNER_INCLUDE,
    });

    return NextResponse.json(toPartnerDetailDTO(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requirePermission('partners:review-verification');
    const { id } = await params;

    const partner = await prisma.partner.findUnique({ where: { id }, include: PARTNER_INCLUDE });
    if (!partner) throw new NotFoundError('Mitra tidak ditemukan.');

    if (partner.verificationStatus !== 'PENDING') {
      throw new ValidationError('Tidak ada pengajuan verifikasi yang menunggu keputusan.');
    }

    if (partner.verificationRequestedById === session.user.id) {
      throw new ValidationError(
        'Pengajuan verifikasi harus ditinjau orang lain — Anda yang mengajukannya.',
      );
    }

    const body = reviewPartnerVerificationSchema.parse(await request.json());
    const reviewedAt = new Date();

    if (body.decision === 'REJECT') {
      const rejected = await prisma.partner.update({
        where: { id },
        data: {
          verificationStatus: 'REJECTED',
          verificationReviewedAt: reviewedAt,
          verificationReviewedById: session.user.id,
          verificationNote: body.note,
        },
        include: PARTNER_INCLUDE,
      });

      return NextResponse.json(toPartnerDetailDTO(rejected));
    }

    const checklist = partnerKypChecklist(toPartnerKypSubject(partner));
    if (!checklist.isComplete) {
      throw new ValidationError(
        `Data KYP sudah tidak lengkap lagi sejak diajukan. Yang kosong sekarang: ${checklist.missing
          .map((item) => item.label)
          .join(', ')}.`,
      );
    }

    const approved = await prisma.partner.update({
      where: { id },
      data: {
        verificationStatus: 'VERIFIED',
        verificationReviewedAt: reviewedAt,
        verificationReviewedById: session.user.id,
        verificationNote: body.note,
        verifiedAt: reviewedAt,
        // Dua tahun dihitung di satu tempat (`partnerVerifiedUntil`), bukan
        // ditulis ulang tiap kali seseorang menyetujui.
        verifiedUntil: partnerVerifiedUntil(reviewedAt),
      },
      include: PARTNER_INCLUDE,
    });

    return NextResponse.json(toPartnerDetailDTO(approved));
  } catch (error) {
    return handleApiError(error);
  }
}
