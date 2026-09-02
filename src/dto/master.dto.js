import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

// 1. Master Item
export const masterItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  code: commonRules.nonEmptyString('Kode Barang'),
  name: commonRules.nonEmptyString('Nama Barang'),
  category: commonRules.optionalString(),
  unit: z.string().default('g'),
  purity: commonRules.percentageNumber('Kadar Kemurnian %').default(99.99),
  inventoryAccount: commonRules.optionalString(),
  status: z.string().default('ACTIVE'),
  notes: commonRules.optionalString()
}).passthrough();

export const defaultMasterItem = {
  code: '',
  name: '',
  category: 'RAW_MATERIAL',
  unit: 'g',
  purity: 99.99,
  inventoryAccount: '1157',
  status: 'ACTIVE',
  notes: ''
};

export const MasterItemDTO = createDto(masterItemSchema, defaultMasterItem);

// 2. Master Finished Goods (Perhiasan Jadi)
export const finishedGoodSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  sku: commonRules.nonEmptyString('SKU Produk'),
  name: commonRules.nonEmptyString('Nama Perhiasan'),
  type: commonRules.optionalString(),
  karat: z.string().default('750'),
  purity: commonRules.percentageNumber('Kadar Kemurnian %').default(75.0),
  goldColor: commonRules.optionalString(),
  stdWeightGram: commonRules.positiveNumber('Berat Standar (Gram)').default(1),
  laborFeeIDRPerGram: commonRules.nonNegativeNumber('Ongkos Tukang per Gram').default(0),
  hsCode: commonRules.optionalString(),
  inventoryAccount: commonRules.optionalString(),
  notes: commonRules.optionalString()
}).passthrough();

export const defaultFinishedGood = {
  sku: '',
  name: '',
  type: 'Cincin (Ring)',
  karat: '750',
  purity: 75.0,
  goldColor: 'Yellow Gold',
  stdWeightGram: 1,
  laborFeeIDRPerGram: 15000,
  hsCode: '7113.19.90',
  inventoryAccount: '1160',
  notes: ''
};

export const FinishedGoodDTO = createDto(finishedGoodSchema, defaultFinishedGood);

// 3. Master Supplier
export const supplierSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  code: commonRules.nonEmptyString('Kode Supplier'),
  name: commonRules.nonEmptyString('Nama Supplier / Perusahaan'),
  category: commonRules.optionalString(),
  type: commonRules.optionalString(),
  suppliedItems: z.union([
    z.array(z.string()),
    z.string().transform(str => (str ? str.split(',').map(s => s.trim()).filter(Boolean) : []))
  ]).default([]),
  country: commonRules.optionalString(),
  currency: z.string().default('IDR'),
  paymentTerms: commonRules.optionalString(),
  taxStatus: z.string().default('NON_PKP'),
  npwp: commonRules.optionalString(),
  contact: commonRules.optionalString(),
  phone: commonRules.optionalString(),
  email: commonRules.optionalString(),
  address: commonRules.optionalString(),
  bankName: commonRules.optionalString(),
  bankAccountNumber: commonRules.optionalString(),
  bankAccountHolder: commonRules.optionalString(),
  notes: commonRules.optionalString(),
  status: z.string().default('ACTIVE'),
  createdAt: commonRules.optionalString(),
  updatedAt: commonRules.optionalString()
}).passthrough();

export const defaultSupplier = {
  id: '',
  code: '',
  name: '',
  category: 'LOCAL',
  type: 'LOCAL',
  suppliedItems: [],
  country: 'Indonesia',
  currency: 'IDR',
  paymentTerms: 'CASH',
  taxStatus: 'NON_PKP',
  npwp: '',
  contact: '',
  phone: '',
  email: '',
  address: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountHolder: '',
  notes: '',
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: ''
};

export const SupplierDTO = createDto(supplierSchema, defaultSupplier);

// 4. Master Customer
export const customerSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  code: commonRules.optionalString(),
  name: commonRules.nonEmptyString('Nama Customer / Buyer'),
  type: commonRules.optionalString(),
  contact: commonRules.optionalString(),
  country: commonRules.optionalString(),
  phone: commonRules.optionalString(),
  address: commonRules.optionalString(),
  currency: z.string().default('IDR'),
  status: z.string().default('ACTIVE')
}).passthrough();

export const defaultCustomer = {
  code: '',
  name: '',
  type: 'LOCAL',
  contact: '',
  country: 'Indonesia',
  phone: '',
  address: '',
  currency: 'IDR',
  status: 'ACTIVE'
};

export const CustomerDTO = createDto(customerSchema, defaultCustomer);
