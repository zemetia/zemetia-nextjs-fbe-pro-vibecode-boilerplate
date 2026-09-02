import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

// Schema for PO Line Item (Non-SQL embedded array)
const poLineItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  itemId: commonRules.optionalString(),
  itemCode: commonRules.optionalString(),
  itemName: commonRules.optionalString(),
  description: commonRules.optionalString(),
  quantity: commonRules.positiveNumber('Jumlah Barang').default(1),
  unit: z.string().default('g'),
  unitPrice: commonRules.nonNegativeNumber('Harga Satuan').default(0),
  unitPriceUSD: commonRules.nonNegativeNumber('Harga Satuan USD').default(0),
  totalAmount: commonRules.nonNegativeNumber('Total Harga').default(0),
  totalUSD: commonRules.nonNegativeNumber('Total USD').default(0)
}).passthrough();

export const importPurchaseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  poNumber: commonRules.optionalString(),
  supplier: commonRules.optionalString(),
  supplierName: commonRules.nonEmptyString('Nama Supplier Impor'),
  orderDate: commonRules.dateString('Tanggal PO Impor'),
  invoiceNumber: commonRules.optionalString(),
  currency: z.string().default('USD'),
  paymentTerms: commonRules.optionalString(),
  exchangeRate: commonRules.positiveNumber('Kurs Valas BCA e-Rate'),
  status: z.string().default('approved'),
  unitMode: z.enum(['oz', 'gram']).default('oz'),
  quantityUnits: commonRules.positiveNumber('Jumlah Kuantitas Pesanan'),
  weightGrams: commonRules.positiveNumber('Total Berat Emas (Gram)'),
  weightOz: commonRules.positiveNumber('Total Berat Emas (Troy Oz)'),
  baseAmountUSD: commonRules.positiveNumber('Nilai Kesepakatan Base Metal USD'),
  totalAmountUSD: commonRules.positiveNumber('Total Nilai PO USD'),
  importDuty: commonRules.nonNegativeNumber('Bea Masuk').default(0),
  pph22Import: commonRules.nonNegativeNumber('PPh Pasal 22 Impor').default(0),
  freightAndInsurance: commonRules.nonNegativeNumber('Ongkos Kirim & Asuransi').default(0),
  totalLandedCostIDR: commonRules.nonNegativeNumber('Total Landed Cost IDR').default(0),
  unitLandedCostIDRPerGram: commonRules.nonNegativeNumber('Landed Cost per Gram IDR').default(0),
  paidAmountIDR: commonRules.nonNegativeNumber('Nominal Terbayar IDR').default(0),
  remainingBalanceIDR: commonRules.nonNegativeNumber('Sisa Hutang IDR').default(0),
  paymentStatus: z.string().default('UNPAID'),
  items: z.array(poLineItemSchema).default([]),
  barSerialNumbers: z.array(z.string()).default([]),
  paymentHistory: z.array(z.any()).default([]),
  logisticsCarrier: commonRules.optionalString(),
  prId: commonRules.optionalString(),
  prNumber: commonRules.optionalString(),
  notes: commonRules.optionalString(),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultImportPurchase = {
  poNumber: '',
  supplier: 'SUPP-YLG-SG',
  supplierName: '',
  orderDate: new Date().toISOString().split('T')[0],
  invoiceNumber: '',
  currency: 'USD',
  paymentTerms: 'CAD',
  exchangeRate: 16250,
  status: 'approved',
  unitMode: 'oz',
  quantityUnits: 0,
  weightGrams: 0,
  weightOz: 0,
  baseAmountUSD: 0,
  totalAmountUSD: 0,
  importDuty: 0,
  pph22Import: 0,
  freightAndInsurance: 0,
  totalLandedCostIDR: 0,
  unitLandedCostIDRPerGram: 0,
  paidAmountIDR: 0,
  remainingBalanceIDR: 0,
  paymentStatus: 'UNPAID',
  items: [],
  barSerialNumbers: [],
  paymentHistory: [],
  logisticsCarrier: 'BRINKS Global Services',
  prId: '',
  prNumber: '',
  notes: '',
  createdAt: new Date().toISOString()
};

const baseDto = createDto(importPurchaseSchema, defaultImportPurchase);

export const ImportPurchaseDTO = {
  ...baseDto,

  /**
   * Sanitizes and normalizes an import purchase order.
   * Auto-recovers USD amounts, volume units, and weight from legacy fields or items.
   */
  fromStorage(raw) {
    if (!raw || typeof raw !== 'object') {
      return { ...defaultImportPurchase };
    }

    const isUSD = raw.currency === 'USD' || Number(raw.totalAmountUSD) > 0 || Number(raw.baseAmountUSD) > 0;

    // 1. Recover USD Total & Base Amount
    let totalAmountUSD = Number(raw.totalAmountUSD || 0);
    let baseAmountUSD = Number(raw.baseAmountUSD || 0);

    if (isUSD) {
      if (!totalAmountUSD) {
        totalAmountUSD = Number(raw.baseAmountUSD || raw.total || raw.subtotal || 0);
        if (!totalAmountUSD && Array.isArray(raw.items) && raw.items.length > 0) {
          totalAmountUSD = raw.items.reduce((sum, item) => {
            const p = Number(item.unitPriceUSD || item.unitPrice || 0);
            const q = Number(item.quantity || item.qty || item.weight || 0);
            return sum + (p * q);
          }, 0);
        }
      }
      if (!baseAmountUSD) {
        baseAmountUSD = totalAmountUSD;
      }
    }

    // 2. Recover Weights (Grams & Troy Oz)
    let weightGrams = Number(raw.weightGrams || 0);
    if (!weightGrams && Array.isArray(raw.items) && raw.items.length > 0) {
      weightGrams = raw.items.reduce((sum, item) => sum + Number(item.quantity || item.qty || item.weight || 0), 0);
    }
    weightGrams = Math.round(weightGrams * 100) / 100;

    const unitMode = raw.unitMode || 'oz';
    let weightOz = Number(raw.weightOz || 0);
    if (!weightOz && weightGrams > 0) {
      weightOz = Math.round((weightGrams / 31.1034768) * 100) / 100;
    }

    // 3. Recover Quantity Units (Respect unitMode)
    let quantityUnits = Number(raw.quantityUnits || 0);
    if (!quantityUnits) {
      if (unitMode === 'oz' && weightOz > 0) {
        quantityUnits = weightOz;
      } else if (weightGrams > 0) {
        quantityUnits = unitMode === 'oz' ? Math.round((weightGrams / 31.1034768) * 100) / 100 : weightGrams;
      }
    }

    // 4. Financials & Landed Cost
    const exchangeRate = Number(raw.exchangeRate || 16250);
    const totalLandedCostIDR = Number(
      raw.totalLandedCostIDR ||
      (totalAmountUSD > 0 ? totalAmountUSD * exchangeRate : raw.subtotalIDR || raw.total || 0)
    );
    const unitLandedCostIDRPerGram = Number(
      raw.unitLandedCostIDRPerGram ||
      (weightGrams > 0 ? Math.round(totalLandedCostIDR / weightGrams) : 0)
    );
    const paidAmountIDR = Number(raw.paidAmountIDR || 0);
    const remainingBalanceIDR = typeof raw.remainingBalanceIDR !== 'undefined'
      ? Number(raw.remainingBalanceIDR)
      : Math.max(0, totalLandedCostIDR - paidAmountIDR);

    const enriched = {
      ...raw,
      unitMode,
      quantityUnits,
      weightGrams,
      weightOz,
      baseAmountUSD,
      totalAmountUSD,
      exchangeRate,
      totalLandedCostIDR,
      unitLandedCostIDRPerGram,
      paidAmountIDR,
      remainingBalanceIDR,
      status: raw.status || 'approved',
      prId: raw.prId || raw.prfId || '',
      prNumber: raw.prNumber || raw.prfNumber || '',
      invoiceNumber: raw.invoiceNumber || '',
      paymentTerms: raw.paymentTerms || '100% Cash Before Delivery (Advance TT)'
    };

    return baseDto.fromStorage(enriched);
  },

  fromStorageList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => this.fromStorage(item));
  }
};

