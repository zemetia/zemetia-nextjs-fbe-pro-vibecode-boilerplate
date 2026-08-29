/**
 * Angka → kata dalam Bahasa Indonesia, untuk baris "Terbilang" di nota.
 *
 * Baris ini bukan hiasan: ia adalah pengaman terhadap angka yang diubah setelah
 * dokumen dicetak — "150.000.000" gampang jadi "1.150.000.000" dengan satu
 * coretan pena, "seratus lima puluh juta rupiah" tidak.
 *
 * Hanya rupiah yang diterbilangkan. Dokumen valas sengaja tidak punya barisnya:
 * "dua ribu empat ratus sepuluh dolar Amerika Serikat" bukan bentuk yang dipakai
 * di dokumen Indonesia, dan menerjemahkan setengah-setengah lebih buruk daripada
 * tidak sama sekali.
 */

/** 0–11 punya kata sendiri; "sebelas" bukan "satu belas". */
const UNITS = [
  '',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas',
] as const;

/** Kelipatan seribu, dari yang terkecil — dibaca mundur saat memilih skala. */
const SCALES = [
  [1_000, 'ribu'],
  [1_000_000, 'juta'],
  [1_000_000_000, 'miliar'],
  [1_000_000_000_000, 'triliun'],
] as const;

/**
 * Nol mengembalikan string kosong, bukan "nol" — di posisi sisa, "seratus nol"
 * adalah kalimat yang salah. Yang menangani nol sebagai keseluruhan angka adalah
 * `terbilang()`, satu lapis di atas ini.
 */
function spell(value: number): string {
  if (value <= 0) return '';
  if (value < 12) return UNITS[value] ?? '';
  if (value < 20) return `${spell(value - 10)} belas`;
  if (value < 100) return `${spell(Math.floor(value / 10))} puluh ${spell(value % 10)}`.trim();
  if (value < 200) return `seratus ${spell(value - 100)}`.trim();
  if (value < 1_000) return `${spell(Math.floor(value / 100))} ratus ${spell(value % 100)}`.trim();
  if (value < 2_000) return `seribu ${spell(value - 1_000)}`.trim();

  for (let index = SCALES.length - 1; index >= 0; index -= 1) {
    const scale = SCALES[index];
    if (scale && value >= scale[0]) {
      return `${spell(Math.floor(value / scale[0]))} ${scale[1]} ${spell(value % scale[0])}`.trim();
    }
  }

  return '';
}

/** `123` → `"seratus dua puluh tiga"`. Bilangan bulat, tanpa satuan. */
export function terbilang(value: number): string {
  const rounded = Math.round(Math.abs(value));
  if (rounded === 0) return 'nol';

  const words = spell(rounded);
  return value < 0 ? `minus ${words}` : words;
}

/**
 * `1234.5` → `"Seribu dua ratus tiga puluh empat rupiah lima puluh sen"`.
 *
 * Sen hanya muncul kalau memang ada — "nol sen" di belakang tiap nota cuma
 * membuat baris terbilang panjang tanpa menambah satu pun kepastian.
 */
export function terbilangRupiah(value: number): string {
  const sign = value < 0 ? 'minus ' : '';
  const absolute = Math.abs(value);
  const rupiah = Math.floor(absolute);
  const sen = Math.round((absolute - rupiah) * 100);

  // Pembulatan sen bisa mendorongnya ke 100 (mis. 9.999) — kalau dibiarkan,
  // nota membaca "sembilan rupiah seratus sen".
  const carriedRupiah = sen === 100 ? rupiah + 1 : rupiah;
  const carriedSen = sen === 100 ? 0 : sen;

  const words = `${sign}${terbilang(carriedRupiah)} rupiah${
    carriedSen > 0 ? ` ${terbilang(carriedSen)} sen` : ''
  }`;

  return words.charAt(0).toUpperCase() + words.slice(1);
}
