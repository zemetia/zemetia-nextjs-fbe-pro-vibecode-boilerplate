import { roundTo } from '@/lib/number';

export interface UnitConversionParams {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly categoryCode: string;
  readonly isAnchor: boolean;
  /**
   * Nilai 1 unit ini dalam satuan Anchor.
   * Contoh:
   * - Gram (anchor): 1
   * - Kilogram: 1000 (1 kg = 1000 g)
   * - Centigram: 0.01 (1 cg = 0.01 g = 1/100 g)
   * - Troy Ounce: 31.1034768 (1 oz t = 31.1034768 g)
   * - Liter (anchor): 1
   * - Mililiter: 0.001 (1 mL = 0.001 L = 1/1000 L)
   * - Piece (anchor): 1
   * - Lusin: 12 (1 dz = 12 pcs)
   */
  readonly conversionFactor: number;
}

export interface ConversionResult {
  readonly fromValue: number;
  readonly fromUnit: UnitConversionParams;
  readonly toUnit: UnitConversionParams;
  readonly anchorUnit: UnitConversionParams;
  readonly anchorValue: number;
  readonly resultValue: number;
  readonly formulaSummary: string;
  readonly ratioFromAnchor: number;
  readonly ratioToAnchor: number;
  readonly steps: readonly string[];
}

/**
 * Konversi nilai dari suatu unit ke Anchor unit dalam tipe yang sama.
 * Nilai Anchor = nilai * conversionFactor
 */
export function convertToAnchor(value: number, unit: Pick<UnitConversionParams, 'conversionFactor'>): number {
  return value * unit.conversionFactor;
}

/**
 * Konversi nilai dari Anchor unit ke unit tujuan.
 * Nilai Tujuan = nilaiAnchor / targetUnit.conversionFactor
 */
export function convertFromAnchor(anchorValue: number, unit: Pick<UnitConversionParams, 'conversionFactor'>): number {
  if (unit.conversionFactor === 0) {
    throw new Error('Faktor konversi tidak boleh 0');
  }
  return anchorValue / unit.conversionFactor;
}

/**
 * Mengonversi nilai dari satuan `fromUnit` ke satuan `toUnit`.
 * Kedua satuan wajib berada pada kategori / tipe yang sama.
 */
export function convertUnits(
  value: number,
  fromUnit: UnitConversionParams,
  toUnit: UnitConversionParams,
  scale?: number,
): number {
  if (fromUnit.categoryCode !== toUnit.categoryCode) {
    throw new Error(
      `Tidak dapat mengonversi satuan antar kategori yang berbeda (${fromUnit.categoryCode} vs ${toUnit.categoryCode})`,
    );
  }

  if (fromUnit.code === toUnit.code) {
    return value;
  }

  const anchorValue = convertToAnchor(value, fromUnit);
  const result = convertFromAnchor(anchorValue, toUnit);

  return scale !== undefined ? roundTo(result, scale) : result;
}

/**
 * Menghasilkan rincian kalkulasi langkah demi langkah untuk visualisasi edukatif di UI.
 */
export function getConversionBreakdown(
  value: number,
  fromUnit: UnitConversionParams,
  toUnit: UnitConversionParams,
  anchorUnit: UnitConversionParams,
  scale = 8,
): ConversionResult {
  if (fromUnit.categoryCode !== toUnit.categoryCode) {
    throw new Error(
      `Tidak dapat mengonversi satuan antar kategori yang berbeda (${fromUnit.categoryCode} vs ${toUnit.categoryCode})`,
    );
  }

  const anchorValue = convertToAnchor(value, fromUnit);
  const rawResult = convertFromAnchor(anchorValue, toUnit);
  const resultValue = roundTo(rawResult, scale);

  // Rasio 1 Anchor = X units
  const ratioFromAnchor = fromUnit.conversionFactor !== 0 ? 1 / fromUnit.conversionFactor : 0;
  const ratioToAnchor = toUnit.conversionFactor !== 0 ? 1 / toUnit.conversionFactor : 0;

  // Bangun langkah penjelasan
  const steps: string[] = [];

  if (fromUnit.code === toUnit.code) {
    steps.push(`Satuan asal dan tujuan sama (${fromUnit.name}). Nilai tetap ${value} ${toUnit.symbol}.`);
  } else {
    if (fromUnit.isAnchor) {
      steps.push(
        `1. Satuan asal sudah merupakan Anchor (${anchorUnit.name}): ${value} ${anchorUnit.symbol}`,
      );
      steps.push(
        `2. Konversi ke ${toUnit.name}: ${value} ÷ ${toUnit.conversionFactor} = ${resultValue} ${toUnit.symbol}`,
      );
    } else if (toUnit.isAnchor) {
      steps.push(
        `1. Konversi dari ${fromUnit.name} ke Anchor (${anchorUnit.name}): ${value} × ${fromUnit.conversionFactor} = ${anchorValue} ${anchorUnit.symbol}`,
      );
    } else {
      steps.push(
        `1. Konversi ke Anchor (${anchorUnit.name}): ${value} ${fromUnit.symbol} × ${fromUnit.conversionFactor} = ${anchorValue} ${anchorUnit.symbol}`,
      );
      steps.push(
        `2. Konversi dari Anchor (${anchorUnit.name}) ke ${toUnit.name}: ${anchorValue} ÷ ${toUnit.conversionFactor} = ${resultValue} ${toUnit.symbol}`,
      );
    }
  }

  const formulaSummary =
    fromUnit.code === toUnit.code
      ? `${value} ${fromUnit.symbol} = ${resultValue} ${toUnit.symbol}`
      : `${value} ${fromUnit.symbol} ➔ ${anchorValue} ${anchorUnit.symbol} ➔ ${resultValue} ${toUnit.symbol}`;

  return {
    fromValue: value,
    fromUnit,
    toUnit,
    anchorUnit,
    anchorValue,
    resultValue,
    formulaSummary,
    ratioFromAnchor,
    ratioToAnchor,
    steps,
  };
}

export interface BuiltinUnitCategory {
  readonly code: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly units: readonly UnitConversionParams[];
}

export const BUILTIN_UNIT_CATEGORIES: readonly BuiltinUnitCategory[] = [
  {
    code: 'WEIGHT',
    name: 'Berat (Weight)',
    icon: '⚖️',
    description: 'Satuan pengukuran berat logam mulia dan bahan padat',
    units: [
      { code: 'G', name: 'Gram', symbol: 'g', categoryCode: 'WEIGHT', isAnchor: true, conversionFactor: 1 },
      { code: 'KG', name: 'Kilogram', symbol: 'kg', categoryCode: 'WEIGHT', isAnchor: false, conversionFactor: 1000 },
      { code: 'CG', name: 'Centigram', symbol: 'cg', categoryCode: 'WEIGHT', isAnchor: false, conversionFactor: 0.01 },
      { code: 'MG', name: 'Miligram', symbol: 'mg', categoryCode: 'WEIGHT', isAnchor: false, conversionFactor: 0.001 },
      { code: 'TROY_OZ', name: 'Troy Ounce', symbol: 'oz t', categoryCode: 'WEIGHT', isAnchor: false, conversionFactor: 31.1034768 },
      { code: 'CARAT', name: 'Karat Permata', symbol: 'ct', categoryCode: 'WEIGHT', isAnchor: false, conversionFactor: 0.2 },
    ],
  },
  {
    code: 'UNIT',
    name: 'Kuantitas & Kemasan (Unit / Count)',
    icon: '📦',
    description: 'Satuan jumlah perhiasan, perlengkapan, dan kemasan',
    units: [
      { code: 'PCS', name: 'Piece / Buah', symbol: 'pcs', categoryCode: 'UNIT', isAnchor: true, conversionFactor: 1 },
      { code: 'DOZEN', name: 'Lusin', symbol: 'dz', categoryCode: 'UNIT', isAnchor: false, conversionFactor: 12 },
      { code: 'KODI', name: 'Kodi', symbol: 'kd', categoryCode: 'UNIT', isAnchor: false, conversionFactor: 20 },
      { code: 'GROSS', name: 'Gross', symbol: 'grs', categoryCode: 'UNIT', isAnchor: false, conversionFactor: 144 },
      { code: 'RIM', name: 'Rim', symbol: 'rim', categoryCode: 'UNIT', isAnchor: false, conversionFactor: 500 },
      { code: 'PAIR', name: 'Pasang', symbol: 'pair', categoryCode: 'UNIT', isAnchor: false, conversionFactor: 2 },
    ],
  },
  {
    code: 'VOLUME',
    name: 'Isi & Cairan (Volume)',
    icon: '💧',
    description: 'Satuan bahan kimia refineri, larutan uji lab, dan cairan',
    units: [
      { code: 'L', name: 'Liter', symbol: 'L', categoryCode: 'VOLUME', isAnchor: true, conversionFactor: 1 },
      { code: 'ML', name: 'Mililiter', symbol: 'mL', categoryCode: 'VOLUME', isAnchor: false, conversionFactor: 0.001 },
      { code: 'M3', name: 'Meter Kubik', symbol: 'm³', categoryCode: 'VOLUME', isAnchor: false, conversionFactor: 1000 },
      { code: 'JRG_30L', name: 'Jerigen 30L', symbol: 'jrg 30L', categoryCode: 'VOLUME', isAnchor: false, conversionFactor: 30 },
      { code: 'JRG_25L', name: 'Jerigen 25L', symbol: 'jrg 25L', categoryCode: 'VOLUME', isAnchor: false, conversionFactor: 25 },
      { code: 'DRUM_200L', name: 'Drum 200L', symbol: 'drum', categoryCode: 'VOLUME', isAnchor: false, conversionFactor: 200 },
      { code: 'GAL', name: 'Galon (US)', symbol: 'gal', categoryCode: 'VOLUME', isAnchor: false, conversionFactor: 3.78541 },
    ],
  },
  {
    code: 'LENGTH',
    name: 'Panjang (Length)',
    icon: '📏',
    description: 'Satuan panjang untuk rantai kalung, kawat emas, dan plat',
    units: [
      { code: 'M', name: 'Meter', symbol: 'm', categoryCode: 'LENGTH', isAnchor: true, conversionFactor: 1 },
      { code: 'CM', name: 'Centimeter', symbol: 'cm', categoryCode: 'LENGTH', isAnchor: false, conversionFactor: 0.01 },
      { code: 'MM', name: 'Milimeter', symbol: 'mm', categoryCode: 'LENGTH', isAnchor: false, conversionFactor: 0.001 },
      { code: 'INCH', name: 'Inci', symbol: 'in', categoryCode: 'LENGTH', isAnchor: false, conversionFactor: 0.0254 },
    ],
  },
];

export const ALL_BUILTIN_UNITS: readonly UnitConversionParams[] = BUILTIN_UNIT_CATEGORIES.flatMap((c) => c.units);

const UNIT_ALIASES: Record<string, string> = {
  g: 'G',
  gr: 'G',
  gram: 'G',
  grams: 'G',
  kg: 'KG',
  kilo: 'KG',
  kilogram: 'KG',
  cg: 'CG',
  centigram: 'CG',
  mg: 'MG',
  miligram: 'MG',
  milligram: 'MG',
  oz: 'TROY_OZ',
  'oz t': 'TROY_OZ',
  ozt: 'TROY_OZ',
  'troy oz': 'TROY_OZ',
  'troy ounce': 'TROY_OZ',
  ct: 'CARAT',
  karat: 'CARAT',
  carat: 'CARAT',
  pcs: 'PCS',
  pc: 'PCS',
  piece: 'PCS',
  buah: 'PCS',
  biji: 'PCS',
  lembar: 'PCS',
  dz: 'DOZEN',
  dozen: 'DOZEN',
  lusin: 'DOZEN',
  kd: 'KODI',
  kodi: 'KODI',
  grs: 'GROSS',
  gross: 'GROSS',
  rim: 'RIM',
  pair: 'PAIR',
  pasang: 'PAIR',
  l: 'L',
  ltr: 'L',
  liter: 'L',
  ml: 'ML',
  mililiter: 'ML',
  milliliter: 'ML',
  m3: 'M3',
  'm³': 'M3',
  'meter kubik': 'M3',
  'jrg 30l': 'JRG_30L',
  'jrg 30': 'JRG_30L',
  jrg30: 'JRG_30L',
  'jerigen 30l': 'JRG_30L',
  'jerigen 30': 'JRG_30L',
  'jerigen (30kg)': 'JRG_30L',
  'jerigen (30l)': 'JRG_30L',
  'jrg 25l': 'JRG_25L',
  'jrg 25': 'JRG_25L',
  jrg25: 'JRG_25L',
  'jerigen 25l': 'JRG_25L',
  'jerigen 25': 'JRG_25L',
  drum: 'DRUM_200L',
  'drum 200l': 'DRUM_200L',
  'drum 200': 'DRUM_200L',
  gal: 'GAL',
  galon: 'GAL',
  m: 'M',
  meter: 'M',
  cm: 'CM',
  centimeter: 'CM',
  mm: 'MM',
  milimeter: 'MM',
  in: 'INCH',
  inch: 'INCH',
  inci: 'INCH',
};

/**
 * Mencari definisi satuan berdasarkan kode, simbol, nama, atau alias umum.
 */
export function findUnit(query?: string | null): UnitConversionParams | undefined {
  if (!query) return undefined;
  const clean = query.trim().toLowerCase();
  if (!clean) return undefined;

  // 1. Cek tabel alias
  const mappedCode = UNIT_ALIASES[clean];
  if (mappedCode) {
    const found = ALL_BUILTIN_UNITS.find((u) => u.code === mappedCode);
    if (found) return found;
  }

  // 2. Cek match persis code (case-insensitive)
  const byCode = ALL_BUILTIN_UNITS.find((u) => u.code.toLowerCase() === clean);
  if (byCode) return byCode;

  // 3. Cek symbol
  const bySymbol = ALL_BUILTIN_UNITS.find((u) => u.symbol.toLowerCase() === clean);
  if (bySymbol) return bySymbol;

  // 4. Cek name
  const byName = ALL_BUILTIN_UNITS.find((u) => u.name.toLowerCase() === clean);
  if (byName) return byName;

  // 5. Cek jika mengandung kata kunci
  return ALL_BUILTIN_UNITS.find(
    (u) =>
      clean.includes(u.symbol.toLowerCase()) ||
      clean.includes(u.name.toLowerCase()) ||
      u.name.toLowerCase().includes(clean),
  );
}

/**
 * Mengambil Satuan Anchor untuk suatu kategori.
 */
export function getAnchorUnitForCategory(categoryCode: string): UnitConversionParams | undefined {
  const cat = BUILTIN_UNIT_CATEGORIES.find((c) => c.code.toUpperCase() === categoryCode.toUpperCase());
  return cat?.units.find((u) => u.isAnchor);
}

/**
 * Mengambil semua satuan yang tergabung dalam suatu kategori.
 */
export function getUnitsByCategory(categoryCode: string): readonly UnitConversionParams[] {
  const cat = BUILTIN_UNIT_CATEGORIES.find((c) => c.code.toUpperCase() === categoryCode.toUpperCase());
  return cat?.units ?? [];
}

export interface AnchorEquivalentResult {
  readonly isAnchor: boolean;
  readonly unit: UnitConversionParams;
  readonly anchorUnit: UnitConversionParams;
  readonly anchorQuantity: number;
  readonly formatted: string;
}

/**
 * Menghitung ekuivalensi kuantitas dalam Satuan Anchor untuk visualisasi di form & tabel.
 */
export function computeAnchorEquivalent(
  quantity: number,
  unitQuery?: string | null,
): AnchorEquivalentResult | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const unit = findUnit(unitQuery);
  if (!unit) return null;

  const anchorUnit = getAnchorUnitForCategory(unit.categoryCode);
  if (!anchorUnit) return null;

  if (unit.isAnchor) {
    return {
      isAnchor: true,
      unit,
      anchorUnit,
      anchorQuantity: quantity,
      formatted: `${quantity.toLocaleString('id-ID')} ${unit.symbol} (Anchor)`,
    };
  }

  const anchorQuantity = convertToAnchor(quantity, unit);
  const formattedAnchor = anchorQuantity.toLocaleString('id-ID', { maximumFractionDigits: 4 });

  return {
    isAnchor: false,
    unit,
    anchorUnit,
    anchorQuantity,
    formatted: `Setara: ${formattedAnchor} ${anchorUnit.symbol} (${anchorUnit.name})`,
  };
}

/**
 * Rekomendasi kategori satuan berdasarkan Kategori Purchase Request.
 */
export function suggestCategoryForPR(prCategory?: string): string {
  if (!prCategory) return 'WEIGHT';
  const cat = prCategory.toUpperCase();
  if (cat.includes('GOLD') || cat.includes('EMAS') || cat.includes('IMPORT') || cat.includes('LOCAL')) {
    return 'WEIGHT';
  }
  if (cat.includes('LAB') || cat.includes('CHEM') || cat.includes('KIMIA')) {
    return 'VOLUME';
  }
  if (cat.includes('SUPPLY') || cat.includes('GENERAL') || cat.includes('OPERASIONAL')) {
    return 'UNIT';
  }
  return 'WEIGHT';
}
