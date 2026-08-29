// Storage Service Layer
// Clean ES module abstraction wrapping data persistence, sequencers, and SAK EMKM business entities

export const KEYS = {
  JOURNAL_ENTRIES: 'erp_journal_entries',
  CHART_OF_ACCOUNTS: 'erp_chart_of_accounts',
  PURCHASE_ORDERS: 'erp_purchase_orders',
  CUSTOMERS: 'erp_customers',
  SUPPLIERS: 'erp_suppliers',
  ITEMS: 'erp_items',
  WAREHOUSES: 'erp_warehouses',
  VOUCHERS: 'erp_vouchers',
  CHEQUES: 'erp_cheques',
  CHEQUE_BOOKS: 'pttan_cheque_books',
  EXPORT_INVOICES: 'pttan_export_invoices',
  EXPORT_SALES_ORDERS: 'pttan_export_sales_orders',
  EXPORT_DELIVERY_ORDERS: 'pttan_export_delivery_orders',
  GOODS_RECEIPTS: 'pttan_goods_receipts',
  LOCAL_PURCHASES: 'pttan_local_purchases',
  SCRAP_PURCHASES: 'pttan_scrap_purchases',
  PRODUCTION_SPK: 'pttan_production_spk',
  PRODUCTION_SETTLEMENTS: 'pttan_production_settlements',
  PURCHASE_REQUESTS: 'pttan_purchase_requests',
  VAULT_TRANSFERS: 'pttan_vault_transfers',
  COMPANY_PROFILE: 'pttan_company_profile',
  MASTER_FINISHED_GOODS: 'pttan_master_finished_goods',
  SILVER_TRANSACTIONS: 'pttan_silver_transactions',
  LOCAL_SALES: 'pttan_local_sales',
  LOCAL_SALES_ORDERS: 'pttan_local_sales_orders',
  LOCAL_DELIVERY_ORDERS: 'pttan_local_delivery_orders',
  LOCAL_INVOICES: 'pttan_local_invoices'
};

const getGlobalStorage = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage;
  }
  return null;
};

export const getStorage = (key, defaultValue = null) => {
  const storage = getGlobalStorage();
  if (storage && typeof storage.get === 'function') {
    const val = storage.get(key);
    return val !== undefined && val !== null ? val : defaultValue;
  }
  return defaultValue;
};

export const setStorage = async (key, value, silent = false) => {
  const storage = getGlobalStorage();
  if (storage && typeof storage.set === 'function') {
    return await storage.set(key, value, silent);
  }
  return false;
};

// Tipe dokumen di halaman React -> kode sequencer di getTransactionTypes() (data/storage.js).
// Kode di sisi kiri harus persis sama dengan argumen yang dipakai halaman.
const REF_TYPE_CODES = {
  journal: 'JRN',
  po: 'PUR',
  pr: 'PRQ',
  grn: 'GRN',
  spk: 'SPK',
  voucher: 'VCH',
  invoice: 'SAL'
};

export const getNextReferenceNumber = async (type) => {
  const code = REF_TYPE_CODES[type];
  if (!code) {
    console.error(`[storageService] Tipe dokumen '${type}' tidak terdaftar di REF_TYPE_CODES — nomor tidak diterbitkan.`);
    return null;
  }

  const year = new Date().getFullYear();
  const storage = getGlobalStorage();
  if (storage && typeof storage.getNextReferenceNumber === 'function') {
    // Storage mengembalikan 'JRN-000019'; counter-nya atomik (Firestore + fallback lokal)
    const raw = await storage.getNextReferenceNumber(code);
    const seq = parseInt(String(raw || '').split('-').pop(), 10);
    if (Number.isFinite(seq)) {
      return `${code}-${year}-${String(seq).padStart(4, '0')}`;
    }
    console.error(`[storageService] Sequencer menolak kode '${code}' — nomor tidak diterbitkan.`);
    return null;
  }

  return `${code}-${year}-${Date.now().toString().slice(-4)}`;
};

// ==========================================
// CHART OF ACCOUNTS (COA)
// ==========================================

export const getCOA = () => {
  const storage = getGlobalStorage();
  if (storage) {
    return storage.get(KEYS.CHART_OF_ACCOUNTS) || (typeof storage.getDefaultChartOfAccounts === 'function' ? storage.getDefaultChartOfAccounts() : []);
  }
  return [];
};

export const saveCOA = async (accounts) => {
  return await setStorage(KEYS.CHART_OF_ACCOUNTS, accounts, true);
};

export const resetToDefaultCOA = async () => {
  const storage = getGlobalStorage();
  if (storage && typeof storage.getDefaultChartOfAccounts === 'function') {
    const officialCoa = storage.getDefaultChartOfAccounts();
    await saveCOA(officialCoa);
    return officialCoa;
  }
  return getCOA();
};

export const addCOAAccount = async (newAccount) => {
  const accounts = getCOA();
  if (accounts.some(a => a.code === newAccount.code)) {
    return { success: false, error: 'Kode akun sudah digunakan' };
  }
  accounts.push(newAccount);
  accounts.sort((a, b) => a.code.localeCompare(b.code));
  await saveCOA(accounts);
  return { success: true };
};

// ==========================================
// MASTER DATA (Items, FG, Customers, Suppliers)
// ==========================================

export const getMasterItems = () => {
  const storage = getGlobalStorage();
  if (storage && typeof storage.getItems === 'function') {
    return storage.getItems() || [];
  }
  return getStorage(KEYS.ITEMS, []);
};

export const saveMasterItem = async (item) => {
  const items = getMasterItems();
  items.unshift(item);
  return await setStorage(KEYS.ITEMS, items);
};

export const saveMasterItems = async (items) => {
  return await setStorage(KEYS.ITEMS, items);
};

export const getFinishedGoods = () => {
  return getStorage(KEYS.MASTER_FINISHED_GOODS, [
    { id: 'JWL-RNG-750-001', sku: 'JWL-RNG-750-001', name: 'Dubai Arabian Casting Ring', type: 'Cincin (Ring)', karat: '750', purity: 75.0, goldColor: 'Yellow Gold', stdWeightGram: 4.50, laborFeeIDRPerGram: 15000, hsCode: '7113.19.90', inventoryAccount: '1160' },
    { id: 'JWL-CHN-700-005', sku: 'JWL-CHN-700-005', name: 'Italian Hollow Rope Chain', type: 'Kalung (Necklace)', karat: '700', purity: 70.0, goldColor: 'Rose Gold', stdWeightGram: 12.00, laborFeeIDRPerGram: 18000, hsCode: '7113.19.90', inventoryAccount: '1160' },
    { id: 'JWL-BNG-375-010', sku: 'JWL-BNG-375-010', name: 'Stamped Diamond Cut Bangle', type: 'Gelang (Bangle)', karat: '375', purity: 37.5, goldColor: 'White Gold', stdWeightGram: 8.50, laborFeeIDRPerGram: 12000, hsCode: '7113.19.90', inventoryAccount: '1160' }
  ]);
};

export const saveFinishedGood = async (fg) => {
  const list = getFinishedGoods();
  list.unshift(fg);
  return await setStorage(KEYS.MASTER_FINISHED_GOODS, list);
};

export const saveFinishedGoods = async (list) => {
  return await setStorage(KEYS.MASTER_FINISHED_GOODS, list);
};

export const getDefaultCustomers = () => [
  {
    id: 'CUST-LOKAL-01',
    name: 'Toko Emas Gadjah Berlian (Surabaya)',
    code: 'CUST-001',
    type: 'LOCAL_RETAIL_WHOLESALE',
    contactPerson: 'Bpk. Hendra Wijaya',
    phone: '0812-3456-7890',
    email: 'gadjahberlian.sby@gmail.com',
    address: 'Jl. Pasar Atom Mall No. 12, Surabaya, Jawa Timur',
    taxFacility: 'NON_BKP_BEBAS_PPN_PMK48_2023',
    status: 'ACTIVE'
  },
  {
    id: 'CUST-LOKAL-02',
    name: 'PT Mulia Jaya Abadi (Jakarta)',
    code: 'CUST-002',
    type: 'LOCAL_CORPORATE',
    contactPerson: 'Ibu Ratna Susanti',
    phone: '0811-9876-5432',
    email: 'procurement@muliajaya.co.id',
    address: 'Kawasan Industri Pulogadung Blok B3, Jakarta Timur',
    taxFacility: 'NON_BKP_BEBAS_PPN_PMK48_2023',
    status: 'ACTIVE'
  },
  {
    id: 'CUST-EXP-01',
    name: 'Dubai Gold & Jewelry Wholesalers DMCC',
    code: 'CUST-EXP-001',
    type: 'EXPORT_OVERSEAS',
    country: 'United Arab Emirates (UAE)',
    contactPerson: 'Mr. Tariq Al-Mansoor',
    phone: '+971-4-423-8899',
    email: 'trading@dubaigold-dmcc.ae',
    address: 'Almas Tower Floor 34, Jumeirah Lakes Towers, Dubai, UAE',
    taxFacility: 'PPN_0_PERSEN_PASAL_4B_UU_PPN',
    bankAccountUSD: 'BCA-USD-001-998811',
    status: 'ACTIVE'
  },
  {
    id: 'CUST-EXP-02',
    name: 'Al-Etihad Gold Refinery DMCC',
    code: 'CUST-EXP-002',
    type: 'EXPORT_OVERSEAS',
    country: 'United Arab Emirates (UAE)',
    contactPerson: 'Mr. Khalid bin Saeed',
    phone: '+971-4-887-2211',
    email: 'orders@aletihadgold.com',
    address: 'Gold & Diamond Park, Building 4, Sheikh Zayed Road, Dubai, UAE',
    taxFacility: 'PPN_0_PERSEN_PASAL_4B_UU_PPN',
    status: 'ACTIVE'
  }
];

export const getCustomers = () => {
  const data = getStorage(KEYS.CUSTOMERS, []);
  return (data && data.length > 0) ? data : getDefaultCustomers();
};

export const saveCustomer = async (cust) => {
  const customers = getCustomers();
  customers.unshift(cust);
  return await setStorage(KEYS.CUSTOMERS, customers);
};

export const saveCustomers = async (customers) => {
  return await setStorage(KEYS.CUSTOMERS, customers);
};

export const getDefaultSuppliers = () => [
  {
    id: 'SUPP-PGD-01',
    name: 'PT Pegadaian (Persero) Jakarta',
    code: 'SUPP-001',
    category: 'LM_LOKAL',
    contactPerson: 'Bpk. Budi Santoso',
    phone: '021-3155550',
    email: 'treasury@pegadaian.co.id',
    address: 'Jl. Kramat Raya No. 162, Senen, Jakarta Pusat 10430',
    bankAccount: 'Bank BCA: 001-234-5678 a/n PT Pegadaian (Persero)',
    status: 'ACTIVE'
  },
  {
    id: 'SUPP-ANTAM-01',
    name: 'PT Antam Tbk (UBPP Logam Mulia)',
    code: 'SUPP-002',
    category: 'LM_LOKAL_SILVER',
    contactPerson: 'Ibu Dian Safitri (Sales Treasury)',
    phone: '021-4757108',
    email: 'ubpplm.sales@antam.com',
    address: 'Jl. Pemuda No. 1, Pulogadung, Jakarta Timur 13210',
    bankAccount: 'Bank Mandiri: 123-00-998877 a/n PT ANTAM Tbk',
    status: 'ACTIVE'
  },
  {
    id: 'SUPP-YLG-01',
    name: 'YLG Bullion Singapore Pte Ltd',
    code: 'SUPP-EXP-001',
    category: 'LM_IMPORT',
    country: 'Singapore',
    contactPerson: 'Mr. William Tan',
    phone: '+65-6535-9988',
    email: 'dealing@ylgbullion.com.sg',
    address: '10 Collyer Quay, #10-01 Ocean Financial Centre, Singapore 049315',
    bankAccount: 'DBS Bank Singapore: 003-902-8811 (USD Currency)',
    status: 'ACTIVE'
  },
  {
    id: 'SUPP-VAL-01',
    name: 'Valcambi SA Switzerland',
    code: 'SUPP-EXP-002',
    category: 'LM_IMPORT',
    country: 'Switzerland',
    contactPerson: 'Mr. Marc Bernasconi',
    phone: '+41-91-695-5111',
    email: 'trade@valcambi.com',
    address: 'Via Passeggiata, 6828 Balerna, Ticino, Switzerland',
    bankAccount: 'UBS Switzerland: CH93-0023-9988-1122-USD',
    status: 'ACTIVE'
  },
  {
    id: 'SUPP-SCRAP-01',
    name: 'Toko Emas Mitra Sejahtera',
    code: 'SUPP-SCRAP-001',
    category: 'SCRAP_LEBURAN',
    contactPerson: 'Bpk. Hendra Gunawan',
    phone: '0813-8899-7766',
    email: 'mitrasejahtera.gold@yahoo.com',
    address: 'Pasar Cikini Gold Center Lt. 1 No. 45, Jakarta Pusat',
    bankAccount: 'Tunai Kas / Transfer BCA: 233-112-9988',
    status: 'ACTIVE'
  },
  {
    id: 'SUPP-KIMIA-01',
    name: 'PT Surya Kimia Abadi',
    code: 'SUPP-MAT-001',
    category: 'CHEMICALS_REFINERY',
    contactPerson: 'Bpk. Surya Wijaya',
    phone: '021-6598811',
    email: 'suryakimia.abadi@gmail.com',
    address: 'Jl. Pangeran Jayakarta No. 88, Jakarta Barat',
    bankAccount: 'Bank BCA: 088-234-9911',
    status: 'ACTIVE'
  }
];

export const getSuppliers = () => {
  const data = getStorage(KEYS.SUPPLIERS, []);
  return (data && data.length > 0) ? data : getDefaultSuppliers();
};

export const saveSupplier = async (supp) => {
  const suppliers = getSuppliers();
  suppliers.unshift(supp);
  return await setStorage(KEYS.SUPPLIERS, suppliers);
};

export const saveSuppliers = async (suppliers) => {
  return await setStorage(KEYS.SUPPLIERS, suppliers);
};

// ==========================================
// JOURNAL ENTRIES & FINANCIAL POSTINGS (SAK EMKM)
// ==========================================

export const getDefaultJournalEntries = () => [
  {
    id: 1723700001,
    entryNumber: 'JRN-2026-0001',
    date: '2026-08-01',
    description: 'Setoran Modal Awal Pemilik PT Triliun Anugrah Nusantara (Kas, Bank IDR, & Bank USD)',
    lines: [
      { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 5000000000, credit: 0, description: 'Setoran Modal Bank BCA IDR' },
      { accountCode: '1111-USD', accountName: 'Bank BCA Devisa USD', debit: 3000000000, credit: 0, description: 'Setoran Modal Bank BCA Devisa USD ($184,615.38 @ Rp 16,250)' },
      { accountCode: '1110', accountName: 'Kas Kecil (Petty Cash)', debit: 1000000000, credit: 0, description: 'Setoran Kas Tunai Brankas Operasional' },
      { accountCode: '3100', accountName: 'Modal Saham', debit: 0, credit: 9000000000, description: 'Modal Disetor Pemilik PT TAN' }
    ],
    createdAt: '2026-08-01T08:00:00.000Z'
  },
  {
    id: 1723700002,
    entryNumber: 'JRN-2026-0002',
    date: '2026-08-11',
    description: 'Pembayaran PO Emas Lokal (PO-LOK-2026-001) - PT Pegadaian Jakarta (1000g @ Rp 1.300.000) [Tahap 1: Kasir -> Kurir]',
    lines: [
      { accountCode: '1159', accountName: 'Persediaan Emas Dalam Perjalanan (Transit Kurir)', debit: 1300000000, credit: 0, description: 'Emas Dibawa Kurir Bpk. Budi Santoso (Ref: PO-LOK-2026-001)' },
      { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: 1300000000, description: 'Transfer BCA Pelunasan PO Pegadaian' }
    ],
    createdAt: '2026-08-11T10:00:00.000Z'
  },
  {
    id: 1723700003,
    entryNumber: 'JRN-2026-0003',
    date: '2026-08-11',
    description: 'Kedatangan Fisik Emas Lokal (PO-LOK-2026-001) Tiba di Vault Utama (1000g Antam Seri ANT-991100) [Tahap 2: Verifikasi 4 TTD]',
    lines: [
      { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)', debit: 1300000000, credit: 0, description: 'Fisik Emas Masuk Vault Utama (1000g Antam Seri ANT-991100)' },
      { accountCode: '1159', accountName: 'Persediaan Emas Dalam Perjalanan (Transit Kurir)', debit: 0, credit: 1300000000, description: 'Penyelesaian Status Transit Kurir' }
    ],
    createdAt: '2026-08-11T14:30:00.000Z'
  },
  {
    id: 1723700004,
    entryNumber: 'JRN-2026-0004',
    date: '2026-08-11',
    description: 'Pembayaran PO Emas Lokal (PO-LOK-2026-002) - PT Antam Tbk (500g @ Rp 1.310.000) [Tahap 1: Kasir -> Kurir]',
    lines: [
      { accountCode: '1159', accountName: 'Persediaan Emas Dalam Perjalanan (Transit Kurir)', debit: 655000000, credit: 0, description: 'Emas Dibawa Kurir Bpk. Budi Santoso (Ref: PO-LOK-2026-002)' },
      { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: 655000000, description: 'Transfer BCA Pelunasan PO Antam' }
    ],
    createdAt: '2026-08-11T11:00:00.000Z'
  },
  {
    id: 1723700005,
    entryNumber: 'JRN-2026-0005',
    date: '2026-08-11',
    description: 'Kedatangan Fisik Emas Lokal (PO-LOK-2026-002) Tiba di Vault Utama (500g Antam Seri ANT-992201) [Tahap 2: Verifikasi 4 TTD]',
    lines: [
      { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)', debit: 655000000, credit: 0, description: 'Fisik Emas Masuk Vault Utama (500g Antam Seri ANT-992201)' },
      { accountCode: '1159', accountName: 'Persediaan Emas Dalam Perjalanan (Transit Kurir)', debit: 0, credit: 655000000, description: 'Penyelesaian Status Transit Kurir' }
    ],
    createdAt: '2026-08-11T16:00:00.000Z'
  },
  {
    id: 1723700006,
    entryNumber: 'JRN-2026-0006',
    date: '2026-08-10',
    description: 'Pembayaran Uang Muka Impor PO Emas (PO-IMP-2026-001) - YLG Bullion Singapore (1000g / 32.1507 oz @ $2,400 = $77,161.79 USD @ Rp 16,250)',
    lines: [
      { accountCode: '1135', accountName: 'Uang Muka Impor / Pembelian Valas', debit: 1253879116, credit: 0, description: 'Uang Muka Impor 1000g Emas Batangan YLG Singapore' },
      { accountCode: '1111-USD', accountName: 'Bank BCA Devisa USD', debit: 0, credit: 1253879116, description: 'Pengeluaran Valas USD ($77,161.79 @ Rp 16,250)' }
    ],
    createdAt: '2026-08-10T09:00:00.000Z'
  },
  {
    id: 1723700007,
    entryNumber: 'JRN-2026-0007',
    date: '2026-08-10',
    description: 'Pembayaran Pajak PPh 22 Impor (0,25%) PO-IMP-2026-001 ke Kas Negara / DJBC (ID Billing: 0881-9922-1100)',
    lines: [
      { accountCode: '1135', accountName: 'Uang Muka Impor / Pembelian Valas', debit: 3134698, credit: 0, description: 'Pajak PPh 22 Impor Logam Mulia 0.25% (Landed Cost Component)' },
      { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: 3134698, description: 'Pembayaran Kas Negara ID Billing DJBC' }
    ],
    createdAt: '2026-08-10T10:30:00.000Z'
  },
  {
    id: 1723700008,
    entryNumber: 'JRN-2026-0008',
    date: '2026-08-10',
    description: 'Penerimaan Fisik TTB Emas Impor (GRN-2026-001) Masuk ke Vault Impor (1000g Valcambi Cast Bar Seri VAL-99120, PIB 001234/PIB/KPU-TP/2026)',
    lines: [
      { accountCode: '1158', accountName: 'Persediaan Logam Mulia Impor', debit: 1253879116, credit: 0, description: 'Penerimaan Fisik Emas Impor di Vault Impor (Akun 1158)' },
      { accountCode: '1135', accountName: 'Uang Muka Impor / Pembelian Valas', debit: 0, credit: 1253879116, description: 'Penutupan Uang Muka Impor setelah Fisik Diterima' }
    ],
    createdAt: '2026-08-10T15:00:00.000Z'
  },
  {
    id: 1723700009,
    entryNumber: 'JRN-2026-0009',
    date: '2026-08-11',
    description: 'Pembelian Scrap Emas (NOTA-SCRAP-2026-001) - Toko Emas Mitra Sejahtera (500g @ 75.5% XRF = 377.5g Fine Gold @ Rp 1.200.000)',
    lines: [
      { accountCode: '1152', accountName: 'Persediaan Emas Scrap & Leburan', debit: 453000000, credit: 0, description: 'Persediaan Emas Scrap Masuk Vault Scrap (Akun 1152)' },
      { accountCode: '1110', accountName: 'Kas Kecil (Petty Cash)', debit: 0, credit: 453000000, description: 'Pembayaran Kas Tunai Pembelian Scrap' }
    ],
    createdAt: '2026-08-11T12:00:00.000Z'
  },
  {
    id: 1723700010,
    entryNumber: 'JRN-2026-0010',
    date: '2026-08-11',
    description: 'Penerimaan Granul Perak Murni 99.9% (SLV-REC-000101) - PT Antam Tbk (5000g @ Rp 16.500)',
    lines: [
      { accountCode: '1153', accountName: 'Persediaan Silver & Logam Mulia Lain', debit: 82500000, credit: 0, description: 'Persediaan Perak Murni Masuk Vault Perak (Akun 1153)' },
      { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: 82500000, description: 'Transfer BCA Pembelian Granul Perak' }
    ],
    createdAt: '2026-08-11T13:00:00.000Z'
  },
  {
    id: 1723700011,
    entryNumber: 'JRN-2026-0011',
    date: '2026-08-12',
    description: 'Penambahan Perak Alloy ke Batangan Emas (ALLOY-SLV-000101) - 100g Perak @ Rp 16.500 ke Vault Utama 1157',
    lines: [
      { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)', debit: 1650000, credit: 0, description: 'Kenaikan Nilai Emas Batangan Pasca Pencampuran Alloy' },
      { accountCode: '1153', accountName: 'Persediaan Silver & Logam Mulia Lain', debit: 0, credit: 1650000, description: 'Pengurangan Fisik Perak di Vault Perak (Akun 1153)' }
    ],
    createdAt: '2026-08-12T09:30:00.000Z'
  },
  {
    id: 1723700012,
    entryNumber: 'JRN-2026-0012',
    date: '2026-08-12',
    description: 'Pengeluaran Bahan Baku SPK Produksi (SPK-PROD-2026-001) - 500g Emas Murni @ Rp 1.300.000 ke Vault WIP Produksi (11502)',
    lines: [
      { accountCode: '11502', accountName: 'Persediaan Emas WIP (Produksi Perhiasan)', debit: 650000000, credit: 0, description: 'Pengeluaran Emas Murni untuk Cincin Dubai Karat 750' },
      { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)', debit: 0, credit: 650000000, description: 'Pengurangan Stok Vault Utama untuk Produksi' }
    ],
    createdAt: '2026-08-12T10:00:00.000Z'
  },
  {
    id: 1723700013,
    entryNumber: 'JRN-2026-0013',
    date: '2026-08-14',
    description: 'Settlement Produksi Perhiasan SPK-PROD-2026-001 (JO-2026-001) - Hasil Jadi 490g [1160], Retur Scrap 8g [1152], Susut 2g [5120], Ongkos Tukang Rp 7.500.000',
    lines: [
      { accountCode: '1160', accountName: 'Persediaan Perhiasan Siap Ekspor', debit: 644500000, credit: 0, description: 'Perhiasan Emas 18K Jadi (490g @ Rp 1.300.000 + Ongkos Kerja Rp 7.500.000)' },
      { accountCode: '1152', accountName: 'Persediaan Emas Scrap & Leburan', debit: 9600000, credit: 0, description: 'Pengembalian Scrap Workshop (8g @ Rp 1.200.000)' },
      { accountCode: '5141', accountName: 'Susut Produksi Normal (Yield Loss Lebur)', debit: 3400000, credit: 0, description: 'Beban Susut Lebur (2g @ Rp 1.300.000 + Varians Scrap 8g @ Rp 100.000)' },
      { accountCode: '11502', accountName: 'Persediaan Emas WIP (Produksi Perhiasan)', debit: 0, credit: 650000000, description: 'Penyelesaian Saldo WIP 500g Bahan Baku Awal' },
      { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: 7500000, description: 'Pembayaran Ongkos Kerja Workshop Pengrajin' }
    ],
    createdAt: '2026-08-14T17:00:00.000Z'
  },
  {
    id: 1723700014,
    entryNumber: 'JRN-2026-0014',
    date: '2026-08-16',
    description: 'Surat Jalan Pengeluaran Emas Lokal (SJ-LOKAL-2026-001) - 1000g Antam dari Vault 1157 ke Toko Emas Gadjah Berlian (HPP Penjualan)',
    lines: [
      { accountCode: '5114', accountName: 'HPP - Logam Mulia Antam', debit: 1300000000, credit: 0, description: 'Beban Pokok Penjualan Emas Batangan 1000g' },
      { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)', debit: 0, credit: 1300000000, description: 'Pengeluaran Fisik Emas dari Vault Utama' }
    ],
    createdAt: '2026-08-16T11:00:00.000Z'
  },
  {
    id: 1723700015,
    entryNumber: 'JRN-2026-0015',
    date: '2026-08-16',
    description: 'Faktur Penjualan Emas Lokal Tunai (INV-LOKAL-2026-001) - Toko Emas Gadjah Berlian (1000g @ Rp 1.380.000 = Rp 1.380.000.000, Bebas PPN PMK 48/2023)',
    lines: [
      { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 1380000000, credit: 0, description: 'Penerimaan Kasir Transfer BCA Penjualan Tunai Lunas' },
      { accountCode: '4111', accountName: 'Penjualan Logam Mulia Lokal (Bebas PPN)', debit: 0, credit: 1380000000, description: 'Pendapatan Penjualan Emas Lokal PMK 48/2023 Non-BKP' }
    ],
    createdAt: '2026-08-16T11:30:00.000Z'
  },
  {
    id: 1723700016,
    entryNumber: 'JRN-2026-0016',
    date: '2026-08-15',
    description: 'Surat Jalan Ekspor Kargo Brinks (DO-EXP-2026-001) - 450g Perhiasan 18K ke Dubai Gold DMCC (HPP Ekspor)',
    lines: [
      { accountCode: '5115', accountName: 'Harga Pokok Penjualan (HPP Ekspor)', debit: 585000000, credit: 0, description: 'HPP Ekspor 450g Perhiasan Dubai Karat 750' },
      { accountCode: '1160', accountName: 'Persediaan Perhiasan Siap Ekspor', debit: 0, credit: 585000000, description: 'Pengeluaran Fisik Perhiasan dari Brankas Ekspor' }
    ],
    createdAt: '2026-08-15T14:00:00.000Z'
  },
  {
    id: 1723700017,
    entryNumber: 'JRN-2026-0017',
    date: '2026-08-15',
    description: 'Faktur Ekspor Komersial USD (INV-EXP-2026-001) - Dubai Gold DMCC (450g @ $85 = $38,250 USD @ Rp 16,250 = Rp 621.562.500, PPN 0% Pasal 4B)',
    lines: [
      { accountCode: '1132', accountName: 'Piutang Usaha Ekspor (USD)', debit: 621562500, credit: 0, description: 'Piutang Ekspor Devisa USD ($38,250 @ Rp 16,250)' },
      { accountCode: '4116', accountName: 'Penjualan Perhiasan Emas Ekspor (PPN 0%)', debit: 0, credit: 621562500, description: 'Penjualan Ekspor Perhiasan Emas Bebas PPN (0%)' }
    ],
    createdAt: '2026-08-15T14:30:00.000Z'
  },
  {
    id: 1723700018,
    entryNumber: 'JRN-2026-0018',
    date: '2026-08-18',
    description: 'Pelunasan Devisa DHE Ekspor (BBM-2026-003) - Dubai Gold DMCC ($38,250 USD = Rp 621.562.500 ke Rekening Devisa Bank BCA USD)',
    lines: [
      { accountCode: '1111-USD', accountName: 'Bank BCA Devisa USD', debit: 621562500, credit: 0, description: 'Penerimaan Devisa Hasil Ekspor (DHE) BCA USD' },
      { accountCode: '1132', accountName: 'Piutang Usaha Ekspor (USD)', debit: 0, credit: 621562500, description: 'Pelunasan Piutang Ekspor INV-EXP-2026-001' }
    ],
    createdAt: '2026-08-18T10:00:00.000Z'
  }
];

export const getJournalEntries = () => {
  const data = getStorage(KEYS.JOURNAL_ENTRIES, []);
  return (data && data.length > 0) ? data : getDefaultJournalEntries();
};

export const saveJournalEntries = async (journals) => {
  return await setStorage(KEYS.JOURNAL_ENTRIES, journals);
};

export const addJournalEntry = async (entry) => {
  const journals = getJournalEntries();
  const entryNum = entry.entryNumber || await getNextReferenceNumber('journal');
  const newEntry = {
    id: entry.id || Date.now(),
    entryNumber: entryNum,
    date: entry.date || new Date().toISOString().split('T')[0],
    description: entry.description || 'Jurnal Penyesuaian',
    lines: entry.lines || [],
    createdAt: entry.createdAt || new Date().toISOString()
  };
  journals.unshift(newEntry);
  await saveJournalEntries(journals);
  return { success: true, entry: newEntry };
};

// ==========================================
// PURCHASE ORDERS (IMPORT & LOCAL)
// ==========================================

export const getDefaultPurchaseOrders = () => [
  {
    id: 'PO-IMP-2026-001',
    poNumber: 'PO-IMP-2026-001',
    date: '2026-08-10',
    orderDate: '2026-08-10',
    supplier: 'YLG Bullion Singapore Pte Ltd',
    supplierName: 'YLG Bullion Singapore Pte Ltd',
    supplierCode: 'SUPP-EXP-001',
    category: 'GOLD_IMPORT',
    type: 'import',
    isImport: true,
    currency: 'USD',
    exchangeRate: 16250,
    pricePerOzUSD: 2400.00,
    goldWeightGram: 1000,
    goldWeightOz: 32.1507,
    totalUSD: 77161.79,
    total: 1253879116,
    totalAmountIDR: 1253879116,
    totalLandedCostIDR: 1257013814,
    pph22AmountIDR: 3134698,
    customsPaidAmountIDR: 3134698,
    paidAmountIDR: 1253879116,
    remainingBalanceIDR: 0,
    paymentStatus: 'PAID',
    status: 'RECEIVED & VERIFIED',
    supplierInvoiceNo: 'INV-YLG-99120',
    targetVault: '1158',
    targetVaultName: 'Vault Impor 999.9 (Akun 1158)',
    pibNo: '001234/PIB/KPU-TP/2026',
    items: [
      { itemCode: 'LM-IMP-VAL-1000G', name: 'Valcambi Gold Cast Bar 1kg (999.9)', quantity: 1, unit: 'kg', weightGram: 1000, priceUSD: 77161.79, totalUSD: 77161.79 }
    ],
    paymentHistory: [
      { id: 'PMT-001', voucherNo: 'BBK-2026-002', date: '2026-08-10', category: 'PO_PRINCIPAL', categoryLabel: '💰 Uang Muka Impor (DP)', amount: 1253879116, bank: 'Bank BCA Devisa USD', recordedAt: '2026-08-10T09:00:00.000Z' },
      { id: 'PMT-002', voucherNo: 'BBK-2026-003', date: '2026-08-10', category: 'CUSTOMS_DUTY_PPH22', categoryLabel: '🏛️ Pajak PPh 22 Impor (0,25%)', amount: 3134698, bank: 'Bank BCA IDR', recordedAt: '2026-08-10T10:30:00.000Z' }
    ]
  },
  {
    id: 'PO-IMP-2026-002',
    poNumber: 'PO-IMP-2026-002',
    date: '2026-08-18',
    orderDate: '2026-08-18',
    supplier: 'Valcambi SA Switzerland',
    supplierName: 'Valcambi SA Switzerland',
    supplierCode: 'SUPP-EXP-002',
    category: 'GOLD_IMPORT',
    type: 'import',
    isImport: true,
    currency: 'USD',
    exchangeRate: 16250,
    pricePerOzUSD: 2410.00,
    goldWeightGram: 500,
    goldWeightOz: 16.0754,
    totalUSD: 38741.71,
    total: 629552788,
    totalAmountIDR: 629552788,
    totalLandedCostIDR: 631126670,
    pph22AmountIDR: 1573882,
    customsPaidAmountIDR: 0,
    paidAmountIDR: 0,
    remainingBalanceIDR: 629552788,
    paymentStatus: 'UNPAID',
    status: 'APPROVED & IN TRANSIT',
    supplierInvoiceNo: 'INV-VAL-008811',
    targetVault: '1158',
    targetVaultName: 'Vault Impor 999.9 (Akun 1158)',
    items: [
      { itemCode: 'LM-IMP-VAL-500G', name: 'Valcambi Gold Minted Bar 500g (999.9)', quantity: 1, unit: 'bar', weightGram: 500, priceUSD: 38741.71, totalUSD: 38741.71 }
    ]
  }
];

export const getPurchaseOrders = () => {
  if (typeof window !== 'undefined' && window.PurchaseOrder && typeof window.PurchaseOrder.getStoredOrders === 'function') {
    const orders = window.PurchaseOrder.getStoredOrders();
    if (orders && orders.length > 0) return orders;
  }
  const data = getStorage(KEYS.PURCHASE_ORDERS, []);
  return (data && data.length > 0) ? data : getDefaultPurchaseOrders();
};

export const savePurchaseOrders = async (orders) => {
  return await setStorage(KEYS.PURCHASE_ORDERS, orders);
};

export const createPurchaseOrder = async (orderData) => {
  if (typeof window !== 'undefined' && window.PurchaseOrder && typeof window.PurchaseOrder.createOrder === 'function') {
    return await window.PurchaseOrder.createOrder(orderData);
  }
  const orders = getPurchaseOrders();
  orders.unshift(orderData);
  await savePurchaseOrders(orders);
  return { success: true, order: orderData };
};

export const recordPOPayment = async (poNumberOrId, paymentData) => {
  let updated = false;

  // 1. Update di PurchaseOrder (PO Impor & Standar)
  if (typeof window !== 'undefined' && window.PurchaseOrder && typeof window.PurchaseOrder.recordPayment === 'function') {
    const res = await window.PurchaseOrder.recordPayment(poNumberOrId, paymentData);
    if (res && res.success) {
      updated = true;
    }
  }

  // 2. Update di Local Purchases (PO Lokal Tempo) jika ada
  const localPurchases = getLocalPurchases();
  const pIndex = localPurchases.findIndex(p => p.id === poNumberOrId || p.poNumber === poNumberOrId || p.receiptNo === poNumberOrId);
  if (pIndex !== -1) {
    const p = localPurchases[pIndex];
    const pmtAmount = parseFloat(paymentData.amount || 0);
    const category = paymentData.category || paymentData.paymentCategory || 'PO_PRINCIPAL';

    let categoryLabel = paymentData.categoryLabel;
    if (!categoryLabel) {
      switch (category) {
        case 'CUSTOMS_DUTY_PPH22':
          categoryLabel = '🏛️ Pajak PPh 22 Impor (0,25%)';
          break;
        case 'LOGISTICS_HANDLING':
          categoryLabel = '🚚 Logistik & Handling';
          break;
        case 'OTHER_EXPENSE':
          categoryLabel = '📑 Biaya Tambahan';
          break;
        default:
          categoryLabel = '💰 Pelunasan Pokok Supplier';
          break;
      }
    }

    const historyEntry = {
      id: paymentData.id || Date.now(),
      voucherNo: paymentData.voucherNo || paymentData.voucherNumber || 'BBK',
      voucherType: paymentData.voucherType || 'BBK',
      date: paymentData.date || new Date().toISOString().split('T')[0],
      category,
      categoryLabel,
      payee: paymentData.payee || p.supplierName || 'Supplier',
      bank: paymentData.bank || paymentData.bankAccountName || 'Bank BCA',
      bankAccountCode: paymentData.bankAccountCode || '1111-IDR',
      accountCode: paymentData.accountCode || (category === 'CUSTOMS_DUTY_PPH22' ? '11903' : p.currency === 'USD' || p.currency === 'SGD' ? '1135' : '2110'),
      amount: pmtAmount,
      notes: paymentData.notes || paymentData.description || '',
      recordedAt: new Date().toISOString()
    };

    const existingHistory = Array.isArray(p.paymentHistory) ? p.paymentHistory : [];
    let curPaid = parseFloat(p.paidAmountIDR || 0);
    const totalAmt = parseFloat(p.totalAmount || 0);
    let rem = typeof p.remainingBalanceIDR !== 'undefined' ? parseFloat(p.remainingBalanceIDR) : Math.max(0, totalAmt - curPaid);
    let customsPaid = parseFloat(p.customsPaidAmountIDR || 0);
    let logisticsPaid = parseFloat(p.logisticsPaidAmountIDR || 0);
    let otherExpensesPaid = parseFloat(p.otherExpensesPaidAmountIDR || 0);

    if (category === 'PO_PRINCIPAL') {
      curPaid += pmtAmount;
      rem = Math.max(0, totalAmt - curPaid);
    } else if (category === 'CUSTOMS_DUTY_PPH22') {
      customsPaid += pmtAmount;
    } else if (category === 'LOGISTICS_HANDLING') {
      logisticsPaid += pmtAmount;
    } else {
      otherExpensesPaid += pmtAmount;
    }

    const isPaid = rem === 0;

    localPurchases[pIndex] = {
      ...p,
      paidAmountIDR: curPaid,
      remainingBalanceIDR: rem,
      customsPaidAmountIDR: customsPaid,
      logisticsPaidAmountIDR: logisticsPaid,
      otherExpensesPaidAmountIDR: otherExpensesPaid,
      paymentStatus: isPaid ? 'PAID' : curPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
      lastPaymentVoucher: historyEntry.voucherNo,
      lastPaymentDate: historyEntry.date,
      paymentHistory: [historyEntry, ...existingHistory],
      updatedAt: new Date().toISOString()
    };

    await saveLocalPurchases(localPurchases);
    updated = true;
  }

  return { success: updated };
};

// ==========================================
// LOCAL PURCHASES (Emas Lokal IDR)
// ==========================================

export const getDefaultLocalPurchases = () => [
  {
    id: '1723450001',
    receiptNo: 'NOTA-PGD-2026-001',
    poNumber: 'PO-LOK-2026-001',
    orderDate: '2026-08-11',
    supplierName: 'PT Pegadaian (Persero) Jakarta',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    quantityGrams: 1000,
    pricePerGramIDR: 1300000,
    totalAmount: 1300000000,
    paidAmountIDR: 1300000000,
    remainingBalanceIDR: 0,
    paymentStatus: 'PAID',
    barSerialNumbers: 'ANT-991100',
    status: 'RECEIVED & STOCKED IN VAULT (VERIFIED 4 TTD)',
    isVaultReceived: true,
    courierName: 'Bpk. Budi Santoso',
    verifiedSignatures: ['Kasir/Finance', 'Kurir Pembawa', 'Petugas Vault', 'Direktur Utama']
  },
  {
    id: '1723450002',
    receiptNo: 'NOTA-ANTAM-2026-002',
    poNumber: 'PO-LOK-2026-002',
    orderDate: '2026-08-11',
    supplierName: 'PT Antam Tbk (UBPP Logam Mulia)',
    itemName: 'Emas Batangan Antam 500g (999.9)',
    quantityGrams: 500,
    pricePerGramIDR: 1310000,
    totalAmount: 655000000,
    paidAmountIDR: 655000000,
    remainingBalanceIDR: 0,
    paymentStatus: 'PAID',
    barSerialNumbers: 'ANT-992201',
    status: 'RECEIVED & STOCKED IN VAULT (VERIFIED 4 TTD)',
    isVaultReceived: true,
    courierName: 'Bpk. Budi Santoso',
    verifiedSignatures: ['Kasir/Finance', 'Kurir Pembawa', 'Petugas Vault', 'Direktur Utama']
  },
  {
    id: '1723450003',
    receiptNo: 'NOTA-PGD-2026-003',
    poNumber: 'PO-LOK-2026-003',
    orderDate: '2026-08-18',
    supplierName: 'PT Pegadaian (Persero) Jakarta',
    itemName: 'Emas Batangan Antam 300g (999.9)',
    quantityGrams: 300,
    pricePerGramIDR: 1305000,
    totalAmount: 391500000,
    paidAmountIDR: 391500000,
    remainingBalanceIDR: 0,
    paymentStatus: 'PAID',
    barSerialNumbers: 'ANT-993301',
    status: 'PAID_IN_TRANSIT_COURIER',
    isVaultReceived: false,
    courierName: 'Bpk. Budi Santoso'
  },
  {
    id: '1723450004',
    receiptNo: 'NOTA-ANTAM-2026-004',
    poNumber: 'PO-LOK-2026-004',
    orderDate: '2026-08-18',
    supplierName: 'PT Antam Tbk (UBPP Logam Mulia)',
    itemName: 'Emas Batangan Antam 250g (999.9)',
    quantityGrams: 250,
    pricePerGramIDR: 1310000,
    totalAmount: 327500000,
    paidAmountIDR: 0,
    remainingBalanceIDR: 327500000,
    paymentStatus: 'UNPAID',
    barSerialNumbers: 'ANT-994401',
    status: 'ORDER_PLACED_UNPAID',
    isVaultReceived: false,
    courierName: 'Bpk. Budi Santoso'
  }
];

export const getLocalPurchases = () => {
  const data = getStorage(KEYS.LOCAL_PURCHASES, []);
  return (data && data.length > 0) ? data : getDefaultLocalPurchases();
};

export const saveLocalPurchases = async (list) => {
  return await setStorage(KEYS.LOCAL_PURCHASES, list);
};

export const saveLocalPurchase = async (lp) => {
  const list = getLocalPurchases();
  const existingIdx = list.findIndex(item => item.id === lp.id || (lp.receiptNo && item.receiptNo === lp.receiptNo));
  if (existingIdx !== -1) {
    list[existingIdx] = { ...list[existingIdx], ...lp, updatedAt: new Date().toISOString() };
  } else {
    list.unshift({ ...lp, createdAt: lp.createdAt || new Date().toISOString() });
  }
  return await saveLocalPurchases(list);
};

// ==========================================
// SCRAP PURCHASES & MELTING
// ==========================================

export const getDefaultScrapPurchases = () => [
  {
    id: 'SCRAP-2026-001',
    receiptNo: 'NOTA-SCRAP-2026-001',
    spkMeltingNo: 'SPK-MLT-2026-001',
    date: '2026-08-11',
    supplierName: 'Toko Emas Mitra Sejahtera',
    itemDescription: 'Pecahan Perhiasan Emas Bekas Karat Campur',
    grossWeight: 500,
    xrfPurity: 75.5,
    estimatedFineGold: 377.5,
    pricePerFineGram: 1200000,
    totalAmount: 453000000,
    paymentMethod: 'CASH',
    creditAccount: '1110',
    creditAccountName: 'Kas Kecil (Petty Cash)',
    targetVault: '1152',
    targetVaultName: 'Vault Pecahan Scrap & Leburan (Akun 1152)',
    status: 'RECEIVED & STORED IN SCRAP VAULT',
    createdAt: '2026-08-11T09:00:00.000Z'
  },
  {
    id: 'SCRAP-2026-002',
    receiptNo: 'NOTA-SCRAP-2026-002',
    spkMeltingNo: 'SPK-MLT-2026-002',
    date: '2026-08-17',
    supplierName: 'Toko Emas Cahaya Mulia',
    itemDescription: 'Pecahan Perhiasan Scrap Karat 700',
    grossWeight: 300,
    xrfPurity: 70.0,
    estimatedFineGold: 210.0,
    pricePerFineGram: 1200000,
    totalAmount: 252000000,
    paymentMethod: 'TRANSFER',
    creditAccount: '1111-IDR',
    creditAccountName: 'Bank BCA IDR',
    targetVault: '1152',
    targetVaultName: 'Vault Pecahan Scrap & Leburan (Akun 1152)',
    status: 'RECEIVED & STORED IN SCRAP VAULT',
    createdAt: '2026-08-17T11:00:00.000Z'
  }
];

export const getScrapPurchases = () => {
  const data = getStorage(KEYS.SCRAP_PURCHASES, []);
  return (data && data.length > 0) ? data : getDefaultScrapPurchases();
};

export const saveScrapPurchases = async (list) => {
  return await setStorage(KEYS.SCRAP_PURCHASES, list);
};

export const saveScrapPurchase = async (scrapData) => {
  const list = getScrapPurchases();
  const newScrap = {
    id: scrapData.receiptNo || `SCRAP-${Date.now().toString().slice(-6)}`,
    receiptNo: scrapData.receiptNo || `NOTA-SCRAP-${Date.now().toString().slice(-4)}`,
    spkMeltingNo: scrapData.spkMeltingNo || `SPK-MLT-${Date.now().toString().slice(-4)}`,
    date: scrapData.date || new Date().toISOString().split('T')[0],
    supplierName: scrapData.supplierName || 'Toko Emas Mitra',
    itemDescription: scrapData.itemDescription || 'Pecahan Perhiasan Emas Scrap',
    grossWeight: Number(scrapData.grossWeight || 0),
    xrfPurity: Number(scrapData.xrfPurity || 0),
    estimatedFineGold: Number(scrapData.estimatedFineGold || 0),
    pricePerFineGram: Number(scrapData.pricePerFineGram || 0),
    totalAmount: Number(scrapData.totalAmount || 0),
    paymentMethod: scrapData.paymentMethod || 'CASH',
    creditAccount: scrapData.creditAccount || '1110',
    creditAccountName: scrapData.creditAccountName || 'Kas Kecil',
    targetVault: scrapData.targetVault || '1152',
    targetVaultName: scrapData.targetVaultName || 'Vault Pecahan Scrap (1152)',
    status: scrapData.status || 'RECEIVED & STORED IN SCRAP VAULT',
    createdAt: new Date().toISOString()
  };

  list.unshift(newScrap);
  await saveScrapPurchases(list);

  // Auto-post journal for scrap purchase
  const journals = getJournalEntries();
  const entryNum = await getNextReferenceNumber('journal');

  journals.unshift({
    id: Date.now(),
    entryNumber: entryNum,
    date: newScrap.date,
    description: `Pembelian Scrap Emas (${newScrap.receiptNo}) - ${newScrap.supplierName} [${newScrap.grossWeight}g @ ${newScrap.xrfPurity}% XRF = ${newScrap.estimatedFineGold}g Fine Gold]`,
    lines: [
      { accountCode: newScrap.targetVault, accountName: newScrap.targetVaultName, debit: newScrap.totalAmount, credit: 0 },
      { accountCode: newScrap.creditAccount, accountName: newScrap.creditAccountName, debit: 0, credit: newScrap.totalAmount }
    ],
    createdAt: new Date().toISOString()
  });

  await saveJournalEntries(journals);
  return { success: true, scrap: newScrap };
};

// ==========================================
// GOODS RECEIPTS (TTB / Penerimaan Barang)
// ==========================================

export const getDefaultGoodsReceipts = () => [
  {
    id: 'GRN-2026-001',
    grnNumber: 'GRN-2026-001',
    poNumber: 'PO-IMP-2026-001',
    supplierDoNumber: 'SJ-SUP-VAL-998811',
    pibNo: '001234/PIB/KPU-TP/2026',
    date: '2026-08-10',
    supplierName: 'Valcambi SA Switzerland',
    targetVault: '1158',
    targetVaultName: 'Vault Impor 999.9 (Akun 1158)',
    safeBoxSlot: 'SAFE-IMP-01',
    securitySealNo: 'SEAL-VAL-99881',
    itemDescription: 'Emas Batangan 999.9 Valcambi Cast Bar 1kg',
    barSerialNumbers: 'VAL-99120, VAL-99121',
    assayCertificateNo: 'ASSAY-VAL-88912',
    documentWeightGram: 1000,
    receivedWeightGram: 1000,
    weightDiscrepancyGram: 0,
    unitPriceIDRPerGram: 1253879,
    totalValueIDR: 1253879116,
    status: 'RECEIVED & VERIFIED'
  },
  {
    id: 'GRN-2026-002',
    grnNumber: 'GRN-2026-002',
    poNumber: 'PO-LOK-2026-001',
    supplierDoNumber: 'SJ-PGD-2026-0881',
    date: '2026-08-11',
    supplierName: 'PT Pegadaian (Persero) Jakarta',
    targetVault: '1157',
    targetVaultName: 'Vault Utama PT TAN (Akun 1157)',
    safeBoxSlot: 'SAFE-PRI-01',
    securitySealNo: 'SEAL-PGD-001',
    itemDescription: 'Emas Batangan Antam 1kg (999.9)',
    barSerialNumbers: 'ANT-991100',
    assayCertificateNo: 'ASSAY-ANT-9911',
    documentWeightGram: 1000,
    receivedWeightGram: 1000,
    weightDiscrepancyGram: 0,
    unitPriceIDRPerGram: 1300000,
    totalValueIDR: 1300000000,
    status: 'RECEIVED & VERIFIED'
  },
  {
    id: 'GRN-2026-003',
    grnNumber: 'GRN-2026-003',
    poNumber: 'PO-LOK-2026-002',
    supplierDoNumber: 'SJ-ANT-2026-0552',
    date: '2026-08-11',
    supplierName: 'PT Antam Tbk (UBPP Logam Mulia)',
    targetVault: '1157',
    targetVaultName: 'Vault Utama PT TAN (Akun 1157)',
    safeBoxSlot: 'SAFE-PRI-02',
    securitySealNo: 'SEAL-ANT-002',
    itemDescription: 'Emas Batangan Antam 500g (999.9)',
    barSerialNumbers: 'ANT-992201',
    assayCertificateNo: 'ASSAY-ANT-9922',
    documentWeightGram: 500,
    receivedWeightGram: 500,
    weightDiscrepancyGram: 0,
    unitPriceIDRPerGram: 1310000,
    totalValueIDR: 655000000,
    status: 'RECEIVED & VERIFIED'
  }
];

export const getGoodsReceipts = () => {
  const data = getStorage(KEYS.GOODS_RECEIPTS, []);
  return (data && data.length > 0) ? data : getDefaultGoodsReceipts();
};

export const saveGoodsReceipts = async (list) => {
  return await setStorage(KEYS.GOODS_RECEIPTS, list);
};

export const saveGoodsReceipt = async (receipt) => {
  const list = getGoodsReceipts();
  list.unshift(receipt);
  return await saveGoodsReceipts(list);
};

// ==========================================
// PURCHASE REQUESTS (PR)
// ==========================================

export const getDefaultPurchaseRequests = () => [
  {
    id: 'PR-2026-001',
    prNumber: 'PR-2026-001',
    date: '2026-08-10',
    requestedBy: 'Staff Purchasing',
    department: 'PURCHASING',
    category: 'GOLD_LOCAL',
    recommendedSupplier: 'PT Pegadaian (Persero) Jakarta',
    estimatedWeightGram: 1000,
    estimatedAmountIDR: 1300000000,
    justification: 'Pengadaan bahan baku emas batangan 1kg untuk pemenuhan pesanan lokal Surabaya',
    status: 'CONVERTED TO PO',
    convertedPoNumber: 'PO-LOK-2026-001',
    convertedPoType: 'LOCAL_GOLD',
    convertedAt: '2026-08-11T08:30:00.000Z'
  },
  {
    id: 'PR-2026-002',
    prNumber: 'PR-2026-002',
    date: '2026-08-09',
    requestedBy: 'Kepala Purchasing',
    department: 'PURCHASING',
    category: 'GOLD_IMPORT',
    recommendedSupplier: 'YLG Bullion Singapore Pte Ltd',
    estimatedWeightGram: 1000,
    estimatedAmountIDR: 1253879116,
    justification: 'Pengadaan impor emas batangan LBMA 1kg untuk stok cadangan devisa dan perhiasan ekspor',
    status: 'CONVERTED TO PO',
    convertedPoNumber: 'PO-IMP-2026-001',
    convertedPoType: 'IMPORT_GOLD',
    convertedAt: '2026-08-10T08:00:00.000Z'
  },
  {
    id: 'PR-2026-003',
    prNumber: 'PR-2026-003',
    date: '2026-08-15',
    requestedBy: 'Staff Produksi',
    department: 'PRODUCTION',
    category: 'CHEMICALS_REFINERY',
    recommendedSupplier: 'PT Surya Kimia Abadi',
    estimatedWeightGram: 0,
    estimatedAmountIDR: 25000000,
    justification: 'Pembelian Asam Nitrat teknis 68% dan Kowi Grafit Lebur untuk operasional workshop',
    status: 'APPROVED'
  },
  {
    id: 'PR-2026-004',
    prNumber: 'PR-2026-004',
    date: '2026-08-18',
    requestedBy: 'Staff Purchasing',
    department: 'PURCHASING',
    category: 'GOLD_LOCAL',
    recommendedSupplier: 'PT Antam Tbk (UBPP Logam Mulia)',
    estimatedWeightGram: 500,
    estimatedAmountIDR: 655000000,
    justification: 'Pengadaan emas batangan Antam 500g untuk pesanan korporasi PT Mulia Jaya',
    status: 'PENDING_APPROVAL'
  }
];

export const getPurchaseRequests = () => {
  const data = getStorage(KEYS.PURCHASE_REQUESTS, []);
  return (data && data.length > 0) ? data : getDefaultPurchaseRequests();
};

export const savePurchaseRequests = async (list) => {
  return await setStorage(KEYS.PURCHASE_REQUESTS, list);
};

export const savePurchaseRequest = async (pr) => {
  const list = getPurchaseRequests();
  const idx = list.findIndex(item => item.id === pr.id || (pr.prNumber && item.prNumber === pr.prNumber));
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...pr, updatedAt: new Date().toISOString() };
  } else {
    list.unshift({ ...pr, createdAt: pr.createdAt || new Date().toISOString() });
  }
  return await savePurchaseRequests(list);
};

// PR to PO conversion prefill cache (sessionStorage based)
const PR_PREFILL_KEY = 'pttan_pr_po_prefill';

export const setPRConversionPrefill = (prefillData) => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(PR_PREFILL_KEY, JSON.stringify(prefillData));
    } catch (e) {
      console.warn('Failed to save PR prefill to sessionStorage', e);
    }
  }
};

export const getPRConversionPrefill = () => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(PR_PREFILL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to read PR prefill from sessionStorage', e);
    }
  }
  return null;
};

export const clearPRConversionPrefill = () => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(PR_PREFILL_KEY);
    } catch (e) {
      console.warn('Failed to clear PR prefill from sessionStorage', e);
    }
  }
};

export const markPRAsConverted = async (prIdOrNumber, { poNumber, poType, supplier }) => {
  const list = getPurchaseRequests();
  let found = false;
  const updated = list.map(pr => {
    if (pr.id === prIdOrNumber || pr.prNumber === prIdOrNumber) {
      found = true;
      return {
        ...pr,
        status: 'CONVERTED TO PO',
        convertedPoNumber: poNumber,
        convertedPoType: poType,
        convertedSupplier: supplier || pr.recommendedSupplier,
        convertedAt: new Date().toISOString()
      };
    }
    return pr;
  });
  if (found) {
    await savePurchaseRequests(updated);
  }
  return { success: found };
};

// ==========================================
// LOCAL SALES (Penjualan & Trading Emas Lokal IDR)
// ==========================================

export const getDefaultLocalSales = () => [
  {
    id: 'LS-2026-001',
    invoiceNo: 'INV-LOKAL-2026-001',
    soNumber: 'SO-LOKAL-2026-001',
    doNumber: 'SJ-LOKAL-2026-001',
    customerPONumber: 'PO-CUST-TGB-881',
    date: '2026-08-16',
    customerId: 'CUST-LOKAL-01',
    customerName: 'Toko Emas Gadjah Berlian (Surabaya)',
    customerPhone: '0812-3456-7890',
    customerAddress: 'Jl. Pasar Atom Mall No. 12, Surabaya',
    paymentMode: 'cash', // 'cash' (Tunai/Transfer Lunas) | 'credit' (Tempo) | 'dp'
    paymentTerms: 'LUNAS (Transfer BCA)',
    paymentSourceAccount: '1111-IDR',
    paymentSourceAccountName: 'Bank BCA IDR (Akun 1111-IDR)',
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    sourceVault: '1157',
    sourceVaultName: 'Vault Utama PT TAN (Akun 1157)',
    quantityGrams: 1000,
    unitPriceIDR: 1380000,
    totalAmountIDR: 1380000000,
    barSerialNumbers: 'ANTAM-998812',
    deliveryMethod: 'KURIR_INTERNAL', // 'COUNTER' | 'KURIR_INTERNAL' | 'EXPEDITION'
    courierName: 'Bpk. Budi (Kurir Internal PT TAN)',
    recipientName: 'Bpk. Hendra (Owner Toko Emas Gadjah)',
    paymentStatus: 'PAID', // 'PAID' | 'UNPAID' | 'PARTIAL'
    deliveryStatus: 'DELIVERED', // 'DELIVERED' | 'PENDING'
    cogsAmountIDR: 1300000000,
    grossProfitIDR: 80000000,
    ownerApprovedBy: 'Direktur Utama / Pemilik PT TAN',
    ownerApproved: true,
    notes: 'Penjualan 1 Batang Emas Antam 1kg Tunai Lunas via Transfer BCA ke Toko Emas Gadjah Berlian',
    createdAt: '2026-08-16T10:00:00.000Z'
  }
];

export const getLocalSales = () => {
  const stored = getStorage(KEYS.LOCAL_SALES);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return getDefaultLocalSales();
};

export const saveLocalSales = async (list) => {
  return await setStorage(KEYS.LOCAL_SALES, list);
};

export const saveLocalSale = async (sale) => {
  const list = getLocalSales();
  const idx = list.findIndex(item => item.id === sale.id || item.invoiceNo === sale.invoiceNo);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...sale, updatedAt: new Date().toISOString() };
  } else {
    list.unshift(sale);
  }
  return await saveLocalSales(list);
};

export const recordLocalSaleTransaction = async (saleData) => {
  const list = getLocalSales();
  const dateStr = saleData.date || new Date().toISOString().split('T')[0];
  const invoiceNo = saleData.invoiceNo || await getNextReferenceNumber('invoice');
  const soNumber = saleData.soNumber || `SO-LOKAL-${Date.now().toString().slice(-6)}`;
  const doNumber = saleData.doNumber || `SJ-LOKAL-${Date.now().toString().slice(-6)}`;

  const quantityGrams = Number(saleData.quantityGrams || 0);
  const unitPriceIDR = Number(saleData.unitPriceIDR || 0);
  const totalAmountIDR = Number(saleData.totalAmountIDR || (quantityGrams * unitPriceIDR));
  const estimatedCostPerGram = Number(saleData.estimatedCostPerGram || 1300000);
  const cogsAmountIDR = Number(saleData.cogsAmountIDR || (quantityGrams * estimatedCostPerGram));
  const grossProfitIDR = totalAmountIDR - cogsAmountIDR;

  const paymentMode = saleData.paymentMode || 'cash'; // 'cash' | 'credit' | 'dp'
  const isCash = paymentMode === 'cash';
  const isDP = paymentMode === 'dp';
  const isCredit = paymentMode === 'credit';

  const debitAccountSales = isCash
    ? (saleData.paymentSourceAccount || '1111-IDR')
    : isCredit
    ? '1130' // Piutang Usaha Lokal
    : '1111-IDR'; // DP Masuk Bank

  const creditAccountSales = isDP ? '2150' : (saleData.revenueAccount || '4111'); // 4111 Penjualan Gold Bar / 2150 Uang Muka

  const sourceVault = saleData.sourceVault || '1157';
  const sourceVaultName = saleData.sourceVaultName || 'Vault Utama PT TAN (Akun 1157)';

  const newSale = {
    id: `LS-${Date.now().toString().slice(-6)}`,
    invoiceNo,
    soNumber,
    doNumber,
    customerPONumber: saleData.customerPONumber || '-',
    date: dateStr,
    customerId: saleData.customerId || 'CUST-LOKAL',
    customerName: saleData.customerName || 'Customer Emas Lokal',
    customerPhone: saleData.customerPhone || '-',
    customerAddress: saleData.customerAddress || '-',
    paymentMode,
    paymentTerms: saleData.paymentTerms || (isCash ? 'LUNAS' : isCredit ? 'NET 30' : 'UANG MUKA (DP)'),
    paymentSourceAccount: debitAccountSales,
    paymentSourceAccountName: saleData.paymentSourceAccountName || (isCash ? 'Bank BCA IDR' : 'Piutang Usaha Lokal'),
    itemCode: saleData.itemCode || 'LM-ANTAM-1000G',
    itemName: saleData.itemName || 'Emas Batangan Antam 1kg (999.9)',
    sourceVault,
    sourceVaultName,
    quantityGrams,
    unitPriceIDR,
    totalAmountIDR,
    barSerialNumbers: saleData.barSerialNumbers || '-',
    deliveryMethod: saleData.deliveryMethod || 'COUNTER',
    courierName: saleData.courierName || 'Serah Terima di Vault PT TAN',
    recipientName: saleData.recipientName || saleData.customerName,
    paymentStatus: isCash ? 'PAID' : isCredit ? 'UNPAID' : 'PARTIAL',
    deliveryStatus: 'DELIVERED',
    cogsAmountIDR,
    grossProfitIDR,
    ownerApprovedBy: saleData.ownerApprovedBy || 'Direktur Utama / Pemilik PT TAN',
    ownerApproved: Boolean(saleData.ownerApproved),
    notes: saleData.notes || 'Penjualan Logam Mulia Lokal IDR',
    createdAt: new Date().toISOString()
  };

  list.unshift(newSale);
  await saveLocalSales(list);

  // AUTO-JURNAL SAK EMKM:
  // 1. Jurnal Pengakuan Pendapatan & Penerimaan Kas/Piutang
  const journals = getJournalEntries();
  const entryNum1 = await getNextReferenceNumber('journal');
  const revenueAccName = isDP
    ? 'Uang Muka Penjualan Emas Lokal (Akun 2150)'
    : (newSale.itemName.includes('Perhiasan') ? 'Penjualan Perhiasan Lokal' : 'Penjualan Gold Bar (Akun 4111)');

  const debitAccName = isCash
    ? (newSale.paymentSourceAccountName || 'Bank BCA IDR')
    : isCredit
    ? 'Piutang Usaha Lokal (Akun 1130)'
    : 'Bank BCA IDR (Uang Muka)';

  journals.unshift({
    id: Date.now(),
    entryNumber: entryNum1,
    date: newSale.date,
    description: `[PENJUALAN-LOKAL] ${newSale.invoiceNo} - ${newSale.customerName} (${quantityGrams}g ${newSale.itemName} @ Rp ${unitPriceIDR.toLocaleString()}) - ${newSale.paymentTerms}`,
    lines: [
      { accountCode: debitAccountSales, accountName: debitAccName, debit: totalAmountIDR, credit: 0 },
      { accountCode: creditAccountSales, accountName: revenueAccName, debit: 0, credit: totalAmountIDR }
    ],
    createdAt: new Date().toISOString()
  });

  // 2. Jurnal Pengakuan HPP & Pengurangan Persediaan Vault Fisik
  if (!isDP && cogsAmountIDR > 0) {
    const entryNum2 = await getNextReferenceNumber('journal');
    journals.unshift({
      id: Date.now() + 1,
      entryNumber: entryNum2,
      date: newSale.date,
      description: `[HPP-PENJUALAN-LOKAL] HPP ${newSale.invoiceNo} (${quantityGrams}g ${newSale.itemName} keluar dari ${sourceVaultName})`,
      lines: [
        { accountCode: '5114', accountName: 'HPP - Logam Mulia Antam', debit: cogsAmountIDR, credit: 0 },
        { accountCode: sourceVault, accountName: sourceVaultName, debit: 0, credit: cogsAmountIDR }
      ],
      createdAt: new Date().toISOString()
    });
  }

  await saveJournalEntries(journals);
  return { success: true, sale: newSale };
};

// ==========================================
// LOCAL SALES ORDERS (SO Emas Lokal & Price Fixing IDR)
// ==========================================
export const getDefaultLocalSalesOrders = () => [
  {
    id: 'SO-LOKAL-2026-001',
    soNumber: 'SO-LOKAL-2026-001',
    customerPONumber: 'PO-CUST-TGB-881',
    date: '2026-08-16',
    customerId: 'CUST-LOKAL-01',
    customerName: 'Toko Emas Gadjah Berlian (Surabaya)',
    customerPhone: '0812-3456-7890',
    customerAddress: 'Jl. Pasar Atom Mall No. 12, Surabaya',
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    sourceVault: '1157',
    sourceVaultName: 'Vault Utama PT TAN (Akun 1157)',
    quantityGrams: 1000,
    unitPriceIDR: 1380000,
    totalAmountIDR: 1380000000,
    status: 'CONFIRMED',
    paymentTerms: 'LUNAS (Transfer BCA)',
    notes: 'Penjualan Logam Mulia Emas Batangan 1kg Tunai Lunas via Transfer BCA',
    createdAt: '2026-08-16T09:30:00.000Z'
  }
];

export const getLocalSalesOrders = () => {
  const stored = getStorage(KEYS.LOCAL_SALES_ORDERS);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return getDefaultLocalSalesOrders();
};

export const saveLocalSalesOrders = async (list) => {
  return await setStorage(KEYS.LOCAL_SALES_ORDERS, list);
};

export const saveLocalSalesOrder = async (so) => {
  const list = getLocalSalesOrders();
  const idx = list.findIndex(i => i.id === so.id || i.soNumber === so.soNumber);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...so, updatedAt: new Date().toISOString() };
  } else {
    list.unshift(so);
  }
  return await saveLocalSalesOrders(list);
};

// ==========================================
// LOCAL DELIVERY ORDERS (Surat Jalan & Pengeluaran Vault Lokal)
// ==========================================
export const getDefaultLocalDeliveryOrders = () => [
  {
    id: 'SJ-LOKAL-2026-001',
    doNumber: 'SJ-LOKAL-2026-001',
    invoiceNo: 'INV-LOKAL-2026-001',
    soNumber: 'SO-LOKAL-2026-001',
    customerPONumber: 'PO-CUST-TGB-881',
    date: '2026-08-16',
    customerId: 'CUST-LOKAL-01',
    customerName: 'Toko Emas Gadjah Berlian (Surabaya)',
    customerPhone: '0812-3456-7890',
    customerAddress: 'Jl. Pasar Atom Mall No. 12, Surabaya',
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    sourceVault: '1157',
    sourceVaultName: 'Vault Utama PT TAN (Akun 1157)',
    netWeightGram: 1000,
    grossWeightGram: 1150,
    barSerialNumbers: 'ANTAM-998812',
    securitySealNo: 'SEAL-VAULT-88912',
    boxCount: 1,
    deliveryMethod: 'KURIR_INTERNAL',
    courierName: 'Bpk. Budi (Kurir Internal PT TAN)',
    recipientName: 'Bpk. Hendra (Owner Toko Emas Gadjah)',
    status: 'DELIVERED',
    cogsAmountIDR: 1300000000,
    notes: 'Pengeluaran fisik emas batangan Antam 1kg dari Vault Utama PT TAN',
    createdAt: '2026-08-16T10:30:00.000Z'
  }
];

export const getLocalDeliveryOrders = () => {
  const stored = getStorage(KEYS.LOCAL_DELIVERY_ORDERS);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return getDefaultLocalDeliveryOrders();
};

export const saveLocalDeliveryOrders = async (list) => {
  return await setStorage(KEYS.LOCAL_DELIVERY_ORDERS, list);
};

export const saveLocalDeliveryOrder = async (doItem) => {
  const list = getLocalDeliveryOrders();
  const idx = list.findIndex(i => i.id === doItem.id || i.doNumber === doItem.doNumber);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...doItem, updatedAt: new Date().toISOString() };
  } else {
    list.unshift(doItem);
  }
  return await saveLocalDeliveryOrders(list);
};

// ==========================================
// LOCAL INVOICES (Faktur Penjualan Emas Lokal IDR - PMK 48/2023)
// ==========================================
export const getDefaultLocalInvoices = () => [
  {
    id: 'INV-LOKAL-2026-001',
    invoiceNo: 'INV-LOKAL-2026-001',
    soNumber: 'SO-LOKAL-2026-001',
    doNumber: 'SJ-LOKAL-2026-001',
    customerPONumber: 'PO-CUST-TGB-881',
    date: '2026-08-16',
    dueDate: '2026-08-16',
    customerId: 'CUST-LOKAL-01',
    customerName: 'Toko Emas Gadjah Berlian (Surabaya)',
    customerPhone: '0812-3456-7890',
    customerAddress: 'Jl. Pasar Atom Mall No. 12, Surabaya',
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    quantityGrams: 1000,
    unitPriceIDR: 1380000,
    subtotalIDR: 1380000000,
    downPaymentIDR: 0,
    taxFacility: 'BEBAS PPN PMK 48/2023',
    taxAmountIDR: 0,
    totalAmountIDR: 1380000000,
    paymentMode: 'cash',
    paymentSourceAccount: '1111-IDR',
    paymentSourceAccountName: 'Bank BCA IDR (Akun 1111-IDR)',
    paymentStatus: 'PAID',
    barSerialNumbers: 'ANTAM-998812',
    ownerApproved: true,
    ownerApprovedBy: 'Direktur Utama / Pemilik PT TAN',
    notes: 'Faktur Penjualan Emas Batangan 1kg Tunai Lunas via BCA IDR',
    createdAt: '2026-08-16T10:00:00.000Z'
  }
];

export const getLocalInvoices = () => {
  const stored = getStorage(KEYS.LOCAL_INVOICES);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return getDefaultLocalInvoices();
};

export const saveLocalInvoices = async (list) => {
  return await setStorage(KEYS.LOCAL_INVOICES, list);
};

export const saveLocalInvoice = async (inv) => {
  const list = getLocalInvoices();
  const idx = list.findIndex(i => i.id === inv.id || i.invoiceNo === inv.invoiceNo);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...inv, updatedAt: new Date().toISOString() };
  } else {
    list.unshift(inv);
  }
  return await saveLocalInvoices(list);
};

// ==========================================
// EXPORT SALES (SO, Invoices, DO)
// ==========================================

// ==========================================
// EXPORT SALES (SO, Invoices, DO)
// ==========================================

export const getDefaultExportSalesOrders = () => [
  {
    id: 'SO-EXP-2026-001',
    soNumber: 'SO-EXP-2026-001',
    customerPONumber: 'PO-DMCC-2026-8899',
    date: '2026-08-14',
    customerId: 'CUST-EXP-01',
    buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
    country: 'United Arab Emirates (UAE)',
    currency: 'USD',
    exchangeRate: 16250,
    itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
    karat: '750',
    netWeightGram: 450,
    grossWeightGram: 560,
    unitPriceUSDPerGram: 85.00,
    totalUSD: 38250.00,
    totalIDR: 621562500,
    paymentTerms: 'CAD (Cash Against Documents) via BCA USD',
    taxFacility: 'PPN 0% PASAL 4B UU PPN',
    status: 'CONFIRMED',
    createdAt: '2026-08-14T09:00:00.000Z'
  },
  {
    id: 'SO-EXP-2026-002',
    soNumber: 'SO-EXP-2026-002',
    customerPONumber: 'PO-ALETIHAD-2026-002',
    date: '2026-08-17',
    customerId: 'CUST-EXP-02',
    buyerName: 'Al-Etihad Gold Refinery DMCC',
    country: 'United Arab Emirates (UAE)',
    currency: 'USD',
    exchangeRate: 16250,
    itemDescription: 'Fine Gold Jewelry 700 (16.8K) Italian Hollow Rope Chain',
    karat: '700',
    netWeightGram: 300,
    grossWeightGram: 380,
    unitPriceUSDPerGram: 86.00,
    totalUSD: 25800.00,
    totalIDR: 419250000,
    paymentTerms: 'TT Advance via BCA USD',
    taxFacility: 'PPN 0% PASAL 4B UU PPN',
    status: 'CONFIRMED',
    createdAt: '2026-08-17T10:00:00.000Z'
  }
];

export const getExportSalesOrders = () => {
  const data = getStorage(KEYS.EXPORT_SALES_ORDERS, []);
  return (data && data.length > 0) ? data : getDefaultExportSalesOrders();
};

export const saveExportSalesOrders = async (list) => {
  return await setStorage(KEYS.EXPORT_SALES_ORDERS, list);
};

export const saveExportSalesOrder = async (so) => {
  const list = getExportSalesOrders();
  list.unshift(so);
  return await saveExportSalesOrders(list);
};

export const getDefaultExportInvoices = () => [
  {
    id: 'INV-EXP-2026-001',
    invoiceNo: 'INV-EXP-2026-001',
    invoiceDate: '2026-08-15',
    date: '2026-08-15',
    dueDate: '2026-08-25',
    soNumber: 'SO-EXP-2026-001',
    doNumber: 'DO-EXP-2026-001',
    customerPONumber: 'PO-DMCC-2026-8899',
    buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
    buyerAddress: 'Almas Tower Floor 34, Jumeirah Lakes Towers, Dubai, UAE',
    country: 'United Arab Emirates (UAE)',
    currency: 'USD',
    exchangeRate: 16250,
    pebNumber: 'PEB-2026-088912',
    awbNumber: 'AWB-FEDEX-99881122',
    taxFacility: 'PPN 0% PASAL 4B UU PPN',
    itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
    netWeightGram: 450,
    grossWeightGram: 560,
    unitPriceUSD: 85.00,
    totalUSD: 38250.00,
    totalIDR: 621562500,
    paidAmountUSD: 38250.00,
    paidAmountIDR: 621562500,
    remainingBalanceUSD: 0,
    paymentStatus: 'PAID',
    status: 'PAID',
    dheBcaAccount: '1111-USD',
    createdAt: '2026-08-15T14:30:00.000Z'
  },
  {
    id: 'INV-EXP-2026-002',
    invoiceNo: 'INV-EXP-2026-002',
    invoiceDate: '2026-08-18',
    date: '2026-08-18',
    dueDate: '2026-08-28',
    soNumber: 'SO-EXP-2026-002',
    doNumber: 'DO-EXP-2026-002',
    customerPONumber: 'PO-ALETIHAD-2026-002',
    buyerName: 'Al-Etihad Gold Refinery DMCC',
    buyerAddress: 'Gold & Diamond Park, Building 4, Sheikh Zayed Road, Dubai, UAE',
    country: 'United Arab Emirates (UAE)',
    currency: 'USD',
    exchangeRate: 16250,
    pebNumber: 'PEB-2026-088990',
    awbNumber: 'AWB-FEDEX-99882233',
    taxFacility: 'PPN 0% PASAL 4B UU PPN',
    itemDescription: 'Fine Gold Jewelry 700 (16.8K) Italian Hollow Rope Chain',
    netWeightGram: 300,
    grossWeightGram: 380,
    unitPriceUSD: 86.00,
    totalUSD: 25800.00,
    totalIDR: 419250000,
    paidAmountUSD: 0,
    paidAmountIDR: 0,
    remainingBalanceUSD: 25800.00,
    paymentStatus: 'UNPAID',
    status: 'ISSUED & SENT',
    dheBcaAccount: '1111-USD',
    createdAt: '2026-08-18T11:00:00.000Z'
  }
];

export const getExportInvoices = () => {
  const data = getStorage(KEYS.EXPORT_INVOICES, []);
  return (data && data.length > 0) ? data : getDefaultExportInvoices();
};

export const saveExportInvoices = async (list) => {
  return await setStorage(KEYS.EXPORT_INVOICES, list);
};

export const saveExportInvoice = async (inv) => {
  const list = getExportInvoices();
  list.unshift(inv);
  return await saveExportInvoices(list);
};

export const getDefaultExportDeliveryOrders = () => [
  {
    id: 'DO-EXP-2026-001',
    doNumber: 'DO-EXP-2026-001',
    customerPONumber: 'PO-DMCC-2026-8899',
    invoiceNo: 'INV-EXP-2026-001',
    soNumber: 'SO-EXP-2026-001',
    goldCertificateNo: 'CERT-FINEGOLD-998812',
    purityCertificateNo: 'ASSAY-KARAT-750-0012',
    date: '2026-08-15',
    buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
    country: 'United Arab Emirates (UAE)',
    courierName: 'Brinks Global Secured Transport',
    awbNumber: 'AWB-FEDEX-99881122',
    pebNumber: 'PEB-2026-088912',
    securitySealNo: 'SEAL-GOLD-998812',
    boxCount: 2,
    itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
    netWeightGram: 450,
    grossWeightGram: 560,
    status: 'SHIPPED / IN TRANSIT'
  }
];

export const getExportDeliveryOrders = () => {
  const data = getStorage(KEYS.EXPORT_DELIVERY_ORDERS, []);
  return (data && data.length > 0) ? data : getDefaultExportDeliveryOrders();
};

export const saveExportDeliveryOrders = async (list) => {
  return await setStorage(KEYS.EXPORT_DELIVERY_ORDERS, list);
};

export const saveExportDeliveryOrder = async (doItem) => {
  const list = getExportDeliveryOrders();
  list.unshift(doItem);
  return await saveExportDeliveryOrders(list);
};

// ==========================================
// JEWELRY PRODUCTION (SPK & Settlement)
// ==========================================

export const getDefaultProductionSPK = () => [
  {
    id: 'SPK-2026-001',
    spkNo: 'SPK-PROD-2026-001',
    date: '2026-08-12',
    buyerName: 'Dubai Gold & Jewelry DMCC',
    jewelryType: 'Cincin & Kalung Emas 18K',
    targetKarat: '750',
    grossWeight: 500,
    fineGoldNeeded: 381.65,
    masterAlloyNeeded: 124.00,
    status: 'COMPLETED',
    notes: 'Pengeluaran bahan baku emas murni 500g ke Brankas WIP untuk perhiasan ekspor'
  },
  {
    id: 'SPK-2026-002',
    spkNo: 'SPK-PROD-2026-002',
    date: '2026-08-17',
    buyerName: 'Al-Etihad Gold Dubai',
    jewelryType: 'Kalung Italian Hollow Rope Chain 18K',
    targetKarat: '700',
    grossWeight: 300,
    fineGoldNeeded: 228.99,
    masterAlloyNeeded: 75.00,
    status: 'IN_WIP',
    notes: 'Pengeluaran bahan baku emas murni 300g ke Brankas WIP'
  }
];

export const getProductionSPK = () => {
  const data = getStorage(KEYS.PRODUCTION_SPK, []);
  return (data && data.length > 0) ? data : getDefaultProductionSPK();
};

export const saveProductionSPKList = async (list) => {
  return await setStorage(KEYS.PRODUCTION_SPK, list);
};

export const saveProductionSPK = async (spk) => {
  const list = getProductionSPK();
  list.unshift(spk);
  return await saveProductionSPKList(list);
};

export const updateProductionSPKStatus = async (spkNoOrId, newStatus) => {
  const list = getProductionSPK();
  const updated = list.map(item => {
    if (item.spkNo === spkNoOrId || item.id === spkNoOrId) {
      return { ...item, status: newStatus, updatedAt: new Date().toISOString() };
    }
    return item;
  });
  return await saveProductionSPKList(updated);
};

export const getDefaultProductionSettlements = () => [
  {
    id: 'JO-2026-001',
    joNumber: 'JO-2026-001',
    spkNo: 'SPK-PROD-2026-001',
    date: '2026-08-14',
    jewelryOutputWeight: 490,
    scrapReturnWeight: 8,
    goldLossWeight: 2,
    laborFeeIDR: 7500000,
    karat: '750',
    status: 'COMPLETED'
  }
];

export const getProductionSettlements = () => {
  const data = getStorage(KEYS.PRODUCTION_SETTLEMENTS, []);
  return (data && data.length > 0) ? data : getDefaultProductionSettlements();
};

export const saveProductionSettlements = async (list) => {
  return await setStorage(KEYS.PRODUCTION_SETTLEMENTS, list);
};

export const saveProductionSettlement = async (settlement) => {
  const list = getProductionSettlements();
  list.unshift(settlement);
  return await saveProductionSettlements(list);
};

// ==========================================
// CHEQUE & VOUCHER MANAGEMENT
// ==========================================

export const getDefaultChequeBooks = () => [
  {
    id: 'BOOK-BCA-2026A',
    bookNumber: 'BOOK-BCA-2026A',
    bankCode: 'BCA-001',
    bankName: 'Bank BCA (KCU Thamrin)',
    accountNumber: '889-012-3456',
    currency: 'IDR',
    seriesPrefix: 'BG-BCA-',
    startNumber: 998801,
    endNumber: 998825,
    totalLeaves: 25,
    maxLimitPerCheque: 500000000,
    totalBookLimit: 5000000000,
    issuedDate: '2026-08-01',
    leaves: [
      { checkNumber: 'BG-BCA-998801', status: 'USED', voucherNo: 'BCK-000101', payee: 'PT Antam Tbk', amount: 150000000, dueDate: '2026-08-15', isCleared: true },
      { checkNumber: 'BG-BCA-998802', status: 'USED', voucherNo: 'BCK-000102', payee: 'Pegadaian Jakarta', amount: 350000000, dueDate: '2026-08-20', isCleared: false },
      { checkNumber: 'BG-BCA-998803', status: 'VOID', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false, notes: 'Salah Tulis / Batal' },
      { checkNumber: 'BG-BCA-998804', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
      { checkNumber: 'BG-BCA-998805', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
      { checkNumber: 'BG-BCA-998806', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
      { checkNumber: 'BG-BCA-998807', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
      { checkNumber: 'BG-BCA-998808', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
      { checkNumber: 'BG-BCA-998809', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
      { checkNumber: 'BG-BCA-998810', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false }
    ]
  }
];

export const getChequeBooks = () => {
  const data = getStorage(KEYS.CHEQUE_BOOKS, []);
  return (data && data.length > 0) ? data : getDefaultChequeBooks();
};

export const saveChequeBooks = async (books) => {
  return await setStorage(KEYS.CHEQUE_BOOKS, books);
};

export const getCheques = getChequeBooks;
export const saveCheques = saveChequeBooks;

export const getDefaultPaymentVouchers = () => [
  {
    id: 'VOUCH-BBK-001',
    voucherNumber: 'BBK-2026-001',
    voucherType: 'BBK',
    type: 'BBK',
    date: '2026-08-11',
    selectedPONumber: 'PO-LOK-2026-001',
    paymentCategory: 'PO_PRINCIPAL',
    categoryLabel: '💰 Pelunasan Pokok Supplier',
    payee: 'PT Pegadaian (Persero) Jakarta',
    payer: 'PT Triliun Anugrah Nusantara',
    bankAccountCode: '1111-IDR',
    bankAccountName: 'Bank BCA IDR',
    bankReferenceNo: 'TRC-BCA-PGD-8812',
    accountCode: '1159',
    accountName: 'Persediaan Emas Dalam Perjalanan (Transit Kurir)',
    debitAccountCode: '1159',
    debitAccountName: 'Persediaan Emas Dalam Perjalanan (Transit Kurir)',
    amount: 1300000000,
    description: 'Pelunasan PO Emas Lokal 1000g Antam ke PT Pegadaian Jakarta (Ref: PO-LOK-2026-001)',
    status: 'APPROVED & PAID',
    isCleared: true,
    createdAt: '2026-08-11T10:00:00.000Z'
  },
  {
    id: 'VOUCH-BBK-002',
    voucherNumber: 'BBK-2026-002',
    voucherType: 'BBK',
    type: 'BBK',
    date: '2026-08-10',
    selectedPONumber: 'PO-IMP-2026-001',
    paymentCategory: 'PO_PRINCIPAL',
    categoryLabel: '💰 Uang Muka Impor (DP)',
    payee: 'YLG Bullion Singapore Pte Ltd',
    payer: 'PT Triliun Anugrah Nusantara',
    bankAccountCode: '1111-USD',
    bankAccountName: 'Bank BCA Devisa USD',
    bankReferenceNo: 'SWIFT-BCA-YLG-991',
    accountCode: '1135',
    accountName: 'Uang Muka Impor / Pembelian Valas',
    debitAccountCode: '1135',
    debitAccountName: 'Uang Muka Impor / Pembelian Valas',
    amount: 1253879116,
    description: 'Pembayaran Uang Muka Impor 1000g Emas Batangan YLG Singapore ($77,161.79 @ Rp 16,250)',
    status: 'APPROVED & PAID',
    isCleared: true,
    createdAt: '2026-08-10T09:00:00.000Z'
  },
  {
    id: 'VOUCH-BBK-003',
    voucherNumber: 'BBK-2026-003',
    voucherType: 'BBK',
    type: 'BBK',
    date: '2026-08-10',
    selectedPONumber: 'PO-IMP-2026-001',
    paymentCategory: 'CUSTOMS_DUTY_PPH22',
    categoryLabel: '🏛️ Pajak PPh 22 Impor (0,25%)',
    payee: 'Kas Negara / DJBC (ID Billing: 0881-9922-1100)',
    payer: 'PT Triliun Anugrah Nusantara',
    bankAccountCode: '1111-IDR',
    bankAccountName: 'Bank BCA IDR',
    bankReferenceNo: 'BILLING-DJBC-0881',
    accountCode: '1135',
    accountName: 'Uang Muka Impor / Pembelian Valas',
    debitAccountCode: '1135',
    debitAccountName: 'Uang Muka Impor / Pembelian Valas',
    amount: 3134698,
    description: 'Pembayaran Pajak PPh 22 Impor Logam Mulia 0.25% PO-IMP-2026-001',
    status: 'APPROVED & PAID',
    isCleared: true,
    createdAt: '2026-08-10T10:30:00.000Z'
  },
  {
    id: 'VOUCH-BKK-001',
    voucherNumber: 'BKK-2026-001',
    voucherType: 'BKK',
    type: 'BKK',
    date: '2026-08-11',
    paymentCategory: 'PO_PRINCIPAL',
    categoryLabel: '💰 Pembelian Scrap Tunai',
    payee: 'Toko Emas Mitra Sejahtera',
    payer: 'PT Triliun Anugrah Nusantara',
    bankAccountCode: '1110',
    bankAccountName: 'Kas Kecil (Petty Cash)',
    bankReferenceNo: 'KAS-BON-SCRAP-01',
    accountCode: '1152',
    accountName: 'Persediaan Emas Scrap & Leburan',
    debitAccountCode: '1152',
    debitAccountName: 'Persediaan Emas Scrap & Leburan',
    amount: 453000000,
    description: 'Pembayaran Kas Tunai Pembelian Scrap Emas 500g @ 75.5% XRF = 377.5g Fine Gold (NOTA-SCRAP-2026-001)',
    status: 'APPROVED & PAID',
    isCleared: true,
    createdAt: '2026-08-11T12:00:00.000Z'
  }
];

export const getDefaultReceiptVouchers = () => [
  {
    id: 'VOUCH-BBM-001',
    voucherNumber: 'BBM-2026-001',
    voucherType: 'BBM',
    type: 'BBM',
    date: '2026-08-16',
    selectedInvoiceNumber: 'INV-LOKAL-2026-001',
    payer: 'Toko Emas Gadjah Berlian (Surabaya)',
    payee: 'PT Triliun Anugrah Nusantara',
    bankAccountCode: '1111-IDR',
    bankAccountName: 'Bank BCA IDR',
    bankReferenceNo: 'MUTASI-BCA-TGB-001',
    accountCode: '4111',
    accountName: 'Penjualan Logam Mulia Lokal (Bebas PPN)',
    amount: 1380000000,
    description: 'Penerimaan Kasir Transfer BCA Penjualan Emas Batangan 1kg (INV-LOKAL-2026-001)',
    status: 'RECEIVED & CLEARED',
    isCleared: true,
    createdAt: '2026-08-16T11:30:00.000Z'
  },
  {
    id: 'VOUCH-BBM-002',
    voucherNumber: 'BBM-2026-002',
    voucherType: 'BBM',
    type: 'BBM',
    date: '2026-08-18',
    selectedInvoiceNumber: 'INV-EXP-2026-001',
    payer: 'Dubai Gold & Jewelry Wholesalers DMCC',
    payee: 'PT Triliun Anugrah Nusantara',
    bankAccountCode: '1111-USD',
    bankAccountName: 'Bank BCA Devisa USD',
    bankReferenceNo: 'SWIFT-IN-DMCC-0881',
    accountCode: '1132',
    accountName: 'Piutang Usaha Ekspor (USD)',
    amount: 621562500,
    description: 'Penerimaan Devisa Hasil Ekspor (DHE) $38,250 USD @ Rp 16,250 dari Dubai Gold DMCC (INV-EXP-2026-001)',
    status: 'RECEIVED & CLEARED',
    isCleared: true,
    createdAt: '2026-08-18T10:00:00.000Z'
  }
];

export const getDefaultVouchers = () => [
  ...getDefaultPaymentVouchers(),
  ...getDefaultReceiptVouchers()
];

export const getVouchers = () => {
  const pmt = getStorage(KEYS.PAYMENT_VOUCHERS, []);
  const rcp = getStorage(KEYS.RECEIPT_VOUCHERS, []);
  const vch = getStorage(KEYS.VOUCHERS, []);
  const combined = [...pmt, ...rcp, ...vch];
  return (combined && combined.length > 0) ? combined : getDefaultVouchers();
};

export const saveVouchers = async (vouchers) => {
  return await setStorage(KEYS.VOUCHERS, vouchers);
};

export const saveVoucher = async (voucher) => {
  const list = getVouchers();
  list.unshift(voucher);
  return await saveVouchers(list);
};

// ==========================================
// SYSTEM SETTINGS, PROFILE & BACKUPS
// ==========================================

export const getCompanyProfile = () => {
  return getStorage(KEYS.COMPANY_PROFILE, {
    companyName: 'PT. Triliun Anugrah Nusantara (PT TAN)',
    logoUrl: '/logo/logo-tan.png',
    address: 'Sentra Niaga Puri Indah Blok T2 No. 12, Kembangan, Jakarta Barat 11610',
    phone: '(021) 5830-1988 / 0811-9876-5432',
    email: 'procurement@tan-gold.co.id',
    npwp: '01.234.567.8-035.000',
    nibPeb: '1234567890123 (NIB Ekspor PPN 0%)',
    currencyDefault: 'USD'
  });
};

export const saveCompanyProfile = async (profile) => {
  return await setStorage(KEYS.COMPANY_PROFILE, profile);
};

export const getAllSystemData = () => {
  return {
    app: 'PT TAN ERP',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    chartOfAccounts: getCOA(),
    items: getMasterItems(),
    customers: getCustomers(),
    suppliers: getSuppliers(),
    purchaseOrders: getPurchaseOrders(),
    paymentVouchers: getVouchers(),
    receiptVouchers: getVouchers(),
    journals: getJournalEntries(),
    companyProfile: getCompanyProfile(),
    goodsReceipts: getGoodsReceipts(),
    localPurchases: getLocalPurchases(),
    scrapPurchases: getScrapPurchases(),
    productionSPK: getProductionSPK(),
    productionSettlements: getProductionSettlements(),
    exportSalesOrders: getExportSalesOrders(),
    exportInvoices: getExportInvoices(),
    exportDeliveryOrders: getExportDeliveryOrders(),
    localSales: getLocalSales(),
    localSalesOrders: getLocalSalesOrders(),
    localDeliveryOrders: getLocalDeliveryOrders(),
    localInvoices: getLocalInvoices(),
    purchaseRequests: getPurchaseRequests(),
    chequeBooks: getChequeBooks()
  };
};

export const restoreSystemData = async (data) => {
  if (data.chartOfAccounts) await saveCOA(data.chartOfAccounts);
  if (data.items) await saveMasterItems(data.items);
  if (data.customers) await saveCustomers(data.customers);
  if (data.suppliers) await saveSuppliers(data.suppliers);
  if (data.purchaseOrders) await savePurchaseOrders(data.purchaseOrders);
  if (data.journals) await saveJournalEntries(data.journals);
  if (data.paymentVouchers) await saveVouchers(data.paymentVouchers);
  if (data.companyProfile) await saveCompanyProfile(data.companyProfile);
  if (data.goodsReceipts) await saveGoodsReceipts(data.goodsReceipts);
  if (data.localPurchases) await saveLocalPurchases(data.localPurchases);
  if (data.scrapPurchases) await saveScrapPurchases(data.scrapPurchases);
  if (data.productionSPK) await saveProductionSPKList(data.productionSPK);
  if (data.productionSettlements) await saveProductionSettlements(data.productionSettlements);
  if (data.exportSalesOrders) await saveExportSalesOrders(data.exportSalesOrders);
  if (data.exportInvoices) await saveExportInvoices(data.exportInvoices);
  if (data.exportDeliveryOrders) await saveExportDeliveryOrders(data.exportDeliveryOrders);
  if (data.localSales) await saveLocalSales(data.localSales);
  if (data.localSalesOrders) await saveLocalSalesOrders(data.localSalesOrders);
  if (data.localDeliveryOrders) await saveLocalDeliveryOrders(data.localDeliveryOrders);
  if (data.localInvoices) await saveLocalInvoices(data.localInvoices);
  if (data.purchaseRequests) await savePurchaseRequests(data.purchaseRequests);
  if (data.chequeBooks) await saveChequeBooks(data.chequeBooks);
  return { success: true };
};

export const clearAllSystemTransactions = async () => {
  const transactionKeys = [
    KEYS.JOURNAL_ENTRIES,
    KEYS.PURCHASE_ORDERS,
    KEYS.VOUCHERS,
    KEYS.GOODS_RECEIPTS,
    KEYS.LOCAL_PURCHASES,
    KEYS.SCRAP_PURCHASES,
    KEYS.PRODUCTION_SPK,
    KEYS.PRODUCTION_SETTLEMENTS,
    KEYS.EXPORT_SALES_ORDERS,
    KEYS.EXPORT_INVOICES,
    KEYS.EXPORT_DELIVERY_ORDERS,
    KEYS.LOCAL_SALES,
    KEYS.LOCAL_SALES_ORDERS,
    KEYS.LOCAL_DELIVERY_ORDERS,
    KEYS.LOCAL_INVOICES,
    KEYS.PURCHASE_REQUESTS,
    KEYS.VAULT_TRANSFERS,
    'payment_vouchers',
    'receipt_vouchers',
    'checks_giro',
    'stock_cards',
    'erp_warehouse_stock_movements',
    'deleted_records'
  ];

  for (const key of transactionKeys) {
    await setStorage(key, [], true);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    transactionKeys.forEach(k => {
      try {
        window.localStorage.setItem(k, JSON.stringify([]));
      } catch (e) {}
    });
  }

  return { success: true };
};

// ==========================================
// VAULT & WAREHOUSE STOCK SERVICE METHODS
// ==========================================

export const getDefaultWarehouses = () => [
  { id: 'WH-VAULT-01', name: 'Vault Utama PT TAN', code: 'VAULT-PRI', location: 'Lantai 2 Safe Room', manager: 'Budi Santoso', status: 'Active', account: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)' },
  { id: 'WH-VAULT-02', name: 'Vault Emas Impor Transit', code: 'VAULT-IMP', location: 'Lantai 2 Customs Safe', manager: 'Siti Aminah', status: 'Active', account: '1158', accountName: 'Persediaan Logam Mulia Impor' },
  { id: 'WH-VAULT-04', name: 'Vault Emas WIP (Produksi Perhiasan)', code: 'VAULT-WIP', location: 'Lantai 2 Manufacturing Vault', manager: 'Hendra (Head of Production)', status: 'Active', account: '11502', accountName: 'Persediaan Emas WIP (Produksi)' },
  { id: 'WH-VAULT-03', name: 'Vault Perhiasan Siap Ekspor', code: 'VAULT-EXP', location: 'Lantai 3 Dispatch Vault', manager: 'Ahmad Hidayat', status: 'Active', account: '1160', accountName: 'Persediaan Perhiasan Siap Ekspor' },
  { id: 'WH-VAULT-05', name: 'Vault Pecahan Scrap & Leburan', code: 'VAULT-SCRAP', location: 'Lantai 2 Smelting Room', manager: 'Rian (Assay Master)', status: 'Active', account: '1152', accountName: 'Persediaan Emas Scrap & Leburan' },
  { id: 'WH-VAULT-06', name: 'Vault Perak & Logam Alloy (Silver Vault)', code: 'VAULT-SILVER', location: 'Lantai 2 Smelting & Alloy Room', manager: 'Rian (Assay Master)', status: 'Active', account: '1153', accountName: 'Persediaan Silver & Logam Mulia Lain' }
];

export const getWarehouses = () => {
  const stored = getStorage('pttan_warehouses') || getStorage(KEYS.WAREHOUSES);
  if (Array.isArray(stored) && stored.length > 0) {
    // Ensure WH-VAULT-06 (1153) is present if missing
    if (!stored.some(w => w.account === '1153' || w.id === 'WH-VAULT-06')) {
      const defaultWh = getDefaultWarehouses();
      const silverWh = defaultWh.find(w => w.account === '1153');
      if (silverWh) stored.push(silverWh);
    }
    return stored;
  }
  return getDefaultWarehouses();
};

export const getDefaultVaultTransfers = () => [
  {
    id: 'TRF-2026-001',
    date: '2026-08-16',
    fromVaultId: 'WH-VAULT-02',
    fromVaultName: 'Vault Emas Impor Transit (Akun 1158)',
    fromAccount: '1158',
    toVaultId: 'WH-VAULT-01',
    toVaultName: 'Vault Utama PT TAN (Akun 1157)',
    toAccount: '1157',
    itemCode: 'LM-IMP-VAL-1000G',
    itemName: 'Emas Batangan Valcambi 999.9',
    quantityGrams: 200,
    estimatedValueIDR: 260000000,
    transferNotes: 'Mutasi internal pemindahan kepingan emas impor ke brankas utama',
    createdAt: '2026-08-16T15:00:00.000Z'
  }
];

export const getVaultTransfers = () => {
  const data = getStorage(KEYS.VAULT_TRANSFERS, []);
  return (data && data.length > 0) ? data : getDefaultVaultTransfers();
};

export const saveVaultTransfers = async (list) => {
  return await setStorage(KEYS.VAULT_TRANSFERS, list);
};

export const recordVaultTransfer = async (transferData) => {
  const list = getVaultTransfers();
  const newTransfer = {
    id: `TRF-${Date.now().toString().slice(-6)}`,
    date: transferData.date || new Date().toISOString().split('T')[0],
    fromVaultId: transferData.fromVaultId,
    fromVaultName: transferData.fromVaultName,
    fromAccount: transferData.fromAccount,
    toVaultId: transferData.toVaultId,
    toVaultName: transferData.toVaultName,
    toAccount: transferData.toAccount,
    itemCode: transferData.itemCode || 'GOLD-GENERIC',
    itemName: transferData.itemName || 'Logam Mulia Emas',
    quantityGrams: Number(transferData.quantityGrams || 0),
    estimatedValueIDR: Number(transferData.estimatedValueIDR || 0),
    transferNotes: transferData.transferNotes || 'Transfer internal brankas vault',
    createdAt: new Date().toISOString()
  };

  list.unshift(newTransfer);
  await saveVaultTransfers(list);

  // Auto-Post Journal Entry for Vault Transfer
  const journals = getJournalEntries();
  const entryNum = await getNextReferenceNumber('journal');
  const journalValue = newTransfer.estimatedValueIDR > 0
    ? newTransfer.estimatedValueIDR
    : newTransfer.quantityGrams * 1300000;

  journals.unshift({
    id: Date.now(),
    entryNumber: entryNum,
    date: newTransfer.date,
    description: `Transfer Mutasi Antar-Vault: ${newTransfer.quantityGrams}g ${newTransfer.itemName} [${newTransfer.fromVaultName} (${newTransfer.fromAccount}) -> ${newTransfer.toVaultName} (${newTransfer.toAccount})] - ${newTransfer.transferNotes}`,
    lines: [
      { accountCode: newTransfer.toAccount, accountName: newTransfer.toVaultName, debit: journalValue, credit: 0 },
      { accountCode: newTransfer.fromAccount, accountName: newTransfer.fromVaultName, debit: 0, credit: journalValue }
    ],
    createdAt: new Date().toISOString()
  });

  await saveJournalEntries(journals);
  return { success: true, transfer: newTransfer };
};

// ==========================================
// SILVER (PERAK) INVENTORY & ALLOY SERVICE
// ==========================================

export const getDefaultSilverTransactions = () => [
  {
    id: 'SLV-REC-000101',
    transactionType: 'RECEIPT',
    date: '2026-08-01',
    supplierName: 'PT Antam Tbk / Divisi Logam Mulia',
    docNo: 'NOTA-SLV-0801',
    itemName: 'Granul Perak Murni 99.9% (Fine Silver Grain)',
    purity: 99.9,
    weightGrams: 5000,
    pricePerGram: 16500,
    totalValueIDR: 82500000,
    sourceAccount: '1111-IDR',
    targetVaultAccount: '1153',
    notes: 'Penerimaan persediaan stok awal perak murni untuk bahan paduan alloy',
    operatorName: 'Rian (Assay Master)',
    createdAt: '2026-08-01T08:30:00.000Z'
  }
];

export const getSilverTransactions = () => {
  const stored = getStorage(KEYS.SILVER_TRANSACTIONS);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return getDefaultSilverTransactions();
};

export const saveSilverTransactions = async (list) => {
  return await setStorage(KEYS.SILVER_TRANSACTIONS, list);
};

export const recordSilverReceipt = async (receiptData) => {
  const list = getSilverTransactions();
  const receiptNo = `SLV-REC-${Date.now().toString().slice(-6)}`;
  const weightGrams = Number(receiptData.weightGrams || 0);
  const pricePerGram = Number(receiptData.pricePerGram || 16500);
  const totalValueIDR = Number(receiptData.totalValueIDR || (weightGrams * pricePerGram));
  const sourceAccount = receiptData.sourceAccount || '1111-IDR';

  const newReceipt = {
    id: receiptNo,
    transactionType: 'RECEIPT',
    date: receiptData.date || new Date().toISOString().split('T')[0],
    supplierName: receiptData.supplierName || 'PT Antam / Supplier Perak',
    docNo: receiptData.docNo || receiptNo,
    itemName: receiptData.itemName || 'Granul Perak Murni 99.9% (Fine Silver Grain)',
    purity: Number(receiptData.purity || 99.9),
    weightGrams,
    pricePerGram,
    totalValueIDR,
    sourceAccount,
    targetVaultAccount: '1153',
    notes: receiptData.notes || 'Penerimaan persediaan perak murni untuk bahan alloy',
    operatorName: receiptData.operatorName || 'Petugas Vault',
    createdAt: new Date().toISOString()
  };

  list.unshift(newReceipt);
  await saveSilverTransactions(list);

  // Auto-Post Journal Entry: Debet 1153 (Persediaan Perak), Kredit Source Account
  const journals = getJournalEntries();
  const entryNum = await getNextReferenceNumber('journal');
  const sourceAccountName = sourceAccount === '1111-IDR'
    ? 'Bank BCA IDR (Operasional & Beli Lokal)'
    : sourceAccount === '2110'
    ? 'Hutang Usaha'
    : 'Kas';

  journals.unshift({
    id: Date.now(),
    entryNumber: entryNum,
    date: newReceipt.date,
    description: `[PENERIMAAN-PERAK] Penerimaan ${weightGrams}g ${newReceipt.itemName} (${newReceipt.supplierName}) | Debet: 1153 | Kredit: ${sourceAccount}`,
    lines: [
      { accountCode: '1153', accountName: 'Silver & Logam Mulia Lain', debit: totalValueIDR, credit: 0 },
      { accountCode: sourceAccount, accountName: sourceAccountName, debit: 0, credit: totalValueIDR }
    ],
    createdAt: new Date().toISOString()
  });

  await saveJournalEntries(journals);
  return { success: true, transaction: newReceipt };
};

export const recordSilverAdditionToGold = async (additionData) => {
  const list = getSilverTransactions();

  // Hitung saldo stok perak yang tersedia di Akun 1153
  const totalSilverIn = list
    .filter(t => t.transactionType === 'RECEIPT')
    .reduce((sum, t) => sum + Number(t.weightGrams || 0), 0);
  const totalSilverOut = list
    .filter(t => t.transactionType === 'ALLOY_ADDITION')
    .reduce((sum, t) => sum + Number(t.silverWeightGram || 0), 0);
  const availableSilver = totalSilverIn - totalSilverOut;

  const silverWeightGram = Number(additionData.silverWeightGram || 0);
  if (silverWeightGram <= 0) {
    return { success: false, message: 'Berat perak yang ditambahkan harus lebih besar dari 0 gram.' };
  }

  if (silverWeightGram > availableSilver) {
    return {
      success: false,
      message: `Saldo stok perak tidak mencukupi. Tersedia: ${availableSilver.toLocaleString()} gram, diminta: ${silverWeightGram.toLocaleString()} gram.`
    };
  }

  const additionId = `ALLOY-SLV-${Date.now().toString().slice(-6)}`;
  const goldInitialWeightGram = Number(additionData.goldInitialWeightGram || 0);
  const goldPurityInitial = Number(additionData.goldPurityInitial || 99.99);
  const silverPricePerGram = Number(additionData.silverPricePerGram || 16500);
  const totalSilverValueIDR = Number(additionData.totalSilverValueIDR || (silverWeightGram * silverPricePerGram));
  const targetVaultId = additionData.targetVaultId || 'WH-VAULT-01';
  const targetVaultName = additionData.targetVaultName || 'Vault Utama PT TAN';
  const targetAccount = additionData.targetAccount || '1157';
  const goldBarRef = additionData.goldBarRef || 'Emas Batangan';
  const totalFinalWeightGram = goldInitialWeightGram + silverWeightGram;

  // Rumus kadar akhir paduan emas-perak
  const fineGoldWeight = goldInitialWeightGram * (goldPurityInitial / 100);
  const finalEstimatedPurity = totalFinalWeightGram > 0
    ? (fineGoldWeight / totalFinalWeightGram) * 100
    : goldPurityInitial;

  const newAddition = {
    id: additionId,
    transactionType: 'ALLOY_ADDITION',
    date: additionData.date || new Date().toISOString().split('T')[0],
    targetVaultId,
    targetVaultName,
    targetAccount,
    goldBarRef,
    goldInitialWeightGram,
    goldPurityInitial,
    silverWeightGram,
    silverPurity: Number(additionData.silverPurity || 99.9),
    silverPricePerGram,
    totalSilverValueIDR,
    totalFinalWeightGram,
    finalEstimatedPurity: Number(finalEstimatedPurity.toFixed(2)),
    notes: additionData.notes || `Penambahan perak alloy ${silverWeightGram}g ke ${goldBarRef}`,
    operatorName: additionData.operatorName || 'Rian (Assay Master)',
    createdAt: new Date().toISOString()
  };

  list.unshift(newAddition);
  await saveSilverTransactions(list);

  // Auto-Journal SAK EMKM: Debet Target Gold Account (1157/11502), Kredit Persediaan Perak (1153)
  const journals = getJournalEntries();
  const entryNum = await getNextReferenceNumber('journal');
  journals.unshift({
    id: Date.now(),
    entryNumber: entryNum,
    date: newAddition.date,
    description: `[ALLOY-PERAK] Penambahan ${silverWeightGram}g Perak ke ${goldBarRef} [${targetVaultName} (${targetAccount})] | Debet: ${targetAccount} | Kredit: 1153 - ${newAddition.notes}`,
    lines: [
      { accountCode: targetAccount, accountName: targetVaultName, debit: totalSilverValueIDR, credit: 0 },
      { accountCode: '1153', accountName: 'Silver & Logam Mulia Lain', debit: 0, credit: totalSilverValueIDR }
    ],
    createdAt: new Date().toISOString()
  });

  await saveJournalEntries(journals);
  return { success: true, transaction: newAddition };
};

// Compute Dynamic Vault Stock Positions & Movement Cards
export const calculateVaultStockPosition = () => {
  const warehouses = getWarehouses();
  const grns = getGoodsReceipts();
  const localPurchases = getLocalPurchases();
  const scrapPurchases = getScrapPurchases();
  const spkList = getProductionSPK();
  const settlements = getProductionSettlements();
  const deliveryOrders = getExportDeliveryOrders();
  const localDeliveryOrders = getLocalDeliveryOrders();
  const localSales = getLocalSales();
  const transfers = getVaultTransfers();

  // Initialize Balances map per account/vault
  const vaultBalances = {};
  warehouses.forEach(w => {
    vaultBalances[w.account] = {
      id: w.id,
      name: w.name,
      code: w.code,
      account: w.account,
      location: w.location,
      manager: w.manager,
      status: w.status,
      totalInGrams: 0,
      totalOutGrams: 0,
      balanceGrams: 0,
      totalValueIDR: 0
    };
  });

  const allMovements = [];

  // 1. Goods Receipts (TTB Impor / Lokal) -> IN
  grns.forEach(grn => {
    const acc = grn.targetVault || '1158';
    const weight = Number(grn.receivedWeightGram || 0);
    const val = Number(grn.totalValueIDR || (weight * 1350000));
    if (vaultBalances[acc]) {
      vaultBalances[acc].totalInGrams += weight;
      vaultBalances[acc].balanceGrams += weight;
      vaultBalances[acc].totalValueIDR += val;
    }
    allMovements.push({
      id: `GRN-${grn.id || grn.grnNumber}`,
      date: grn.date || '2026-08-10',
      docType: 'TTB / GRN',
      docNo: grn.grnNumber || grn.id,
      refNo: grn.poNumber || '-',
      itemCode: 'LM-IMPORT-LBMA',
      itemName: grn.itemDescription || 'Emas Batangan Impor 999.9',
      warehouseAccount: acc,
      warehouseName: vaultBalances[acc]?.name || 'Vault Impor (1158)',
      inQty: weight,
      outQty: 0,
      unit: 'gram',
      valueIDR: val,
      serialNo: grn.barSerialNumbers || grn.assayCertificateNo || 'Sertifikat Pabean'
    });
  });

  // 2. Local Purchases (Emas Lokal yang sudah tiba di vault) -> IN ke 1157
  localPurchases.forEach(lp => {
    if (lp.isVaultReceived || lp.status?.includes('RECEIVED') || lp.status?.includes('VAULT')) {
      const acc = '1157';
      const weight = Number(lp.quantityGrams || 0);
      const val = Number(lp.totalAmount || (weight * 1300000));
      if (vaultBalances[acc]) {
        vaultBalances[acc].totalInGrams += weight;
        vaultBalances[acc].balanceGrams += weight;
        vaultBalances[acc].totalValueIDR += val;
      }
      allMovements.push({
        id: `LOK-${lp.id || lp.receiptNo}`,
        date: lp.orderDate || lp.vaultReceivedAt?.split('T')[0] || '2026-08-11',
        docType: 'PO / NOTA LOKAL',
        docNo: lp.receiptNo || lp.poNumber || 'NOTA-LOKAL',
        refNo: lp.poNumber || lp.receiptNo || '-',
        itemCode: 'LM-ANTAM-9999',
        itemName: lp.itemName || 'Emas Batangan Antam / Lokal 999.9',
        warehouseAccount: acc,
        warehouseName: vaultBalances[acc]?.name || 'Vault Utama (1157)',
        inQty: weight,
        outQty: 0,
        unit: 'gram',
        valueIDR: val,
        serialNo: lp.barSerialNumbers || `Kurir: ${lp.courierName || 'Internal'}`
      });
    }
  });

  // 2b. Scrap Purchases -> IN ke 1152 (atau target vault yang dipilih)
  scrapPurchases.forEach(sc => {
    const acc = sc.targetVault || '1152';
    const weight = Number(sc.grossWeight || sc.estimatedFineGold || 0);
    const val = Number(sc.totalAmount || (weight * 1200000));
    if (vaultBalances[acc]) {
      vaultBalances[acc].totalInGrams += weight;
      vaultBalances[acc].balanceGrams += weight;
      vaultBalances[acc].totalValueIDR += val;
    }
    allMovements.push({
      id: `SCRAP-BUY-${sc.id || sc.receiptNo}`,
      date: sc.date || '2026-08-11',
      docType: 'NOTA BELI SCRAP',
      docNo: sc.receiptNo || sc.id,
      refNo: `SPK: ${sc.spkMeltingNo || '-'} | XRF: ${sc.xrfPurity || 0}%`,
      itemCode: 'SCRAP-MIX',
      itemName: sc.itemDescription || `Scrap Emas Kadar ${sc.xrfPurity}%`,
      warehouseAccount: acc,
      warehouseName: vaultBalances[acc]?.name || 'Vault Scrap (1152)',
      inQty: weight,
      outQty: 0,
      unit: 'gram',
      valueIDR: val,
      serialNo: `Toko: ${sc.supplierName} | Fine Gold: ${sc.estimatedFineGold}g`
    });
  });

  // 3. SPK Issue to WIP Produksi -> OUT dari 1157, IN ke 11502
  spkList.forEach(spk => {
    const fineWeight = Number(spk.fineGoldNeeded || 0);
    const val = fineWeight * 1300000;

    // OUT dari 1157
    if (vaultBalances['1157']) {
      vaultBalances['1157'].totalOutGrams += fineWeight;
      vaultBalances['1157'].balanceGrams -= fineWeight;
      vaultBalances['1157'].totalValueIDR -= val;
    }
    allMovements.push({
      id: `SPK-OUT-${spk.id || spk.spkNo}`,
      date: spk.date || '2026-08-12',
      docType: 'SPK PENGELUARAN WIP',
      docNo: spk.spkNo || spk.id,
      refNo: spk.buyerName || 'Workshop Produksi',
      itemCode: 'GOLD-RAW-9999',
      itemName: `Bahan Emas Murni (${spk.jewelryType || 'Perhiasan'})`,
      warehouseAccount: '1157',
      warehouseName: vaultBalances['1157']?.name || 'Vault Utama (1157)',
      inQty: 0,
      outQty: fineWeight,
      unit: 'gram',
      valueIDR: val,
      serialNo: `SPK: ${spk.spkNo} (Target Karat ${spk.targetKarat || '750'})`
    });

    // IN ke 11502
    if (vaultBalances['11502']) {
      vaultBalances['11502'].totalInGrams += fineWeight;
      vaultBalances['11502'].balanceGrams += fineWeight;
      vaultBalances['11502'].totalValueIDR += val;
    }
    allMovements.push({
      id: `SPK-IN-${spk.id || spk.spkNo}`,
      date: spk.date || '2026-08-12',
      docType: 'SPK PENERIMAAN WIP',
      docNo: spk.spkNo || spk.id,
      refNo: spk.buyerName || 'Workshop Produksi',
      itemCode: 'GOLD-WIP-KARAT',
      itemName: `Emas WIP Dalam Proses Karat ${spk.targetKarat || '750'}`,
      warehouseAccount: '11502',
      warehouseName: vaultBalances['11502']?.name || 'Vault Emas WIP (11502)',
      inQty: fineWeight,
      outQty: 0,
      unit: 'gram',
      valueIDR: val,
      serialNo: `WIP SPK ${spk.spkNo}`
    });
  });

  // 4. Production Settlement -> OUT dari 11502, IN ke 1160 (Perhiasan Jadi) & 1152 (Scrap Retur)
  settlements.forEach(st => {
    const outJewelry = Number(st.jewelryOutputWeight || 0);
    const scrapRet = Number(st.scrapReturnWeight || 0);
    const goldLoss = Number(st.goldLossWeight || 0);
    const totalDeductedWIP = outJewelry + scrapRet + goldLoss;
    const valJewelry = (outJewelry * 1350000) + Number(st.laborFeeIDR || 0);

    // OUT dari 11502
    if (vaultBalances['11502']) {
      vaultBalances['11502'].totalOutGrams += totalDeductedWIP;
      vaultBalances['11502'].balanceGrams -= totalDeductedWIP;
      vaultBalances['11502'].totalValueIDR -= (totalDeductedWIP * 1300000);
    }
    allMovements.push({
      id: `SETTLE-OUT-${st.id || st.joNumber}`,
      date: st.date || '2026-08-14',
      docType: 'SETTLEMENT WORKSHOP',
      docNo: st.joNumber || st.id,
      refNo: `Hasil Jadi ${outJewelry}g | Loss ${goldLoss}g`,
      itemCode: 'GOLD-WIP-KARAT',
      itemName: 'Pelunasan Bahan Emas WIP Karat',
      warehouseAccount: '11502',
      warehouseName: vaultBalances['11502']?.name || 'Vault Emas WIP (11502)',
      inQty: 0,
      outQty: totalDeductedWIP,
      unit: 'gram',
      valueIDR: totalDeductedWIP * 1300000,
      serialNo: `Settle SPK: ${st.joNumber}`
    });

    // IN ke 1160 (Perhiasan Siap Ekspor)
    if (vaultBalances['1160']) {
      vaultBalances['1160'].totalInGrams += outJewelry;
      vaultBalances['1160'].balanceGrams += outJewelry;
      vaultBalances['1160'].totalValueIDR += valJewelry;
    }
    allMovements.push({
      id: `SETTLE-IN-EXP-${st.id || st.joNumber}`,
      date: st.date || '2026-08-14',
      docType: 'FINISH GOODS RECEIPT',
      docNo: st.joNumber || st.id,
      refNo: `Labor Fee: Rp ${(st.laborFeeIDR || 0).toLocaleString()}`,
      itemCode: 'JEWELRY-EXP-750',
      itemName: `Perhiasan Emas Karat ${st.karat || '750'} Siap Ekspor`,
      warehouseAccount: '1160',
      warehouseName: vaultBalances['1160']?.name || 'Vault Perhiasan Siap Ekspor (1160)',
      inQty: outJewelry,
      outQty: 0,
      unit: 'gram',
      valueIDR: valJewelry,
      serialNo: `Batch FG: ${st.joNumber}`
    });

    // IN ke 1152 (Scrap Retur jika ada)
    if (scrapRet > 0 && vaultBalances['1152']) {
      vaultBalances['1152'].totalInGrams += scrapRet;
      vaultBalances['1152'].balanceGrams += scrapRet;
      vaultBalances['1152'].totalValueIDR += (scrapRet * 1200000);
      allMovements.push({
        id: `SCRAP-RET-${st.id || st.joNumber}`,
        date: st.date || '2026-08-14',
        docType: 'SCRAP RETUR LEBURAN',
        docNo: st.joNumber || st.id,
        refNo: 'Sisa Leburan Workshop',
        itemCode: 'SCRAP-RETURN',
        itemName: 'Emas Scrap Retur / Sisa Leburan',
        warehouseAccount: '1152',
        warehouseName: vaultBalances['1152']?.name || 'Vault Scrap (1152)',
        inQty: scrapRet,
        outQty: 0,
        unit: 'gram',
        valueIDR: scrapRet * 1200000,
        serialNo: `Retur JO ${st.joNumber}`
      });
    }
  });

  // 5. Export Delivery Orders (DO) -> OUT dari 1160
  deliveryOrders.forEach(doItem => {
    const weight = Number(doItem.netWeightGram || 0);
    const val = weight * 1380000;
    if (vaultBalances['1160']) {
      vaultBalances['1160'].totalOutGrams += weight;
      vaultBalances['1160'].balanceGrams -= weight;
      vaultBalances['1160'].totalValueIDR -= val;
    }
    allMovements.push({
      id: `DO-EXP-${doItem.id || doItem.doNumber}`,
      date: doItem.date || '2026-08-15',
      docType: 'SURAT JALAN EKSPOR',
      docNo: doItem.doNumber || doItem.id,
      refNo: doItem.soNumber || doItem.customerPONumber || '-',
      itemCode: 'JEWELRY-EXP-750',
      itemName: doItem.itemDescription || 'Fine Gold Jewelry 750 (18K)',
      warehouseAccount: '1160',
      warehouseName: vaultBalances['1160']?.name || 'Vault Perhiasan Siap Ekspor (1160)',
      inQty: 0,
      outQty: weight,
      unit: 'gram',
      valueIDR: val,
      serialNo: `${doItem.goldCertificateNo || 'Cert'} | AWB: ${doItem.awbNumber || '-'}`
    });
  });

  // 6. Internal Vault Transfers
  transfers.forEach(trf => {
    const weight = Number(trf.quantityGrams || 0);
    const val = Number(trf.estimatedValueIDR || (weight * 1300000));
    const fromAcc = trf.fromAccount;
    const toAcc = trf.toAccount;

    // Deduct from Source
    if (vaultBalances[fromAcc]) {
      vaultBalances[fromAcc].totalOutGrams += weight;
      vaultBalances[fromAcc].balanceGrams -= weight;
      vaultBalances[fromAcc].totalValueIDR -= val;
    }
    allMovements.push({
      id: `TRF-OUT-${trf.id}`,
      date: trf.date || '2026-08-16',
      docType: 'TRANSFER ANTAR-VAULT (OUT)',
      docNo: trf.id,
      refNo: `Transfer ke ${trf.toVaultName}`,
      itemCode: trf.itemCode,
      itemName: trf.itemName,
      warehouseAccount: fromAcc,
      warehouseName: trf.fromVaultName,
      inQty: 0,
      outQty: weight,
      unit: 'gram',
      valueIDR: val,
      serialNo: trf.transferNotes || 'Transfer Antar Brankas'
    });

    // Add to Destination
    if (vaultBalances[toAcc]) {
      vaultBalances[toAcc].totalInGrams += weight;
      vaultBalances[toAcc].balanceGrams += weight;
      vaultBalances[toAcc].totalValueIDR += val;
    }
    allMovements.push({
      id: `TRF-IN-${trf.id}`,
      date: trf.date || '2026-08-16',
      docType: 'TRANSFER ANTAR-VAULT (IN)',
      docNo: trf.id,
      refNo: `Diterima dari ${trf.fromVaultName}`,
      itemCode: trf.itemCode,
      itemName: trf.itemName,
      warehouseAccount: toAcc,
      warehouseName: trf.toVaultName,
      inQty: weight,
      outQty: 0,
      unit: 'gram',
      valueIDR: val,
      serialNo: trf.transferNotes || 'Penerimaan Transfer Brankas'
    });
  });

  // 7. Silver Receipts & Silver Additions to Gold (Alloy)
  const silverTransactions = getSilverTransactions();
  silverTransactions.forEach(st => {
    if (st.transactionType === 'RECEIPT') {
      const weight = Number(st.weightGrams || 0);
      const val = Number(st.totalValueIDR || (weight * (st.pricePerGram || 16500)));
      if (vaultBalances['1153']) {
        vaultBalances['1153'].totalInGrams += weight;
        vaultBalances['1153'].balanceGrams += weight;
        vaultBalances['1153'].totalValueIDR += val;
      }
      allMovements.push({
        id: `SLV-IN-${st.id}`,
        date: st.date || '2026-08-01',
        docType: 'PENERIMAAN PERAK',
        docNo: st.docNo || st.id,
        refNo: st.supplierName || 'Penerimaan Perak',
        itemCode: 'SILVER-GRAIN-999',
        itemName: st.itemName || 'Granul Perak Murni 99.9%',
        warehouseAccount: '1153',
        warehouseName: vaultBalances['1153']?.name || 'Vault Perak & Alloy (1153)',
        inQty: weight,
        outQty: 0,
        unit: 'gram',
        valueIDR: val,
        serialNo: `Purity: ${st.purity || 99.9}% | @Rp ${(st.pricePerGram || 16500).toLocaleString()}/g`
      });
    } else if (st.transactionType === 'ALLOY_ADDITION') {
      const silverWeight = Number(st.silverWeightGram || 0);
      const val = Number(st.totalSilverValueIDR || (silverWeight * (st.silverPricePerGram || 16500)));
      const targetAcc = st.targetAccount || '1157';

      // Deduct from Silver Vault (1153)
      if (vaultBalances['1153']) {
        vaultBalances['1153'].totalOutGrams += silverWeight;
        vaultBalances['1153'].balanceGrams -= silverWeight;
        vaultBalances['1153'].totalValueIDR -= val;
      }
      allMovements.push({
        id: `SLV-OUT-${st.id}`,
        date: st.date || '2026-08-16',
        docType: 'ALLOY / KELUAR PERAK',
        docNo: st.id,
        refNo: `Alloy ke ${st.goldBarRef || 'Emas Batangan'} (${st.targetVaultName})`,
        itemCode: 'SILVER-ALLOY-OUT',
        itemName: `Perak Paduan Alloy (${silverWeight}g)`,
        warehouseAccount: '1153',
        warehouseName: vaultBalances['1153']?.name || 'Vault Perak & Alloy (1153)',
        inQty: 0,
        outQty: silverWeight,
        unit: 'gram',
        valueIDR: val,
        serialNo: `Kredit 1153 -> Debet ${targetAcc} | Operator: ${st.operatorName || 'Assay Master'}`
      });

      // Add alloy silver mass & value into Target Gold Vault (1157 / 11502)
      if (vaultBalances[targetAcc]) {
        vaultBalances[targetAcc].totalInGrams += silverWeight;
        vaultBalances[targetAcc].balanceGrams += silverWeight;
        vaultBalances[targetAcc].totalValueIDR += val;
      }
      allMovements.push({
        id: `ALLOY-IN-${st.id}`,
        date: st.date || '2026-08-16',
        docType: 'ALLOY / TAMBAH PERAK',
        docNo: st.id,
        refNo: `Ref: ${st.goldBarRef || 'Batangan Emas'}`,
        itemCode: 'GOLD-ALLOYED-BAR',
        itemName: `Emas Batangan + Perak Alloy (+${silverWeight}g)`,
        warehouseAccount: targetAcc,
        warehouseName: vaultBalances[targetAcc]?.name || st.targetVaultName,
        inQty: silverWeight,
        outQty: 0,
        unit: 'gram',
        valueIDR: val,
        serialNo: `Emas: ${st.goldInitialWeightGram}g + Perak: ${silverWeight}g = ${st.totalFinalWeightGram}g (Kadar: ${st.finalEstimatedPurity}%)`
      });
    }
  });

  // 8. Local Delivery Orders (Surat Jalan Pengeluaran Vault Lokal) -> OUT dari Vault Asal (1157, 1160, 1152)
  const processedSalesDONumbers = new Set();
  localDeliveryOrders.forEach(doItem => {
    if (doItem.status === 'DELIVERED' || doItem.status?.includes('DELIVERED') || doItem.status === 'SHIPPED') {
      const acc = doItem.sourceVault || '1157';
      const weight = Number(doItem.netWeightGram || doItem.quantityGrams || 0);
      const cogsVal = Number(doItem.cogsAmountIDR || (weight * 1300000));
      if (vaultBalances[acc]) {
        vaultBalances[acc].totalOutGrams += weight;
        vaultBalances[acc].balanceGrams -= weight;
        vaultBalances[acc].totalValueIDR -= cogsVal;
      }
      if (doItem.doNumber) processedSalesDONumbers.add(doItem.doNumber);
      if (doItem.invoiceNo) processedSalesDONumbers.add(doItem.invoiceNo);

      allMovements.push({
        id: `DO-LOK-${doItem.id || doItem.doNumber}`,
        date: doItem.date || '2026-08-16',
        docType: 'SURAT JALAN LOKAL',
        docNo: doItem.doNumber || doItem.id,
        refNo: `${doItem.customerName || '-'} | Ref: ${doItem.soNumber || doItem.customerPONumber || '-'}`,
        itemCode: doItem.itemCode || 'LM-LOKAL',
        itemName: doItem.itemName || 'Pengeluaran Fisik Emas Lokal',
        warehouseAccount: acc,
        warehouseName: vaultBalances[acc]?.name || 'Vault Utama (1157)',
        inQty: 0,
        outQty: weight,
        unit: 'gram',
        valueIDR: cogsVal,
        serialNo: `${doItem.barSerialNumbers || 'Seri Bar'} | Kurir: ${doItem.courierName || 'Internal'}`
      });
    }
  });

  // 8b. Direct Local Sales (Bila ada penjualan langsung yang belum ada DO terpisah)
  localSales.forEach(sale => {
    if ((sale.deliveryStatus === 'DELIVERED' || sale.paymentStatus === 'PAID') &&
        !processedSalesDONumbers.has(sale.doNumber) &&
        !processedSalesDONumbers.has(sale.invoiceNo)) {
      const acc = sale.sourceVault || '1157';
      const weight = Number(sale.quantityGrams || 0);
      const cogsVal = Number(sale.cogsAmountIDR || (weight * 1300000));
      if (vaultBalances[acc]) {
        vaultBalances[acc].totalOutGrams += weight;
        vaultBalances[acc].balanceGrams -= weight;
        vaultBalances[acc].totalValueIDR -= cogsVal;
      }
      allMovements.push({
        id: `LS-OUT-${sale.id || sale.invoiceNo}`,
        date: sale.date || '2026-08-16',
        docType: 'PENJUALAN LOKAL',
        docNo: sale.invoiceNo || sale.id,
        refNo: `${sale.customerName || '-'} | Ref: ${sale.doNumber || sale.soNumber || '-'}`,
        itemCode: sale.itemCode || 'LM-LOKAL-SALE',
        itemName: sale.itemName || 'Penjualan Logam Mulia Lokal',
        warehouseAccount: acc,
        warehouseName: vaultBalances[acc]?.name || 'Vault Utama (1157)',
        inQty: 0,
        outQty: weight,
        unit: 'gram',
        valueIDR: cogsVal,
        serialNo: `${sale.barSerialNumbers || 'Seri Bar'} | Kurir: ${sale.courierName || 'Counter'}`
      });
    }
  });

  // Calculate Running Balances chronologically
  allMovements.sort((a, b) => new Date(a.date) - new Date(b.date));
  const accountRunningTotals = {};
  const enrichedMovements = allMovements.map(m => {
    if (!accountRunningTotals[m.warehouseAccount]) {
      accountRunningTotals[m.warehouseAccount] = 0;
    }
    accountRunningTotals[m.warehouseAccount] += (m.inQty - m.outQty);
    return {
      ...m,
      balanceQty: accountRunningTotals[m.warehouseAccount]
    };
  });

  // Reverse so newest appears first on UI table
  enrichedMovements.reverse();

  // Summary Metrics
  const lmMainGrams = Math.max(0, vaultBalances['1157']?.balanceGrams || 0);
  const lmImportGrams = Math.max(0, vaultBalances['1158']?.balanceGrams || 0);
  const totalLMGrams = lmMainGrams + lmImportGrams;
  const wipGrams = Math.max(0, vaultBalances['11502']?.balanceGrams || 0);
  const exportGrams = Math.max(0, vaultBalances['1160']?.balanceGrams || 0);
  const scrapGrams = Math.max(0, vaultBalances['1152']?.balanceGrams || 0);
  const silverGrams = Math.max(0, vaultBalances['1153']?.balanceGrams || 0);
  const totalVaultGrams = totalLMGrams + wipGrams + exportGrams + scrapGrams + silverGrams;

  let grandTotalValueIDR = 0;
  Object.values(vaultBalances).forEach(vb => {
    grandTotalValueIDR += Math.max(0, vb.totalValueIDR || 0);
  });

  return {
    vaults: Object.values(vaultBalances),
    movements: enrichedMovements,
    summary: {
      totalLMGrams,
      lmMainGrams,
      lmImportGrams,
      wipGrams,
      exportGrams,
      scrapGrams,
      silverGrams,
      totalVaultGrams,
      grandTotalValueIDR
    }
  };
};

// ==========================================
// SYSTEM SEED DATA INITIALIZER
// ==========================================

export const initializeSeedData = async (force = false) => {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const seedMappings = [
    { key: KEYS.CUSTOMERS, getter: getDefaultCustomers },
    { key: KEYS.SUPPLIERS, getter: getDefaultSuppliers },
    { key: KEYS.JOURNAL_ENTRIES, getter: getDefaultJournalEntries },
    { key: KEYS.PURCHASE_REQUESTS, getter: getDefaultPurchaseRequests },
    { key: KEYS.PURCHASE_ORDERS, getter: getDefaultPurchaseOrders },
    { key: KEYS.LOCAL_PURCHASES, getter: getDefaultLocalPurchases },
    { key: KEYS.SCRAP_PURCHASES, getter: getDefaultScrapPurchases },
    { key: KEYS.GOODS_RECEIPTS, getter: getDefaultGoodsReceipts },
    { key: KEYS.PRODUCTION_SPK, getter: getDefaultProductionSPK },
    { key: KEYS.PRODUCTION_SETTLEMENTS, getter: getDefaultProductionSettlements },
    { key: KEYS.SILVER_TRANSACTIONS, getter: getDefaultSilverTransactions },
    { key: KEYS.VAULT_TRANSFERS, getter: getDefaultVaultTransfers },
    { key: KEYS.LOCAL_SALES, getter: getDefaultLocalSales },
    { key: KEYS.LOCAL_SALES_ORDERS, getter: getDefaultLocalSalesOrders },
    { key: KEYS.LOCAL_DELIVERY_ORDERS, getter: getDefaultLocalDeliveryOrders },
    { key: KEYS.LOCAL_INVOICES, getter: getDefaultLocalInvoices },
    { key: KEYS.EXPORT_SALES_ORDERS, getter: getDefaultExportSalesOrders },
    { key: KEYS.EXPORT_INVOICES, getter: getDefaultExportInvoices },
    { key: KEYS.EXPORT_DELIVERY_ORDERS, getter: getDefaultExportDeliveryOrders },
    { key: KEYS.PAYMENT_VOUCHERS, getter: getDefaultPaymentVouchers },
    { key: KEYS.RECEIPT_VOUCHERS, getter: getDefaultReceiptVouchers },
    { key: KEYS.VOUCHERS, getter: getDefaultVouchers },
    { key: KEYS.CHEQUE_BOOKS, getter: getDefaultChequeBooks }
  ];

  for (const item of seedMappings) {
    try {
      const raw = window.localStorage.getItem(item.key);
      if (force || !raw || raw === '[]' || raw === '{}') {
        const data = item.getter();
        window.localStorage.setItem(item.key, JSON.stringify(data));
      }
    } catch (e) {
      console.warn(`[SeedData] Error seeding key ${item.key}:`, e);
    }
  }
};

// Auto-seed on load if running in browser
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    initializeSeedData(false);
  } catch (e) {}
}

