import { prisma } from '@/lib/prisma';
import type { AccountType } from '@prisma/client';

import { ACCOUNT_SKELETON } from './data/accounts';

/**
 * Memetakan `category` dari COA lama (erp-tan-felix) ke enum `AccountType`
 * Prisma. Dua sumber kebenaran ini tidak pernah menyimpang karena keduanya
 * mengikuti skema kelas 1–6 SAK EMKM.
 */
const TYPE_BY_CATEGORY: Record<string, AccountType> = {
  aset:             'ASSET',
  kewajiban:        'LIABILITY',
  ekuitas:          'EQUITY',
  pendapatan:       'REVENUE',
  beban:            'COST_EXPENSE',
  pendapatan_lain:  'NON_OPERATING',
};

/**
 * Menghitung level pohon dari kode akun PT TAN.
 *
 * Kode asli PT TAN tidak mengikuti skema 4-5 digit abstrak:
 * ada `11101` (5 digit, tapi digit ke-4 nol), `115601` (6 digit),
 * `53000` (5 digit dengan trailing zero), dll. Karena itu `level`
 * dihitung dari **panjang string kode** — ini konsisten dengan
 * perilaku lama `getDefaultChartOfAccounts()` di storage.js yang
 * menggunakan kode mentah tanpa transformasi.
 *
 * Panjang → level:
 *   4 karakter → level 1 atau 2 (kelas & grup)
 *   5 karakter → level 3 (sub-grup atau detail)
 *   6 karakter → level 4 (detail dalam sub-grup 6-digit)
 */
function levelFromCode(code: string): number {
  return code.length;   // simpan panjang apa adanya; laporan mengurutkan by code asc
}

/**
 * Menemukan kode induk terpanjang yang merupakan prefix dari `code`.
 *
 * Algoritma:
 * 1. Potong satu karakter dari ujung kanan kode berulang kali.
 * 2. Setiap kandidat prefix dicek ke `codeSet`.
 * 3. Kandidat terpanjang yang ditemukan adalah induk langsung.
 *
 * Contoh: `115601` → coba `11560` (tidak ada) → `1156` (tidak ada) →
 *         `115` (tidak ada, panjang < 4) → null (root atau `1150` jadi induk).
 *
 * Karena kode di set selalu diurutkan lebih pendek ke lebih panjang sebelum
 * upsert, setiap induk sudah ada di database saat anaknya diproses.
 */
function findParentCode(code: string, codeSet: Set<string>): string | null {
  for (let len = code.length - 1; len >= 4; len--) {
    const candidate = code.slice(0, len);
    if (codeSet.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Seeds the chart of accounts from `ACCOUNT_SKELETON` — the exact 259-account
 * COA used by PT TAN in erp-tan-felix, preserved verbatim (codes, names, types).
 *
 * Idempotent — safe to run on every deploy:
 * - `upsert` on `code` (unique). Only `name` is refreshed on conflict so a
 *   rename in the data file propagates to existing databases.
 * - `isTan` is written only at creation; afterwards it belongs to the company.
 * - Accounts are never deleted here; deactivation happens from the UI.
 *
 * Insertion order: shortest codes first (lexicographic by length then value),
 * so every parent is guaranteed to exist before its children are inserted.
 */
export async function seedAccounts(): Promise<number> {
  // Urutkan: pendek dulu (induk sebelum anak), lalu leksikografis
  const ordered = [...ACCOUNT_SKELETON].sort((a, b) => {
    if (a.code.length !== b.code.length) return a.code.length - b.code.length;
    return a.code.localeCompare(b.code);
  });

  // Set semua kode — dipakai findParentCode tanpa query DB
  const codeSet = new Set(ordered.map((a) => a.code));

  // Map kode → id DB — diisi saat upsert berjalan
  const idByCode = new Map<string, string>();

  let count = 0;
  for (const account of ordered) {
    const { code, name, category, isTan } = account;

    const accountType = TYPE_BY_CATEGORY[category];
    if (!accountType) {
      throw new Error(
        `Kategori akun tidak dikenal: "${category}" (kode ${code}). ` +
        `Nilai yang valid: ${Object.keys(TYPE_BY_CATEGORY).join(', ')}.`,
      );
    }

    const level    = levelFromCode(code);
    const parentCode = findParentCode(code, codeSet);
    const parentId   = parentCode ? idByCode.get(parentCode) : null;

    if (parentCode && !parentId) {
      // Ini tidak boleh terjadi karena kita sudah urutkan pendek-dahulu
      throw new Error(
        `Induk "${parentCode}" untuk akun "${code}" belum ada di map saat seeding. ` +
        `Pastikan urutan di ACCOUNT_SKELETON konsisten.`,
      );
    }

    const row = await prisma.ledgerAccount.upsert({
      where:  { code },
      update: { name },                           // hanya nama yang di-refresh
      create: {
        code,
        name,
        type:     accountType,
        level,
        parentId: parentId ?? null,
        isTan:    isTan === true,
      },
      select: { id: true },
    });

    idByCode.set(code, row.id);
    count++;
  }

  console.log(`Accounts: ${count} in sync (COA PT TAN erp-tan-felix)`);
  return count;
}
