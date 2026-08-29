// ==========================================
// Tax Engine: TER PPh 21 (PP 58/2023)
// ==========================================

const TaxEngineTER = {
  // Menentukan Kategori TER berdasarkan Status PTKP
  getCategory(ptkp) {
    if (!ptkp) return 'A'; // Default
    const status = ptkp.toUpperCase().trim();
    
    // Kategori A: TK/0, TK/1, K/0
    if (['TK/0', 'TK/1', 'K/0'].includes(status)) return 'A';
    
    // Kategori B: TK/2, TK/3, K/1, K/2
    if (['TK/2', 'TK/3', 'K/1', 'K/2'].includes(status)) return 'B';
    
    // Kategori C: K/3
    if (['K/3'].includes(status)) return 'C';
    
    return 'A'; // Fallback
  },

  // Menghitung Pajak PPh 21 Bulanan berdasarkan TER
  calculatePPh21(ptkp, grossIncome) {
    const category = this.getCategory(ptkp);
    let rate = 0; // dalam persentase, misal 0.5 untuk 0.5%
    
    if (category === 'A') {
      if (grossIncome <= 5400000) rate = 0;
      else if (grossIncome <= 5650000) rate = 0.25;
      else if (grossIncome <= 5950000) rate = 0.5;
      else if (grossIncome <= 6300000) rate = 0.75;
      else if (grossIncome <= 6750000) rate = 1;
      else if (grossIncome <= 7500000) rate = 1.25;
      else if (grossIncome <= 8550000) rate = 1.5;
      else if (grossIncome <= 9650000) rate = 1.75;
      else if (grossIncome <= 10050000) rate = 2;
      else if (grossIncome <= 10350000) rate = 2.25;
      else if (grossIncome <= 10700000) rate = 2.5;
      else if (grossIncome <= 11050000) rate = 3;
      else if (grossIncome <= 11600000) rate = 3.5;
      else if (grossIncome <= 12500000) rate = 4;
      else if (grossIncome <= 13750000) rate = 5;
      else if (grossIncome <= 15100000) rate = 6;
      else rate = 7;
    } 
    else if (category === 'B') {
      if (grossIncome <= 6200000) rate = 0;
      else if (grossIncome <= 6500000) rate = 0.25;
      else if (grossIncome <= 6850000) rate = 0.5;
      else if (grossIncome <= 7300000) rate = 0.75;
      else if (grossIncome <= 9200000) rate = 1;
      else if (grossIncome <= 10750000) rate = 1.5;
      else if (grossIncome <= 11250000) rate = 2;
      else if (grossIncome <= 11600000) rate = 2.5;
      else if (grossIncome <= 12600000) rate = 3;
      else if (grossIncome <= 13600000) rate = 4;
      else if (grossIncome <= 14950000) rate = 5;
      else rate = 6;
    }
    else if (category === 'C') {
      if (grossIncome <= 6600000) rate = 0;
      else if (grossIncome <= 6950000) rate = 0.25;
      else if (grossIncome <= 7350000) rate = 0.5;
      else if (grossIncome <= 7800000) rate = 0.75;
      else if (grossIncome <= 8850000) rate = 1;
      else if (grossIncome <= 9800000) rate = 1.25;
      else if (grossIncome <= 10950000) rate = 1.5;
      else if (grossIncome <= 11200000) rate = 2;
      else if (grossIncome <= 12050000) rate = 3;
      else if (grossIncome <= 13200000) rate = 4;
      else rate = 5;
    }

    const taxAmount = (grossIncome * rate) / 100;
    
    return {
      category: category,
      ratePct: rate,
      grossIncome: grossIncome,
      taxAmount: Math.round(taxAmount)
    };
  },

  // Formula Baru per Spesifikasi ERP Golden Alura:
  // Taxable Base (DPP TER) = Gross Allowance Kotor - Total Deduction NonTax
  calculateTERFromComponents({ grossAllowanceKotor = 0, totalDeductionNonTax = 0, ptkpStatus = 'TK/0' }) {
    const taxableBase = Math.max(0, grossAllowanceKotor - totalDeductionNonTax);
    const result = this.calculatePPh21(ptkpStatus, taxableBase);
    return {
      ...result,
      taxableBase: taxableBase,
      grossAllowanceKotor: grossAllowanceKotor,
      totalDeductionNonTax: totalDeductionNonTax
    };
  }
};

if (typeof window !== 'undefined') {
  window.TaxEngineTER = TaxEngineTER;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaxEngineTER;
}

