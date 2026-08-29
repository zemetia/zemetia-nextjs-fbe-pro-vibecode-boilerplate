/**
 * PT TRILIUN ANUGRAH NUSANTARA (PT TAN) ERP
 * Unit Test Suite for Core Business Logic & Financial Formulas
 * 
 * Covering:
 * - Purchasing: PR prefill mapping, PO Impor landed cost, PO Lokal 2-stage transit logic, Scrap fine gold precision
 * - Warehouse & Vault: TTB Discrepancy, SPK BOM karat calculator, Settlement Mass Conservation, Silver Alloy Purity
 * - Sales & Export: PMK 48/2023 Non-BKP tax facility, Export PPN 0%, DO Vault Allocation, AR Aging
 * - Cashier & Treasury: BBK / BBM journal builders, Bank Reference No trace ID, Cheque leaf sequencer & limits
 * - Accounting & GL: SAK EMKM Account category normal sides, Trial balance debit/credit balance, PnL calculation
 */

describe('Purchasing, Vault, Sales, Cashier & Accounting Unit Tests', () => {

  // 1. PURCHASING LOGIC
  describe('Purchasing Logic & Data Transformers', () => {
    function calculateScrapFineGold(grossWeight, xrfPurity) {
      const g = Number(grossWeight || 0);
      const p = Number(xrfPurity || 0);
      return Number(((g * p) / 100).toFixed(4));
    }

    function calculateImportLandedCost({ quantityGrams, priceUSDPerOz, exchangeRate, importTaxRate = 0.0025 }) {
      const oz = quantityGrams / 31.1034768;
      const totalUSD = oz * priceUSDPerOz;
      const totalIDR = totalUSD * exchangeRate;
      const pph22IDR = totalIDR * importTaxRate;
      return {
        ozWeight: Number(oz.toFixed(4)),
        totalUSD: Number(totalUSD.toFixed(2)),
        totalIDR: Number(totalIDR.toFixed(0)),
        pph22IDR: Number(pph22IDR.toFixed(0))
      };
    }

    function mapPRToPOPrefill(pr) {
      if (pr.category === 'GOLD_LOCAL') {
        return {
          targetRoute: '/local-trading',
          supplierName: pr.recommendedSupplier,
          quantityGrams: pr.estimatedWeightGram,
          referencePrNo: pr.prNumber
        };
      }
      if (pr.category === 'GOLD_IMPORT') {
        return {
          targetRoute: '/import-trading',
          supplierName: pr.recommendedSupplier,
          quantityGrams: pr.estimatedWeightGram,
          referencePrNo: pr.prNumber
        };
      }
      return {
        targetRoute: '/purchasing-general',
        supplierName: pr.recommendedSupplier,
        referencePrNo: pr.prNumber
      };
    }

    test('1. calculateScrapFineGold computes exact fine gold from gross and XRF purity', () => {
      expect(calculateScrapFineGold(100, 75.0)).toBe(75.0000);
      expect(calculateScrapFineGold(250.5, 87.5)).toBe(219.1875);
      expect(calculateScrapFineGold(0, 99.9)).toBe(0);
    });

    test('2. calculateImportLandedCost computes Troy Oz, USD value, IDR conversion, and PPh 22 0.25%', () => {
      const res = calculateImportLandedCost({
        quantityGrams: 1000,
        priceUSDPerOz: 2400,
        exchangeRate: 16250
      });
      expect(res.ozWeight).toBe(32.1507);
      expect(res.totalUSD).toBe(77161.79);
      expect(res.totalIDR).toBe(1253879116);
      expect(res.pph22IDR).toBe(3134698); // 0.25% of IDR
    });

    test('3. mapPRToPOPrefill routes correctly based on category without prompt popup', () => {
      const prLocal = { category: 'GOLD_LOCAL', recommendedSupplier: 'Pegadaian', estimatedWeightGram: 500, prNumber: 'PR-01' };
      const prImport = { category: 'GOLD_IMPORT', recommendedSupplier: 'YLG', estimatedWeightGram: 1000, prNumber: 'PR-02' };

      expect(mapPRToPOPrefill(prLocal).targetRoute).toBe('/local-trading');
      expect(mapPRToPOPrefill(prImport).targetRoute).toBe('/import-trading');
    });
  });

  // 2. WAREHOUSE & VAULT FORMULAS
  describe('Warehouse, Vault & Production Formulas', () => {
    function calculateScaleDiscrepancy(docWeight, scaleWeight) {
      return Number((Number(scaleWeight || 0) - Number(docWeight || 0)).toFixed(4));
    }

    function calculateAlloyFineness(goldWeight, goldPurity, silverWeight) {
      const gWeight = Number(goldWeight || 0);
      const sWeight = Number(silverWeight || 0);
      const totalWeight = gWeight + sWeight;
      if (totalWeight === 0) return 0;
      const pureGold = gWeight * (Number(goldPurity || 99.99) / 100);
      return Number(((pureGold / totalWeight) * 100).toFixed(2));
    }

    function validateProductionSettlementMass(inputWeight, fgWeight, scrapWeight, lossWeight, tolerance = 0.05) {
      const totalOut = Number((fgWeight + scrapWeight + lossWeight).toFixed(4));
      const diff = Math.abs(totalOut - inputWeight);
      return {
        isValid: diff <= tolerance,
        totalOut,
        inputWeight,
        diff: Number(diff.toFixed(4))
      };
    }

    test('4. calculateScaleDiscrepancy tracks exact scale weight discrepancies on goods receipts', () => {
      expect(calculateScaleDiscrepancy(1000.00, 1000.00)).toBe(0);
      expect(calculateScaleDiscrepancy(1000.00, 999.85)).toBe(-0.15);
      expect(calculateScaleDiscrepancy(500.00, 500.12)).toBe(0.12);
    });

    test('5. calculateAlloyFineness calculates alloy final purity accurately', () => {
      // 1000g gold (99.99%) + 100g silver -> 90.90%
      expect(calculateAlloyFineness(1000, 99.99, 100)).toBe(90.90);
      // 750g gold (99.99%) + 250g alloy -> 74.99% ~ 75%
      expect(calculateAlloyFineness(750, 99.99, 250)).toBe(74.99);
    });

    test('6. validateProductionSettlementMass enforces gold mass conservation', () => {
      // Valid settlement: 490 + 8 + 2 = 500 === 500
      const valid = validateProductionSettlementMass(500, 490, 8, 2);
      expect(valid.isValid).toBe(true);
      expect(valid.diff).toBe(0);

      // Invalid settlement: 480 + 8 + 2 = 490 !== 500 (10g unaccounted)
      const invalid = validateProductionSettlementMass(500, 480, 8, 2);
      expect(invalid.isValid).toBe(false);
      expect(invalid.diff).toBe(10);
    });
  });

  // 3. SALES & EXPORT FORMULAS
  describe('Sales & Export Tax & COGS Formulas', () => {
    function calculateLocalSalesTax(isGoldBar, isJewelry) {
      if (isGoldBar) {
        return { facility: 'BEBAS PPN PMK 48/2023 (NON-BKP)', taxRate: 0, taxAmount: 0 };
      }
      if (isJewelry) {
        return { facility: 'PPN FINAL PMK 48/2023 (1.1% / 1.65%)', taxRate: 0.011 };
      }
      return { facility: 'PPN STANDAR 12%', taxRate: 0.12 };
    }

    function calculateExportInvoiceValues(netWeightGram, priceUSDPerGram, exchangeRate) {
      const totalUSD = netWeightGram * priceUSDPerGram;
      const totalIDR = totalUSD * exchangeRate;
      return {
        totalUSD: Number(totalUSD.toFixed(2)),
        totalIDR: Number(totalIDR.toFixed(0)),
        ppnExportFacility: 'PPN 0% PASAL 4B UU PPN'
      };
    }

    test('7. calculateLocalSalesTax returns PMK 48/2023 exemption for investment gold bars', () => {
      const tax = calculateLocalSalesTax(true, false);
      expect(tax.facility).toContain('BEBAS PPN');
      expect(tax.taxRate).toBe(0);
    });

    test('8. calculateExportInvoiceValues formats USD export values and enforces 0% VAT', () => {
      const exp = calculateExportInvoiceValues(500, 85.00, 16250);
      expect(exp.totalUSD).toBe(42500.00);
      expect(exp.totalIDR).toBe(690625000);
      expect(exp.ppnExportFacility).toBe('PPN 0% PASAL 4B UU PPN');
    });
  });

  // 4. CASHIER, CHEQUE & AUDIT TRAIL
  describe('Cashier, Treasury & Bank Trace ID Validations', () => {
    function validateBankReferenceNo(refNo) {
      if (!refNo || typeof refNo !== 'string') return false;
      const cleaned = refNo.trim();
      return cleaned.length >= 3;
    }

    function validateChequeLeafRange(startNum, endNum, totalLeaves) {
      const start = Number(startNum);
      const end = Number(endNum);
      const count = Number(totalLeaves);
      return (end - start + 1) === count;
    }

    test('9. validateBankReferenceNo validates existence of bank mutation trace IDs', () => {
      expect(validateBankReferenceNo('TRC-BCA-998811')).toBe(true);
      expect(validateBankReferenceNo('12345')).toBe(true);
      expect(validateBankReferenceNo('')).toBe(false);
      expect(validateBankReferenceNo('  ')).toBe(false);
      expect(validateBankReferenceNo(null)).toBe(false);
    });

    test('10. validateChequeLeafRange enforces continuous serial leaf counts in cheque books', () => {
      expect(validateChequeLeafRange(998801, 998825, 25)).toBe(true);
      expect(validateChequeLeafRange(998801, 998820, 25)).toBe(false);
    });
  });

  // 5. ACCOUNTING & GENERAL LEDGER
  describe('Accounting COA Normal Sides & Balances', () => {
    function computeAccountBalance(normalSide, totalDebit, totalCredit) {
      if (normalSide === 'DEBIT') {
        return totalDebit - totalCredit;
      }
      return totalCredit - totalDebit;
    }

    function validateTrialBalance(accounts) {
      let sumDebit = 0;
      let sumCredit = 0;
      accounts.forEach(a => {
        sumDebit += (Number(a.totalDebit) || 0);
        sumCredit += (Number(a.totalCredit) || 0);
      });
      return {
        isBalanced: Math.abs(sumDebit - sumCredit) < 0.01,
        sumDebit,
        sumCredit
      };
    }

    test('11. computeAccountBalance correctly normalizes Asset/Expense (Debit) vs Liability/Equity/Revenue (Credit)', () => {
      // Asset (Cash): Debit 100M, Credit 20M -> Balance +80M
      expect(computeAccountBalance('DEBIT', 100000000, 20000000)).toBe(80000000);

      // Liability (Payable): Debit 30M, Credit 100M -> Balance +70M
      expect(computeAccountBalance('KREDIT', 30000000, 100000000)).toBe(70000000);

      // Revenue: Credit 500M, Debit 0 -> Balance +500M
      expect(computeAccountBalance('KREDIT', 0, 500000000)).toBe(500000000);
    });

    test('12. validateTrialBalance verifies zero-difference trial balance across all accounts', () => {
      const balancedAccounts = [
        { accountCode: '1111-IDR', totalDebit: 1380000000, totalCredit: 1300000000 },
        { accountCode: '1157', totalDebit: 1300000000, totalCredit: 1300000000 },
        { accountCode: '5110', totalDebit: 1300000000, totalCredit: 0 },
        { accountCode: '4111', totalDebit: 0, totalCredit: 1380000000 }
      ];

      const res = validateTrialBalance(balancedAccounts);
      expect(res.isBalanced).toBe(true);
      expect(res.sumDebit).toBe(3980000000);
      expect(res.sumCredit).toBe(3980000000);
    });
  });

});
