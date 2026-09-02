import { prisma } from '@/lib/prisma';

interface SeedUnitCategory {
  code: string;
  name: string;
  description: string;
  units: {
    code: string;
    name: string;
    symbol: string;
    isAnchor: boolean;
    conversionFactor: number;
    notes?: string;
  }[];
}

export const SEED_UNIT_CATEGORIES: SeedUnitCategory[] = [
  {
    code: 'WEIGHT',
    name: 'Berat (Weight)',
    description: 'Satuan pengukuran berat logam mulia dan bahan padat',
    units: [
      {
        code: 'G',
        name: 'Gram',
        symbol: 'g',
        isAnchor: true,
        conversionFactor: 1,
        notes: 'Satuan dasar / anchor baku pencatatan persediaan emas PT TAN',
      },
      {
        code: 'KG',
        name: 'Kilogram',
        symbol: 'kg',
        isAnchor: false,
        conversionFactor: 1000,
        notes: '1 kg = 1.000 gram (1/1000 dari anchor kg)',
      },
      {
        code: 'CG',
        name: 'Centigram',
        symbol: 'cg',
        isAnchor: false,
        conversionFactor: 0.01,
        notes: '1 cg = 0,01 gram = 1/100 gram (100 cg dalam 1 gram)',
      },
      {
        code: 'MG',
        name: 'Miligram',
        symbol: 'mg',
        isAnchor: false,
        conversionFactor: 0.001,
        notes: '1 mg = 0,001 gram (1.000 mg dalam 1 gram)',
      },
      {
        code: 'TROY_OZ',
        name: 'Troy Ounce',
        symbol: 'oz t',
        isAnchor: false,
        conversionFactor: 31.1034768,
        notes: '1 troy oz = 31,1034768 gram (standar perdagangan LM internasional)',
      },
      {
        code: 'CARAT',
        name: 'Karat Permata',
        symbol: 'ct',
        isAnchor: false,
        conversionFactor: 0.2,
        notes: '1 ct = 0,2 gram (satuan batu permata / berlian perhiasan)',
      },
    ],
  },
  {
    code: 'UNIT',
    name: 'Kuantitas & Kemasan (Unit / Count)',
    description: 'Satuan jumlah perhiasan, perlengkapan, dan kemasan',
    units: [
      {
        code: 'PCS',
        name: 'Piece / Buah',
        symbol: 'pcs',
        isAnchor: true,
        conversionFactor: 1,
        notes: 'Satuan dasar / anchor penghitungan unit',
      },
      {
        code: 'DOZEN',
        name: 'Lusin',
        symbol: 'dz',
        isAnchor: false,
        conversionFactor: 12,
        notes: '1 lusin = 12 pcs',
      },
      {
        code: 'KODI',
        name: 'Kodi',
        symbol: 'kd',
        isAnchor: false,
        conversionFactor: 20,
        notes: '1 kodi = 20 pcs',
      },
      {
        code: 'GROSS',
        name: 'Gross',
        symbol: 'grs',
        isAnchor: false,
        conversionFactor: 144,
        notes: '1 gross = 144 pcs (12 lusin)',
      },
      {
        code: 'RIM',
        name: 'Rim',
        symbol: 'rim',
        isAnchor: false,
        conversionFactor: 500,
        notes: '1 rim = 500 lembar (kertas sertifikat / nota)',
      },
      {
        code: 'PAIR',
        name: 'Pasang',
        symbol: 'pair',
        isAnchor: false,
        conversionFactor: 2,
        notes: '1 pasang = 2 pcs (anting perhiasan)',
      },
    ],
  },
  {
    code: 'VOLUME',
    name: 'Isi & Cairan (Volume)',
    description: 'Satuan bahan kimia refineri, larutan uji lab, dan cairan',
    units: [
      {
        code: 'L',
        name: 'Liter',
        symbol: 'L',
        isAnchor: true,
        conversionFactor: 1,
        notes: 'Satuan dasar / anchor volume cairan',
      },
      {
        code: 'ML',
        name: 'Mililiter',
        symbol: 'mL',
        isAnchor: false,
        conversionFactor: 0.001,
        notes: '1 mL = 0,001 Liter (1.000 mL dalam 1 Liter)',
      },
      {
        code: 'M3',
        name: 'Meter Kubik',
        symbol: 'm³',
        isAnchor: false,
        conversionFactor: 1000,
        notes: '1 m³ = 1.000 Liter',
      },
      {
        code: 'JRG_30L',
        name: 'Jerigen 30L',
        symbol: 'jrg 30L',
        isAnchor: false,
        conversionFactor: 30,
        notes: '1 jerigen standar asam nitrat HNO3 = 30 Liter',
      },
      {
        code: 'JRG_25L',
        name: 'Jerigen 25L',
        symbol: 'jrg 25L',
        isAnchor: false,
        conversionFactor: 25,
        notes: '1 jerigen = 25 Liter',
      },
      {
        code: 'DRUM_200L',
        name: 'Drum 200L',
        symbol: 'drum',
        isAnchor: false,
        conversionFactor: 200,
        notes: '1 drum cairan industri = 200 Liter',
      },
      {
        code: 'GAL',
        name: 'Galon (US)',
        symbol: 'gal',
        isAnchor: false,
        conversionFactor: 3.78541,
        notes: '1 galon US = 3,78541 Liter',
      },
    ],
  },
  {
    code: 'LENGTH',
    name: 'Panjang (Length)',
    description: 'Satuan panjang untuk rantai kalung, kawat emas, dan plat',
    units: [
      {
        code: 'M',
        name: 'Meter',
        symbol: 'm',
        isAnchor: true,
        conversionFactor: 1,
        notes: 'Satuan dasar / anchor panjang',
      },
      {
        code: 'CM',
        name: 'Centimeter',
        symbol: 'cm',
        isAnchor: false,
        conversionFactor: 0.01,
        notes: '1 cm = 0,01 m (100 cm dalam 1 meter)',
      },
      {
        code: 'MM',
        name: 'Milimeter',
        symbol: 'mm',
        isAnchor: false,
        conversionFactor: 0.001,
        notes: '1 mm = 0,001 m (1.000 mm dalam 1 meter)',
      },
      {
        code: 'INCH',
        name: 'Inci',
        symbol: 'in',
        isAnchor: false,
        conversionFactor: 0.0254,
        notes: '1 inch = 0,0254 meter (2,54 cm)',
      },
    ],
  },
];

export async function seedUnits(): Promise<{ categories: number; units: number }> {
  let unitCount = 0;

  for (const catData of SEED_UNIT_CATEGORIES) {
    const category = await prisma.unitCategory.upsert({
      where: { code: catData.code },
      update: {
        name: catData.name,
        description: catData.description,
      },
      create: {
        code: catData.code,
        name: catData.name,
        description: catData.description,
      },
    });

    for (const u of catData.units) {
      await prisma.unit.upsert({
        where: { code: u.code },
        update: {
          name: u.name,
          symbol: u.symbol,
          categoryId: category.id,
          isAnchor: u.isAnchor,
          conversionFactor: u.conversionFactor,
          notes: u.notes,
        },
        create: {
          code: u.code,
          name: u.name,
          symbol: u.symbol,
          categoryId: category.id,
          isAnchor: u.isAnchor,
          conversionFactor: u.conversionFactor,
          notes: u.notes,
        },
      });
      unitCount++;
    }
  }

  console.log(`Units: ${SEED_UNIT_CATEGORIES.length} categories, ${unitCount} units in sync`);
  return { categories: SEED_UNIT_CATEGORIES.length, units: unitCount };
}
