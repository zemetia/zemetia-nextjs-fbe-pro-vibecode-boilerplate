import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * `APR-202608-0001`, direset tiap bulan — skema yang sama dengan jurnal, PO, dan
 * voucher. Periodenya diambil dari **hari pengajuan**, karena itulah tanggal
 * peristiwa yang dicatat baris ini (dokumennya boleh bertanggal mundur; permintaan
 * konfirmasinya tidak pernah).
 *
 * Nomornya dibaca sekali lalu dihitung lokal, **tanpa pola retry-on-conflict**:
 * pemanggilnya selalu di dalam transaksi, dan di dalam transaksi statement yang
 * gagal sudah membatalkan seluruhnya sehingga percobaan kedua tidak pernah punya
 * kesempatan jalan (THIS.md 2026-08-11). Unique index tetap kata terakhir.
 */

const SEQUENCE_DIGITS = 4;

export async function nextApprovalNumber(
  now: Date,
  client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `APR-${period}-`;

  const latest = await client.approvalRequest.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  const sequence = latest ? Number(latest.number.split('-').at(-1)) + 1 : 1;

  return `${prefix}${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}
