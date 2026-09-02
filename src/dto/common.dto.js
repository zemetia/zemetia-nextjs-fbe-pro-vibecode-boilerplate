import { z } from 'zod';

/**
 * Deeply strips undefined values from an object or array.
 * Firestore throws a runtime error if any property value is undefined.
 * This helper ensures safe serialization for Non-SQL (Firestore) documents.
 */
export function deepStripUndefined(obj) {
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => deepStripUndefined(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = deepStripUndefined(value);
      }
    }
    return clean;
  }
  return obj;
}

/**
 * Common Zod Primitives with clear Indonesian error messages
 */
export const commonRules = {
  nonEmptyString: (fieldLabel) =>
    z.string({
      error: `${fieldLabel} wajib diisi`
    })
    .trim()
    .min(1, `${fieldLabel} tidak boleh kosong`),

  optionalString: () =>
    z.string().nullish().transform(val => (val === undefined || val === null ? '' : String(val).trim())),

  positiveNumber: (fieldLabel) =>
    z.coerce.number({
      error: `${fieldLabel} harus berupa angka valid`
    })
    .gt(0, `${fieldLabel} harus lebih besar dari 0`),

  nonNegativeNumber: (fieldLabel) =>
    z.coerce.number({
      error: `${fieldLabel} harus berupa angka valid`
    })
    .gte(0, `${fieldLabel} tidak boleh bernilai negatif`),

  percentageNumber: (fieldLabel) =>
    z.coerce.number({
      error: `${fieldLabel} harus berupa persentase angka valid`
    })
    .gte(0, `${fieldLabel} minimal 0%`)
    .lte(100, `${fieldLabel} maksimal 100%`),

  dateString: (fieldLabel = 'Tanggal') =>
    z.string({
      error: `${fieldLabel} wajib diisi`
    })
    .regex(/^\d{4}-\d{2}-\d{2}/, `${fieldLabel} harus berformat YYYY-MM-DD`),

  coaAccountCode: (fieldLabel = 'Kode Akun') =>
    z.string({
      error: `${fieldLabel} wajib dipilih`
    })
    .trim()
    .min(3, `${fieldLabel} tidak valid`),

  currencyEnum: () =>
    z.enum(['IDR', 'USD', 'SGD'], {
      error: 'Mata uang harus IDR, USD, atau SGD'
    }).default('IDR')
};
