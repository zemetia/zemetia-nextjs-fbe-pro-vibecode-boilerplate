import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/errors';

/**
 * Akun yang **sistem** rujuk sendiri, bukan yang dipilih petugas.
 *
 * Hampir semua akun di jurnal otomatis datang dari data: akun persediaan dan
 * akun singgah ikut barangnya (`Product.inventoryAccountId`), akun sumber dana
 * ikut vouchernya (`CashVoucher.contraAccountId`). Yang tersisa cuma segelintir
 * akun yang lawan transaksinya tidak dipilih siapa pun karena jawabannya cuma
 * satu — hutang usaha atas pembelian selalu hutang usaha dagang.
 *
 * Disebut lewat **kode**, bukan cuid: kode akun stabil lintas database dan
 * terbaca oleh manusia yang membaca kode ini setahun lagi, sementara cuid-nya
 * berbeda di tiap instalasi (pelajaran key-vs-id, LEARN 2026-08-10).
 *
 * Kalau suatu hari perannya perlu bisa diatur per perusahaan, yang berubah cuma
 * isi peta ini — pemanggilnya sudah menyebut peran, bukan kode.
 */
export const LEDGER_ROLE_CODES = {
  /** `2111` — lawan dari setiap penerimaan barang yang belum dibayar. */
  TRADE_PAYABLE: '2111',
} as const;

export type LedgerRole = keyof typeof LEDGER_ROLE_CODES;

const LEDGER_ROLE_LABELS: Record<LedgerRole, string> = {
  TRADE_PAYABLE: 'Hutang Usaha Dagang',
};

/**
 * Id akun untuk sebuah peran, dicari lewat kodenya.
 *
 * Akun yang tidak ada atau sudah dinonaktifkan ditolak di sini dengan pesan yang
 * menyebut **nama akunnya**, bukan kodenya saja — layar tidak pernah menampilkan
 * code (hard constraint #18), dan "Akun Hutang Usaha Dagang belum terdaftar"
 * bisa ditindaklanjuti sementara "account 2111 not found" tidak.
 */
export async function resolveLedgerRoleAccountId(
  role: LedgerRole,
  client: Prisma.TransactionClient = prisma,
): Promise<string> {
  const code = LEDGER_ROLE_CODES[role];
  const account = await client.ledgerAccount.findUnique({
    where: { code },
    select: { id: true, isActive: true, _count: { select: { children: true } } },
  });

  if (!account) {
    throw new ValidationError(
      `Akun ${LEDGER_ROLE_LABELS[role]} belum ada di bagan akun, jadi jurnalnya tidak bisa dibuat. Jalankan penyiapan bagan akun lebih dulu.`,
    );
  }

  if (!account.isActive) {
    throw new ValidationError(
      `Akun ${LEDGER_ROLE_LABELS[role]} sudah nonaktif, jadi tidak bisa dipakai untuk transaksi baru. Aktifkan kembali akunnya lebih dulu.`,
    );
  }

  if (account._count.children > 0) {
    throw new ValidationError(
      `Akun ${LEDGER_ROLE_LABELS[role]} punya akun turunan, jadi tidak bisa menerima transaksi langsung.`,
    );
  }

  return account.id;
}
