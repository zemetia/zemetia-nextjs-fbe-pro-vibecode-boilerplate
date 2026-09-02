/**
 * purchaseDb.js — jembatan view legacy → database.
 *
 * View legacy (`src/views/LmImportTrading.jsx`, `LmLocalTrading.jsx`,
 * `PurchaseRequestPage.jsx`) memanggil fungsi-fungsi storageService
 * (localStorage). Modul ini mengekspos nama fungsi yang SAMA dengan bentuk
 * data legacy yang sama, tapi di belakangnya memakai API Prisma
 * (`/api/metal-purchases`, `/api/purchase-requests`, `/api/partners`,
 * `/api/products`, `/api/supplies`, `/api/journal-entries`).
 *
 * Dengan begitu UI legacy tidak berubah — hanya lapisan datanya yang pindah
 * ke database. Fungsi handoff transien (prefill PR, prefill voucher/TTB)
 * tetap localStorage karena itu state antar-halaman, bukan catatan bisnis.
 */
import { apiClient } from './client';
import { findUnit } from '@/lib/unit-conversion';
import {
  getPRConversionPrefill,
  clearPRConversionPrefill,
  setPRConversionPrefill,
  setVoucherPrefillFromPO,
  setGoodsReceiptPrefillFromPO,
  createPurchaseOrder as legacyCreatePurchaseOrder,
} from './storageService';

// ─── Re-export handoff transien (tetap localStorage) ─────────────────────────
export {
  getPRConversionPrefill,
  clearPRConversionPrefill,
  setPRConversionPrefill,
  setVoucherPrefillFromPO,
  setGoodsReceiptPrefillFromPO,
};

// ─── Helper umum ─────────────────────────────────────────────────────────────

const OZ_TO_GRAM = 31.1034768;

/** List endpoint mengembalikan `{ data: [...], total, ... }` — normalisasi. */
function unwrapList(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  if (body && Array.isArray(body.items)) return body.items;
  return [];
}

function errMsg(error, fallback) {
  return error?.message || fallback;
}

function toErrors(error, fallback) {
  const msg = errMsg(error, fallback);
  return { success: false, errors: [msg], message: msg };
}

function toSuccess(data) {
  return { success: true, ...data };
}

// ─── Cache master (supplier, produk, supply, COA) ────────────────────────────

function toSupplierVO(p) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    origin: p.country_iso2 === 'ID' ? 'LOCAL' : 'OVERSEAS',
    currency: p.currency_code,
    country: p.country_name,
  };
}

let suppliersCache = null;
async function getSuppliersFromDb() {
  if (!suppliersCache) {
    const body = await apiClient.get('/api/partners?role=supplier&limit=30', { cache: 'no-store' });
    suppliersCache = unwrapList(body).map(toSupplierVO);
  }
  return suppliersCache;
}

/** Supplier luar negeri (master mitra database) — untuk form PO LM Impor. */
export async function getImportSuppliers() {
  const body = await apiClient.get('/api/partners?role=supplier&origin=OVERSEAS&limit=30', { cache: 'no-store' });
  return unwrapList(body).map(toSupplierVO);
}

let productsCache = null;
async function getProductsFromDb() {
  if (!productsCache) {
    const body = await apiClient.get('/api/products', { cache: 'no-store' });
    productsCache = unwrapList(body).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      metal: p.metal,
      form: p.form,
      category: p.form === 'BULLION' ? 'Emas Murni' : p.form === 'JEWELRY' ? 'Perhiasan' : p.form === 'SCRAP' ? 'Scrap' : 'Granul',
      unit: 'gram',
      purity: p.default_purity_percent || 99.99,
      purityLocked: p.purity_locked,
    }));
  }
  return productsCache;
}

let suppliesCache = null;
async function getSuppliesFromDb() {
  if (!suppliesCache) {
    const body = await apiClient.get('/api/supplies?limit=30', { cache: 'no-store' });
    suppliesCache = unwrapList(body).map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      category: s.category,
      unit: s.unit,
      lastPriceIdr: s.last_price_idr,
    }));
  }
  return suppliesCache;
}

let unitsCache = null;
async function getUnitsFromDb() {
  if (!unitsCache) {
    const body = await apiClient.get('/api/units', { cache: 'no-store' });
    unitsCache = unwrapList(body).map((u) => ({ id: u.id, code: u.code, symbol: u.symbol }));
  }
  return unitsCache;
}

/**
 * Simbol/alias satuan bebas ketik (`'g'`, `'oz'`, `'oz t'`, `'kg'`, ...) → id
 * `Unit` database. `findUnit()` (`src/lib/unit-conversion.ts`) menormalisasi
 * alias apa pun ke kode kanonik (`'TROY_OZ'`, `'G'`, ...); kode itu sama
 * persis dengan kolom `code` yang dipakai `unit.seeder.ts` — jadi cocok tanpa
 * tabel pemetaan kedua.
 */
async function resolveUnitId(unitText) {
  const resolved = findUnit(unitText);
  const code = resolved ? resolved.code : String(unitText || '').trim().toUpperCase();
  const units = await getUnitsFromDb();
  const found = units.find((u) => u.code === code);
  if (!found) throw new Error(`Satuan "${unitText}" tidak dikenali di master satuan database.`);
  return found.id;
}

let accountCache = null;
/** Kode akun legacy → kode akun COA database (alias yang dipakai form lama). */
const ACCOUNT_CODE_ALIAS = {
  '1111-IDR': '1121',
  '1111': '1121',
  '1110-1': '11101',
  '2111': '2110',
};
function flattenAccountTree(nodes) {
  const flat = [];
  const walk = (list) => {
    for (const node of list) {
      flat.push({ id: node.id, code: node.code, name: node.name });
      if (Array.isArray(node.children)) walk(node.children);
    }
  };
  walk(nodes);
  return flat;
}
async function accountIdByCode(code) {
  const target = ACCOUNT_CODE_ALIAS[code] || code;
  if (!accountCache) {
    const body = await apiClient.get('/api/accounts', { cache: 'no-store' });
    accountCache = flattenAccountTree(Array.isArray(body) ? body : body?.data ?? []);
  }
  const found = accountCache.find((a) => a.code === target);
  if (!found) throw new Error(`Akun ${code} tidak ditemukan di bagan akun database.`);
  return found.id;
}

async function findProductForGold(itemCode, itemId) {
  const products = await getProductsFromDb();
  if (itemId) {
    const byId = products.find((p) => p.id === itemId);
    if (byId) return byId;
  }
  if (itemCode) {
    const byCode = products.find((p) => p.code === itemCode);
    if (byCode) return byCode;
  }
  return products.find((p) => p.metal === 'GOLD' && p.form === 'BULLION') || products[0];
}

// ─── Pemetaan bentuk data: DTO → legacy ──────────────────────────────────────

const SERIAL_NOTE_PREFIX = 'Seri: ';
const LOCATION_NOTE_PREFIX = 'Lokasi: ';

function parseSerialsFromNotes(notes) {
  if (!notes) return [];
  const match = String(notes).match(new RegExp(`${SERIAL_NOTE_PREFIX}([^\\n]*)`));
  if (!match || !match[1]) return [];
  return match[1].split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
}

function parseLocationFromNotes(notes) {
  if (!notes) return '';
  const match = String(notes).match(new RegExp(`${LOCATION_NOTE_PREFIX}([^\\n]*)`));
  return match ? match[1].trim() : '';
}

function stripMarkers(notes) {
  if (!notes) return '';
  return String(notes)
    .split('\n')
    .filter((line) => !line.startsWith(SERIAL_NOTE_PREFIX) && !line.startsWith(LOCATION_NOTE_PREFIX))
    .join('\n')
    .trim();
}

function toLegacyImportOrder(dto) {
  const item = dto.items?.[0];
  const weightGram = Number(item?.weight_gram || 0);
  const isOz = item?.weight_unit === 'TROY_OUNCE';
  const exchangeRate = Number(dto.exchange_rate || 0);
  const totalAmountUSD = Number(dto.goods_amount || 0);
  const totalLandedCostIDR = exchangeRate > 0 ? totalAmountUSD * exchangeRate : totalAmountUSD;
  const paid = Number(dto.paid_amount_idr || 0);
  const remaining = dto.remaining_balance_idr !== null && dto.remaining_balance_idr !== undefined
    ? Number(dto.remaining_balance_idr)
    : Math.max(0, totalLandedCostIDR - paid);

  return {
    id: dto.id,
    poNumber: dto.number,
    supplierName: dto.partner.name,
    supplier: dto.partner.name,
    supplierId: dto.partner.id,
    orderDate: dto.date,
    invoiceNumber: dto.supplier_invoice_number || '',
    currency: dto.currency_code,
    exchangeRate,
    quantityUnits: isOz ? weightGram / OZ_TO_GRAM : weightGram,
    unitMode: isOz ? 'oz' : 'gram',
    weightGrams: Math.round(weightGram * 100) / 100,
    weightOz: Math.round((weightGram / OZ_TO_GRAM) * 100) / 100,
    totalAmountUSD,
    totalLandedCostIDR: Math.round(totalLandedCostIDR),
    unitLandedCostIDRPerGram: weightGram > 0 ? Math.round(totalLandedCostIDR / weightGram) : 0,
    paidAmountIDR: paid,
    remainingBalanceIDR: remaining,
    paymentStatus: dto.payment_status === 'PAID' ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
    status: dto.status === 'CONFIRMED' ? 'approved' : dto.status === 'VOID' ? 'void' : 'draft',
    prId: dto.purchase_request_id || '',
    prNumber: dto.purchase_request_number || '',
    barSerialNumbers: parseSerialsFromNotes(item?.notes),
    logisticsCarrier: dto.courier_name || '',
    notes: stripMarkers(dto.notes || item?.notes || ''),
    paymentTerms: '',
    items: (dto.items || []).map((it) => ({
      itemId: it.product.id,
      itemCode: it.product.code,
      itemName: it.product.name,
      quantity: Number(it.weight_gram),
      unit: it.weight_unit === 'TROY_OUNCE' ? 'oz' : 'gram',
      unitPrice: Number(it.price_per_unit),
      unitPriceUSD: Number(it.price_per_unit),
      totalUSD: Number(it.amount),
    })),
  };
}

function toLegacyLocalPurchase(dto, vaultReceived = false) {
  const item = dto.items?.[0];
  const totalAmount = Number(dto.goods_amount || 0);
  const paid = Number(dto.paid_amount_idr || 0);
  const remaining = dto.remaining_balance_idr !== null && dto.remaining_balance_idr !== undefined
    ? Number(dto.remaining_balance_idr)
    : Math.max(0, totalAmount - paid);

  return {
    id: dto.id,
    receiptNo: dto.number,
    poNumber: dto.number,
    ttbNumber: `TTB-${dto.number}`,
    supplierName: dto.partner.name,
    supplierId: dto.partner.id,
    orderDate: dto.date,
    itemCode: item?.product.code || '',
    itemName: item?.product.name || '',
    quantityGrams: Number(item?.weight_gram || 0),
    unitPriceIDR: Number(item?.price_per_unit || 0),
    totalAmount,
    paymentMode: dto.payment_type === 'DP' ? 'cash' : 'credit',
    paymentStatus: dto.payment_status === 'PAID' ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
    paidAmountIDR: paid,
    remainingBalanceIDR: remaining,
    paymentHistory: (dto.payments || []).map((p) => ({
      voucherNo: p.voucher_no || '',
      voucherType: p.voucher_type || '',
      date: p.date || '',
      category: p.category,
      categoryLabel: p.category_label || '',
      payee: p.payee || '',
      bank: p.bank || '',
      bankAccountCode: p.bank_account_code || '',
      accountCode: p.account_code || '',
      amount: Number(p.amount || 0),
      notes: p.notes || '',
    })),
    barCertificateNo: parseSerialsFromNotes(item?.notes).join(', '),
    courierName: dto.courier_name || '',
    courierDocNo: dto.courier_mandate_number || '',
    pickupLocation: parseLocationFromNotes(dto.notes),
    ownerApprovedBy: '',
    ownerApproved: true,
    status: dto.status === 'CONFIRMED' ? 'approved' : dto.status === 'VOID' ? 'void' : 'draft',
    isVaultReceived: vaultReceived,
    vaultReceivedAt: vaultReceived ? dto.updated_at : null,
    prId: dto.purchase_request_id || '',
    prNumber: dto.purchase_request_number || '',
  };
}

const LEGACY_STATUS_BY_DB = {
  DRAFT: 'PENDING',
  APPROVED: 'APPROVED',
  VOID: 'VOID',
};

function toLegacyPR(dto) {
  const isConverted = dto.converted_po_number ? 'CONVERTED TO PO' : null;
  const status = isConverted || LEGACY_STATUS_BY_DB[dto.status] || dto.status;
  return {
    id: dto.id,
    prNumber: dto.number,
    category: dto.category,
    requestDate: dto.date,
    requiredDate: dto.required_date || '',
    department: dto.department,
    requesterName: dto.requester_name || '',
    priority: dto.priority === 'URGENT' ? 'Urgent' : 'Normal',
    recommendedSupplier: dto.recommended_supplier || '',
    currency: dto.currency_code,
    notes: dto.notes || '',
    items: (dto.items || []).map((it) => ({
      itemId: it.product?.id || it.supply?.id || '',
      itemCode: it.product?.code || it.supply?.code || '',
      itemName: it.product?.name || it.supply?.name || '',
      quantity: Number(it.quantity),
      unit: it.unit?.symbol || it.supply?.unit || 'pcs',
      estUnitPrice: Number(it.est_unit_price || 0),
      subtotal: Number(it.est_amount || 0),
      notes: it.notes || '',
    })),
    totalEstAmount: Number(dto.est_total_amount || 0),
    status,
    convertedPoNumber: dto.converted_po_number || '',
    approvedBy: dto.approved_by?.name || '',
    approvedAt: dto.approved_at || '',
    createdAt: dto.created_at,
  };
}

// ─── Data: daftar ────────────────────────────────────────────────────────────

/** Riwayat PO Impor (legacy `getPurchaseOrders`). */
export async function getPurchaseOrders() {
  const body = await apiClient.get('/api/metal-purchases?type=IMPORT&limit=30', { cache: 'no-store' });
  const rows = unwrapList(body);
  const details = await Promise.all(rows.map((row) => apiClient.get(`/api/metal-purchases/${row.id}`, { cache: 'no-store' })));
  return details.map(toLegacyImportOrder);
}

/** Riwayat PO Lokal (legacy `getLocalPurchases`) + status vault dari jurnal. */
export async function getLocalPurchases() {
  const body = await apiClient.get('/api/metal-purchases?type=LOCAL&limit=30', { cache: 'no-store' });
  const rows = unwrapList(body);
  const details = await Promise.all(rows.map((row) => apiClient.get(`/api/metal-purchases/${row.id}`, { cache: 'no-store' })));

  let vaultSet = new Set();
  try {
    const jBody = await apiClient.get('/api/journal-entries?limit=30', { cache: 'no-store' });
    const journals = unwrapList(jBody);
    vaultSet = new Set(
      journals
        .filter((j) => String(j.description || '').includes('[TAHAP 2]'))
        .flatMap((j) => {
          const m = String(j.description).match(/\(([^)]*)\)/);
          return m ? [m[1].trim()] : [];
        }),
    );
  } catch {
    // Jurnal tak terbaca → semua dianggap belum sampai vault; daftar tetap tampil.
  }

  return details.map((dto) => toLegacyLocalPurchase(dto, vaultSet.has(dto.number)));
}

/**
 * Daftar Purchase Request (legacy `getPurchaseRequests`) — bentuk legacy penuh.
 * `filters` opsional: `{ category, status }`, diteruskan sebagai query — dipakai
 * form PO Impor/Lokal supaya hanya PR sekategori & sudah APPROVED yang muncul
 * sebagai referensi (satu-satunya yang benar-benar bisa dikonversi, lihat
 * `linkMetalPurchaseRequest` di `src/lib/metal-purchase-write.ts`).
 */
export async function getPurchaseRequests(filters = {}) {
  const params = new URLSearchParams({ limit: '30' });
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  const body = await apiClient.get(`/api/purchase-requests?${params.toString()}`, { cache: 'no-store' });
  const rows = unwrapList(body);
  const details = await Promise.all(
    rows.map((row) => apiClient.get(`/api/purchase-requests/${row.id}`, { cache: 'no-store' })),
  );
  return details.map(toLegacyPR);
}

/** Master barang (legacy `getMasterItems`) — produk database. */
export async function getMasterItems() {
  return getProductsFromDb();
}

/** Master bahan operasional non-logam (supply). */
export async function getSupplyItems() {
  return getSuppliesFromDb();
}

/** Master supplier (legacy `getSuppliers`) — partner database. */
export async function getSuppliers() {
  return getSuppliersFromDb();
}

// ─── Data: tulis ─────────────────────────────────────────────────────────────

/**
 * Terbitkan PO Impor (legacy `createPurchaseOrder` untuk payload impor).
 * Payload operasional non-logam (tanpa `baseAmountUSD`) tetap lewat
 * storageService legacy — database belum punya model PO operasional.
 */
export async function createPurchaseOrder(poPayload) {
  const isImport = poPayload && (poPayload.baseAmountUSD !== undefined || poPayload.type === 'IMPORT');
  if (!isImport) {
    return legacyCreatePurchaseOrder(poPayload);
  }

  try {
    const suppliers = await getSuppliersFromDb();
    const partner = suppliers.find((s) => s.name === poPayload.supplierName) || suppliers.find((s) => s.name?.toLowerCase().includes((poPayload.supplierName || '').toLowerCase()));
    if (!partner) {
      return { success: false, errors: [`Supplier "${poPayload.supplierName}" tidak ditemukan di master mitra database.`] };
    }

    const product = await findProductForGold(poPayload.items?.[0]?.itemCode, poPayload.items?.[0]?.itemId);
    const weightGrams = Number(poPayload.weightGrams || 0);
    const isOz = poPayload.unitMode === 'oz';
    const totalUSD = Number(poPayload.totalAmountUSD || poPayload.baseAmountUSD || 0);
    const pricePerUnit = isOz
      ? (weightGrams > 0 ? (totalUSD / (weightGrams / OZ_TO_GRAM)) : 0)
      : (weightGrams > 0 ? (totalUSD / weightGrams) : 0);

    const serials = Array.isArray(poPayload.barSerialNumbers) && poPayload.barSerialNumbers.length > 0
      ? poPayload.barSerialNumbers
      : (poPayload.certificates || []).map((c) => (typeof c === 'string' ? c : c?.serialNumber)).filter(Boolean);

    const created = await apiClient.post('/api/metal-purchases', {
      type: 'IMPORT',
      payment_type: 'PO',
      partner_id: partner.id,
      date: poPayload.orderDate,
      supplier_invoice_number: poPayload.invoiceNumber || null,
      currency_code: 'USD',
      exchange_rate: Number(poPayload.exchangeRate) || null,
      courier_name: poPayload.logisticsCarrier || poPayload.logisticsPartner || null,
      purchase_request_id: poPayload.prId || null,
      items: [{
        product_id: product.id,
        weight_unit: isOz ? 'TROY_OUNCE' : 'GRAM',
        weight_gram: Math.round(weightGrams * 10000) / 10000,
        purity_percent: product.purity || 99.99,
        price_per_unit: Math.round(pricePerUnit * 100000000) / 100000000,
        notes: serials.length > 0 ? `${SERIAL_NOTE_PREFIX}${serials.join(', ')}` : null,
      }],
      charges: [],
      notes: poPayload.notes || null,
    });

    return toSuccess({
      order: {
        id: created.id,
        poNumber: created.number,
        receiptNo: created.number,
        supplierName: created.partner.name,
        totalAmountUSD: Number(created.goods_amount),
      },
    });
  } catch (error) {
    return toErrors(error, 'Gagal menerbitkan PO Impor.');
  }
}

/** Simpan pembelian lokal baru (legacy `saveLocalPurchases` untuk create). */
export async function createLocalPurchase(lp) {
  try {
    const suppliers = await getSuppliersFromDb();
    const partner = suppliers.find((s) => s.name === lp.supplierName) || suppliers.find((s) => s.name?.toLowerCase().includes((lp.supplierName || '').toLowerCase()));
    if (!partner) {
      return { success: false, errors: [`Supplier "${lp.supplierName}" tidak ditemukan di master mitra database.`] };
    }

    const product = await findProductForGold(lp.itemCode, lp.itemId);
    const serials = Array.isArray(lp.barSerialNumbers) && lp.barSerialNumbers.length > 0
      ? lp.barSerialNumbers
      : (lp.barCertificateNo || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);

    const noteLines = [];
    if (lp.notes) noteLines.push(lp.notes);
    if (lp.pickupLocation) noteLines.push(`${LOCATION_NOTE_PREFIX}${lp.pickupLocation}`);

    const created = await apiClient.post('/api/metal-purchases', {
      type: 'LOCAL',
      payment_type: lp.paymentMode === 'cash' ? 'DP' : 'PO',
      partner_id: partner.id,
      date: lp.orderDate,
      currency_code: 'IDR',
      purchase_request_id: lp.prId || null,
      courier_name: lp.courierName || null,
      courier_mandate_number: lp.courierDocNo || null,
      items: [{
        product_id: product.id,
        weight_unit: 'GRAM',
        weight_gram: Number(lp.quantityGrams || 0),
        purity_percent: lp.purityPercent || product.purity || 99.99,
        price_per_unit: Number(lp.unitPriceIDR || 0),
        notes: serials.length > 0 ? `${SERIAL_NOTE_PREFIX}${serials.join(', ')}` : null,
      }],
      charges: [],
      notes: noteLines.join('\n') || null,
    });

    return toSuccess({
      order: {
        id: created.id,
        poNumber: created.number,
        receiptNo: created.number,
        supplierName: created.partner.name,
        totalAmount: Number(created.goods_amount),
      },
    });
  } catch (error) {
    return toErrors(error, 'Gagal menyimpan pembelian lokal.');
  }
}

/** Konfirmasi emas tiba di vault — jurnal tahap 2 (Debet 1157 vs Kredit 1159). */
export async function confirmVaultArrival(purchase) {
  const total = Number(purchase.totalAmount || 0);
  const receiptNo = purchase.receiptNo || purchase.poNumber;
  try {
    await postJournalEntry({
      date: new Date().toISOString().split('T')[0],
      description: `[TAHAP 2] Serah Terima Fisik Emas Ke Vault Utama (${receiptNo}) - Barang: ${purchase.itemName || ''} (${purchase.quantityGrams || 0}g) | Debet: Akun 1157 (Vault Utama) | Kredit: Akun 1159 (Transit Kurir ${purchase.courierName || ''})`,
      lines: [
        { accountCode: '1157', accountName: 'Persediaan Logam Mulia Antam (Gold Bar)', debit: total, credit: 0 },
        { accountCode: '1159', accountName: 'Persediaan Emas Dalam Perjalanan Kurir (Transit)', debit: 0, credit: total },
      ],
    });
    return toSuccess({});
  } catch (error) {
    return toErrors(error, 'Gagal posting jurnal tahap 2 (vault).');
  }
}

/** Posting jurnal ke database (legacy `saveJournalEntries` untuk entry baru). */
export async function postJournalEntry(entry) {
  const lines = [];
  for (const line of entry.lines || []) {
    const accountId = await accountIdByCode(line.accountCode);
    lines.push({
      account_id: accountId,
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
    });
  }
  const created = await apiClient.post('/api/journal-entries', {
    date: entry.date,
    description: entry.description,
    lines,
  });
  await apiClient.patch(`/api/journal-entries/${created.id}/status`, { status: 'POSTED' });
  return created;
}

/** Ajukan Purchase Request baru (legacy `savePurchaseRequests` untuk create). */
export async function createPurchaseRequest(form) {
  try {
    const categoryMap = {
      GOLD_IMPORT: 'GOLD_IMPORT',
      GOLD_LOCAL: 'GOLD_LOCAL',
      LAB_CHEMICALS: 'CHEMICALS_REFINERY',
      GENERAL_SUPPLIES: 'SAFETY_GA',
    };
    const category = categoryMap[form.category] || form.category;
    const isGold = category === 'GOLD_IMPORT' || category === 'GOLD_LOCAL';

    const items = [];
    for (const item of form.items || []) {
      const unitId = await resolveUnitId(item.unit);
      if (isGold) {
        const product = await findProductForGold(item.itemCode, item.itemId);
        items.push({
          product_id: product.id,
          unit_id: unitId,
          quantity: Number(item.quantity),
          est_unit_price: Number(item.estUnitPrice || 0),
          notes: item.notes || null,
        });
      } else {
        let supply = null;
        const supplies = await getSuppliesFromDb();
        supply = supplies.find((s) => s.id === item.itemId) || supplies.find((s) => s.code === item.itemCode) || null;
        if (!supply) {
          return { success: false, errors: [`Barang "${item.itemName}" tidak ditemukan di master bahan (supply) database.`] };
        }
        items.push({
          supply_id: supply.id,
          unit_id: unitId,
          quantity: Number(item.quantity),
          est_unit_price: Number(item.estUnitPrice || 0),
          notes: item.notes || null,
        });
      }
    }

    const created = await apiClient.post('/api/purchase-requests', {
      category,
      date: form.requestDate || new Date().toISOString().split('T')[0],
      required_date: form.requiredDate || undefined,
      department: form.department,
      priority: form.priority === 'Urgent' ? 'URGENT' : 'NORMAL',
      suggested_partner_id: undefined,
      requester_name: form.requesterName || undefined,
      recommended_supplier: form.recommendedSupplier || undefined,
      currency_code: form.currency || 'IDR',
      notes: form.notes || undefined,
      items,
    });

    return toSuccess({ pr: { id: created.id, prNumber: created.number } });
  } catch (error) {
    return toErrors(error, 'Gagal mengajukan Purchase Request.');
  }
}

/** Otorisasi/approve PR (legacy `savePurchaseRequests` untuk approve). */
export async function approvePurchaseRequest(prId) {
  try {
    const updated = await apiClient.patch(`/api/purchase-requests/${prId}/status`, { status: 'APPROVED' });
    return toSuccess({ pr: { id: updated.id, prNumber: updated.number, status: updated.status } });
  } catch (error) {
    return toErrors(error, 'Gagal menyetujui Purchase Request.');
  }
}

// ─── No-op / nomor tiruan (nomor asli lahir di server) ───────────────────────

/** Konversi PR ditangani server saat PO dibuat dengan `purchase_request_id`. */
export async function markPRAsConverted() {
  return undefined;
}

export async function getNextReferenceNumber() {
  return `JRN-${Date.now().toString().slice(-6)}`;
}

export async function generateNextTTBNumber() {
  return `TTB-${Date.now().toString().slice(-6)}`;
}
