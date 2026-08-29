import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requirePermission } from '@/lib/rbac';
import { handleApiError } from '@/lib/api-error';
import { toUtcDateOnly } from '@/lib/date';
import { nextCashVoucherNumber } from '@/lib/cash-voucher-number';

const querySchema = z.object({
  fund: z.enum(['CASH', 'BANK', 'MEMORIAL'], 'Jenis voucher tidak dikenali'),
  direction: z.enum(['IN', 'OUT'], 'Arah voucher tidak dikenali'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal voucher tidak valid')
    .optional(),
});

/**
 * The number this voucher would be given if it were saved right now, shown in the
 * form header so the clerk can write it on the paperwork before saving.
 *
 * It reserves nothing. Numbers are assigned at save time and a concurrent save
 * can take this one, which is why the real assignment retries on the unique
 * violation rather than trusting a number handed out earlier.
 *
 * Gated by `cash-vouchers:create` rather than a key of its own: it only derives
 * from a resource that already has one, and inventing a new key would leave the
 * header blank until someone remembers to re-seed (docs/knowledge/THIS.md).
 */
export async function GET(request: Request) {
  try {
    await requirePermission('cash-vouchers:create');

    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());
    const query = querySchema.parse(raw);

    const date = query.date ? toUtcDateOnly(query.date) : new Date();

    return NextResponse.json({
      number: await nextCashVoucherNumber(query.fund, query.direction, date),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
