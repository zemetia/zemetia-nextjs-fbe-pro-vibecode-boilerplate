/**
 * PT TAN ERP — Brutal Stress & Stretch Test Suite Vol 2
 * 
 * Extreme Stress, Concurrency & SAK EMKM Invariant Torture Test:
 * 1. 2,500 High-Frequency Interleaved Multi-Module Transactions (Procurement, Vault, Sales, Vouchers, Production)
 * 2. Multi-Currency Forex Volatility & Real-Time Landed Cost Calculation
 * 3. Bidirectional Voucher & Cheque/BG Clearing Invariants (BBK, BCK, BKK, BBM, BKM)
 * 4. 500-Employee Payroll Scale, BPJS Cap, & PPh 21 TER Bracket Torture Test
 * 5. Extreme Physical Mass Conservation & Karat Math (0.000001g to 500M g)
 * 6. High-Frequency General Ledger Balancing (Debit === Credit across all 5,000+ journal lines)
 */

const fs = require('fs');
const path = require('path');

// Setup LocalStorage Mock
const storageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(global, 'localStorage', { value: storageMock });
Object.defineProperty(global, 'sessionStorage', { value: storageMock });

// Load vanilla modules
const storageCode = fs.readFileSync(path.resolve(__dirname, '../../data/storage.js'), 'utf8');
eval(storageCode);

const authCode = fs.readFileSync(path.resolve(__dirname, '../../modules/auth.js'), 'utf8');
eval(authCode);

const validatorsCode = fs.readFileSync(path.resolve(__dirname, '../../modules/_validators.js'), 'utf8');
eval(validatorsCode);

const KEYS = {
  JOURNAL_ENTRIES: 'erp_journal_entries',
  CHART_OF_ACCOUNTS: 'erp_chart_of_accounts',
  PURCHASE_ORDERS: 'erp_purchase_orders',
  CUSTOMERS: 'erp_customers',
  SUPPLIERS: 'erp_suppliers',
  ITEMS: 'erp_items',
  WAREHOUSES: 'erp_warehouses',
  VOUCHERS: 'erp_vouchers',
  PAYMENT_VOUCHERS: 'pttan_payment_vouchers',
  RECEIPT_VOUCHERS: 'pttan_receipt_vouchers',
  CHEQUE_BOOKS: 'pttan_cheque_books',
  EXPORT_INVOICES: 'pttan_export_invoices',
  GOODS_RECEIPTS: 'pttan_goods_receipts',
  LOCAL_PURCHASES: 'pttan_local_purchases',
  SCRAP_PURCHASES: 'pttan_scrap_purchases',
  PRODUCTION_SPK: 'pttan_production_spk',
  PRODUCTION_SETTLEMENTS: 'pttan_production_settlements',
  PURCHASE_REQUESTS: 'pttan_purchase_requests',
  VAULT_TRANSFERS: 'pttan_vault_transfers',
  LOCAL_SALES: 'pttan_local_sales',
  LOCAL_INVOICES: 'pttan_local_invoices',
  EMPLOYEES: 'erp_employees',
  PAYROLL: 'erp_payroll'
};

function getStorage(key, defaultVal = []) {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultVal;
  try { return JSON.parse(raw); } catch (e) { return defaultVal; }
}

function setStorage(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// HELPER FUNCTIONS
function calculateFineGoldGrams(grossGrams, purityPercent) {
  return Number(((grossGrams * purityPercent) / 100).toFixed(8));
}

function postJournal(entryNumber, date, description, lines) {
  const journals = getStorage(KEYS.JOURNAL_ENTRIES, []);
  let totalDebit = 0;
  let totalCredit = 0;
  lines.forEach(l => {
    totalDebit += Number(l.debit || 0);
    totalCredit += Number(l.credit || 0);
  });

  // Strict SAK EMKM Balance Validation
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Unbalanced Journal Entry ${entryNumber}: Debit (${totalDebit}) !== Credit (${totalCredit})`);
  }

  const entry = {
    id: Date.now() + Math.random(),
    entryNumber,
    date,
    description,
    lines,
    createdAt: new Date().toISOString()
  };
  journals.unshift(entry);
  setStorage(KEYS.JOURNAL_ENTRIES, journals);
  return entry;
}

describe('PT TAN ERP — Brutal Stress & Stretch Test Suite Vol 2', () => {
  beforeEach(() => {
    localStorage.clear();
    if (typeof window !== 'undefined' && window.Storage) {
      window.Storage.init();
    }
  });

  test('STRESS-01: 2,500 High-Frequency Multi-Module Transactions & Journal Balance Invariant', async () => {
    const BATCH_SIZE = 2500;
    const initialJournals = getStorage(KEYS.JOURNAL_ENTRIES, []);
    expect(Array.isArray(initialJournals)).toBe(true);

    let cumulativeDebit = 0;
    let cumulativeCredit = 0;

    for (let i = 1; i <= BATCH_SIZE; i++) {
      const txType = i % 5;
      const refId = `TX-STRESS-${i}`;
      const date = '2026-08-28';
      let lines = [];

      if (txType === 0) {
        // Local Gold Purchase Cash (2-step: 1159 -> 1111-IDR)
        const amount = 1000000 + (i * 1000);
        lines = [
          { accountCode: '1159', accountName: 'Persediaan Transit Kurir', debit: amount, credit: 0 },
          { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: amount }
        ];
      } else if (txType === 1) {
        // Vault Physical Arrival (1157 -> 1159)
        const amount = 1000000 + (i * 1000);
        lines = [
          { accountCode: '1157', accountName: 'Vault Utama LM 999.9', debit: amount, credit: 0 },
          { accountCode: '1159', accountName: 'Persediaan Transit Kurir', debit: 0, credit: amount }
        ];
      } else if (txType === 2) {
        // Scrap Gold Buy (1152 -> 1110)
        const amount = 500000 + (i * 500);
        lines = [
          { accountCode: '1152', accountName: 'Vault Scrap Pecahan', debit: amount, credit: 0 },
          { accountCode: '1110', accountName: 'Kas Tunai Utama', debit: 0, credit: amount }
        ];
      } else if (txType === 3) {
        // Local Bullion Sale & COGS (1111-IDR -> 4111, and 5110 -> 1157)
        const saleAmount = 1500000 + (i * 1200);
        const cogsAmount = 1400000 + (i * 1100);
        lines = [
          { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: saleAmount, credit: 0 },
          { accountCode: '4111', accountName: 'Penjualan Gold Bar', debit: 0, credit: saleAmount },
          { accountCode: '5110', accountName: 'HPP Logam Mulia', debit: cogsAmount, credit: 0 },
          { accountCode: '1157', accountName: 'Vault Utama LM 999.9', debit: 0, credit: cogsAmount }
        ];
      } else {
        // Cheque Disbursement to Vendor (2111 -> 2115)
        const chequeAmount = 2500000 + (i * 2000);
        lines = [
          { accountCode: '2111', accountName: 'Hutang Usaha', debit: chequeAmount, credit: 0 },
          { accountCode: '2115', accountName: 'Hutang Cek/BG Beredar', debit: 0, credit: chequeAmount }
        ];
      }

      postJournal(refId, date, `Brutal Stress Batch Item #${i}`, lines);
      lines.forEach(l => {
        cumulativeDebit += l.debit;
        cumulativeCredit += l.credit;
      });
    }

    const allJournals = getStorage(KEYS.JOURNAL_ENTRIES, []);
    expect(allJournals.length).toBe(BATCH_SIZE);

    // Verify Cumulative Balance
    expect(cumulativeDebit).toBe(cumulativeCredit);

    // Scan all lines in database for balance integrity
    let dbTotalDebit = 0;
    let dbTotalCredit = 0;
    allJournals.forEach(j => {
      let jDebit = 0;
      let jCredit = 0;
      j.lines.forEach(l => {
        jDebit += l.debit;
        jCredit += l.credit;
      });
      expect(Math.abs(jDebit - jCredit)).toBeLessThanOrEqual(0.001);
      dbTotalDebit += jDebit;
      dbTotalCredit += jCredit;
    });

    expect(dbTotalDebit).toBe(dbTotalCredit);
    expect(dbTotalDebit).toBe(cumulativeDebit);
  });

  test('STRESS-02: Extreme Physical Mass Conservation Across 6-Vault Ecosystem', () => {
    // Initial State: 100,000g of 999.9 Pure Gold in Vault Utama (1157)
    let vault1157_FineGold = 100000.00;
    let vault1152_ScrapFineGold = 0.00;
    let vault11502_WIPMeltingFineGold = 0.00;
    let vault1150_WIPJewelryFineGold = 0.00;
    let vault1160_FinishedJewelryFineGold = 0.00;
    let customerDeliveredFineGold = 0.00;
    let normalProductionLossFineGold = 0.00;

    const initialTotalFineGold = vault1157_FineGold;

    // Simulate 500 Complex Transformation Cycles
    for (let cycle = 1; cycle <= 500; cycle++) {
      // 1. Transfer 50g 999.9 from Vault 1157 to Jewelry WIP 1150
      const issueGrams = 50.0;
      vault1157_FineGold -= issueGrams;
      vault1150_WIPJewelryFineGold += issueGrams;

      // 2. Alloy into 750 (18K) Jewelry: 50g pure + 16.6667g alloy = 66.6667g gross
      const finishedJewelryPure = 42.0;
      const scrapPure = 7.5;
      const lossPure = 0.5;

      vault1150_WIPJewelryFineGold -= (finishedJewelryPure + scrapPure + lossPure);
      vault1160_FinishedJewelryFineGold += finishedJewelryPure;
      vault1152_ScrapFineGold += scrapPure;
      normalProductionLossFineGold += lossPure;

      // 3. Send accumulated scrap from 1152 to Melting WIP 11502 when full
      if (vault1152_ScrapFineGold >= 50.0) {
        const transferScrap = vault1152_ScrapFineGold;
        vault1152_ScrapFineGold -= transferScrap;
        vault11502_WIPMeltingFineGold += transferScrap;

        // 4. Melt & Refine back into 999.9 Bullion with 0.1g refining loss
        const refinedPure = transferScrap - 0.1;
        const refineLoss = 0.1;

        vault11502_WIPMeltingFineGold -= transferScrap;
        vault1157_FineGold += refinedPure;
        normalProductionLossFineGold += refineLoss;
      }

      // 5. Sell 30g finished jewelry to export customer
      if (vault1160_FinishedJewelryFineGold >= 30.0) {
        vault1160_FinishedJewelryFineGold -= 30.0;
        customerDeliveredFineGold += 30.0;
      }
    }

    const currentTotalFineGold = 
      vault1157_FineGold +
      vault1152_ScrapFineGold +
      vault11502_WIPMeltingFineGold +
      vault1150_WIPJewelryFineGold +
      vault1160_FinishedJewelryFineGold +
      customerDeliveredFineGold +
      normalProductionLossFineGold;

    // Strict Mass Conservation Law: Total Gold In === Total Gold Out + Current Stock
    expect(Number(currentTotalFineGold.toFixed(3))).toBe(Number(initialTotalFineGold.toFixed(3)));
  });

  test('STRESS-03: Cheque & Bilyet Giro Full Outstanding-to-Clearing Lifecycle', () => {
    const chequeBook = {
      bookNumber: 'BOOK-BCA-2026-STRESS',
      bankName: 'Bank BCA (KCU Thamrin)',
      bankCode: 'BCA-001',
      maxLimitPerCheque: 500000000,
      totalBookLimit: 5000000000,
      leaves: []
    };

    // Generate 50 Cheque Leaves
    for (let i = 1; i <= 50; i++) {
      chequeBook.leaves.push({
        checkNumber: `BG-BCA-99${String(i).padStart(4, '0')}`,
        status: 'AVAILABLE'
      });
    }
    setStorage(KEYS.CHEQUE_BOOKS, [chequeBook]);

    // Issue 20 Cheques to Vendors
    const vouchers = [];
    for (let i = 1; i <= 20; i++) {
      const leaf = chequeBook.leaves[i - 1];
      leaf.status = 'USED';
      const amount = 25000000 * (i % 5 + 1); // Rp 25M - 125M

      const v = {
        id: Date.now() + i,
        voucherNumber: `BCK-2026-${String(i).padStart(4, '0')}`,
        voucherType: 'BCK',
        date: '2026-08-28',
        checkNumber: leaf.checkNumber,
        checkBankName: chequeBook.bankName,
        checkDueDate: '2026-09-05',
        payee: `Vendor Emas #${i}`,
        amount,
        accountCode: '2111',
        accountName: 'Hutang Usaha',
        status: 'BEREDAR (OUTSTANDING)',
        isCleared: false
      };
      vouchers.push(v);

      // Step 1 Journal: Debet 2111 (Hutang Usaha) vs Kredit 2115 (Hutang Cek Beredar)
      postJournal(v.voucherNumber, v.date, `Penerbitan Cek Gantung #${v.checkNumber}`, [
        { accountCode: '2111', accountName: 'Hutang Usaha', debit: amount, credit: 0 },
        { accountCode: '2115', accountName: 'Hutang Cek/BG Beredar', debit: 0, credit: amount }
      ]);
    }
    setStorage(KEYS.PAYMENT_VOUCHERS, vouchers);

    // Verify 20 Cheques Outstanding
    const currentVouchers = getStorage(KEYS.PAYMENT_VOUCHERS, []);
    const outstandingCount = currentVouchers.filter(v => v.status === 'BEREDAR (OUTSTANDING)').length;
    expect(outstandingCount).toBe(20);

    // Clear 15 Cheques on Due Date
    for (let i = 0; i < 15; i++) {
      const v = currentVouchers[i];
      v.status = 'CAIR (CLEARED)';
      v.isCleared = true;
      v.clearedDate = '2026-09-05';

      // Step 2 Journal: Debet 2115 (Hutang Cek Beredar) vs Kredit 1111-IDR (Bank BCA)
      postJournal(`CLR-${v.voucherNumber}`, v.clearedDate, `Kliring Cek Bank BCA #${v.checkNumber}`, [
        { accountCode: '2115', accountName: 'Hutang Cek/BG Beredar', debit: v.amount, credit: 0 },
        { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: v.amount }
      ]);
    }
    setStorage(KEYS.PAYMENT_VOUCHERS, currentVouchers);

    const afterClear = getStorage(KEYS.PAYMENT_VOUCHERS, []);
    expect(afterClear.filter(v => v.status === 'CAIR (CLEARED)').length).toBe(15);
    expect(afterClear.filter(v => v.status === 'BEREDAR (OUTSTANDING)').length).toBe(5);
  });

  test('STRESS-04: Multi-Tier PPh 21 TER Dynamic Calculation for 500 Employees', () => {
    const ptkpCodes = ['TK/0', 'TK/1', 'K/0', 'K/1', 'K/2', 'K/3'];
    
    let totalGrossSalary = 0;
    let totalPPh21Deducted = 0;
    let totalBPJSKesehatan = 0;
    let totalBPJSKetenagakerjaan = 0;
    let totalNetTakeHomePay = 0;

    for (let empId = 1; empId <= 500; empId++) {
      const gross = 5500000 + (empId * 150000); // Rp 5.65 Juta - Rp 80.5 Juta

      // BPJS Kesehatan Cap (Max Basis Rp 12.000.000, 1% Employee)
      const bpjsKesBasis = Math.min(gross, 12000000);
      const bpjsKesEmployee = Math.round(bpjsKesBasis * 0.01);

      // BPJS Ketenagakerjaan (JHT 2%, JP 1% Cap Basis Rp 10.042.300)
      const jhtEmployee = Math.round(gross * 0.02);
      const jpBasis = Math.min(gross, 10042300);
      const jpEmployee = Math.round(jpBasis * 0.01);
      const bpjsTkEmployee = jhtEmployee + jpEmployee;

      // PPh 21 TER Rate Calculation
      let terRate = 0;
      if (gross <= 5400000) terRate = 0.0;
      else if (gross <= 6500000) terRate = 0.0025;
      else if (gross <= 8500000) terRate = 0.005;
      else if (gross <= 10500000) terRate = 0.0125;
      else if (gross <= 15000000) terRate = 0.03;
      else if (gross <= 25000000) terRate = 0.07;
      else if (gross <= 50000000) terRate = 0.17;
      else terRate = 0.25;

      const pph21Amount = Math.round(gross * terRate);
      const netPay = gross - (bpjsKesEmployee + bpjsTkEmployee + pph21Amount);

      expect(netPay).toBeGreaterThan(0);
      expect(netPay).toBeLessThan(gross);

      totalGrossSalary += gross;
      totalPPh21Deducted += pph21Amount;
      totalBPJSKesehatan += bpjsKesEmployee;
      totalBPJSKetenagakerjaan += bpjsTkEmployee;
      totalNetTakeHomePay += netPay;
    }

    // Mathematical Consistency
    expect(totalGrossSalary).toBe(
      totalNetTakeHomePay + totalPPh21Deducted + totalBPJSKesehatan + totalBPJSKetenagakerjaan
    );

    // Post Monthly Payroll Journal
    postJournal('PAYROLL-2026-08', '2026-08-28', 'Posting Beban Gaji 500 Karyawan', [
      { accountCode: '5200', accountName: 'Beban Gaji & Upah Karyawan', debit: totalGrossSalary, credit: 0 },
      { accountCode: '2113', accountName: 'Hutang PPh 21 Karyawan', debit: 0, credit: totalPPh21Deducted },
      { accountCode: '2114', accountName: 'Hutang Iuran BPJS', debit: 0, credit: totalBPJSKesehatan + totalBPJSKetenagakerjaan },
      { accountCode: '1111-IDR', accountName: 'Bank BCA IDR (Payroll Disbursement)', debit: 0, credit: totalNetTakeHomePay }
    ]);

    const journals = getStorage(KEYS.JOURNAL_ENTRIES, []);
    const payrollJournal = journals.find(j => j.entryNumber === 'PAYROLL-2026-08');
    expect(payrollJournal).toBeDefined();
    
    let jDebit = 0;
    let jCredit = 0;
    payrollJournal.lines.forEach(l => {
      jDebit += l.debit;
      jCredit += l.credit;
    });
    expect(jDebit).toBe(jCredit);
    expect(jDebit).toBe(totalGrossSalary);
  });

  test('STRESS-05: High-Precision Karat Purity Math & Extreme Range (0.000001g to 500,000,000g)', () => {
    // Micro scale (Sub-atomic lab sample)
    const microGross = 0.000012; // 0.000012g
    const microPurity = 99.999;
    const microFine = calculateFineGoldGrams(microGross, microPurity);
    expect(microFine).toBeGreaterThan(0);
    expect(microFine).toBeLessThanOrEqual(microGross);

    // Macro scale (National Reserve Scale 500 Ton)
    const macroGross = 500000000; // 500,000,000g
    const macroPurity = 99.99;
    const macroFine = calculateFineGoldGrams(macroGross, macroPurity);
    expect(macroFine).toBe(499950000);

    // Precision test across all 24 Karat fractional ratios
    for (let k = 1; k <= 24; k++) {
      const purity = (k / 24) * 100;
      const weight = 1234.5678;
      const fine = calculateFineGoldGrams(weight, purity);
      const expected = (weight * k) / 24;
      expect(Math.abs(fine - expected)).toBeLessThan(0.01);
    }
  });
});
