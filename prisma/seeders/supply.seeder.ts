import { prisma } from '@/lib/prisma';

/**
 * Master bahan operasional (non-logam) untuk PR kategori CHEMICALS_REFINERY
 * dan SAFETY_GA — cermin item legacy di PurchaseRequestPage
 * (`CHEM-HNO3-68`, `SAFETY-GLOVE-500C`, dll). Tanpa baris ini, PR non-logam
 * tidak punya `supply_id` untuk diisi saat dikirim ke database.
 *
 * Idempotent: upsert by `code`.
 */

interface SeedSupply {
  code: string;
  name: string;
  category: 'CHEMICAL' | 'CONSUMABLE' | 'EQUIPMENT' | 'OTHER';
  unit: string;
  lastPriceIdr?: number;
}

const SUPPLIES: SeedSupply[] = [
  { code: 'CHEM-HNO3-68', name: 'Asam Nitrat (HNO3 68% Technical Grade)', category: 'CHEMICAL', unit: 'Jerigen 30L', lastPriceIdr: 450000 },
  { code: 'CHEM-HCL-32', name: 'Asam Klorida (HCl 32% Technical Grade)', category: 'CHEMICAL', unit: 'Jerigen 30L', lastPriceIdr: 380000 },
  { code: 'CHEM-KOWI', name: 'Kowi Tanah Liat Refractory (Kowi Refineri)', category: 'CONSUMABLE', unit: 'Pcs', lastPriceIdr: 750000 },
  { code: 'CHEM-BORAX', name: 'Boraks (Flux Peleburan)', category: 'CHEMICAL', unit: 'Karung 25kg', lastPriceIdr: 320000 },
  { code: 'CHEM-CRUCIBLE', name: 'Crucible / Wadah Lebur 2kg', category: 'CONSUMABLE', unit: 'Pcs', lastPriceIdr: 185000 },
  { code: 'SAFETY-GLOVE-500C', name: 'Sarung Tangan Kulit Tahan Panas 500°C', category: 'CONSUMABLE', unit: 'Pasang', lastPriceIdr: 85000 },
  { code: 'SAFETY-APRON', name: 'Apron Kulit Operator Peleburan', category: 'CONSUMABLE', unit: 'Pcs', lastPriceIdr: 210000 },
  { code: 'SAFETY-MASK', name: 'Masker Gas / Respirator Refinery', category: 'CONSUMABLE', unit: 'Pcs', lastPriceIdr: 145000 },
  { code: 'SAFETY-GOGGLE', name: 'Kacamata Las / Safety Goggle', category: 'CONSUMABLE', unit: 'Pcs', lastPriceIdr: 55000 },
  { code: 'PACK-SEAL-BAG', name: 'Kantong Segel Plastik 6x8 cm (100 pcs)', category: 'OTHER', unit: 'Pak', lastPriceIdr: 12000 },
];

export async function seedSupplies(): Promise<void> {
  for (const supply of SUPPLIES) {
    await prisma.supply.upsert({
      where: { code: supply.code },
      create: {
        code: supply.code,
        name: supply.name,
        category: supply.category,
        unit: supply.unit,
        lastPriceIdr: supply.lastPriceIdr,
      },
      update: {
        name: supply.name,
        category: supply.category,
        unit: supply.unit,
      },
    });
  }
}
