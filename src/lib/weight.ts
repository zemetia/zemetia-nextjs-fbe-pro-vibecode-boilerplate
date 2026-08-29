import { roundTo } from '@/lib/number';
import type { WeightUnit } from '@/types/value-objects';

/**
 * Weight units and the one conversion between them.
 *
 * Gold trades in **troy** ounces, not the avoirdupois ounce of everyday scales —
 * 31,1034768 g against 28,3495 g. Getting that wrong overstates a 1.000 oz order
 * by roughly 2,8 kg, so the constant lives here alone and every caller reads it
 * from here rather than typing it again.
 *
 * Everything stored is grams. The chosen unit only decides how the clerk types
 * and reads the figure — comparing an order against its shipments must never
 * require a conversion in the query.
 */

export const GRAM_PER_TROY_OUNCE = 31.1034768;

export const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  GRAM: 'gram',
  TROY_OUNCE: 'troy oz',
};

export const WEIGHT_UNITS = ['GRAM', 'TROY_OUNCE'] as const;

export const WEIGHT_UNIT_OPTIONS = WEIGHT_UNITS.map((value) => ({
  value,
  label: WEIGHT_UNIT_LABELS[value],
}));

/** Scale of every stored weight column, and of every figure shown on screen. */
export const WEIGHT_SCALE = 4;

/** Whatever the clerk typed → grams, the only unit anything is stored in. */
export function toGram(value: number, unit: WeightUnit): number {
  return unit === 'GRAM' ? value : value * GRAM_PER_TROY_OUNCE;
}

/** Grams → the unit the document was entered in, for reopening the form. */
export function fromGram(gram: number, unit: WeightUnit): number {
  return unit === 'GRAM' ? gram : gram / GRAM_PER_TROY_OUNCE;
}

/** `fromGram` rounded to the scale the field displays — the form's entry point. */
export function displayWeight(gram: number, unit: WeightUnit): number {
  return roundTo(fromGram(gram, unit), WEIGHT_SCALE);
}

/**
 * Berapa satuan `to` yang setara dengan satu satuan `from`.
 *
 * Diturunkan dari `toGram()` alih-alih menulis 31,1034768 lagi: satu konstanta,
 * satu tempat, jadi kedua arah konversi tidak bisa berselisih.
 */
function unitRatio(from: WeightUnit, to: WeightUnit): number {
  return toGram(1, from) / toGram(1, to);
}

/**
 * Berat yang **sama**, dinyatakan dalam satuan lain — 1.000 g adalah 32,1507 oz,
 * bukan 1.000 oz.
 *
 * Dipakai saat satuan sebuah baris ditukar di layar. Ia sengaja hidup
 * berpasangan dengan `convertPricePerUnit()`: menukar satuan tanpa menukar
 * harganya membuat nilai baris melompat tiga puluh satu kali lipat.
 */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return roundTo(value * unitRatio(from, to), WEIGHT_SCALE);
}

/**
 * Harga per satu satuan `from` → harga per satu satuan `to`.
 *
 * Arahnya kebalikan berat, dan itu bukan kebetulan: nilai baris adalah
 * `harga × berat`, jadi satu-satunya cara menukar satuan tanpa menggeser
 * kesepakatan adalah membagi salah satunya dengan faktor yang mengalikan
 * satunya lagi. Rp 1.000.000/g dan Rp 31.103.476,80/oz adalah harga yang sama.
 */
export function convertPricePerUnit(
  price: number,
  from: WeightUnit,
  to: WeightUnit,
  scale: number,
): number {
  if (from === to) return price;
  return roundTo(price / unitRatio(from, to), scale);
}
