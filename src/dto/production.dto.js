import { z } from 'zod';
import { createDto } from './createDto.js';
import { commonRules } from './common.dto.js';

export const productionSPKSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  spkNo: commonRules.nonEmptyString('Nomor Dokumen SPK Produksi'),
  buyerName: commonRules.nonEmptyString('Nama Pemesan / Buyer Ekspor'),
  date: commonRules.dateString('Tanggal Penerbitan SPK'),
  jewelryType: commonRules.nonEmptyString('Jenis Produk Perhiasan'),
  targetKarat: z.string().default('750'),
  targetPurity: commonRules.percentageNumber('Kadar Kemurnian Target (%)'),
  grossWeight: commonRules.positiveNumber('Target Berat Total (Gram)'),
  fineGoldNeeded: commonRules.positiveNumber('Kebutuhan Emas Murni 999.9 (Gram)'),
  masterAlloyNeeded: commonRules.nonNegativeNumber('Kebutuhan Master Alloy (Gram)').default(0),
  alloyAgPct: commonRules.nonNegativeNumber('Alloy Perak Ag %').default(0),
  alloyCuPct: commonRules.nonNegativeNumber('Alloy Tembaga Cu %').default(0),
  description: commonRules.optionalString(),
  status: z.string().default('IN_WIP'),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultProductionSPK = {
  spkNo: '',
  buyerName: '',
  date: new Date().toISOString().split('T')[0],
  jewelryType: 'Casting Ring (Cincin Cor)',
  targetKarat: '750',
  targetPurity: 75.0,
  grossWeight: 0,
  fineGoldNeeded: 0,
  masterAlloyNeeded: 0,
  alloyAgPct: 15.0,
  alloyCuPct: 10.0,
  description: '',
  status: 'IN_WIP',
  createdAt: new Date().toISOString()
};

export const ProductionSPKDTO = createDto(productionSPKSchema, defaultProductionSPK);

export const productionSettlementSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  joNumber: commonRules.nonEmptyString('Nomor Job Order (JO) Settlement'),
  spkNo: commonRules.nonEmptyString('Nomor Referensi SPK Asal'),
  buyerName: commonRules.optionalString(),
  date: commonRules.dateString('Tanggal Settlement'),
  jewelryOutputWeight: commonRules.positiveNumber('Berat Hasil Perhiasan Jadi (Gram)'),
  scrapReturnWeight: commonRules.nonNegativeNumber('Berat Scrap Retur (Gram)').default(0),
  goldLossWeight: commonRules.nonNegativeNumber('Berat Susut Lebur (Gram)').default(0),
  totalWipDeducted: commonRules.nonNegativeNumber('Total Pemotongan WIP (Gram)').default(0),
  laborFeeIDR: commonRules.nonNegativeNumber('Biaya Ongkos Tukang (Labor Fee)').default(0),
  karat: z.string().default('750'),
  notes: commonRules.optionalString(),
  status: z.string().default('COMPLETED'),
  createdAt: commonRules.optionalString()
}).passthrough();

export const defaultProductionSettlement = {
  joNumber: '',
  spkNo: '',
  buyerName: '',
  date: new Date().toISOString().split('T')[0],
  jewelryOutputWeight: 0,
  scrapReturnWeight: 0,
  goldLossWeight: 0,
  totalWipDeducted: 0,
  laborFeeIDR: 0,
  karat: '750',
  notes: '',
  status: 'COMPLETED',
  createdAt: new Date().toISOString()
};

export const ProductionSettlementDTO = createDto(productionSettlementSchema, defaultProductionSettlement);
