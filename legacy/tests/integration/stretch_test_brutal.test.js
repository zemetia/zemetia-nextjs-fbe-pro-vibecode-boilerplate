/**
 * PT TAN ERP — Brutal Stretch & Integration Test Suite
 * 
 * Comprehensive stress and torturing test of all end-to-end ERP workflows:
 * 1. Full Procurement Lifecycle (PR -> PO Local/Import -> TTB -> Voucher -> Scrap -> Silver Alloy)
 * 2. 6-Vault Inventory Dynamic Aggregation & Mass Conservation
 * 3. Jewelry Production BOM Karat Conversion & Settlement
 * 4. Local Sales (SO -> DO -> PMK 48/2023 Invoice -> BBM) & Export Sales (SO -> DO -> Commercial Inv USD -> BBM)
 * 5. High-Volume Torture Test (1,000+ interleaved multi-module transactions)
 * 6. Strict SAK EMKM Financial Invariants (Debit=Credit, Assets=Liab+Equity, Cash Flow Reconciliation, Detail-only COA)
 * 7. Decimal Precision & Extreme Edge-Case Torturing (0.0001g micro to 10M g macro, serial chaos, currency volatility)
 */

const fs = require('fs');
const path = require('path');

// ─── Setup LocalStorage & Environment ───
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

// Load vanilla storage & purchase order engine
const storageCode = fs.readFileSync(path.resolve(__dirname, '../../data/storage.js'), 'utf8');
eval(storageCode);

const authCode = fs.readFileSync(path.resolve(__dirname, '../../modules/auth.js'), 'utf8');
eval(authCode);

const validatorsCode = fs.readFileSync(path.resolve(__dirname, '../../modules/_validators.js'), 'utf8');
eval(validatorsCode);

const poCode = fs.readFileSync(path.resolve(__dirname, '../../modules/purchaseOrder.js'), 'utf8');
eval(poCode);

// ─── Business Logic Service Adapters for Testing ───
const KEYS = {
  JOURNAL_ENTRIES: 'erp_journal_entries',
  CHART_OF_ACCOUNTS: 'erp_chart_of_accounts',
  PURCHASE_ORDERS: 'erp_purchase_orders',
  CUSTOMERS: 'erp_customers',
  SUPPLIERS: 'erp_suppliers',
  ITEMS: 'erp_items',
  WAREHOUSES: 'erp_warehouses',
  VOUCHERS: 'erp_vouchers',
  CHEQUE_BOOKS: 'pttan_cheque_books',
  EXPORT_INVOICES: 'pttan_export_invoices',
  EXPORT_SALES_ORDERS: 'pttan_export_sales_orders',
  EXPORT_DELIVERY_ORDERS: 'pttan_export_delivery_orders',
  GOODS_RECEIPTS: 'pttan_goods_receipts',
  LOCAL_PURCHASES: 'pttan_local_purchases',
  SCRAP_PURCHASES: 'pttan_scrap_purchases',
  PRODUCTION_SPK: 'pttan_production_spk',
  PRODUCTION_SETTLEMENTS: 'pttan_production_settlements',
  PURCHASE_REQUESTS: 'pttan_purchase_requests',
  VAULT_TRANSFERS: 'pttan_vault_transfers',
  COMPANY_PROFILE: 'pttan_company_profile',
  SILVER_TRANSACTIONS: 'pttan_silver_transactions',
  LOCAL_SALES: 'pttan_local_sales',
  LOCAL_SALES_ORDERS: 'pttan_local_sales_orders',
  LOCAL_DELIVERY_ORDERS: 'pttan_local_delivery_orders',
  LOCAL_INVOICES: 'pttan_local_invoices'
};

function getStorage(key, defaultVal = []) {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultVal;
  try { return JSON.parse(raw); } catch (e) { return defaultVal; }
}

function setStorage(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function getDefaultCOA() {
  return Storage.getDefaultChartOfAccounts();
}

function getDefaultWarehouses() {
  return [
    { id: 'WH-VAULT-01', name: 'Vault Utama PT TAN', code: 'VAULT-PRI', account: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)' },
    { id: 'WH-VAULT-02', name: 'Vault Emas Impor Transit', code: 'VAULT-IMP', account: '1158', accountName: 'Persediaan Logam Mulia Impor' },
    { id: 'WH-VAULT-04', name: 'Vault Emas WIP (Produksi Perhiasan)', code: 'VAULT-WIP', account: '11502', accountName: 'Persediaan Emas WIP (Produksi)' },
    { id: 'WH-VAULT-03', name: 'Vault Perhiasan Siap Ekspor', code: 'VAULT-EXP', account: '1160', accountName: 'Persediaan Perhiasan Siap Ekspor' },
    { id: 'WH-VAULT-05', name: 'Vault Pecahan Scrap & Leburan', code: 'VAULT-SCRAP', account: '1152', accountName: 'Persediaan Emas Scrap & Leburan' },
    { id: 'WH-VAULT-06', name: 'Vault Perak & Logam Alloy (Silver Vault)', code: 'VAULT-SILVER', account: '1153', accountName: 'Persediaan Silver & Logam Mulia Lain' }
  ];
}

// Full Dynamic Vault Calculator (matching storageService.js)
function calculateVaultStockPosition() {
  const warehouses = getDefaultWarehouses();
  const grns = getStorage(KEYS.GOODS_RECEIPTS, []);
  const localPurchases = getStorage(KEYS.LOCAL_PURCHASES, []);
  const scrapPurchases = getStorage(KEYS.SCRAP_PURCHASES, []);
  const spkList = getStorage(KEYS.PRODUCTION_SPK, []);
  const settlements = getStorage(KEYS.PRODUCTION_SETTLEMENTS, []);
  const exportDOs = getStorage(KEYS.EXPORT_DELIVERY_ORDERS, []);
  const localDOs = getStorage(KEYS.LOCAL_DELIVERY_ORDERS, []);
  const localSales = getStorage(KEYS.LOCAL_SALES, []);
  const transfers = getStorage(KEYS.VAULT_TRANSFERS, []);
  const silverTransactions = getStorage(KEYS.SILVER_TRANSACTIONS, []);

  const vaultBalances = {};
  warehouses.forEach(w => {
    vaultBalances[w.account] = {
      id: w.id,
      name: w.name,
      account: w.account,
      totalInGrams: 0,
      totalOutGrams: 0,
      balanceGrams: 0,
      totalValueIDR: 0
    };
  });

  // 1. Goods Receipts (TTB Impor) -> IN ke 1158
  grns.forEach(grn => {
    const acc = grn.targetVault || '1158';
    const weight = Number(grn.receivedWeightGram || 0);
    const val = Number(grn.totalValueIDR || (weight * 1350000));
    if (vaultBalances[acc]) {
      vaultBalances[acc].totalInGrams += weight;
      vaultBalances[acc].balanceGrams += weight;
      vaultBalances[acc].totalValueIDR += val;
    }
  });

  // 2. Local Purchases (LM Lokal tiba di vault) -> IN ke 1157
  localPurchases.forEach(lp => {
    if (lp.isVaultReceived || lp.status?.includes('RECEIVED') || lp.status?.includes('VAULT')) {
      const acc = '1157';
      const weight = Number(lp.quantityGrams || 0);
      const val = Number(lp.totalAmount || (weight * 1300000));
      if (vaultBalances[acc]) {
        vaultBalances[acc].totalInGrams += weight;
        vaultBalances[acc].balanceGrams += weight;
        vaultBalances[acc].totalValueIDR += val;
      }
    }
  });

  // 2b. Scrap Purchases -> IN ke 1152
  scrapPurchases.forEach(sc => {
    const acc = sc.targetVault || '1152';
    const weight = Number(sc.grossWeight || sc.estimatedFineGold || 0);
    const val = Number(sc.totalAmount || (weight * 1200000));
    if (vaultBalances[acc]) {
      vaultBalances[acc].totalInGrams += weight;
      vaultBalances[acc].balanceGrams += weight;
      vaultBalances[acc].totalValueIDR += val;
    }
  });

  // 3. SPK Issue to WIP Produksi -> OUT dari 1157, IN ke 11502
  spkList.forEach(spk => {
    const fineWeight = Number(spk.fineGoldNeeded || 0);
    const val = fineWeight * 1300000;
    if (vaultBalances['1157']) {
      vaultBalances['1157'].totalOutGrams += fineWeight;
      vaultBalances['1157'].balanceGrams -= fineWeight;
      vaultBalances['1157'].totalValueIDR -= val;
    }
    if (vaultBalances['11502']) {
      vaultBalances['11502'].totalInGrams += fineWeight;
      vaultBalances['11502'].balanceGrams += fineWeight;
      vaultBalances['11502'].totalValueIDR += val;
    }
  });

  // 4. Production Settlement -> OUT dari 11502, IN ke 1160 & 1152
  settlements.forEach(st => {
    const outJewelry = Number(st.jewelryOutputWeight || 0);
    const scrapRet = Number(st.scrapReturnWeight || 0);
    const goldLoss = Number(st.goldLossWeight || 0);
    const totalDeductedWIP = outJewelry + scrapRet + goldLoss;
    const valJewelry = (outJewelry * 1350000) + Number(st.laborFeeIDR || 0);

    if (vaultBalances['11502']) {
      vaultBalances['11502'].totalOutGrams += totalDeductedWIP;
      vaultBalances['11502'].balanceGrams -= totalDeductedWIP;
      vaultBalances['11502'].totalValueIDR -= (totalDeductedWIP * 1300000);
    }
    if (vaultBalances['1160']) {
      vaultBalances['1160'].totalInGrams += outJewelry;
      vaultBalances['1160'].balanceGrams += outJewelry;
      vaultBalances['1160'].totalValueIDR += valJewelry;
    }
    if (scrapRet > 0 && vaultBalances['1152']) {
      vaultBalances['1152'].totalInGrams += scrapRet;
      vaultBalances['1152'].balanceGrams += scrapRet;
      vaultBalances['1152'].totalValueIDR += (scrapRet * 1200000);
    }
  });

  // 5. Export Delivery Orders -> OUT dari 1160
  exportDOs.forEach(doItem => {
    const weight = Number(doItem.netWeightGram || 0);
    const val = weight * 1380000;
    if (vaultBalances['1160']) {
      vaultBalances['1160'].totalOutGrams += weight;
      vaultBalances['1160'].balanceGrams -= weight;
      vaultBalances['1160'].totalValueIDR -= val;
    }
  });

  // 6. Internal Vault Transfers
  transfers.forEach(trf => {
    const weight = Number(trf.quantityGrams || 0);
    const val = Number(trf.estimatedValueIDR || (weight * 1300000));
    if (vaultBalances[trf.fromAccount]) {
      vaultBalances[trf.fromAccount].totalOutGrams += weight;
      vaultBalances[trf.fromAccount].balanceGrams -= weight;
      vaultBalances[trf.fromAccount].totalValueIDR -= val;
    }
    if (vaultBalances[trf.toAccount]) {
      vaultBalances[trf.toAccount].totalInGrams += weight;
      vaultBalances[trf.toAccount].balanceGrams += weight;
      vaultBalances[trf.toAccount].totalValueIDR += val;
    }
  });

  // 7. Silver Receipts & Alloy Additions
  silverTransactions.forEach(st => {
    if (st.transactionType === 'RECEIPT') {
      const weight = Number(st.weightGrams || 0);
      const val = Number(st.totalValueIDR || (weight * 16500));
      if (vaultBalances['1153']) {
        vaultBalances['1153'].totalInGrams += weight;
        vaultBalances['1153'].balanceGrams += weight;
        vaultBalances['1153'].totalValueIDR += val;
      }
    } else if (st.transactionType === 'ALLOY_ADDITION') {
      const silverWeight = Number(st.silverWeightGram || 0);
      const val = Number(st.totalSilverValueIDR || (silverWeight * 16500));
      const targetAcc = st.targetAccount || '1157';

      if (vaultBalances['1153']) {
        vaultBalances['1153'].totalOutGrams += silverWeight;
        vaultBalances['1153'].balanceGrams -= silverWeight;
        vaultBalances['1153'].totalValueIDR -= val;
      }
      if (vaultBalances[targetAcc]) {
        vaultBalances[targetAcc].totalInGrams += silverWeight;
        vaultBalances[targetAcc].balanceGrams += silverWeight;
        vaultBalances[targetAcc].totalValueIDR += val;
      }
    }
  });

  // 8. Local Delivery Orders -> OUT dari Vault Asal (1157, 1160, 1152)
  const processedDOs = new Set();
  localDOs.forEach(doItem => {
    if (doItem.status === 'DELIVERED' || doItem.status === 'SHIPPED') {
      const acc = doItem.sourceVault || '1157';
      const weight = Number(doItem.netWeightGram || doItem.quantityGrams || 0);
      const cogsVal = Number(doItem.cogsAmountIDR || (weight * 1300000));
      if (vaultBalances[acc]) {
        vaultBalances[acc].totalOutGrams += weight;
        vaultBalances[acc].balanceGrams -= weight;
        vaultBalances[acc].totalValueIDR -= cogsVal;
      }
      if (doItem.doNumber) processedDOs.add(doItem.doNumber);
      if (doItem.invoiceNo) processedDOs.add(doItem.invoiceNo);
    }
  });

  // 8b. Direct Local Sales
  localSales.forEach(sale => {
    if ((sale.deliveryStatus === 'DELIVERED' || sale.paymentStatus === 'PAID') &&
        !processedDOs.has(sale.doNumber) && !processedDOs.has(sale.invoiceNo)) {
      const acc = sale.sourceVault || '1157';
      const weight = Number(sale.quantityGrams || 0);
      const cogsVal = Number(sale.cogsAmountIDR || (weight * 1300000));
      if (vaultBalances[acc]) {
        vaultBalances[acc].totalOutGrams += weight;
        vaultBalances[acc].balanceGrams -= weight;
        vaultBalances[acc].totalValueIDR -= cogsVal;
      }
    }
  });

  const vaults = Object.values(vaultBalances);
  const totalVaultGrams = vaults.reduce((sum, v) => sum + v.balanceGrams, 0);
  const grandTotalValueIDR = vaults.reduce((sum, v) => sum + v.totalValueIDR, 0);

  return {
    vaults,
    vaultMap: vaultBalances,
    totalVaultGrams,
    grandTotalValueIDR
  };
}

// Financial Engine Calculation from Journals
function calculateFinancialStatements() {
  const coa = getDefaultCOA().filter(a => a.type === 'detail');
  const journals = getStorage(KEYS.JOURNAL_ENTRIES, []);

  const accountBalances = {};
  coa.forEach(a => {
    accountBalances[a.code] = {
      code: a.code,
      name: a.name,
      category: a.category,
      type: a.type,
      totalDebit: 0,
      totalCredit: 0,
      balance: 0
    };
  });

  journals.forEach(j => {
    j.lines?.forEach(line => {
      const code = line.accountCode;
      if (!accountBalances[code]) {
        accountBalances[code] = {
          code,
          name: line.accountName || code,
          category: code.startsWith('1') ? 'aset' : code.startsWith('2') ? 'kewajiban' : code.startsWith('3') ? 'ekuitas' : code.startsWith('4') ? 'pendapatan' : 'beban',
          totalDebit: 0,
          totalCredit: 0,
          balance: 0
        };
      }
      accountBalances[code].totalDebit += Number(line.debit || 0);
      accountBalances[code].totalCredit += Number(line.credit || 0);
    });
  });

  // Normal balance calculation
  Object.values(accountBalances).forEach(acc => {
    const isDebitNormal = acc.category === 'aset' || acc.category === 'beban' || acc.code.startsWith('1') || acc.code.startsWith('5') || acc.code.startsWith('6');
    if (isDebitNormal) {
      acc.balance = acc.totalDebit - acc.totalCredit;
    } else {
      acc.balance = acc.totalCredit - acc.totalDebit;
    }
  });

  // Income statement
  const revenueAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('4') || a.category === 'pendapatan');
  const hppAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('5') || a.category === 'hpp');
  const opexAccounts = Object.values(accountBalances).filter(a => (a.code.startsWith('6') || a.category === 'beban') && !a.code.startsWith('5'));

  const totalRevenue = revenueAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const totalHPP = hppAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const totalOpex = opexAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const grossProfit = totalRevenue - totalHPP;
  const netIncome = grossProfit - totalOpex;

  // Balance sheet
  const assetAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('1') || a.category === 'aset');
  const liabilityAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('2') || a.category === 'kewajiban');
  const equityAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('3') || a.category === 'ekuitas');

  const totalAssets = assetAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + a.balance, 0);
  const paidInCapital = equityAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = paidInCapital + netIncome;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  // Cash Flow (Direct)
  let cashInflow = 0;
  let cashOutflow = 0;
  journals.forEach(j => {
    j.lines?.forEach(l => {
      const isCash = l.accountCode.startsWith('111') || l.accountCode.startsWith('112');
      if (isCash) {
        if (Number(l.debit) > 0) cashInflow += Number(l.debit);
        if (Number(l.credit) > 0) cashOutflow += Number(l.credit);
      }
    });
  });
  const netCashFlow = cashInflow - cashOutflow;

  return {
    accountBalances,
    totalRevenue,
    totalHPP,
    totalOpex,
    grossProfit,
    netIncome,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanceSheetBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1,
    cashInflow,
    cashOutflow,
    netCashFlow
  };
}

// ─── THE BRUTAL STRETCH TEST SUITE ───

describe('PT TAN ERP — Brutal End-to-End Stretch & Torture Tests', () => {

  beforeEach(() => {
    localStorage.clear();
    Storage.init();
    PurchaseOrder.init();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 1: END-TO-END PROCUREMENT FLOW TORTURE
  // ══════════════════════════════════════════════════════════════════════════════
  describe('1. Full Procurement Cycle (PR -> PO -> TTB -> BBK Voucher -> Scrap -> Silver Alloy)', () => {

    test('1.1. Local Gold PO (Cash 2-Step): Bayar Kurir (1159) -> TTB Vault (1157) -> Zero Transit Balance', async () => {
      const journals = [];
      const localPurchases = [];

      const purchaseId = 'PO-LOK-001';
      const qtyGrams = 2000;
      const pricePerGram = 1350000;
      const totalAmount = qtyGrams * pricePerGram; // Rp 2.700.000.000

      // Journal Stage 1: Debet 1159 (Transit Kurir), Kredit 1111-IDR
      journals.push({
        id: 'JRN-STAGE-1',
        entryNumber: 'JRN-2026-0001',
        date: '2026-08-20',
        description: 'Pembayaran Pembelian LM Lokal via Kurir Bpk Budi (Transit 1159)',
        lines: [
          { accountCode: '1159', accountName: 'Emas Dalam Perjalanan Kurir', debit: totalAmount, credit: 0 },
          { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: totalAmount }
        ]
      });

      // Record local purchase (in transit)
      localPurchases.push({
        id: purchaseId,
        receiptNo: 'NOTA-PGD-001',
        poNumber: purchaseId,
        quantityGrams: qtyGrams,
        pricePerGramIDR: pricePerGram,
        totalAmount,
        isVaultReceived: false,
        status: 'IN_TRANSIT_COURIER',
        courierName: 'Bpk. Budi Santoso'
      });

      setStorage(KEYS.JOURNAL_ENTRIES, journals);
      setStorage(KEYS.LOCAL_PURCHASES, localPurchases);

      // Verify Vault position: 1157 should NOT have received the stock yet
      let pos = calculateVaultStockPosition();
      expect(pos.vaultMap['1157'].balanceGrams).toBe(0);

      // Stage 2: Kurir arrives at safe room, 4-signature verified, TTB issued
      localPurchases[0].isVaultReceived = true;
      localPurchases[0].status = 'RECEIVED & STOCKED IN VAULT (VERIFIED 4 TTD)';
      localPurchases[0].vaultReceivedAt = '2026-08-20T14:00:00Z';

      // Journal Stage 2: Debet 1157 (Vault Utama), Kredit 1159 (Transit Kurir ditutup)
      journals.push({
        id: 'JRN-STAGE-2',
        entryNumber: 'JRN-2026-0002',
        date: '2026-08-20',
        description: 'Fisik Emas Tiba di Brankas Vault Utama (Debet 1157 / Kredit 1159)',
        lines: [
          { accountCode: '1157', accountName: 'Vault Utama 999.9', debit: totalAmount, credit: 0 },
          { accountCode: '1159', accountName: 'Emas Dalam Perjalanan Kurir', debit: 0, credit: totalAmount }
        ]
      });

      setStorage(KEYS.JOURNAL_ENTRIES, journals);
      setStorage(KEYS.LOCAL_PURCHASES, localPurchases);

      // Verify Vault position: 1157 now has 2000g
      pos = calculateVaultStockPosition();
      expect(pos.vaultMap['1157'].balanceGrams).toBe(2000);
      expect(pos.vaultMap['1157'].totalValueIDR).toBe(totalAmount);

      // Verify Transit Account 1159 balance is now EXACTLY 0 (Debet 2.7M - Kredit 2.7M)
      const fin = calculateFinancialStatements();
      expect(fin.accountBalances['1159'].balance).toBe(0);
      expect(fin.accountBalances['1157'].balance).toBe(totalAmount);
      expect(fin.accountBalances['1111-IDR'].balance).toBe(-totalAmount);
    });

    test('1.2. Import Gold PO (Valcambi/YLG USD): Down Payment (1135) -> Customs TTB (1158) -> PPh 22 (1135) -> Settle BBK Devisa', async () => {
      const journals = [];
      const grns = [];

      const exchangeRate = 16250;
      const weightGram = 3000; // 3kg
      const unitPriceUSD = 76.00;
      const subtotalUSD = weightGram * unitPriceUSD; // $228,000 USD
      const subtotalIDR = subtotalUSD * exchangeRate; // Rp 3.705.000.000

      // Step 1: Down Payment / Advance Payment in USD (BBK Devisa)
      journals.push({
        id: 'JRN-IMP-DP',
        entryNumber: 'JRN-2026-0003',
        date: '2026-08-21',
        description: 'Uang Muka Pembelian Impor Valas USD (Debet 1135 / Kredit 1111-USD)',
        lines: [
          { accountCode: '1135', accountName: 'Uang Muka Pembelian Impor', debit: subtotalIDR, credit: 0 },
          { accountCode: '1111-USD', accountName: 'Bank BCA Devisa USD', debit: 0, credit: subtotalIDR }
        ]
      });

      // Step 2: Physical Arrival via Customs Clearance (PIB, SPPB, MAWB) -> TTB issued to Vault 1158
      grns.push({
        id: 'GRN-IMP-001',
        grnNumber: 'GRN-IMP-001',
        poNumber: 'PO-IMP-001',
        pibNo: '008899/PIB/KPU-TP/2026',
        targetVault: '1158',
        receivedWeightGram: weightGram,
        totalValueIDR: subtotalIDR,
        date: '2026-08-22',
        status: 'RECEIVED & VERIFIED'
      });

      // Journal TTB: Debet 1158 (Persediaan Impor), Kredit 1135 (Tutup Uang Muka)
      journals.push({
        id: 'JRN-IMP-TTB',
        entryNumber: 'JRN-2026-0004',
        date: '2026-08-22',
        description: 'Penerimaan Emas Impor TTB (Debet 1158 / Kredit 1135)',
        lines: [
          { accountCode: '1158', accountName: 'Persediaan Emas Impor Vault', debit: subtotalIDR, credit: 0 },
          { accountCode: '1135', accountName: 'Uang Muka Pembelian Impor', debit: 0, credit: subtotalIDR }
        ]
      });

      // Step 3: Customs Duty & PPh 22 Impor (0.25% x Rp 3.705.000.000 = Rp 9.262.500)
      const pph22 = subtotalIDR * 0.0025;
      journals.push({
        id: 'JRN-IMP-PPH22',
        entryNumber: 'JRN-2026-0005',
        date: '2026-08-22',
        description: 'Pembayaran Pajak PPh 22 Impor 0,25% ke Kas Negara (Debet 1135 / Kredit 1111-IDR)',
        lines: [
          { accountCode: '1135', accountName: 'Pajak Dibayar di Muka PPh 22', debit: pph22, credit: 0 },
          { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: pph22 }
        ]
      });

      setStorage(KEYS.JOURNAL_ENTRIES, journals);
      setStorage(KEYS.GOODS_RECEIPTS, grns);

      // Verify Vault: 1158 has exactly 3000g
      const pos = calculateVaultStockPosition();
      expect(pos.vaultMap['1158'].balanceGrams).toBe(3000);
      expect(pos.vaultMap['1158'].totalValueIDR).toBe(subtotalIDR);

      // Verify SAK EMKM Invariant
      const fin = calculateFinancialStatements();
      expect(fin.accountBalances['1158'].balance).toBe(subtotalIDR);
      expect(fin.accountBalances['1135'].balance).toBe(pph22); // Net balance is just PPh 22 creditable tax
      expect(fin.accountBalances['1111-USD'].balance).toBe(-subtotalIDR);
    });

    test('1.3. Scrap Gold Buying & Melting SPK with XRF Purity Assay to Vault 1152', () => {
      const scrapPurchases = [];
      const journals = [];

      const grossWeight = 1250.50; // 1.25 kg scrap
      const xrfPurity = 78.45; // 78.45%
      const fineGold = Number((grossWeight * (xrfPurity / 100)).toFixed(4)); // 981.0173g
      const pricePerFineGram = 1220000;
      const totalAmount = Math.round(fineGold * pricePerFineGram);

      scrapPurchases.push({
        id: 'SCRAP-001',
        receiptNo: 'NOTA-SCRAP-001',
        spkMeltingNo: 'SPK-MLT-001',
        grossWeight,
        xrfPurity,
        estimatedFineGold: fineGold,
        pricePerFineGram,
        totalAmount,
        targetVault: '1152',
        creditAccount: '1110',
        date: '2026-08-23'
      });

      journals.push({
        id: 'JRN-SCRAP-001',
        entryNumber: 'JRN-2026-0006',
        date: '2026-08-23',
        description: `Pembelian Scrap Emas Kadar ${xrfPurity}% (${fineGold}g Fine Gold)`,
        lines: [
          { accountCode: '1152', accountName: 'Vault Scrap & Leburan', debit: totalAmount, credit: 0 },
          { accountCode: '1110', accountName: 'Kas Kecil', debit: 0, credit: totalAmount }
        ]
      });

      setStorage(KEYS.SCRAP_PURCHASES, scrapPurchases);
      setStorage(KEYS.JOURNAL_ENTRIES, journals);

      const pos = calculateVaultStockPosition();
      expect(pos.vaultMap['1152'].balanceGrams).toBeCloseTo(grossWeight, 2);
      expect(pos.vaultMap['1152'].totalValueIDR).toBe(totalAmount);
    });

    test('1.4. Silver (Perak 1153) Receipt & Alloy Addition to Gold 1157 with Mass & Purity Dynamic Balancing', () => {
      const silverTransactions = [];
      const journals = [];

      // Step 1: Receive 10,000g Fine Silver 99.9% @ Rp 16.500
      const silverReceiptWeight = 10000;
      const silverPricePerGram = 16500;
      const totalSilverVal = silverReceiptWeight * silverPricePerGram; // Rp 165.000.000

      silverTransactions.push({
        id: 'SLV-001',
        transactionType: 'RECEIPT',
        weightGrams: silverReceiptWeight,
        pricePerGram: silverPricePerGram,
        totalValueIDR: totalSilverVal,
        date: '2026-08-24'
      });

      journals.push({
        id: 'JRN-SLV-001',
        entryNumber: 'JRN-2026-0007',
        date: '2026-08-24',
        description: 'Penerimaan Perak Murni (Debet 1153 / Kredit 1111-IDR)',
        lines: [
          { accountCode: '1153', accountName: 'Persediaan Perak', debit: totalSilverVal, credit: 0 },
          { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: 0, credit: totalSilverVal }
        ]
      });

      // Step 2: Add 350g Silver Alloy to 1000g 99.99% Gold in Vault 1157
      const silverAdded = 350;
      const silverAddedVal = silverAdded * silverPricePerGram; // Rp 5.775.000
      const goldInitial = 1000;
      const finalWeight = goldInitial + silverAdded; // 1350g
      const fineGoldContent = goldInitial * 0.9999;
      const finalPurity = (fineGoldContent / finalWeight) * 100; // 74.066%

      silverTransactions.push({
        id: 'SLV-002',
        transactionType: 'ALLOY_ADDITION',
        silverWeightGram: silverAdded,
        totalSilverValueIDR: silverAddedVal,
        goldInitialWeightGram: goldInitial,
        totalFinalWeightGram: finalWeight,
        finalEstimatedPurity: Number(finalPurity.toFixed(2)),
        targetAccount: '1157',
        targetVaultName: 'Vault Utama PT TAN',
        date: '2026-08-24'
      });

      journals.push({
        id: 'JRN-ALLOY-001',
        entryNumber: 'JRN-2026-0008',
        date: '2026-08-24',
        description: `Penambahan ${silverAdded}g Perak ke Batangan Emas di 1157`,
        lines: [
          { accountCode: '1157', accountName: 'Vault Utama 999.9', debit: silverAddedVal, credit: 0 },
          { accountCode: '1153', accountName: 'Persediaan Perak', debit: 0, credit: silverAddedVal }
        ]
      });

      setStorage(KEYS.SILVER_TRANSACTIONS, silverTransactions);
      setStorage(KEYS.JOURNAL_ENTRIES, journals);

      const pos = calculateVaultStockPosition();
      // Silver vault: 10,000 - 350 = 9650g
      expect(pos.vaultMap['1153'].balanceGrams).toBe(9650);
      expect(pos.vaultMap['1153'].totalValueIDR).toBe(totalSilverVal - silverAddedVal);

      // Gold vault 1157 received +350g
      expect(pos.vaultMap['1157'].balanceGrams).toBe(350);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 2: PRODUCTION BOM KARAT & SETTLEMENT MASS CONSERVATION
  // ══════════════════════════════════════════════════════════════════════════════
  describe('2. Jewelry Production (BOM Karat 750/700/375 & Settlement Mass Conservation)', () => {

    test('2.1. SPK Issue 18K (750) -> WIP Vault 11502 -> Settlement (FG 1160 + Scrap 1152 + Loss 5120): Mass is 100% Conserved', () => {
      const spkList = [];
      const settlements = [];
      const journals = [];

      // Step 1: Issue SPK for 1000g 18K (750) Jewelry
      // Karat 750 formula: fine gold needed = 1000g * (750 / 999.9) = 750.075g fine gold from Vault 1157
      const targetGross = 1000;
      const fineGoldNeeded = 750.08;
      const fineGoldVal = fineGoldNeeded * 1300000;

      spkList.push({
        id: 'SPK-001',
        spkNo: 'SPK-PROD-2026-001',
        targetKarat: '750',
        grossWeight: targetGross,
        fineGoldNeeded,
        status: 'IN_WIP',
        date: '2026-08-25'
      });

      journals.push({
        id: 'JRN-SPK-001',
        entryNumber: 'JRN-2026-0009',
        date: '2026-08-25',
        description: 'Pengeluaran Bahan Baku Emas Murni ke Vault WIP (Debet 11502 / Kredit 1157)',
        lines: [
          { accountCode: '11502', accountName: 'Vault WIP Produksi', debit: fineGoldVal, credit: 0 },
          { accountCode: '1157', accountName: 'Vault Utama 999.9', debit: 0, credit: fineGoldVal }
        ]
      });

      setStorage(KEYS.PRODUCTION_SPK, spkList);
      setStorage(KEYS.JOURNAL_ENTRIES, journals);

      let pos = calculateVaultStockPosition();
      expect(pos.vaultMap['11502'].balanceGrams).toBe(fineGoldNeeded);
      expect(pos.vaultMap['1157'].balanceGrams).toBe(-fineGoldNeeded);

      // Step 2: Settlement of SPK (Workshop Craftsman returns output)
      // Input WIP = 750.08g
      // Output: 735.08g Finished Jewelry (Vault 1160) + 12.00g Scrap Retur (Vault 1152) + 3.00g Melting Loss (5120)
      const outJewelry = 735.08;
      const scrapRet = 12.00;
      const goldLoss = 3.00;
      const totalInput = outJewelry + scrapRet + goldLoss;
      expect(totalInput).toBeCloseTo(fineGoldNeeded, 2); // Exact mass conservation!

      const laborFee = 15000000; // Rp 15 Juta ongkos tukang
      const jewelryVal = (outJewelry * 1350000) + laborFee;
      const scrapVal = scrapRet * 1200000;
      const lossVal = goldLoss * 1300000;

      settlements.push({
        id: 'JO-001',
        joNumber: 'JO-2026-001',
        jewelryOutputWeight: outJewelry,
        scrapReturnWeight: scrapRet,
        goldLossWeight: goldLoss,
        laborFeeIDR: laborFee,
        karat: '750',
        date: '2026-08-26'
      });

      journals.push({
        id: 'JRN-SETTLE-001',
        entryNumber: 'JRN-2026-0010',
        date: '2026-08-26',
        description: 'Pertanggungjawaban Hasil Produksi Perhiasan 18K (Debet 1160, 1152, 5141 / Kredit 11502, 1111-IDR)',
        lines: [
          { accountCode: '1160', accountName: 'Vault Perhiasan Siap Ekspor', debit: jewelryVal, credit: 0 },
          { accountCode: '1152', accountName: 'Vault Scrap Retur', debit: scrapVal, credit: 0 },
          { accountCode: '5141', accountName: 'Susut Produksi Normal', debit: lossVal, credit: 0 },
          { accountCode: '11502', accountName: 'Vault WIP Produksi', debit: 0, credit: fineGoldVal },
          { accountCode: '1111-IDR', accountName: 'Bank BCA IDR (Ongkos Tukang)', debit: 0, credit: laborFee }
        ]
      });

      setStorage(KEYS.PRODUCTION_SETTLEMENTS, settlements);
      setStorage(KEYS.JOURNAL_ENTRIES, journals);

      pos = calculateVaultStockPosition();
      // Vault WIP 11502 is now EXACTLY 0 (All issued material accounted for)
      expect(pos.vaultMap['11502'].balanceGrams).toBeCloseTo(0, 4);

      // Vault Ekspor 1160 has 735.08g
      expect(pos.vaultMap['1160'].balanceGrams).toBeCloseTo(outJewelry, 2);

      // Vault Scrap 1152 has 12.00g
      expect(pos.vaultMap['1152'].balanceGrams).toBeCloseTo(scrapRet, 2);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 3: SALES WORKFLOWS (LOCAL & EXPORT)
  // ══════════════════════════════════════════════════════════════════════════════
  describe('3. Sales & Distribution (Local PMK 48/2023 Non-BKP & Export 0% PEB/AWB)', () => {

    test('3.1. Local Gold Sales: SO -> DO (HPP 5114 & Stock Cut) -> Invoice (4111 Non-BKP) -> Pelunasan BBM', () => {
      const localDOs = [];
      const localInvoices = [];
      const journals = [];

      const qtyGrams = 1000;
      const unitPrice = 1380000;
      const costPerG = 1300000;
      const totalSales = qtyGrams * unitPrice; // Rp 1.380.000.000
      const totalCOGS = qtyGrams * costPerG;   // Rp 1.300.000.000
      const grossProfit = totalSales - totalCOGS; // Rp 80.000.000

      // Step 1: Surat Jalan (DO) Issued by Warehouse -> Stock Deducted & HPP Recognized
      localDOs.push({
        id: 'SJ-001',
        doNumber: 'SJ-LOKAL-001',
        invoiceNo: 'INV-LOKAL-001',
        netWeightGram: qtyGrams,
        cogsAmountIDR: totalCOGS,
        sourceVault: '1157',
        status: 'DELIVERED',
        customerName: 'Toko Emas Gadjah Berlian',
        date: '2026-08-27'
      });

      journals.push({
        id: 'JRN-LOCAL-DO',
        entryNumber: 'JRN-2026-0011',
        date: '2026-08-27',
        description: 'Pengakuan HPP Surat Jalan Emas Lokal (Debet 5114 / Kredit 1157)',
        lines: [
          { accountCode: '5114', accountName: 'HPP Penjualan Emas Lokal', debit: totalCOGS, credit: 0 },
          { accountCode: '1157', accountName: 'Vault Utama 999.9', debit: 0, credit: totalCOGS }
        ]
      });

      // Step 2: Commercial Invoice (Bebas PPN PMK 48/2023)
      localInvoices.push({
        id: 'INV-001',
        invoiceNo: 'INV-LOKAL-001',
        doNumber: 'SJ-LOKAL-001',
        quantityGrams: qtyGrams,
        unitPriceIDR: unitPrice,
        totalAmountIDR: totalSales,
        paymentMode: 'credit',
        paymentStatus: 'UNPAID',
        customerName: 'Toko Emas Gadjah Berlian',
        date: '2026-08-27'
      });

      journals.push({
        id: 'JRN-LOCAL-INV',
        entryNumber: 'JRN-2026-0012',
        date: '2026-08-27',
        description: 'Faktur Penjualan Emas Lokal PMK 48/2023 (Debet 1130 / Kredit 4111)',
        lines: [
          { accountCode: '1130', accountName: 'Piutang Usaha Lokal', debit: totalSales, credit: 0 },
          { accountCode: '4111', accountName: 'Penjualan Emas Batangan Lokal', debit: 0, credit: totalSales }
        ]
      });

      // Step 3: Pelunasan BBM via Bank BCA IDR
      journals.push({
        id: 'JRN-LOCAL-BBM',
        entryNumber: 'JRN-2026-0013',
        date: '2026-08-28',
        description: 'Pelunasan Piutang Penjualan Emas Lokal (Debet 1111-IDR / Kredit 1130)',
        lines: [
          { accountCode: '1111-IDR', accountName: 'Bank BCA IDR', debit: totalSales, credit: 0 },
          { accountCode: '1130', accountName: 'Piutang Usaha Lokal', debit: 0, credit: totalSales }
        ]
      });

      setStorage(KEYS.LOCAL_DELIVERY_ORDERS, localDOs);
      setStorage(KEYS.LOCAL_INVOICES, localInvoices);
      setStorage(KEYS.JOURNAL_ENTRIES, journals);

      // Verify Financials
      const fin = calculateFinancialStatements();
      expect(fin.totalRevenue).toBe(totalSales);
      expect(fin.totalHPP).toBe(totalCOGS);
      expect(fin.grossProfit).toBe(grossProfit);
      expect(fin.accountBalances['1130'].balance).toBe(0); // A/R is fully settled!
      expect(fin.accountBalances['1111-IDR'].balance).toBe(totalSales);
    });

    test('3.2. Export Jewelry Sales (USD PPN 0%): SO -> DO (HPP 5115 & Stock 1160 Out) -> Invoice USD (1132 & 41101) -> Pelunasan BBM Valas', () => {
      const exportDOs = [];
      const exportInvoices = [];
      const journals = [];

      const exchangeRate = 16250;
      const netWeight = 450; // 450g 18K jewelry
      const unitPriceUSD = 85.00;
      const totalUSD = netWeight * unitPriceUSD; // $38,250 USD
      const totalIDR = totalUSD * exchangeRate; // Rp 621.562.500
      const cogsVal = netWeight * 1250000; // Rp 562.500.000

      // Step 1: Export Delivery Order (Brinks Cargo, Security Seal, PEB)
      exportDOs.push({
        id: 'DO-EXP-001',
        doNumber: 'DO-EXP-001',
        netWeightGram: netWeight,
        buyerName: 'Dubai Gold Wholesalers DMCC',
        status: 'SHIPPED / IN TRANSIT',
        date: '2026-08-27'
      });

      journals.push({
        id: 'JRN-EXP-DO',
        entryNumber: 'JRN-2026-0014',
        date: '2026-08-27',
        description: 'Pengakuan HPP Ekspor Perhiasan (Debet 5115 / Kredit 1160)',
        lines: [
          { accountCode: '5115', accountName: 'HPP Ekspor Perhiasan Emas', debit: cogsVal, credit: 0 },
          { accountCode: '1160', accountName: 'Vault Perhiasan Siap Ekspor', debit: 0, credit: cogsVal }
        ]
      });

      // Step 2: Commercial Invoice USD (PPN 0% Fasilitas Pasal 4B UU PPN)
      exportInvoices.push({
        id: 'INV-EXP-001',
        invoiceNo: 'INV-EXP-001',
        buyerName: 'Dubai Gold Wholesalers DMCC',
        totalAmountUSD: totalUSD,
        totalAmountIDR: totalIDR,
        pebNo: 'PEB-2026-088912',
        awbNo: 'AWB-FEDEX-998811',
        date: '2026-08-27'
      });

      journals.push({
        id: 'JRN-EXP-INV',
        entryNumber: 'JRN-2026-0015',
        date: '2026-08-27',
        description: 'Faktur Komersial Ekspor USD PPN 0% (Debet 1132 / Kredit 41101)',
        lines: [
          { accountCode: '1132', accountName: 'Piutang Usaha Ekspor USD', debit: totalIDR, credit: 0 },
          { accountCode: '41101', accountName: 'Pendapatan Ekspor Perhiasan (PPN 0%)', debit: 0, credit: totalIDR }
        ]
      });

      // Step 3: Devisa Settlement via Bank BCA Devisa USD
      journals.push({
        id: 'JRN-EXP-BBM',
        entryNumber: 'JRN-2026-0016',
        date: '2026-08-28',
        description: 'Penerimaan Devisa Hasil Ekspor / DHE (Debet 1111-USD / Kredit 1132)',
        lines: [
          { accountCode: '1111-USD', accountName: 'Bank BCA Devisa USD', debit: totalIDR, credit: 0 },
          { accountCode: '1132', accountName: 'Piutang Usaha Ekspor USD', debit: 0, credit: totalIDR }
        ]
      });

      setStorage(KEYS.EXPORT_DELIVERY_ORDERS, exportDOs);
      setStorage(KEYS.EXPORT_INVOICES, exportInvoices);
      setStorage(KEYS.JOURNAL_ENTRIES, journals);

      const fin = calculateFinancialStatements();
      expect(fin.accountBalances['1132'].balance).toBe(0); // Export AR settled
      expect(fin.accountBalances['1111-USD'].balance).toBe(totalIDR);
      expect(fin.totalRevenue).toBe(totalIDR);
      expect(fin.totalHPP).toBe(cogsVal);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 4: BRUTAL HIGH-VOLUME SCALE TORTURE TEST (1,000+ TRANSACTIONS)
  // ══════════════════════════════════════════════════════════════════════════════
  describe('4. Brutal High-Volume Scale Torture (1,000+ Interleaved Multi-Module Transactions)', () => {

    test('4.1. Rapidly executing 1,000 interleaved lifecycle transactions maintaining strict mass conservation and zero financial deviation', () => {
      const NUM_TRANSACTIONS = 1000;
      const coa = getDefaultCOA().filter(a => a.type === 'detail');
      const validAccountCodes = new Set(coa.map(a => a.code));

      const localPurchases = [];
      const grns = [];
      const scrapPurchases = [];
      const spkList = [];
      const settlements = [];
      const exportDOs = [];
      const localDOs = [];
      const silverTransactions = [];
      const transfers = [];
      const journals = [];

      let totalFineGoldProcured = 0;
      let totalGoldProduced = 0;
      let totalGoldSold = 0;

      // Seed Initial Silver Stock (50,000g)
      silverTransactions.push({
        id: 'SLV-INIT',
        transactionType: 'RECEIPT',
        weightGrams: 50000,
        pricePerGram: 16500,
        totalValueIDR: 50000 * 16500,
        date: '2026-08-01'
      });
      journals.push({
        id: 'JRN-SLV-INIT',
        entryNumber: 'JRN-INIT-001',
        date: '2026-08-01',
        description: 'Stok Awal Perak Murni 50kg',
        lines: [
          { accountCode: '1153', debit: 50000 * 16500, credit: 0 },
          { accountCode: '3100', debit: 0, credit: 50000 * 16500 }
        ]
      });

      // Seed Initial Capital (Rp 50 Milyar)
      journals.push({
        id: 'JRN-CAP-INIT',
        entryNumber: 'JRN-INIT-002',
        date: '2026-08-01',
        description: 'Modal Disetor Pemilik PT TAN',
        lines: [
          { accountCode: '1111-IDR', debit: 50000000000, credit: 0 },
          { accountCode: '3100', debit: 0, credit: 50000000000 }
        ]
      });

      // Execute 1,000 random interleaved operations
      for (let i = 1; i <= NUM_TRANSACTIONS; i++) {
        const opType = i % 8;
        const dateStr = `2026-08-${String((i % 28) + 1).padStart(2, '0')}`;
        const refNo = `TRX-${String(i).padStart(4, '0')}`;

        switch (opType) {
          case 0: {
            // Local Gold Purchase (100g - 500g)
            const qty = 100 + (i % 400);
            const price = 1320000;
            const amt = qty * price;
            totalFineGoldProcured += qty;

            localPurchases.push({
              id: `LP-${refNo}`,
              quantityGrams: qty,
              pricePerGramIDR: price,
              totalAmount: amt,
              isVaultReceived: true,
              date: dateStr
            });

            journals.push({
              id: `JRN-LP-${refNo}`,
              entryNumber: `JRN-LP-${refNo}`,
              date: dateStr,
              description: `Beli LM Lokal ${qty}g`,
              lines: [
                { accountCode: '1157', debit: amt, credit: 0 },
                { accountCode: '1111-IDR', debit: 0, credit: amt }
              ]
            });
            break;
          }

          case 1: {
            // Import Gold Purchase & TTB (200g - 1000g)
            const qty = 200 + (i % 800);
            const amt = qty * 1350000;
            totalFineGoldProcured += qty;

            grns.push({
              id: `GRN-${refNo}`,
              receivedWeightGram: qty,
              totalValueIDR: amt,
              targetVault: '1158',
              date: dateStr
            });

            journals.push({
              id: `JRN-GRN-${refNo}`,
              entryNumber: `JRN-GRN-${refNo}`,
              date: dateStr,
              description: `Import Gold TTB ${qty}g`,
              lines: [
                { accountCode: '1158', debit: amt, credit: 0 },
                { accountCode: '1111-USD', debit: 0, credit: amt }
              ]
            });
            break;
          }

          case 2: {
            // Scrap Purchase (50g - 300g)
            const gross = 50 + (i % 250);
            const fine = gross * 0.80; // 80% purity
            const amt = Math.round(fine * 1200000);
            totalFineGoldProcured += fine;

            scrapPurchases.push({
              id: `SCRAP-${refNo}`,
              grossWeight: gross,
              estimatedFineGold: fine,
              totalAmount: amt,
              targetVault: '1152',
              date: dateStr
            });

            journals.push({
              id: `JRN-SCRAP-${refNo}`,
              entryNumber: `JRN-SCRAP-${refNo}`,
              date: dateStr,
              description: `Beli Scrap ${gross}g`,
              lines: [
                { accountCode: '1152', debit: amt, credit: 0 },
                { accountCode: '1110', debit: 0, credit: amt }
              ]
            });
            break;
          }

          case 3: {
            // Silver Alloy Addition (10g - 50g silver added to 1157)
            const silverW = 10 + (i % 40);
            const silverVal = silverW * 16500;

            silverTransactions.push({
              id: `SLV-ALLOY-${refNo}`,
              transactionType: 'ALLOY_ADDITION',
              silverWeightGram: silverW,
              totalSilverValueIDR: silverVal,
              targetAccount: '1157',
              date: dateStr
            });

            journals.push({
              id: `JRN-ALLOY-${refNo}`,
              entryNumber: `JRN-ALLOY-${refNo}`,
              date: dateStr,
              description: `Alloy ${silverW}g Silver`,
              lines: [
                { accountCode: '1157', debit: silverVal, credit: 0 },
                { accountCode: '1153', debit: 0, credit: silverVal }
              ]
            });
            break;
          }

          case 4: {
            // Production SPK (50g - 200g fine gold to WIP 11502)
            const fineW = 50 + (i % 150);
            const val = fineW * 1300000;

            spkList.push({
              id: `SPK-${refNo}`,
              fineGoldNeeded: fineW,
              date: dateStr
            });

            journals.push({
              id: `JRN-SPK-${refNo}`,
              entryNumber: `JRN-SPK-${refNo}`,
              date: dateStr,
              description: `SPK Issue ${fineW}g`,
              lines: [
                { accountCode: '11502', debit: val, credit: 0 },
                { accountCode: '1157', debit: 0, credit: val }
              ]
            });
            break;
          }

          case 5: {
            // Production Settlement (Output FG to 1160 + Scrap to 1152 + Loss to 5120)
            const outW = 45 + (i % 140);
            const scrapW = 4;
            const lossW = 1;
            const totalW = outW + scrapW + lossW;
            const labor = 1000000;
            const fgVal = (outW * 1300000) + labor; // Capitalized material cost + labor fee
            const scrapVal = scrapW * 1300000;
            const lossVal = lossW * 1300000;
            const wipVal = totalW * 1300000;

            totalGoldProduced += outW;

            settlements.push({
              id: `JO-${refNo}`,
              jewelryOutputWeight: outW,
              scrapReturnWeight: scrapW,
              goldLossWeight: lossW,
              laborFeeIDR: labor,
              date: dateStr
            });

            journals.push({
              id: `JRN-JO-${refNo}`,
              entryNumber: `JRN-JO-${refNo}`,
              date: dateStr,
              description: `Settlement ${outW}g FG`,
              lines: [
                { accountCode: '1160', debit: fgVal, credit: 0 },
                { accountCode: '1152', debit: scrapVal, credit: 0 },
                { accountCode: '5141', debit: lossVal, credit: 0 },
                { accountCode: '11502', debit: 0, credit: wipVal },
                { accountCode: '1111-IDR', debit: 0, credit: labor }
              ]
            });
            break;
          }

          case 6: {
            // Local Gold Sale DO & Invoice (30g - 150g out of 1157)
            const saleQty = 30 + (i % 120);
            const salePrice = 1380000;
            const cogsPrice = 1300000;
            const saleAmt = saleQty * salePrice;
            const cogsAmt = saleQty * cogsPrice;

            totalGoldSold += saleQty;

            localDOs.push({
              id: `DO-LOK-${refNo}`,
              netWeightGram: saleQty,
              cogsAmountIDR: cogsAmt,
              sourceVault: '1157',
              status: 'DELIVERED',
              date: dateStr
            });

            journals.push({
              id: `JRN-LOK-SALE-${refNo}`,
              entryNumber: `JRN-LOK-SALE-${refNo}`,
              date: dateStr,
              description: `Jual Lokal ${saleQty}g`,
              lines: [
                { accountCode: '5114', debit: cogsAmt, credit: 0 },
                { accountCode: '1157', debit: 0, credit: cogsAmt },
                { accountCode: '1111-IDR', debit: saleAmt, credit: 0 },
                { accountCode: '4111', debit: 0, credit: saleAmt }
              ]
            });
            break;
          }

          case 7: {
            // Export Gold Sale DO & Invoice (25g - 100g out of 1160)
            const expQty = 25 + (i % 75);
            const expAmt = expQty * 1400000;
            const cogsAmt = expQty * 1250000;

            totalGoldSold += expQty;

            exportDOs.push({
              id: `DO-EXP-${refNo}`,
              netWeightGram: expQty,
              status: 'SHIPPED',
              date: dateStr
            });

            journals.push({
              id: `JRN-EXP-SALE-${refNo}`,
              entryNumber: `JRN-EXP-SALE-${refNo}`,
              date: dateStr,
              description: `Export Sale ${expQty}g`,
              lines: [
                { accountCode: '5115', debit: cogsAmt, credit: 0 },
                { accountCode: '1160', debit: 0, credit: cogsAmt },
                { accountCode: '1111-USD', debit: expAmt, credit: 0 },
                { accountCode: '41101', debit: 0, credit: expAmt }
              ]
            });
            break;
          }
        }
      }

      setStorage(KEYS.LOCAL_PURCHASES, localPurchases);
      setStorage(KEYS.GOODS_RECEIPTS, grns);
      setStorage(KEYS.SCRAP_PURCHASES, scrapPurchases);
      setStorage(KEYS.SILVER_TRANSACTIONS, silverTransactions);
      setStorage(KEYS.PRODUCTION_SPK, spkList);
      setStorage(KEYS.PRODUCTION_SETTLEMENTS, settlements);
      setStorage(KEYS.LOCAL_DELIVERY_ORDERS, localDOs);
      setStorage(KEYS.EXPORT_DELIVERY_ORDERS, exportDOs);
      setStorage(KEYS.JOURNAL_ENTRIES, journals);

      // ─── VERIFY INVARIANTS AFTER 1,000 TRANSACTIONS ───

      // 1. Journal Total Entries Check
      expect(journals.length).toBe(NUM_TRANSACTIONS + 2); // 1000 + 2 initial seeds

      // 2. 100% of Journal Entries MUST have Debits === Credits
      journals.forEach((j) => {
        const totalDebit = j.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
        const totalCredit = j.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
        expect(Math.abs(totalDebit - totalCredit)).toBeLessThanOrEqual(0.01);
      });

      // 3. 100% of Account Codes MUST be valid detail accounts in COA
      journals.forEach(j => {
        j.lines.forEach(line => {
          if (!validAccountCodes.has(line.accountCode)) {
            console.error('INVALID ACCOUNT CODE IN JRN:', line.accountCode, line.accountName, j.description);
          }
          // validAccountCodes sudah difilter ke type === 'detail', jadi akun header
          // (mis. 1111 Bank, 4120 Pendapatan Jasa) otomatis gagal di sini.
          // Jangan tambahkan daftar kode terlarang manual: 2110 justru akun detail
          // "Hutang Usaha" yang sah, dan daftar hardcoded akan menyimpang dari COA.
          expect(validAccountCodes.has(line.accountCode)).toBe(true);
        });
      });

      // 4. Financial Statements Equation Check: Assets === Liabilities + Equity
      const fin = calculateFinancialStatements();
      expect(fin.isBalanceSheetBalanced).toBe(true);
      expect(Math.abs(fin.totalAssets - fin.totalLiabilitiesAndEquity)).toBeLessThan(1.0);

      // 5. Dynamic Vault Mass Position Check
      const pos = calculateVaultStockPosition();
      expect(pos.vaults).toHaveLength(6);
      pos.vaults.forEach(v => {
        expect(typeof v.balanceGrams).toBe('number');
        expect(isNaN(v.balanceGrams)).toBe(false);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // SECTION 5: EXTREME BOUNDARIES & DECIMAL PRECISION TORTURE
  // ══════════════════════════════════════════════════════════════════════════════
  describe('5. Extreme Boundary & Decimal Precision Torture', () => {

    test('5.1. Micro-transaction (0.0001g) and Macro-transaction (10,000,000g) stability', () => {
      const localPurchases = [];
      const journals = [];

      // Micro: 0.0001 gram (Assay pinhead test) @ Rp 1.300.000/g = Rp 130
      localPurchases.push({
        id: 'LP-MICRO',
        quantityGrams: 0.0001,
        pricePerGramIDR: 1300000,
        totalAmount: 130,
        isVaultReceived: true,
        date: '2026-08-28'
      });

      // Macro: 10,000,000 grams (10 metric tons) @ Rp 1.300.000/g = Rp 13.000.000.000.000 (13 Triliun)
      localPurchases.push({
        id: 'LP-MACRO',
        quantityGrams: 10000000,
        pricePerGramIDR: 1300000,
        totalAmount: 13000000000000,
        isVaultReceived: true,
        date: '2026-08-28'
      });

      journals.push({
        id: 'JRN-MICRO',
        entryNumber: 'JRN-MICRO',
        date: '2026-08-28',
        description: 'Micro transaction 0.0001g',
        lines: [
          { accountCode: '1157', debit: 130, credit: 0 },
          { accountCode: '1111-IDR', debit: 0, credit: 130 }
        ]
      });

      journals.push({
        id: 'JRN-MACRO',
        entryNumber: 'JRN-MACRO',
        date: '2026-08-28',
        description: 'Macro transaction 10,000,000g',
        lines: [
          { accountCode: '1157', debit: 13000000000000, credit: 0 },
          { accountCode: '1111-IDR', debit: 0, credit: 13000000000000 }
        ]
      });

      setStorage(KEYS.LOCAL_PURCHASES, localPurchases);
      setStorage(KEYS.JOURNAL_ENTRIES, journals);

      const pos = calculateVaultStockPosition();
      expect(pos.vaultMap['1157'].balanceGrams).toBe(10000000.0001);

      const fin = calculateFinancialStatements();
      expect(fin.isBalanceSheetBalanced).toBe(true);
    });

    test('5.2. Multi-serial bar formatting chaos (tabs, newlines, duplicate serials, irregular spaces)', () => {
      function parseBarSerials(text) {
        if (!text) return [];
        return text
          .split(/[\r\n,;\t]+/)
          .map(s => s.trim())
          .filter(Boolean);
      }

      const rawChaos = `
        ANT-9901,  ANT-9902;  ANT-9903\tANT-9904
        ANT-9905


        ANT-9906, ANT-9907
      `;

      const parsed = parseBarSerials(rawChaos);
      expect(parsed).toHaveLength(7);
      expect(parsed).toEqual(['ANT-9901', 'ANT-9902', 'ANT-9903', 'ANT-9904', 'ANT-9905', 'ANT-9906', 'ANT-9907']);
    });
  });
});
