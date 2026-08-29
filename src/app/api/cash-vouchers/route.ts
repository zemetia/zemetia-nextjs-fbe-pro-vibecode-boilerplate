import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { buildPaginatedDTO, parseListQuery, toPageWindow } from '@/lib/pagination';
import { createWithVoucherNumber } from '@/lib/cash-voucher-number';
import {
  CASH_VOUCHER_DETAIL_INCLUDE,
  CASH_VOUCHER_INCLUDE,
  toCashVoucherDetailDTO,
  toCashVoucherDTO,
} from '@/lib/cash-voucher-dto';
import {
  assertPartnerUsable,
  assertVoucherAccounts,
  resolveVoucherReference,
  toCashVoucherColumns,
  toCashVoucherFundRows,
  toCashVoucherLineRows,
} from '@/lib/cash-voucher-write';
import { cashVoucherListQuerySchema, createCashVoucherSchema } from '@/lib/validations';

export async function GET(request: Request) {
  try {
    await requirePermission('cash-vouchers:list');

    const query = parseListQuery(request, cashVoucherListQuerySchema);
    const { skip, take } = toPageWindow(query);

    const where: Prisma.CashVoucherWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.fund ? { fund: query.fund } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.payment_method ? { paymentMethod: query.payment_method } : {}),
      ...(query.partner_id ? { partnerId: query.partner_id } : {}),
      ...(query.date_from || query.date_to
        ? {
            date: {
              ...(query.date_from ? { gte: toUtcDateOnly(query.date_from) } : {}),
              ...(query.date_to ? { lte: toUtcDateOnly(query.date_to) } : {}),
            },
          }
        : {}),
      // The counterparty name is searchable alongside the number and the purpose:
      // a voucher is nearly always looked up by who it was paid to, and many of
      // them have no partner row to search through at all.
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' as const } },
              { counterpartyName: { contains: query.q, mode: 'insensitive' as const } },
              { purpose: { contains: query.q, mode: 'insensitive' as const } },
              { referenceNumber: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.cashVoucher.findMany({
        where,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        include: CASH_VOUCHER_INCLUDE,
      }),
      prisma.cashVoucher.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedDTO(rows, total, query, toCashVoucherDTO));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * A new voucher is always a draft. Nothing reaches the ledger from here — the
 * approval step decides that, which is the whole point of having one.
 */
export async function POST(request: Request) {
  try {
    await requirePermission('cash-vouchers:create');
    const session = await requireAuth();

    const body = createCashVoucherSchema.parse(await request.json());

    const [, , reference] = await Promise.all([
      assertVoucherAccounts(
        body.funds.map((fund) => fund.account_id),
        body.lines.map((line) => line.account_id),
      ),
      assertPartnerUsable(body.partner_id),
      resolveVoucherReference(body.reference_type, body.reference_id),
    ]);

    const date = toUtcDateOnly(body.date);

    const voucher = await createWithVoucherNumber(body.fund, body.direction, date, (number) =>
      prisma.cashVoucher.create({
        data: {
          ...toCashVoucherColumns(body, reference),
          number,
          createdById: session.user.id,
          funds: { create: toCashVoucherFundRows(body) },
          lines: { create: toCashVoucherLineRows(body) },
        },
        include: CASH_VOUCHER_DETAIL_INCLUDE,
      }),
    );

    return NextResponse.json(toCashVoucherDetailDTO(voucher), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
