import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { CASH_VOUCHER_DETAIL_INCLUDE, toCashVoucherDetailDTO } from '@/lib/cash-voucher-dto';
import { findVoucherJournal } from '@/lib/cash-voucher-journal';
import {
  assertPartnerUsable,
  assertVoucherAccounts,
  resolveVoucherReference,
  toCashVoucherColumns,
  toCashVoucherFundRows,
  toCashVoucherLineRows,
} from '@/lib/cash-voucher-write';
import { updateCashVoucherSchema } from '@/lib/validations';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePermission('cash-vouchers:detail');
    const { id } = await params;

    const voucher = await prisma.cashVoucher.findUnique({
      where: { id },
      include: CASH_VOUCHER_DETAIL_INCLUDE,
    });
    if (!voucher) throw new NotFoundError('Voucher tidak ditemukan.');

    return NextResponse.json(toCashVoucherDetailDTO(voucher, await findVoucherJournal(id)));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Only a draft can be edited. Once a voucher has been submitted it is what the
 * verifier is looking at, and once approved it is what somebody signed — from
 * there a correction is a cancellation plus a new voucher.
 *
 * The rows are replaced wholesale rather than diffed: line identity means nothing
 * here (nothing points at a voucher line), and matching them up would only invent
 * a way for `lineNo` to drift out of the order on screen.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requirePermission('cash-vouchers:update');
    const { id } = await params;

    const existing = await prisma.cashVoucher.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundError('Voucher tidak ditemukan.');
    if (existing.status !== 'DRAFT') {
      throw new ConflictError(
        'Voucher ini sudah diajukan, jadi tidak bisa diubah lagi. Minta verifikator mengembalikannya ke draft dulu.',
      );
    }

    const body = updateCashVoucherSchema.parse(await request.json());

    const [, , reference] = await Promise.all([
      assertVoucherAccounts(
        body.funds.map((fund) => fund.account_id),
        body.lines.map((line) => line.account_id),
      ),
      assertPartnerUsable(body.partner_id),
      resolveVoucherReference(body.reference_type, body.reference_id),
    ]);

    const voucher = await prisma.$transaction(async (tx) => {
      // Kedua sisi ditulis ulang seluruhnya, bukan ditambal per baris: edit
      // mengirim dokumen utuh, dan mencocokkan baris lama dengan baris baru
      // hanya menyediakan cara bagi keduanya untuk berselisih.
      await tx.cashVoucherFundLine.deleteMany({ where: { voucherId: id } });
      await tx.cashVoucherLine.deleteMany({ where: { voucherId: id } });

      return tx.cashVoucher.update({
        where: { id },
        data: {
          ...toCashVoucherColumns(body, reference),
          funds: { create: toCashVoucherFundRows(body) },
          lines: { create: toCashVoucherLineRows(body) },
        },
        include: CASH_VOUCHER_DETAIL_INCLUDE,
      });
    });

    return NextResponse.json(toCashVoucherDetailDTO(voucher));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * A draft never happened, so it can be removed. Anything past that stays on file
 * and is cancelled through `PATCH /status` instead — including a voucher that was
 * returned to draft, which is why the check is on the current status alone.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requirePermission('cash-vouchers:delete');
    const { id } = await params;

    const existing = await prisma.cashVoucher.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundError('Voucher tidak ditemukan.');
    if (existing.status !== 'DRAFT') {
      throw new ConflictError(
        'Hanya draft yang bisa dihapus. Voucher yang sudah diajukan dibatalkan, bukan dihapus.',
      );
    }

    await prisma.cashVoucher.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
