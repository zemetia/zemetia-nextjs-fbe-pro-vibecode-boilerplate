import { roundTo } from '@/lib/number';
import type { BalStage, MetalLotForm } from '@/types/value-objects';

/**
 * Labels and arithmetic for one lot of stock. Everything here is pure and
 * isomorphic on purpose: the sorting form previews a split with the exact
 * function the route handler uses to store it, so what the clerk sees before
 * saving and what the lot ends up weighing can never disagree.
 */

export const METAL_LOT_FORMS = ['BAR', 'GRANULE', 'JEWELRY', 'SCRAP', 'BAL'] as const;

export const METAL_LOT_FORM_LABELS: Record<MetalLotForm, string> = {
  BAR: 'Batangan',
  GRANULE: 'Granul',
  JEWELRY: 'Perhiasan',
  SCRAP: 'Barang Masuk',
  BAL: 'Bal',
};

export const METAL_LOT_FORM_DESCRIPTIONS: Record<MetalLotForm, string> = {
  BAR: 'Batangan bersertifikat — satu baris satu keping, serinya unik.',
  GRANULE: 'Granul logam murni — satu baris satu kantong, ditakar per gram.',
  JEWELRY: 'Perhiasan siap jual atau ekspor, dikelompokkan per kode model dan karat.',
  SCRAP: 'Barang masuk yang belum dipilah — habis begitu selesai disortir.',
  BAL: 'Rakitan bahan baku lintas penerimaan, menunggu dilebur atau diolah.',
};

export const METAL_LOT_FORM_OPTIONS = METAL_LOT_FORMS.map((value) => ({
  value,
  label: METAL_LOT_FORM_LABELS[value],
}));

export const BAL_STAGES = ['OPEN', 'SEALED'] as const;

export const BAL_STAGE_LABELS: Record<BalStage, string> = {
  OPEN: 'Terbuka',
  SEALED: 'Disegel',
};

export const WEIGHT_SCALE = 4;

/** Karat that jewelry is actually made in here, with the purity each one means. */
export const KARAT_PURITY_PERCENT: Record<number, number> = {
  24: 99.9,
  23: 95.8,
  22: 91.6,
  21: 87.5,
  20: 83.3,
  18: 75,
  16: 66.6,
  14: 58.5,
  10: 41.7,
  9: 37.5,
};

export const KARAT_OPTIONS = Object.keys(KARAT_PURITY_PERCENT)
  .map(Number)
  .sort((a, b) => b - a)
  .map((karat) => ({
    value: String(karat),
    label: `${karat}K — ${KARAT_PURITY_PERCENT[karat]}%`,
  }));

export function purityFromKarat(karat: number): number | undefined {
  return KARAT_PURITY_PERCENT[karat];
}

/**
 * Bentuk lot yang isinya **logam murni**: batangan bersertifikat dan granul.
 *
 * Kembarannya di sisi dokumen adalah `isPureProductForm()` di `@/lib/product`,
 * dan keduanya menjawab pertanyaan yang sama — sengaja tidak digabung karena
 * `MetalLotForm` (satu keping di rak) dan `ProductForm` (satu baris di dokumen)
 * memang dua enum yang berbeda.
 */
export function isPureLotForm(form: MetalLotForm): boolean {
  return form === 'BAR' || form === 'GRANULE';
}

/**
 * The one derivation of fine weight, used by lot rows and movement lines alike.
 * Rounded to the column's four decimals so a figure on screen can be added up by
 * hand and match the stored one.
 *
 * **Logam murni tidak dipotong kadarnya.** Emas 99,99% dan perak 99,90% dihitung
 * sebesar berat aslinya: itulah cara batangan diperdagangkan di sini — yang
 * dibayar, dikirim, dan disimpan adalah berat kepingnya, dan mengalikannya
 * dengan 99,99% melahirkan angka yang tidak pernah muncul di sertifikat mana
 * pun, lalu menyisakan 0,1 g "hilang" di tiap keping 1 kg yang tidak bisa
 * dijelaskan ke siapa-siapa. Kadarnya tetap disimpan dan tetap ditampilkan
 * sebagai keterangan sertifikat — yang berubah cuma apakah ia jadi pengali.
 *
 * Karena itu `pure` **wajib dijawab tiap pemanggilan**, bukan opsi dengan
 * default: bentuk barang berikutnya tidak boleh diam-diam ikut aturan yang salah
 * hanya karena penulisnya tidak memikirkannya (alasan yang sama yang membuat
 * pesan `AppError` jadi parameter wajib).
 */
export function fineWeight(
  grossWeightGram: number,
  purityPercent: number,
  { pure }: { pure: boolean },
): number {
  if (pure) return roundTo(grossWeightGram, WEIGHT_SCALE);
  return roundTo((grossWeightGram * purityPercent) / 100, WEIGHT_SCALE);
}

/**
 * Weights are compared in **whole milligrams**. Summing floats rejects a
 * movement that is genuinely balanced for a reason that has nothing to do with
 * gold — the same trap the journal avoids by comparing whole cents.
 */
export function toMilligram(gram: number): number {
  return Math.round(gram * 1000);
}

/**
 * Bal carries two purities: what it was estimated at while being filled, and
 * what the assay said when it was sealed. The assay wins once it exists — until
 * then every consumption runs on a guess nobody has ever checked.
 */
export function effectivePurity(lot: {
  purityPercent: number;
  assayedPurityPercent?: number | null;
}): number {
  return lot.assayedPurityPercent ?? lot.purityPercent;
}

/**
 * Share of the total, for the bars on the position page. Lives here rather than
 * next to the aggregation because that module reaches for Prisma, and the client
 * bundle must never pull it in.
 */
export function positionShare(fineWeightGram: number, totalFineGram: number): number {
  if (totalFineGram <= 0) return 0;
  return roundTo((fineWeightGram / totalFineGram) * 100, 2);
}

export const METAL_LOT_CODE_PREFIX: Record<MetalLotForm, string> = {
  BAR: 'BAR',
  GRANULE: 'GRN',
  JEWELRY: 'PHS',
  SCRAP: 'SCR',
  BAL: 'BAL',
};
