// Data contoh untuk mencoba layar pembelian import. Dijalankan sendiri
// (`npm run db:demo`), **terpisah dari `seed.ts`** dan tidak pernah ikut
// dipanggil olehnya: seeder mengisi data acuan yang memang harus ada di
// produksi, sedangkan file ini mengarang transaksi — dan transaksi karangan
// tidak boleh punya jalan untuk masuk ke database sungguhan tanpa sengaja.
try {
  process.loadEnvFile();
} catch {
  // Tidak ada .env (mis. CI) — variabelnya diinjeksi langsung.
}

/** Penanda dokumen contoh. Dipakai untuk memeriksa apakah demo sudah pernah jalan. */
const DEMO_INVOICE_PREFIX = 'DEMO-INV-';

async function main() {
  // Diimpor dinamis, sama seperti `seed.ts`: `@/lib/prisma` membaca DATABASE_URL
  // saat module-eval, sedangkan `loadEnvFile()` baru jalan di runtime.
  const { prisma } = await import('@/lib/prisma');
  const db = prisma as any;
  const { computeMetalPurchaseItem } = await import('@/lib/metal-purchase');
  const { fineWeight } = await import('@/lib/metal-lot');
  const { nextPartnerCode } = await import('@/lib/partner-code');
  // Nomornya diambil dari generator yang sama dengan route handler — nomor
  // karangan yang lebih tinggi akan dibaca generator sebagai nomor tertinggi
  // lalu membekukan urutan dokumen sungguhan (bug `SUPP-` vs `MTR-`).
  const { nextMetalPurchaseDeliveryNumber, nextMetalPurchaseNumber } = await import(
    '@/lib/metal-purchase-number'
  );

  /** `YYYY-MM-DD` → kolom `@db.Date`, lewat jalur yang sama dengan route handler. */
  const { toUtcDateOnly } = await import('@/lib/date');

  function daysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  try {
    const existing = await db.metalPurchase?.count?.({
      where: { supplierInvoiceNumber: { startsWith: DEMO_INVOICE_PREFIX } },
    }) ?? 0;

    if (existing > 0) {
      console.log(`Demo sudah ada (${existing} dokumen). Tidak ada yang dibuat.`);
      return;
    }

    const user = await prisma.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!user) throw new Error('Belum ada pengguna. Jalankan `npm run db:seed` dulu.');

    const [gold, silver] = await Promise.all([
      prisma.product.findUnique({ where: { code: 'PRD-0001' } }),
      prisma.product.findUnique({ where: { code: 'PRD-0002' } }),
    ]);
    if (!gold || !silver) {
      throw new Error('Master barang belum ada. Jalankan `npm run db:seed` dulu.');
    }

    // Supplier luar negeri. Asal mitra diturunkan dari negaranya, jadi yang
    // menentukan dokumen ini boleh jadi import adalah barisnya sendiri — bukan
    // flag yang bisa berselisih.
    const country = await prisma.country.findFirst({ where: { iso2: 'CH' } });
    const currency = await prisma.currency.findUnique({ where: { code: 'USD' } });
    if (!country || !currency) {
      throw new Error('Negara/mata uang acuan belum ada. Jalankan `npm run db:seed` dulu.');
    }

    const supplier =
      (await prisma.partner.findFirst({ where: { name: 'Argor-Heraeus SA' } })) ??
      (await prisma.partner.create({
        data: {
          code: await nextPartnerCode(),
          name: 'Argor-Heraeus SA',
          legalName: 'Argor-Heraeus SA',
          type: 'COMPANY',
          isSupplier: true,
          countryId: country.id,
          currencyCode: currency.code,
          city: 'Mendrisio',
          contactName: 'Demo Contact',
          notes: 'Mitra contoh — dibuat oleh `npm run db:demo`.',
        },
      }));

    const goldPurity = Number(gold.defaultPurityPercent ?? 99.99);
    const silverPurity = Number(silver.defaultPurityPercent ?? 99.9);

    /** Satu baris dokumen, dihitung dengan fungsi yang sama persis dengan route handler. */
    // Dokumen contoh semuanya bersatuan gram, jadi berat yang "diketik" dan
    // berat yang tersimpan kebetulan sama angka — tetap lewat fungsi yang sama
    // dengan route handler supaya nilainya tidak pernah dihitung dua cara.
    function line(
      productId: string,
      lineNo: number,
      weightGram: number,
      purityPercent: number,
      pricePerUnit: number,
      certificates: { serialNumber: string; weightGram: number }[],
    ) {
      const totals = computeMetalPurchaseItem({
        weight: weightGram,
        weightUnit: 'GRAM',
        purityPercent,
        // Batangan dan granul: beratnya sudah berat murninya.
        pure: true,
        priceBasis: 'GROSS',
        pricePerUnit,
      });

      return {
        lineNo,
        productId,
        weightGram: totals.weightGram,
        purityPercent,
        fineWeightGram: totals.fineWeightGram,
        priceBasis: 'GROSS' as const,
        pricePerUnit,
        amount: totals.amount,
        certificates: { create: certificates },
      };
    }

    /** Σ nilai baris — kolom `goodsAmount` tidak pernah dikirim client, selalu dihitung. */
    function goodsAmount(lines: { amount: number }[]): number {
      return Math.round(lines.reduce((total, item) => total + item.amount, 0) * 100) / 100;
    }

    // 1 — draft, satu batang 1 kg yang belum dikonfirmasi.
    const draftLines = [
      line(gold.id, 1, 1000, goldPurity, 85, [
        { serialNumber: 'AH-2026-100001', weightGram: 1000 },
      ]),
    ];

    const draft = await db.metalPurchase.create({
      data: {
        number: await nextMetalPurchaseNumber(toUtcDateOnly(daysAgo(10)), 'PO'),
        type: 'IMPORT',
        status: 'DRAFT',
        paymentType: 'PO',
        partnerId: supplier.id,
        date: toUtcDateOnly(daysAgo(10)),
        supplierInvoiceNumber: `${DEMO_INVOICE_PREFIX}1001`,
        currencyCode: currency.code,
        goodsAmount: goodsAmount(draftLines),
        notes: 'Dokumen contoh — masih draft, kepingnya baru satu batang.',
        createdById: user.id,
        items: { create: draftLines },
      },
    });

    // 2 — terkonfirmasi, dua logam dalam satu dokumen (emas + perak).
    const mixedLines = [
      line(
        gold.id,
        1,
        500,
        goldPurity,
        86.5,
        Array.from({ length: 5 }, (_, index) => ({
          serialNumber: `AH-2026-2000${index + 1}`,
          weightGram: 100,
        })),
      ),
      line(
        silver.id,
        2,
        5000,
        silverPurity,
        1.15,
        Array.from({ length: 5 }, (_, index) => ({
          serialNumber: `AH-AG-2026-300${index + 1}`,
          weightGram: 1000,
        })),
      ),
    ];

    const mixed = await db.metalPurchase.create({
      data: {
        number: await nextMetalPurchaseNumber(toUtcDateOnly(daysAgo(7)), 'PO'),
        type: 'IMPORT',
        status: 'CONFIRMED',
        paymentType: 'PO',
        partnerId: supplier.id,
        date: toUtcDateOnly(daysAgo(7)),
        supplierInvoiceNumber: `${DEMO_INVOICE_PREFIX}1002`,
        currencyCode: currency.code,
        goodsAmount: goodsAmount(mixedLines),
        notes: 'Dokumen contoh — emas dan perak dalam satu invoice, barangnya belum datang.',
        createdById: user.id,
        confirmedById: user.id,
        confirmedAt: new Date(),
        items: { create: mixedLines },
      },
    });

    // 3 — terkonfirmasi dan sudah punya penerimaan draft berikut biayanya.
    const partialLines = [
      line(gold.id, 1, 2500, goldPurity, 84.25, [
        { serialNumber: 'AH-2026-400001', weightGram: 1000 },
        { serialNumber: 'AH-2026-400002', weightGram: 1000 },
        { serialNumber: 'AH-2026-400003', weightGram: 500 },
      ]),
    ];

    const partial = await db.metalPurchase.create({
      data: {
        number: await nextMetalPurchaseNumber(toUtcDateOnly(daysAgo(3)), 'PO'),
        type: 'IMPORT',
        status: 'CONFIRMED',
        paymentType: 'PO',
        partnerId: supplier.id,
        date: toUtcDateOnly(daysAgo(3)),
        supplierInvoiceNumber: `${DEMO_INVOICE_PREFIX}1003`,
        currencyCode: currency.code,
        goodsAmount: goodsAmount(partialLines),
        notes: 'Dokumen contoh — kiriman pertamanya sudah dicatat sebagai draft penerimaan.',
        createdById: user.id,
        confirmedById: user.id,
        confirmedAt: new Date(),
        items: { create: partialLines },
      },
      include: { items: { include: { certificates: true } } },
    });

    const item = partial.items[0];
    const firstBar = item?.certificates.find((certificate: any) => certificate.serialNumber.endsWith('1'));
    if (!item || !firstBar) throw new Error('Baris contoh gagal dibuat.');

    const received = 1000;
    const delivery = await db.metalPurchaseDelivery.create({
      data: {
        number: await nextMetalPurchaseDeliveryNumber(toUtcDateOnly(daysAgo(1))),
        purchaseId: partial.id,
        status: 'DRAFT',
        date: toUtcDateOnly(daysAgo(1)),
        trackingNumber: 'DEMO-AWB-77120',
        receivedByName: 'Petugas Gudang',
        notes: 'Penerimaan contoh — satu batang dari tiga.',
        createdById: user.id,
        lines: {
          create: [
            {
              purchaseItemId: item.id,
              weightGram: received,
              purityPercent: goldPurity,
              fineWeightGram: fineWeight(received, goldPurity, { pure: true }),
            },
          ],
        },
        // Tiga biaya yang memang hampir selalu ada di kiriman import.
        charges: {
          create: [
            { lineNo: 1, name: 'Bea masuk', amountIdr: 12_500_000 },
            { lineNo: 2, name: 'Freight & asuransi', amountIdr: 3_200_000 },
            { lineNo: 3, name: 'Biaya kurir', amountIdr: 750_000 },
          ],
        },
      },
      include: { lines: true },
    });

    // Keping yang ikut datang ditautkan ke baris penerimaannya — satu keping
    // fisik datang tepat sekali.
    await db.metalPurchaseItemCertificate.update({
      where: { id: firstBar.id },
      data: { deliveryLineId: delivery.lines[0]?.id },
    });

    console.log(
      `Demo dibuat: ${draft.number} (draft), ${mixed.number} (terkonfirmasi), ${partial.number} (+ penerimaan ${delivery.number}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export {};
