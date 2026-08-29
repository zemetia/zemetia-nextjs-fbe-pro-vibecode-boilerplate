import { prisma } from '@/lib/prisma';
import { GOLD_BULLION_PURITY_PERCENT, SILVER_BULLION_PURITY_PERCENT } from '@/lib/product';

import type { SeededAccountCode } from './data/accounts';

/**
 * Barang yang ada di hari pertama. Diseed karena baris dokumen pembelian
 * menunjuk `Product` — master yang kosong berarti dokumen pertama tidak punya
 * apa pun untuk dibeli.
 *
 * Mengikuti konvensi data acuan, bukan konvensi izin: **tidak pernah memangkas**
 * dan **tidak pernah menyentuh `isActive`**, karena sebuah barang bisa sudah
 * dipakai baris dokumen, dan menonaktifkannya adalah keputusan perusahaan, bukan
 * keputusan seeder.
 *
 * Akunnya disebut lewat **kode**, bukan id: kode akun stabil lintas reseed dan
 * terbaca oleh manusia, sementara cuid-nya berbeda di tiap database (pelajaran
 * key-vs-id di `PermissionMatrix`, LEARN 2026-08-10). Tipenya `SeededAccountCode`
 * sehingga salah ketik kode akun gagal saat compile, bukan gagal di tengah seed.
 *
 * Wajib jalan **sesudah** `seedAccounts()` — akunnya harus sudah ada barisnya.
 */
const DEFAULT_PRODUCTS = [
  {
    code: 'PRD-0001',
    name: 'Emas Murni Batangan',
    metal: 'GOLD',
    form: 'BULLION',
    defaultPurityPercent: GOLD_BULLION_PURITY_PERCENT,
    purityLocked: true,
    requiresCertificate: true,
    inventoryAccountCode: '11541',
    transitAccountCode: '11551',
    notes: 'Batangan bersertifikat — tiap keping bernomor seri.',
  },
  {
    code: 'PRD-0002',
    name: 'Perak Murni Batangan',
    metal: 'SILVER',
    form: 'BULLION',
    defaultPurityPercent: SILVER_BULLION_PURITY_PERCENT,
    purityLocked: true,
    requiresCertificate: true,
    inventoryAccountCode: '11542',
    transitAccountCode: '11552',
    notes: 'Batangan bersertifikat — tiap keping bernomor seri.',
  },
  {
    code: 'PRD-0003',
    name: 'Perhiasan Emas',
    metal: 'GOLD',
    form: 'JEWELRY',
    defaultPurityPercent: null,
    purityLocked: false,
    requiresCertificate: false,
    inventoryAccountCode: '11516',
    transitAccountCode: '11551',
    notes: 'Perhiasan jadi — kadarnya diuji dan diketik per dokumen.',
  },
  {
    code: 'PRD-0004',
    name: 'Scrap Emas',
    metal: 'GOLD',
    form: 'SCRAP',
    defaultPurityPercent: null,
    purityLocked: false,
    requiresCertificate: false,
    inventoryAccountCode: '11512',
    transitAccountCode: '11551',
    notes: 'Barang tua atau rusak untuk dilebur — kadar hasil uji.',
  },
  // Granul: kadarnya dipatok seperti batangan, tapi **tanpa sertifikat per
  // keping** — sekantong 500 g tidak bisa dibelah jadi keping bernomor seri.
  // Itulah yang memisahkan `purityLocked` dari `requiresCertificate`; sebelum
  // granul masuk, keduanya selalu dijawab bersamaan.
  {
    code: 'PRD-0005',
    name: 'Emas Murni Granul',
    metal: 'GOLD',
    form: 'GRANULE',
    defaultPurityPercent: GOLD_BULLION_PURITY_PERCENT,
    purityLocked: true,
    requiresCertificate: false,
    inventoryAccountCode: '11543',
    transitAccountCode: '11551',
    notes: 'Butiran emas murni — ditakar per gram, tanpa nomor seri.',
  },
  {
    code: 'PRD-0006',
    name: 'Perak Murni Granul',
    metal: 'SILVER',
    form: 'GRANULE',
    defaultPurityPercent: SILVER_BULLION_PURITY_PERCENT,
    purityLocked: true,
    requiresCertificate: false,
    inventoryAccountCode: '11544',
    transitAccountCode: '11552',
    notes: 'Butiran perak murni — ditakar per gram, tanpa nomor seri.',
  },
] as const satisfies readonly {
  code: string;
  name: string;
  metal: 'GOLD' | 'SILVER';
  form: 'BULLION' | 'GRANULE' | 'JEWELRY' | 'SCRAP';
  defaultPurityPercent: number | null;
  purityLocked: boolean;
  requiresCertificate: boolean;
  inventoryAccountCode: SeededAccountCode;
  transitAccountCode: SeededAccountCode;
  notes: string;
}[];

export async function seedProducts(): Promise<void> {
  // Satu query untuk seluruh akun yang dirujuk, bukan satu per produk: kodenya
  // sedikit dan tidak berubah di tengah jalan.
  const codes = [
    ...new Set(
      DEFAULT_PRODUCTS.flatMap((product) => [
        product.inventoryAccountCode,
        product.transitAccountCode,
      ]),
    ),
  ];

  const accounts = await prisma.ledgerAccount.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const idByCode = new Map(accounts.map((account) => [account.code, account.id]));

  for (const code of codes) {
    if (!idByCode.has(code)) {
      throw new Error(
        `Akun ${code} yang dirujuk master barang belum ada — jalankan seedAccounts() lebih dulu.`,
      );
    }
  }

  for (const product of DEFAULT_PRODUCTS) {
    const columns = {
      name: product.name,
      metal: product.metal,
      form: product.form,
      defaultPurityPercent: product.defaultPurityPercent,
      purityLocked: product.purityLocked,
      requiresCertificate: product.requiresCertificate,
      inventoryAccountId: idByCode.get(product.inventoryAccountCode) ?? null,
      transitAccountId: idByCode.get(product.transitAccountCode) ?? null,
      notes: product.notes,
    };

    await prisma.product.upsert({
      where: { code: product.code },
      // Kolom aturannya disegarkan, statusnya tidak — lihat catatan di atas.
      update: columns,
      create: { code: product.code, ...columns },
    });
  }

  console.log(`Seeded ${DEFAULT_PRODUCTS.length} products.`);
}
