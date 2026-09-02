import { prisma } from '@/lib/prisma';

/**
 * Menghidupkan kembali master customer legacy (`CUSTOMERS` di
 * storageService, dipakai bareng oleh `LocalSalesTrading` maupun
 * `ExportSalesOrderPage`/`ExportInvoicing`/`ExportDeliveryOrderPage`) sebagai
 * baris `Partner` di database. Tanpa ini, halaman SO Lokal/Ekspor yang sudah
 * tersambung API tidak punya `partner_id` untuk diisi.
 *
 * Legacy tidak pernah benar-benar menyeed buyer overseas — kombobox "Pilih
 * Buyer Overseas" jatuh ke satu placeholder ("Dubai Gold & Jewelry
 * Wholesalers DMCC", UAE) tiap kali tidak ada customer berkolom `country`.
 * Baris EXPORT di bawah menuntaskan itu dengan buyer sungguhan, memakai pola
 * yang sama dengan supplier impor (`partner.seeder.ts`): USD, negara asli.
 *
 * Idempotent: upsert by `code`, hanya `name` + peran customer yang
 * disegarkan. Wajib jalan sesudah `seedCurrencies()` dan `seedCountries()`.
 */

interface SeedCustomer {
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
  salesTermDays?: number;
  salesPaymentMethod?: 'TRANSFER' | 'CASH' | 'LETTER_OF_CREDIT' | 'CONSIGNMENT';
  notes?: string;
}

const CUSTOMERS: SeedCustomer[] = [
  // ── Lokal (Indonesia) — legacy `CUSTOMERS` di storage.js ────────────────
  {
    code: 'CUST-001',
    name: 'PT Indo Jaya Makmur',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: true,
    phone: '021-5551234',
    email: 'budi@indojaya.co.id',
    addressLine: 'Jl. Sudirman No. 123',
    city: 'Jakarta',
    contactName: 'Budi Santoso',
    salesTermDays: 30,
    salesPaymentMethod: 'TRANSFER',
    notes: 'Pembeli gold bar bulky',
  },
  {
    code: 'CUST-002',
    name: 'CV Mitra Emas Sejahtera',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: false,
    phone: '021-7778888',
    email: 'siti@mitraemas.com',
    addressLine: 'Jl. Gatot Subroto 456',
    city: 'Jakarta',
    contactName: 'Siti Aminah',
    salesTermDays: 60,
    salesPaymentMethod: 'TRANSFER',
    notes: 'Toko emas retail',
  },
  {
    code: 'CUST-003',
    name: 'Toko Emas Berkah',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: false,
    phone: '021-9990000',
    email: 'ahmad@tokoemasberkah.com',
    addressLine: 'Pasar Baru Blok A-12',
    city: 'Jakarta',
    contactName: 'Ahmad Hidayat',
    salesPaymentMethod: 'CASH',
    notes: 'Toko emas - COD only',
  },
  {
    code: 'CUST-004',
    name: 'PT Manufaktur Indonesia',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: true,
    phone: '021-3334455',
    email: 'dewi@manufaktur.co.id',
    addressLine: 'Kawasan Industri MM2100',
    city: 'Bekasi',
    contactName: 'Dewi Kusuma',
    salesTermDays: 30,
    salesPaymentMethod: 'TRANSFER',
    notes: 'Industri elektronik - perlu gold grain',
  },
  {
    code: 'CUST-005',
    name: 'Galeri Perhiasan Mewah',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: true,
    phone: '021-6667788',
    email: 'rudi@galeriperhiasan.com',
    addressLine: 'Plaza Indonesia Lt. 3',
    city: 'Jakarta',
    contactName: 'Rudi Hartono',
    salesTermDays: 30,
    salesPaymentMethod: 'TRANSFER',
    notes: 'Galeri perhiasan high-end',
  },
  {
    code: 'CUST-006',
    name: 'CV Emas Express',
    countryIso2: 'ID',
    currencyCode: 'IDR',
    isPkp: false,
    phone: '021-1112233',
    email: 'andi@emasexpress.com',
    addressLine: 'Jl. MH Thamrin 789',
    city: 'Jakarta',
    contactName: 'Andi Wijaya',
    salesTermDays: 30,
    salesPaymentMethod: 'TRANSFER',
    notes: 'Distributor emas untuk apotek dan pegadaian',
  },
  // ── Ekspor (buyer overseas) ──────────────────────────────────────────────
  {
    code: 'CUST-DMCC-01',
    name: 'Dubai Gold & Jewelry Wholesalers DMCC',
    countryIso2: 'AE',
    currencyCode: 'USD',
    isPkp: false,
    taxNumber: 'DMCC-2019-44107',
    addressLine: 'Gold & Diamond Park, Sheikh Zayed Road',
    city: 'Dubai',
    contactName: 'Import & Purchasing Desk',
    salesPaymentMethod: 'LETTER_OF_CREDIT',
    notes: 'Buyer perhiasan emas 24K & 22K',
  },
  {
    code: 'CUST-SG-01',
    name: 'Golden Heritage Jewellery Pte Ltd',
    countryIso2: 'SG',
    currencyCode: 'USD',
    isPkp: false,
    taxNumber: '200814556D',
    addressLine: '#03-12 People\'s Park Complex, 1 Park Road',
    city: 'Singapore',
    contactName: 'Purchasing Manager',
    salesPaymentMethod: 'TRANSFER',
    notes: 'Buyer perhiasan emas & aksesori',
  },
  {
    code: 'CUST-HK-01',
    name: 'Fortune Jade & Gold Trading Co. Ltd',
    countryIso2: 'HK',
    currencyCode: 'USD',
    isPkp: false,
    taxNumber: '22884561000',
    addressLine: 'Unit 1105, Jewellery Trade Centre, 55 Hankow Road',
    city: 'Kowloon',
    contactName: 'Trading Desk',
    salesPaymentMethod: 'LETTER_OF_CREDIT',
    notes: 'Buyer perhiasan emas untuk pasar Hong Kong & Tiongkok Selatan',
  },
];

export async function seedCustomers(): Promise<void> {
  const [currencies, countries] = await Promise.all([
    prisma.currency.findMany({ select: { code: true } }),
    prisma.country.findMany({ select: { id: true, iso2: true } }),
  ]);
  const currencyCodes = new Set(currencies.map((c) => c.code));
  const countryByIso2 = new Map(countries.map((c) => [c.iso2, c.id]));

  for (const customer of CUSTOMERS) {
    if (!currencyCodes.has(customer.currencyCode)) continue;
    const countryId = countryByIso2.get(customer.countryIso2);
    if (!countryId) continue;

    await prisma.partner.upsert({
      where: { code: customer.code },
      create: {
        code: customer.code,
        name: customer.name,
        type: 'COMPANY',
        isCustomer: true,
        isPkp: customer.isPkp,
        taxNumber: customer.taxNumber,
        phone: customer.phone,
        email: customer.email,
        addressLine: customer.addressLine,
        city: customer.city,
        contactName: customer.contactName,
        countryId,
        currencyCode: customer.currencyCode,
        salesTermDays: customer.salesTermDays,
        salesPaymentMethod: customer.salesPaymentMethod,
        notes: customer.notes,
      },
      update: {
        name: customer.name,
        isCustomer: true,
        isPkp: customer.isPkp,
      },
    });
  }

  return;
}
