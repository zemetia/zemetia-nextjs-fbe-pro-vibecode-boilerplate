import { z } from 'zod';

import { paginationSchema } from './common';

/**
 * Query buku besar dan neraca saldo. Keduanya baca murni, jadi yang perlu
 * dijaga hanya bentuk nilainya.
 *
 * Periode **tidak** punya nilai awal di sini. Laporan yang terbuka dengan filter
 * "bulan ini" akan membuat orang yang mencari transaksi Juli menyimpulkan
 * datanya hilang — memilih periode adalah keputusan pembacanya.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const periodShape = {
  date_from: z.string().regex(DATE_ONLY, 'Tanggal awal tidak valid').optional(),
  date_to: z.string().regex(DATE_ONLY, 'Tanggal akhir tidak valid').optional(),
};

export const generalLedgerQuerySchema = paginationSchema.extend({
  ...periodShape,
  /** Buku besar selalu tentang satu akun — tanpa ini laporannya tidak punya subjek. */
  account_id: z.string().trim().min(1, 'Akun buku besar wajib dipilih'),
});

export const trialBalanceQuerySchema = z.object({
  ...periodShape,
  /**
   * Akun tanpa saldo awal maupun mutasi disembunyikan secara bawaan — dari 275
   * akun, sebagian besar diam di periode mana pun, dan barisan nol memakan
   * laporan yang seharusnya bisa dibaca sekali lihat. Bisa diminta tampil saat
   * yang dicari justru akun yang tidak bergerak.
   */
  include_empty: z
    .enum(['true', 'false'], 'Pilihan tampilkan akun tanpa mutasi tidak dikenali')
    .optional(),
});

export type GeneralLedgerQuery = z.infer<typeof generalLedgerQuerySchema>;
export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;
