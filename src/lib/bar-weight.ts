import { formatNumber, roundTo } from '@/lib/number';
import { WEIGHT_UNIT_LABELS } from '@/lib/weight';
import type { WeightUnit } from '@/types/value-objects';

/**
 * Ukuran keping batangan dan cara membagi berat sebuah baris ke sejumlah keping.
 *
 * Berat keping **dipilih dari daftar, tidak diketik bebas**: batangan refinery
 * datang dalam ukuran yang itu-itu saja, dan angka bebas hanya membuka jalan bagi
 * 100 g yang tertulis 1.000 g — salah ketik yang tidak akan ketahuan sampai
 * emasnya ditimbang di brankas.
 *
 * **Daftarnya per satuan, bukan satu daftar yang dikonversi.** Batangan troy
 * ounce bukan batangan gram yang dibagi 31,1034768: pasarnya memang menjual
 * keping 1 oz, 10 oz, dan 400 oz, dan mengkonversi daftar gram akan menawarkan
 * "32,1507 oz" sebagai ukuran yang tidak pernah ada wujudnya. Daftar gram
 * gabungan ukuran internasional (PAMP/Valcambi/Argor) dan ukuran Antam; daftar
 * troy ounce mengikuti ukuran yang beredar di perdagangan lintas negara sampai
 * Good Delivery — 400 oz untuk emas, 1.000 oz untuk perak, dan itu batas atasnya.
 *
 * Semuanya murni supaya bisa diuji dan dipakai form tanpa menyentuh server.
 */
export const BAR_WEIGHTS: Record<WeightUnit, readonly number[]> = {
  GRAM: [1, 2, 3, 5, 10, 20, 25, 50, 100, 250, 500, 1000],
  TROY_OUNCE: [1, 2, 5, 10, 20, 50, 100, 400, 500, 1000],
};

/** Daftar gram tetap diekspor dengan nama lamanya — dipakai seeder dan demo data. */
export const BAR_WEIGHT_GRAMS = BAR_WEIGHTS.GRAM;

/** `1.000 g` ditulis `1 kg`; troy ounce tidak punya kelipatan bernama, jadi apa adanya. */
export function barWeightLabel(value: number, unit: WeightUnit): string {
  if (unit === 'GRAM' && value >= 1000 && value % 1000 === 0) {
    return `${formatNumber(value / 1000, { decimalScale: 0 })} kg`;
  }

  const decimalScale = value % 1 === 0 ? 0 : 4;
  const suffix = unit === 'GRAM' ? 'g' : WEIGHT_UNIT_LABELS.TROY_OUNCE;

  return `${formatNumber(value, { decimalScale })} ${suffix}`;
}

export interface BarWeightOption {
  value: string;
  label: string;
}

/**
 * Pilihan dropdown berat keping, dalam satuan dokumennya.
 *
 * Berat yang tidak ada di daftar tetap ikut ditawarkan bila memang sudah
 * tersimpan di barisnya (`include`) — dokumen lama tidak boleh kehilangan
 * angkanya hanya karena hari ini daftarnya berubah. Itu juga yang menyelamatkan
 * dokumen troy ounce yang kepingnya lahir dari berat gram: hasil konversinya
 * hampir tidak pernah persis salah satu ukuran di daftar.
 */
export function barWeightOptions(unit: WeightUnit, include?: number): BarWeightOption[] {
  const weights: number[] = [...BAR_WEIGHTS[unit]];

  if (include !== undefined && include > 0 && !weights.includes(include)) {
    weights.push(include);
    weights.sort((a, b) => a - b);
  }

  return weights.map((weight) => ({
    value: String(weight),
    label: barWeightLabel(weight, unit),
  }));
}

/** Ukuran terbesar di satuan itu yang tidak melebihi `value`. */
export function largestBarWeightAtMost(value: number, unit: WeightUnit): number | undefined {
  let found: number | undefined;

  for (const weight of BAR_WEIGHTS[unit]) {
    if (weight <= value) found = weight;
  }

  return found;
}

/**
 * Membagi `total` ke `pieceCount` keping, tiap keping memakai ukuran **terbesar
 * yang muat** pada jatahnya. Keduanya dalam satuan dokumennya.
 *
 * Jatah dihitung ulang tiap keping (`sisa / keping yang belum kebagian`), bukan
 * sekali di depan: 100 g atas 5 sertifikat jadi 5 × 20 g, sementara greedy yang
 * murni ambil-terbesar-dulu akan memberi keping pertama 100 g dan menyisakan
 * empat keping kosong. Efek yang sama menjaga kasus sebaliknya tetap jujur —
 * 10 kg atas 5 sertifikat mentok di 5 × 1 kg (ukuran terbesar yang ada) sehingga
 * hasilnya **sengaja kurang 5 kg**, dan selisih itu ditampilkan di layar alih-alih
 * dikarang jadi keping raksasa yang tidak pernah ada wujudnya. Batas atas troy
 * ounce-nya 1.000 oz, jadi 5.000 oz atas 3 sertifikat berhenti di 3.000 oz.
 *
 * Fungsi ini hanya mengusulkan; berat tiap keping tetap bisa diganti satu per
 * satu lewat dropdownnya.
 */
export function splitBarWeights(total: number, pieceCount: number, unit: WeightUnit): number[] {
  if (pieceCount <= 0) return [];

  const sizes = BAR_WEIGHTS[unit];
  const smallest = Math.min(...sizes);
  const largest = Math.max(...sizes);

  const weights: number[] = [];
  let remaining = roundTo(Math.max(total, 0), 4);

  for (let index = 0; index < pieceCount; index += 1) {
    const share = Math.min(remaining / (pieceCount - index), largest);
    // Jatah yang lebih kecil dari keping terkecil tetap dapat keping terkecil:
    // sertifikat yang sudah di tangan berarti kepingnya memang ada, dan
    // kelebihannya akan terbaca di kaki daftar.
    const weight = largestBarWeightAtMost(share, unit) ?? smallest;

    weights.push(weight);
    remaining = roundTo(Math.max(remaining - weight, 0), 4);
  }

  return weights;
}
