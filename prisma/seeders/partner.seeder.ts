import { prisma } from '@/lib/prisma';

/**
 * Menghidupkan kembali master supplier legacy (`DEFAULT_SUPPLIERS` di
 * storageService + daftar supplier impor di LmImportTrading) sebagai baris
 * `Partner` di database. Tanpa ini, halaman PO Impor/Lokal yang sudah
 * disambungkan ke API tidak punya `partner_id` untuk diisi.
 *
 * Idempotent: upsert by `code`, hanya `name` + peran supplier yang
 * disegarkan. Wajib jalan sesudah `seedCurrencies()` dan `seedCountries()`.
 */

interface SeedSupplier {
  code: string;
  name: string;
  countryIso2: string;
  currencyCode: string;
  isPkp: boolean;
  taxNumber?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  contactName?: string;
}

const SUPPLIERS: SeedSupplier[] = [
  // ── Lokal (Indonesia) ────────────────────────────────────────────────────
  {
    code: 'SUPP-ANTAM-01',
    name: 'PT Antam Tbk (UBPP LM Jakarta)',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: true,
    taxNumber: '01.000.013.8-093.000',
    phone: '021-4757108',
    email: 'gold@antam.com',
    addressLine: 'Gedung Graha Dipta Antam, Jl. Pemuda No. 1, Pulogadung',
    city: 'Jakarta Timur',
    contactName: 'Divisi Pemasaran & Penjualan LM',
  },
  {
    code: 'SUPP-PEGADAIAN-01',
    name: 'PT Pegadaian (Persero) Jakarta',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: true,
    taxNumber: '01.000.004.0-093.000',
    phone: '021-3501000',
    addressLine: 'Jl. Kramat Raya No. 162, Senen',
    city: 'Jakarta Pusat',
    contactName: 'Divisi Emas & Logam Mulia',
  },
  {
    code: 'SUPP-UBS-01',
    name: 'PT UBS Fine Gold (Surabaya)',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: true,
    taxNumber: '01.000.013.8-093.000',
    phone: '031-3571234',
    addressLine: 'Jl. Pahlawan No. 32',
    city: 'Surabaya',
    contactName: 'Bagian Penjualan LM',
  },
  {
    code: 'SUPP-TOKOEMAS-01',
    name: 'Toko Emas & Bullion Dealer Jakarta',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: false,
    phone: '021-6001234',
    addressLine: 'Pasar Rawabening, Jatinegara',
    city: 'Jakarta Timur',
  },
  // ── Impor (luar negeri) ──────────────────────────────────────────────────
  {
    code: 'SUPP-YLG-SG',
    name: 'YLG Bullion Singapore Pte Ltd',
    countryIso2: 'SG',
    currencyCode: 'USD',
    isPkp: false,
    taxNumber: '201021341K',
    phone: '+65 6533 6123',
    addressLine: '1 Raffles Place #20-61, One Raffles Place Tower 2',
    city: 'Singapore',
    contactName: 'Bullion Desk',
  },
  {
    code: 'SUPP-VALCAMBI',
    name: 'Valcambi SA Switzerland',
    countryIso2: 'CH',
    currencyCode: 'USD',
    isPkp: false,
    taxNumber: 'CHE-105.815.020',
    addressLine: 'Via Torre 1, 6855 Stabio',
    city: 'Stabio',
    contactName: 'Sales & Trading',
  },
  {
    code: 'SUPP-PAMP',
    name: 'PAMP SA Switzerland',
    countryIso2: 'CH',
    currencyCode: 'USD',
    isPkp: false,
    taxNumber: 'CHE-101.670.305',
    addressLine: 'Via Allegra 4, 6774 Castel San Pietro',
    city: 'Castel San Pietro',
    contactName: 'Refinery Sales',
  },
  {
    code: 'SUPP-METALOR',
    name: 'Metalor Technologies Singapore',
    countryIso2: 'SG',
    currencyCode: 'USD',
    isPkp: false,
    taxNumber: '201012345M',
    addressLine: '51 Changi Business Park Central 2',
    city: 'Singapore',
    contactName: 'Precious Metals Desk',
  },
  {
    code: 'SUPP-SGPMX',
    name: 'Singapore Precious Metals Exchange (SGPMX)',
    countryIso2: 'SG',
    currencyCode: 'USD',
    isPkp: false,
    taxNumber: '201198765K',
    addressLine: '80 Robinson Road #17-02',
    city: 'Singapore',
    contactName: 'Membership & Trading',
  },
  {
    code: 'SUPP-DMCC',
    name: 'Dubai Gold & Commodities Bullion',
    countryIso2: 'AE',
    currencyCode: 'USD',
    isPkp: false,
    taxNumber: 'DMCC-2021-88231',
    addressLine: 'Almas Tower, Jumeirah Lakes Towers',
    city: 'Dubai',
    contactName: 'Bullion Trading',
  },
];

export async function seedPartners(): Promise<void> {
  const [currencies, countries] = await Promise.all([
    prisma.currency.findMany({ select: { code: true } }),
    prisma.country.findMany({ select: { iso2: true } }),
  ]);
  const currencyCodes = new Set(currencies.map((c) => c.code));
  const countryIso2s = new Set(countries.map((c) => c.iso2));

  let upserted = 0;
  for (const supplier of SUPPLIERS) {
    if (!countryIso2s.has(supplier.countryIso2)) continue;
    if (!currencyCodes.has(supplier.currencyCode)) continue;

    const country = await prisma.country.findUnique({
      where: { iso2: supplier.countryIso2 },
      select: { id: true },
    });
    if (!country) continue;

    const existing = await prisma.partner.findUnique({
      where: { code: supplier.code },
      select: { id: true },
    });

    await prisma.partner.upsert({
      where: { code: supplier.code },
      create: {
        code: supplier.code,
        name: supplier.name,
        type: 'COMPANY',
        isSupplier: true,
        isPkp: supplier.isPkp,
        taxNumber: supplier.taxNumber,
        phone: supplier.phone,
        email: supplier.email,
        addressLine: supplier.addressLine,
        city: supplier.city,
        contactName: supplier.contactName,
        countryId: country.id,
        currencyCode: supplier.currencyCode,
      },
      update: {
        name: supplier.name,
        isSupplier: true,
        isPkp: supplier.isPkp,
      },
    });
    upserted += existing ? 0 : 1;
  }

  return;
}
