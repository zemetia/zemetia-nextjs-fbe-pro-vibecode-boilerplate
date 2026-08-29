import type { Metal, PriceBasis, ProductForm } from '@/types/value-objects';

/**
 * Label dan aturan turunan master produk. Semuanya murni dan isomorfik: form
 * memakai fungsi yang sama persis dengan yang dipakai route handler, jadi apa
 * yang terlihat sebelum menyimpan tidak bisa berbeda dari apa yang tersimpan.
 */

export const METAL_LABELS: Record<Metal, string> = {
  GOLD: 'Emas',
  SILVER: 'Perak',
};

export const METALS = ['GOLD', 'SILVER'] as const;

export const METAL_OPTIONS = METALS.map((value) => ({ value, label: METAL_LABELS[value] }));

export const PRODUCT_FORM_LABELS: Record<ProductForm, string> = {
  BULLION: 'Batangan',
  GRANULE: 'Granul',
  JEWELRY: 'Perhiasan',
  SCRAP: 'Scrap',
};

export const PRODUCT_FORM_DESCRIPTIONS: Record<ProductForm, string> = {
  BULLION: 'Batangan bersertifikat — kadarnya tidak dinegosiasikan, tiap keping bernomor seri.',
  GRANULE: 'Granul logam murni — kadarnya dipatok seperti batangan, tapi ditakar per gram tanpa nomor seri.',
  JEWELRY: 'Perhiasan jadi — kadarnya diuji dan diketik.',
  SCRAP: 'Barang tua atau rusak untuk dilebur — kadarnya baru pasti setelah diuji.',
};

export const PRODUCT_FORMS = ['BULLION', 'GRANULE', 'JEWELRY', 'SCRAP'] as const;

export const PRODUCT_FORM_OPTIONS = PRODUCT_FORMS.map((value) => ({
  value,
  label: PRODUCT_FORM_LABELS[value],
}));

export const PRICE_BASIS_LABELS: Record<PriceBasis, string> = {
  GROSS: 'per gram kotor',
  FINE: 'per gram murni',
};

/**
 * Dasar harga sebuah barang — **diturunkan dari bentuknya, tidak pernah dipilih**.
 *
 * Batangan dan granul dihargai per gram kotor: kadarnya sudah setinggi yang bisa
 * didapat, jadi yang dinegosiasikan di lapangan memang harga per gram barangnya.
 * Perhiasan dan scrap dihargai per gram murni, karena kadarnya beragam dan
 * satu-satunya harga yang bisa dibandingkan antar barang adalah harga isinya.
 *
 * Yang menentukan dasarnya karena itu **bukan bentuknya, melainkan apakah
 * kadarnya dipatok** — granul 999,9 dan batangan 999,9 dinegosiasikan dengan
 * cara yang sama persis meski bentuknya berbeda.
 *
 * Nilainya dibekukan di baris dokumen saat ditulis; fungsi ini hanya menjawab
 * "seharusnya apa" untuk baris baru, bukan untuk membaca baris lama.
 */
export function priceBasisForForm(form: ProductForm): PriceBasis {
  return form === 'BULLION' || form === 'GRANULE' ? 'GROSS' : 'FINE';
}

/**
 * Barang yang isinya **logam murni** — batangan dan granul.
 *
 * Jawaban yang sama dengan `priceBasisForForm() === 'GROSS'`, dan itu bukan
 * kebetulan: keduanya berangkat dari kenyataan yang sama, yaitu kadarnya sudah
 * setinggi yang bisa didapat sehingga yang diperdagangkan memang berat barangnya
 * sendiri. Tetap dua fungsi karena keduanya menjawab dua pertanyaan berbeda —
 * "harga dikalikan berat mana" dan "beratnya perlu dipotong kadar atau tidak" —
 * dan menyatukannya berarti barang berikutnya yang memisahkan keduanya harus
 * membongkar dua tempat sekaligus.
 *
 * Lihat `fineWeight()` di `@/lib/metal-lot` untuk alasan lengkapnya.
 */
export function isPureProductForm(form: ProductForm): boolean {
  return form === 'BULLION' || form === 'GRANULE';
}

/** Berat yang dikalikan harga, sesuai dasarnya. */
export function pricedWeightGram(
  basis: PriceBasis,
  weights: { weightGram: number; fineWeightGram: number },
): number {
  return basis === 'GROSS' ? weights.weightGram : weights.fineWeightGram;
}

/**
 * Kadar batangan emas bersertifikat. Tetap jadi konstanta meski kadarnya kini
 * hidup di master produk: seeder butuh satu angka untuk menuliskannya, dan
 * layar yang menjelaskan kenapa fieldnya terkunci butuh menyebutnya.
 */
export const GOLD_BULLION_PURITY_PERCENT = 99.99;

/** Kadar batangan perak bersertifikat — satu tingkat di bawah emas, dan memang begitu. */
export const SILVER_BULLION_PURITY_PERCENT = 99.9;

/**
 * Bentuk yang **tidak** dicatat per keping bernomor seri.
 *
 * Granul murni kadarnya dipatok persis seperti batangan, tapi sekantong 500 g
 * tidak bisa dibelah jadi keping yang bisa dicocokkan ke sertifikat — jadi
 * "kadarnya tetap" dan "punya nomor seri" ternyata dua pertanyaan, bukan satu.
 * Sebelum granul masuk keduanya selalu dijawab bersamaan, dan itulah yang
 * membuat keduanya sempat terlihat seperti satu kolom.
 */
export function requiresCertificateForForm(form: ProductForm): boolean {
  return form === 'BULLION';
}
