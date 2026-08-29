/**
 * PT TRILIUN ANUGRAH NUSANTARA (PT TAN) ERP
 * Comprehensive Closed-Loop (#loop) End-to-End Integration & Multi-Scenario Test Suite
 * 
 * Domains Covered Without Exception:
 * 1. PEMBELIAN (Purchasing): PR -> PO Impor (Valas USD) & PO Emas Lokal (IDR) & PO Scrap (XRF % Fine Gold) & Multi-Voucher Cicilan
 * 2. GUDANG & VAULT (Warehouse & Inventory): TTB / GRN, Safe Slot & Seal, WIP Produksi SPK, Settlement Mass Conservation, Silver Alloy Vault (1153), Transfer Antar-Vault, Dynamic Stock Positions
 * 3. PENJUALAN (Sales & Export): Local Sales (Cash, Credit 30d, DP), Local DO & Invoicing (PMK 48/2023 Bebas PPN), Export SO/DO/Invoice (PPN 0%, DHE USD/SGD, PEB & AWB, Brinks)
 * 4. KASIR & KEUANGAN (Cashier & Treasury): BBK/BKK/BBM/BKM, Bank Reference No (Trace ID), Multi-Voucher Allocations (Principal, PPh 22, Logistics), Master Cheque
 * 5. AKUNTANSI & LAPORAN (Accounting & Financial Statements): 100% Debit=Credit Invariant, COA Detail Verification, GL Normalization, Balance Sheet & Income Statement
 * 6. 5 EXTREME FAILURE MODE STRESS TESTS (#loop): Corrupt Payload, Over-depletion Guard, Chronological Skew, Floating Point Gram Invariance, Multi-Currency Fallback
 */

// ─── DOMAIN SIMULATOR & STORAGE ENGINE ───

class TANErpSystemEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.storage = {
      chartOfAccounts: this.getDefaultCOA(),
      purchaseRequests: [],
      purchaseOrders: [],
      localPurchases: [],
      scrapPurchases: [],
      goodsReceipts: [],
      productionSPK: [],
      productionSettlements: [],
      silverTransactions: [],
      vaultTransfers: [],
      localSalesOrders: [],
      localDeliveryOrders: [],
      localInvoices: [],
      localSales: [],
      exportSalesOrders: [],
      exportInvoices: [],
      exportDeliveryOrders: [],
      vouchers: [],
      chequeBooks: this.getDefaultChequeBooks(),
      journals: []
    };
  }

  getDefaultCOA() {
    return [
      { code: '1110', name: 'Kas Kecil (Petty Cash)', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1111-IDR', name: 'Bank BCA IDR (Operasional & Beli Lokal)', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1111-USD', name: 'Bank BCA Devisa USD (LBMA & Ekspor)', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1111-SGD', name: 'Bank BCA Devisa SGD (Bullion Singapura)', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1130', name: 'Piutang Usaha Lokal IDR', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1132', name: 'Piutang Usaha Ekspor USD', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1135', name: 'Uang Muka Pembelian / Pajak Dibayar Dimuka', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1152', name: 'Persediaan Emas Scrap & Leburan', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1153', name: 'Persediaan Silver & Logam Mulia Lain', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1157', name: 'Persediaan Emas Murni 999.9 (LM Utama)', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1158', name: 'Persediaan Logam Mulia Impor', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1159', name: 'Persediaan Emas Dalam Perjalanan (Transit Kurir)', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '11502', name: 'Persediaan Emas WIP (Produksi Perhiasan)', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '1160', name: 'Persediaan Perhiasan Siap Ekspor', type: 'detail', category: 'ASET_LANCAR', normalSide: 'DEBIT' },
      { code: '2111', name: 'Hutang Usaha Pihak Ketiga', type: 'detail', category: 'LIABILITAS', normalSide: 'KREDIT' },
      { code: '2116-1', name: 'Uang Muka Penjualan Logam Mulia (DP)', type: 'detail', category: 'LIABILITAS', normalSide: 'KREDIT' },
      { code: '3100', name: 'Modal Saham', type: 'detail', category: 'EKUITAS', normalSide: 'KREDIT' },
      { code: '3200', name: 'Saldo Laba Ditahan', type: 'detail', category: 'EKUITAS', normalSide: 'KREDIT' },
      { code: '4111', name: 'Penjualan Logam Mulia Lokal (Bebas PPN)', type: 'detail', category: 'PENDAPATAN', normalSide: 'KREDIT' },
      { code: '4120', name: 'Pendapatan Ekspor Perhiasan PPN 0%', type: 'detail', category: 'PENDAPATAN', normalSide: 'KREDIT' },
      { code: '5110', name: 'Harga Pokok Penjualan (HPP Lokal)', type: 'detail', category: 'BEBAN_POKOK', normalSide: 'DEBIT' },
      { code: '5115', name: 'Harga Pokok Penjualan (HPP Ekspor)', type: 'detail', category: 'BEBAN_POKOK', normalSide: 'DEBIT' },
      { code: '5120', name: 'Beban Susut / Kehilangan Lebur (Yield Loss)', type: 'detail', category: 'BEBAN_POKOK', normalSide: 'DEBIT' },
      { code: '6100', name: 'Beban Operasional & Umum', type: 'detail', category: 'BEBAN_OPERASIONAL', normalSide: 'DEBIT' }
    ];
  }

  getDefaultChequeBooks() {
    return [
      {
        bookNumber: 'BOOK-BCA-2026A',
        bankCode: 'BCA-001',
        currency: 'IDR',
        seriesPrefix: 'BG-BCA-',
        startNumber: 998801,
        endNumber: 998825,
        totalLeaves: 25,
        maxLimitPerCheque: 500000000,
        leaves: [
          { checkNumber: 'BG-BCA-998801', status: 'AVAILABLE', amount: 0 },
          { checkNumber: 'BG-BCA-998802', status: 'AVAILABLE', amount: 0 },
          { checkNumber: 'BG-BCA-998803', status: 'AVAILABLE', amount: 0 }
        ]
      }
    ];
  }

  // Jurnal Posting Helper with Strict SAK EMKM Invariant Check
  postJournal(ref, description, lines, date = '2026-08-28') {
    const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`[SAK EMKM VIOLATION] Unbalanced Journal! Debit (${totalDebit}) !== Credit (${totalCredit}) in ${ref}`);
    }

    const coaMap = new Map(this.storage.chartOfAccounts.map(a => [a.code, a]));
    lines.forEach((l, idx) => {
      const acc = coaMap.get(l.accountCode);
      if (!acc) {
        throw new Error(`[SAK EMKM VIOLATION] Account Code '${l.accountCode}' not found in COA at line ${idx + 1}`);
      }
      if (acc.type !== 'detail') {
        throw new Error(`[SAK EMKM VIOLATION] Cannot post to header account '${l.accountCode}'`);
      }
    });

    const entry = {
      id: `JRN-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ref,
      date,
      description,
      lines,
      totalDebit,
      totalCredit
    };
    this.storage.journals.push(entry);
    return entry;
  }

  // 1. DOMAIN PEMBELIAN (PURCHASING)
  createPurchaseRequest(prData) {
    const newPr = {
      id: `PR-${Date.now()}`,
      prNumber: prData.prNumber || `PR-2026-${String(this.storage.purchaseRequests.length + 1).padStart(3, '0')}`,
      category: prData.category, // 'GOLD_IMPORT' | 'GOLD_LOCAL' | 'CHEMICAL_REFINERY' | 'GENERAL_AFFAIR'
      itemName: prData.itemName,
      estimatedWeightGram: Number(prData.estimatedWeightGram || 0),
      estimatedBudgetIDR: Number(prData.estimatedBudgetIDR || 0),
      recommendedSupplier: prData.recommendedSupplier,
      status: 'PENDING_APPROVAL',
      isPosting: false, // Strict Rule: PR is Non-Posting
      createdAt: new Date().toISOString()
    };
    this.storage.purchaseRequests.push(newPr);
    return newPr;
  }

  approvePurchaseRequest(prId) {
    const pr = this.storage.purchaseRequests.find(p => p.id === prId || p.prNumber === prId);
    if (!pr) throw new Error('PR not found');
    pr.status = 'APPROVED';
    return pr;
  }

  convertPRToPO(prId, poPayload) {
    const pr = this.storage.purchaseRequests.find(p => p.id === prId || p.prNumber === prId);
    if (!pr) throw new Error('PR not found');
    if (pr.status !== 'APPROVED') throw new Error('Cannot convert unapproved PR');

    let poResult;
    if (pr.category === 'GOLD_LOCAL') {
      poResult = this.createLocalPurchaseOrder({
        poNumber: poPayload.poNumber,
        supplierName: poPayload.supplierName || pr.recommendedSupplier,
        quantityGrams: poPayload.quantityGrams || pr.estimatedWeightGram,
        pricePerGramIDR: poPayload.pricePerGramIDR,
        courierName: poPayload.courierName || 'Bpk. Budi Santoso'
      });
    } else if (pr.category === 'GOLD_IMPORT') {
      poResult = this.createImportPurchaseOrder({
        poNumber: poPayload.poNumber,
        supplierName: poPayload.supplierName || pr.recommendedSupplier,
        quantityGrams: poPayload.quantityGrams || pr.estimatedWeightGram,
        priceUSDPerOz: poPayload.priceUSDPerOz,
        exchangeRate: poPayload.exchangeRate || 16250
      });
    }

    pr.status = 'CONVERTED TO PO';
    pr.convertedPoNumber = poResult.poNumber;
    return { pr, po: poResult };
  }

  // 1b. PO Emas Lokal - 2 Stage Workflow
  createLocalPurchaseOrder(poData) {
    const qty = Number(poData.quantityGrams || 0);
    const pricePerGram = Number(poData.pricePerGramIDR || 0);
    const totalAmount = qty * pricePerGram;

    const po = {
      id: `PO-LOK-${Date.now()}`,
      poNumber: poData.poNumber || `PO-LOK-2026-${String(this.storage.localPurchases.length + 1).padStart(3, '0')}`,
      supplierName: poData.supplierName,
      quantityGrams: qty,
      pricePerGramIDR: pricePerGram,
      totalAmount,
      courierName: poData.courierName,
      status: 'ISSUED_WAITING_PAYMENT',
      paidAmountIDR: 0,
      remainingBalanceIDR: totalAmount,
      paymentStatus: 'UNPAID',
      isVaultReceived: false,
      paymentHistory: []
    };
    this.storage.localPurchases.push(po);
    return po;
  }

  payLocalPurchaseStage1(poNumber, { paymentSource = '1111-IDR', bankReferenceNo = 'TRC-BCA-001', voucherNo = 'BBK-001' }) {
    const po = this.storage.localPurchases.find(p => p.poNumber === poNumber);
    if (!po) throw new Error('PO Lokal not found');

    po.paidAmountIDR = po.totalAmount;
    po.remainingBalanceIDR = 0;
    po.paymentStatus = 'PAID';
    po.status = 'PAID_IN_TRANSIT_COURIER';
    po.lastPaymentVoucher = voucherNo;

    // Stage 1 Auto-Journal: Debet Persediaan Emas Transit Kurir (1159) vs Kredit Bank (1111-IDR)
    this.postJournal(
      voucherNo,
      `[STAGE-1 BELI LOKAL] Pembayaran PO ${po.poNumber} Kurir ${po.courierName} Ref Bank ${bankReferenceNo}`,
      [
        { accountCode: '1159', debit: po.totalAmount, credit: 0 },
        { accountCode: paymentSource, debit: 0, credit: po.totalAmount }
      ]
    );

    po.paymentHistory.push({
      voucherNo,
      bankReferenceNo,
      amount: po.totalAmount,
      category: 'PO_PRINCIPAL',
      date: '2026-08-28'
    });
    return po;
  }

  confirmLocalVaultArrivalStage2(poNumber, { safeBoxSlot = 'SLOT-A1', securitySealNo = 'SEAL-99881', barSerialNumbers = 'ANT-001' }) {
    const po = this.storage.localPurchases.find(p => p.poNumber === poNumber);
    if (!po) throw new Error('PO Lokal not found');
    if (po.paymentStatus !== 'PAID') throw new Error('Cannot arrive in vault before stage 1 payment');

    po.isVaultReceived = true;
    po.status = 'RECEIVED & STOCKED IN VAULT (VERIFIED 4 TTD)';
    po.safeBoxSlot = safeBoxSlot;
    po.securitySealNo = securitySealNo;
    po.barSerialNumbers = barSerialNumbers;

    // Stage 2 Auto-Journal: Debet Persediaan Emas Utama (1157) vs Kredit Transit Kurir (1159)
    this.postJournal(
      po.poNumber,
      `[STAGE-2 TIBA DI BRANKAS] Serah Terima Emas Fisik 4-TTD PO ${po.poNumber} (${po.quantityGrams}g) ke Brankas Utama (1157)`,
      [
        { accountCode: '1157', debit: po.totalAmount, credit: 0 },
        { accountCode: '1159', debit: 0, credit: po.totalAmount }
      ]
    );
    return po;
  }

  // 1c. PO Impor Valas USD
  createImportPurchaseOrder(poData) {
    const qtyGrams = Number(poData.quantityGrams || 0);
    const pricePerOz = Number(poData.priceUSDPerOz || 0);
    const ozWeight = qtyGrams / 31.1034768;
    const totalUSD = ozWeight * pricePerOz;
    const rate = Number(poData.exchangeRate || 16250);
    const totalIDR = totalUSD * rate;

    const po = {
      id: `PO-IMP-${Date.now()}`,
      poNumber: poData.poNumber || `PO-IMP-2026-${String(this.storage.purchaseOrders.length + 1).padStart(3, '0')}`,
      supplierName: poData.supplierName || 'YLG Bullion Singapore',
      currency: 'USD',
      quantityGrams: qtyGrams,
      priceUSDPerOz: pricePerOz,
      totalAmountUSD: totalUSD,
      exchangeRate: rate,
      totalAmountIDR: totalIDR,
      status: 'ORDER_PLACED',
      paymentStatus: 'UNPAID',
      paidAmountIDR: 0,
      remainingBalanceIDR: totalIDR,
      paymentHistory: []
    };
    this.storage.purchaseOrders.push(po);
    return po;
  }

  payImportPurchaseDownPayment(poNumber, { amountUSD, exchangeRate = 16250, bankAccount = '1111-USD', voucherNo = 'BBK-USD-001', bankRef = 'TT-BCA-USD-01' }) {
    const po = this.storage.purchaseOrders.find(p => p.poNumber === poNumber);
    if (!po) throw new Error('PO Impor not found');

    const amountIDR = amountUSD * exchangeRate;
    po.paidAmountIDR += amountIDR;
    po.remainingBalanceIDR = Math.max(0, po.totalAmountIDR - po.paidAmountIDR);
    po.paymentStatus = po.remainingBalanceIDR === 0 ? 'PAID' : 'PARTIALLY_PAID';

    // FLOW_PEMBELIAN SAK EMKM: Debet Uang Muka Impor (1135) vs Kredit Bank Devisa (1111-USD)
    this.postJournal(
      voucherNo,
      `[BBK IMPOR] Pembayaran Uang Muka PO Impor ${po.poNumber} (${amountUSD} USD @ Rp ${exchangeRate}) Ref ${bankRef}`,
      [
        { accountCode: '1135', debit: amountIDR, credit: 0 },
        { accountCode: bankAccount, debit: 0, credit: amountIDR }
      ]
    );

    po.paymentHistory.push({
      voucherNo,
      bankReferenceNo: bankRef,
      amountUSD,
      amountIDR,
      category: 'PO_PRINCIPAL'
    });
    return po;
  }

  payCustomsPPh22Impor(poNumber, { pph22AmountIDR, voucherNo = 'BBK-TAX-01', bankRef = 'BILLING-DJBC-01' }) {
    const po = this.storage.purchaseOrders.find(p => p.poNumber === poNumber);
    if (!po) throw new Error('PO Impor not found');

    // Debet Pajak Dibayar Dimuka PPh 22 (1135) vs Kredit Bank IDR (1111-IDR)
    this.postJournal(
      voucherNo,
      `[PAJAK IMPOR] Pembayaran PPh 22 Impor (0.25%) PO ${po.poNumber} via Billing DJBC Ref ${bankRef}`,
      [
        { accountCode: '1135', debit: pph22AmountIDR, credit: 0 },
        { accountCode: '1111-IDR', debit: 0, credit: pph22AmountIDR }
      ]
    );

    po.paymentHistory.push({
      voucherNo,
      bankReferenceNo: bankRef,
      amount: pph22AmountIDR,
      category: 'CUSTOMS_DUTY_PPH22'
    });
    return po;
  }

  // 1d. Pembelian Emas Scrap & Leburan (XRF % Fine Gold)
  createScrapPurchase(scrapData) {
    const grossWeight = Number(scrapData.grossWeight || 0);
    const xrfPurity = Number(scrapData.xrfPurity || 0);
    const fineGoldGrams = (grossWeight * xrfPurity) / 100;
    const pricePerFineGram = Number(scrapData.pricePerFineGram || 0);
    const totalAmount = fineGoldGrams * pricePerFineGram;
    const paymentSource = scrapData.paymentSource || '1110'; // Kas Kecil / Bank

    const scrap = {
      id: `SCRAP-${Date.now()}`,
      receiptNo: scrapData.receiptNo || `NOTA-SCRAP-2026-${String(this.storage.scrapPurchases.length + 1).padStart(3, '0')}`,
      supplierName: scrapData.supplierName,
      grossWeight,
      xrfPurity,
      estimatedFineGold: fineGoldGrams,
      pricePerFineGram,
      totalAmount,
      targetVault: '1152', // Vault Scrap & Leburan
      status: 'RECEIVED & STORED IN SCRAP VAULT'
    };
    this.storage.scrapPurchases.push(scrap);

    // Auto-Journal: Debet Persediaan Scrap (1152) vs Kredit Kas/Bank (1110 / 1111-IDR)
    this.postJournal(
      scrap.receiptNo,
      `[BELI SCRAP] ${scrap.receiptNo} ${scrap.supplierName} (${grossWeight}g @ ${xrfPurity}% XRF = ${fineGoldGrams}g Fine Gold)`,
      [
        { accountCode: '1152', debit: totalAmount, credit: 0 },
        { accountCode: paymentSource, debit: 0, credit: totalAmount }
      ]
    );
    return scrap;
  }

  // 2. DOMAIN GUDANG & VAULT (WAREHOUSE & VAULT MANAGEMENT)
  createGoodsReceipt(grnData) {
    const docWeight = Number(grnData.documentWeightGram || 0);
    const scaleWeight = Number(grnData.receivedWeightGram || 0);
    const discrepancy = Number((scaleWeight - docWeight).toFixed(4));
    const targetVault = grnData.targetVault || '1158'; // Default Impor 1158 atau 1157
    const unitPrice = Number(grnData.unitPriceIDR || 1350000);
    const totalValue = scaleWeight * unitPrice;

    const grn = {
      id: `GRN-${Date.now()}`,
      grnNumber: grnData.grnNumber || `GRN-2026-${String(this.storage.goodsReceipts.length + 1).padStart(3, '0')}`,
      poNumber: grnData.poNumber,
      documentWeightGram: docWeight,
      receivedWeightGram: scaleWeight,
      weightDiscrepancyGram: discrepancy,
      targetVault,
      safeBoxSlot: grnData.safeBoxSlot || 'SLOT-IMP-01',
      securitySealNo: grnData.securitySealNo || 'SEAL-VAL-001',
      barSerialNumbers: grnData.barSerialNumbers,
      totalValueIDR: totalValue,
      status: 'RECEIVED & VERIFIED'
    };
    this.storage.goodsReceipts.push(grn);

    // SAK EMKM: Tutup Uang Muka Impor (1135) masuk ke Persediaan Impor (1158)
    if (targetVault === '1158') {
      this.postJournal(
        grn.grnNumber,
        `[TTB FISIK IMPOR] Penerimaan Fisik Emas Impor ${grn.grnNumber} PO ${grn.poNumber} (${scaleWeight}g) ke Brankas Impor (1158)`,
        [
          { accountCode: '1158', debit: totalValue, credit: 0 },
          { accountCode: '1135', debit: 0, credit: totalValue }
        ]
      );
    }
    return grn;
  }

  // 2b. SPK Produksi Perhiasan (Pengeluaran Bahan Baku ke WIP)
  createProductionSPK(spkData) {
    const fineGoldNeeded = Number(spkData.fineGoldNeeded || 0);
    const targetKarat = spkData.targetKarat || '750';
    const estimatedValue = fineGoldNeeded * 1300000;

    const spk = {
      id: `SPK-${Date.now()}`,
      spkNo: spkData.spkNo || `SPK-PROD-2026-${String(this.storage.productionSPK.length + 1).padStart(3, '0')}`,
      jewelryType: spkData.jewelryType || 'Cincin Dubai 18K',
      targetKarat,
      fineGoldNeeded,
      status: 'IN_WIP'
    };
    this.storage.productionSPK.push(spk);

    // Auto-Journal: Debet Persediaan WIP (11502) vs Kredit Persediaan Emas Murni Utama (1157)
    this.postJournal(
      spk.spkNo,
      `[SPK PRODUKSI WIP] Pengeluaran Bahan Baku Emas Murni ${spk.spkNo} (${fineGoldNeeded}g) dari Brankas 1157 ke WIP 11502`,
      [
        { accountCode: '11502', debit: estimatedValue, credit: 0 },
        { accountCode: '1157', debit: 0, credit: estimatedValue }
      ]
    );
    return spk;
  }

  // 2c. Settlement Produksi (Konservasi Massa Emas)
  settleProductionSPK(spkNo, settlementData) {
    const spk = this.storage.productionSPK.find(s => s.spkNo === spkNo);
    if (!spk) throw new Error('SPK not found');

    const outputJewelryWeight = Number(settlementData.jewelryOutputWeight || 0);
    const scrapReturnWeight = Number(settlementData.scrapReturnWeight || 0);
    const goldLossWeight = Number(settlementData.goldLossWeight || 0);
    const totalMassAccounted = Number((outputJewelryWeight + scrapReturnWeight + goldLossWeight).toFixed(4));
    const originalInputWeight = Number(spk.fineGoldNeeded.toFixed(4));

    // Conservation of Mass Check
    if (Math.abs(totalMassAccounted - originalInputWeight) > 0.05) {
      throw new Error(`[CONSERVATION OF MASS BREACH] Total Output (${totalMassAccounted}g) does not equal Input (${originalInputWeight}g)`);
    }

    const laborFeeIDR = Number(settlementData.laborFeeIDR || 0);
    const goldCostRate = 1300000;
    const valueJewelry = (outputJewelryWeight * goldCostRate) + laborFeeIDR;
    const valueScrap = scrapReturnWeight * 1200000;
    const scrapVarianceLoss = scrapReturnWeight * (goldCostRate - 1200000); // Selisih nilai standard scrap vs cost
    const valueLoss = (goldLossWeight * goldCostRate) + scrapVarianceLoss;
    const totalWIPDeductedValue = (originalInputWeight * goldCostRate);

    const settlement = {
      id: `JO-${Date.now()}`,
      joNumber: settlementData.joNumber || `JO-2026-${String(this.storage.productionSettlements.length + 1).padStart(3, '0')}`,
      spkNo,
      jewelryOutputWeight: outputJewelryWeight,
      scrapReturnWeight,
      goldLossWeight,
      laborFeeIDR,
      status: 'COMPLETED'
    };
    this.storage.productionSettlements.push(settlement);
    spk.status = 'COMPLETED';

    // Auto-Journal:
    // Debet 1160 (Perhiasan Siap Ekspor)
    // Debet 1152 (Scrap Retur)
    // Debet 5120 (Beban Susut Lebur & Variance)
    // Kredit 11502 (Persediaan WIP)
    // Kredit 1111-IDR / 2111 (Ongkos Kerja Tukang)
    const journalLines = [
      { accountCode: '1160', debit: valueJewelry, credit: 0 },
      { accountCode: '11502', debit: 0, credit: totalWIPDeductedValue }
    ];
    if (scrapReturnWeight > 0) {
      journalLines.push({ accountCode: '1152', debit: valueScrap, credit: 0 });
    }
    if (valueLoss > 0) {
      journalLines.push({ accountCode: '5120', debit: valueLoss, credit: 0 });
    }
    if (laborFeeIDR > 0) {
      journalLines.push({ accountCode: '1111-IDR', debit: 0, credit: laborFeeIDR });
    }

    this.postJournal(
      settlement.joNumber,
      `[SETTLEMENT PRODUKSI] Pelunasan SPK ${spkNo} (Hasil Jadi 1160: ${outputJewelryWeight}g, Scrap 1152: ${scrapReturnWeight}g, Susut 5120: ${goldLossWeight}g)`,
      journalLines
    );
    return settlement;
  }

  // 2d. Perak Murni (1153) & Penambahan Perak ke Emas (Alloy)
  recordSilverReceipt(receiptData) {
    const weight = Number(receiptData.weightGrams || 0);
    const pricePerGram = Number(receiptData.pricePerGram || 16500);
    const totalVal = weight * pricePerGram;
    const paymentSource = receiptData.sourceAccount || '1111-IDR';

    const tx = {
      id: `SLV-REC-${Date.now()}`,
      transactionType: 'RECEIPT',
      weightGrams: weight,
      pricePerGram,
      totalValueIDR: totalVal,
      targetVaultAccount: '1153'
    };
    this.storage.silverTransactions.push(tx);

    this.postJournal(
      tx.id,
      `[BELI PERAK] Penerimaan ${weight}g Perak Murni ke Brankas Perak (1153)`,
      [
        { accountCode: '1153', debit: totalVal, credit: 0 },
        { accountCode: paymentSource, debit: 0, credit: totalVal }
      ]
    );
    return tx;
  }

  addSilverToGoldAlloy(additionData) {
    // Check available silver in 1153
    const totalIn = this.storage.silverTransactions
      .filter(t => t.transactionType === 'RECEIPT')
      .reduce((sum, t) => sum + t.weightGrams, 0);
    const totalOut = this.storage.silverTransactions
      .filter(t => t.transactionType === 'ALLOY_ADDITION')
      .reduce((sum, t) => sum + t.silverWeightGram, 0);
    const availableSilver = totalIn - totalOut;

    const silverWeight = Number(additionData.silverWeightGram || 0);
    if (silverWeight <= 0) throw new Error('Silver weight must be > 0');
    if (silverWeight > availableSilver) {
      throw new Error(`Insufficient Silver Stock! Available: ${availableSilver}g, Requested: ${silverWeight}g`);
    }

    const goldWeight = Number(additionData.goldInitialWeightGram || 0);
    const goldPurity = Number(additionData.goldPurityInitial || 99.99);
    const silverPrice = Number(additionData.silverPricePerGram || 16500);
    const silverVal = silverWeight * silverPrice;
    const targetAccount = additionData.targetAccount || '1157';

    const fineGold = goldWeight * (goldPurity / 100);
    const totalFinalWeight = goldWeight + silverWeight;
    const finalPurity = Number(((fineGold / totalFinalWeight) * 100).toFixed(2));

    const tx = {
      id: `ALLOY-${Date.now()}`,
      transactionType: 'ALLOY_ADDITION',
      goldInitialWeightGram: goldWeight,
      silverWeightGram: silverWeight,
      totalFinalWeightGram: totalFinalWeight,
      finalEstimatedPurity: finalPurity,
      totalSilverValueIDR: silverVal,
      targetAccount
    };
    this.storage.silverTransactions.push(tx);

    this.postJournal(
      tx.id,
      `[ALLOY PERAK-EMAS] Penambahan ${silverWeight}g Perak ke ${goldWeight}g Emas [${targetAccount}] -> Kadar Akhir ${finalPurity}%`,
      [
        { accountCode: targetAccount, debit: silverVal, credit: 0 },
        { accountCode: '1153', debit: 0, credit: silverVal }
      ]
    );
    return tx;
  }

  // 2e. Transfer Antar-Vault
  transferBetweenVaults(transferData) {
    const fromAccount = transferData.fromAccount;
    const toAccount = transferData.toAccount;
    const weightGrams = Number(transferData.quantityGrams || 0);
    const valueIDR = Number(transferData.estimatedValueIDR || (weightGrams * 1300000));

    const stock = this.calculateVaultStockPositions();
    const sourceVault = stock.vaults.find(v => v.account === fromAccount);
    if (!sourceVault || sourceVault.balanceGrams < weightGrams - 0.0001) {
      throw new Error(`Insufficient source vault stock in ${fromAccount}! Available: ${sourceVault?.balanceGrams || 0}g, Requested: ${weightGrams}g`);
    }

    const trf = {
      id: `TRF-${Date.now()}`,
      fromAccount,
      toAccount,
      quantityGrams: weightGrams,
      estimatedValueIDR: valueIDR
    };
    this.storage.vaultTransfers.push(trf);

    this.postJournal(
      trf.id,
      `[MUTASI ANTAR-VAULT] Transfer ${weightGrams}g Emas dari ${fromAccount} ke ${toAccount}`,
      [
        { accountCode: toAccount, debit: valueIDR, credit: 0 },
        { accountCode: fromAccount, debit: 0, credit: valueIDR }
      ]
    );
    return trf;
  }

  // 2f. Stock Aggregation Engine with Floating Point Safe Normalization
  calculateVaultStockPositions() {
    const vaultAccounts = ['1157', '1158', '11502', '1160', '1152', '1153', '1159'];
    const vaultBalances = {};
    vaultAccounts.forEach(acc => {
      vaultBalances[acc] = { account: acc, inGrams: 0, outGrams: 0, balanceGrams: 0 };
    });

    // 1. Goods Receipts
    this.storage.goodsReceipts.forEach(g => {
      if (vaultBalances[g.targetVault]) {
        vaultBalances[g.targetVault].inGrams += g.receivedWeightGram;
        vaultBalances[g.targetVault].balanceGrams += g.receivedWeightGram;
      }
    });

    // 2. Local Purchases (Arrived in Vault 1157)
    this.storage.localPurchases.forEach(lp => {
      if (lp.isVaultReceived && vaultBalances['1157']) {
        vaultBalances['1157'].inGrams += lp.quantityGrams;
        vaultBalances['1157'].balanceGrams += lp.quantityGrams;
      }
    });

    // 3. Scrap Purchases (1152)
    this.storage.scrapPurchases.forEach(sc => {
      if (vaultBalances['1152']) {
        vaultBalances['1152'].inGrams += sc.grossWeight;
        vaultBalances['1152'].balanceGrams += sc.grossWeight;
      }
    });

    // 4. SPK Produksi (Out from 1157, In to 11502)
    this.storage.productionSPK.forEach(spk => {
      if (vaultBalances['1157']) {
        vaultBalances['1157'].outGrams += spk.fineGoldNeeded;
        vaultBalances['1157'].balanceGrams -= spk.fineGoldNeeded;
      }
      if (vaultBalances['11502']) {
        vaultBalances['11502'].inGrams += spk.fineGoldNeeded;
        vaultBalances['11502'].balanceGrams += spk.fineGoldNeeded;
      }
    });

    // 5. Settlement Produksi (Out from 11502, In to 1160 & 1152)
    this.storage.productionSettlements.forEach(st => {
      const totalOut = st.jewelryOutputWeight + st.scrapReturnWeight + st.goldLossWeight;
      if (vaultBalances['11502']) {
        vaultBalances['11502'].outGrams += totalOut;
        vaultBalances['11502'].balanceGrams -= totalOut;
      }
      if (vaultBalances['1160']) {
        vaultBalances['1160'].inGrams += st.jewelryOutputWeight;
        vaultBalances['1160'].balanceGrams += st.jewelryOutputWeight;
      }
      if (st.scrapReturnWeight > 0 && vaultBalances['1152']) {
        vaultBalances['1152'].inGrams += st.scrapReturnWeight;
        vaultBalances['1152'].balanceGrams += st.scrapReturnWeight;
      }
    });

    // 6. Silver Receipts & Additions
    this.storage.silverTransactions.forEach(st => {
      if (st.transactionType === 'RECEIPT' && vaultBalances['1153']) {
        vaultBalances['1153'].inGrams += st.weightGrams;
        vaultBalances['1153'].balanceGrams += st.weightGrams;
      } else if (st.transactionType === 'ALLOY_ADDITION') {
        if (vaultBalances['1153']) {
          vaultBalances['1153'].outGrams += st.silverWeightGram;
          vaultBalances['1153'].balanceGrams -= st.silverWeightGram;
        }
        if (vaultBalances[st.targetAccount]) {
          vaultBalances[st.targetAccount].inGrams += st.silverWeightGram;
          vaultBalances[st.targetAccount].balanceGrams += st.silverWeightGram;
        }
      }
    });

    // 7. Transfers
    this.storage.vaultTransfers.forEach(trf => {
      if (vaultBalances[trf.fromAccount]) {
        vaultBalances[trf.fromAccount].outGrams += trf.quantityGrams;
        vaultBalances[trf.fromAccount].balanceGrams -= trf.quantityGrams;
      }
      if (vaultBalances[trf.toAccount]) {
        vaultBalances[trf.toAccount].inGrams += trf.quantityGrams;
        vaultBalances[trf.toAccount].balanceGrams += trf.quantityGrams;
      }
    });

    // 8. Local Delivery Orders (Deduct from Source Vault 1157/1160/1152)
    this.storage.localDeliveryOrders.forEach(doItem => {
      if (doItem.status === 'DELIVERED') {
        const acc = doItem.sourceVault || '1157';
        if (vaultBalances[acc]) {
          vaultBalances[acc].outGrams += doItem.netWeightGram;
          vaultBalances[acc].balanceGrams -= doItem.netWeightGram;
        }
      }
    });

    // 9. Export Delivery Orders (Deduct from 1160)
    this.storage.exportDeliveryOrders.forEach(doItem => {
      if (doItem.status === 'SHIPPED') {
        if (vaultBalances['1160']) {
          vaultBalances['1160'].outGrams += doItem.netWeightGram;
          vaultBalances['1160'].balanceGrams -= doItem.netWeightGram;
        }
      }
    });

    // Precision Rounding to eliminate binary floating point artifacts (e.g. 0.19999999999999998 -> 0.2)
    Object.values(vaultBalances).forEach(vb => {
      vb.inGrams = Number(vb.inGrams.toFixed(4));
      vb.outGrams = Number(vb.outGrams.toFixed(4));
      vb.balanceGrams = Number(vb.balanceGrams.toFixed(4));
    });

    return {
      vaults: Object.values(vaultBalances)
    };
  }

  // 3. DOMAIN PENJUALAN (SALES & EXPORT)
  createLocalSalesOrder(soData) {
    const qty = Number(soData.quantityGrams || 0);
    const unitPrice = Number(soData.unitPriceIDR || 0);
    const total = qty * unitPrice;

    const so = {
      id: `SO-LOK-${Date.now()}`,
      soNumber: soData.soNumber || `SO-LOK-2026-${String(this.storage.localSalesOrders.length + 1).padStart(3, '0')}`,
      customerName: soData.customerName,
      quantityGrams: qty,
      unitPriceIDR: unitPrice,
      totalAmountIDR: total,
      paymentMode: soData.paymentMode || 'cash',
      status: 'CONFIRMED'
    };
    this.storage.localSalesOrders.push(so);
    return so;
  }

  createLocalDeliveryOrder(doData) {
    const netWeight = Number(doData.netWeightGram || 0);
    const sourceVault = doData.sourceVault || '1157';
    const cogsAmount = Number(doData.cogsAmountIDR || (netWeight * 1300000));

    // Verify vault stock availability before dispatching with epsilon guard
    const positions = this.calculateVaultStockPositions();
    const vault = positions.vaults.find(v => v.account === sourceVault);
    if (!vault || vault.balanceGrams < netWeight - 0.0001) {
      throw new Error(`Insufficient Stock in Vault ${sourceVault} for Local DO! Available: ${vault?.balanceGrams || 0}g, Requested: ${netWeight}g`);
    }

    const doItem = {
      id: `SJ-LOK-${Date.now()}`,
      doNumber: doData.doNumber || `SJ-LOK-2026-${String(this.storage.localDeliveryOrders.length + 1).padStart(3, '0')}`,
      soNumber: doData.soNumber,
      customerName: doData.customerName,
      sourceVault,
      netWeightGram: netWeight,
      securitySealNo: doData.securitySealNo || 'SEAL-LOK-01',
      courierName: doData.courierName || 'Bpk. Budi Santoso',
      cogsAmountIDR: cogsAmount,
      status: 'DELIVERED'
    };
    this.storage.localDeliveryOrders.push(doItem);

    // Auto-Journal: Debet HPP Lokal (5110) vs Kredit Persediaan Vault (1157 / 1160 / 1152)
    this.postJournal(
      doItem.doNumber,
      `[HPP SURAT JALAN LOKAL] Pengeluaran Fisik ${doItem.doNumber} (${netWeight}g) dari Brankas ${sourceVault}`,
      [
        { accountCode: '5110', debit: cogsAmount, credit: 0 },
        { accountCode: sourceVault, debit: 0, credit: cogsAmount }
      ]
    );
    return doItem;
  }

  createLocalInvoice(invData) {
    const totalAmount = Number(invData.totalAmountIDR || 0);
    const downPayment = Number(invData.downPaymentIDR || 0);
    const netReceivable = Math.max(0, totalAmount - downPayment);
    const paymentMode = invData.paymentMode || 'cash';

    const debitAccount = paymentMode === 'cash'
      ? (invData.paymentSourceAccount || '1111-IDR')
      : paymentMode === 'credit'
      ? '1130' // Piutang Usaha Lokal
      : '1111-IDR'; // DP Cash

    const inv = {
      id: `INV-LOK-${Date.now()}`,
      invoiceNo: invData.invoiceNo || `INV-LOK-2026-${String(this.storage.localInvoices.length + 1).padStart(3, '0')}`,
      soNumber: invData.soNumber,
      customerName: invData.customerName,
      paymentMode,
      totalAmountIDR: totalAmount,
      downPaymentIDR: downPayment,
      netReceivableIDR: netReceivable,
      taxFacility: 'BEBAS PPN PMK 48/2023',
      paymentStatus: paymentMode === 'cash' ? 'PAID' : paymentMode === 'credit' ? 'UNPAID' : 'PARTIAL'
    };
    this.storage.localInvoices.push(inv);

    const journalLines = [
      { accountCode: debitAccount, debit: netReceivable, credit: 0 }
    ];
    if (downPayment > 0) {
      journalLines.push({ accountCode: '2116-1', debit: downPayment, credit: 0 });
    }
    journalLines.push({ accountCode: '4111', debit: 0, credit: totalAmount });

    this.postJournal(
      inv.invoiceNo,
      `[FAKTUR PENJUALAN LOKAL PMK 48/2023] ${inv.invoiceNo} - ${inv.customerName} (${paymentMode.toUpperCase()})`,
      journalLines
    );
    return inv;
  }

  // 3b. Penjualan Ekspor Perhiasan USD
  createExportSalesOrder(soData) {
    const netWeight = Number(soData.netWeightGram || 0);
    const priceUSDPerGram = Number(soData.priceUSDPerGram || 0);
    const totalUSD = netWeight * priceUSDPerGram;

    const so = {
      id: `SO-EXP-${Date.now()}`,
      soNumber: soData.soNumber || `SO-EXP-2026-${String(this.storage.exportSalesOrders.length + 1).padStart(3, '0')}`,
      buyerName: soData.buyerName || 'Dubai Gold DMCC',
      netWeightGram: netWeight,
      priceUSDPerGram,
      totalAmountUSD: totalUSD,
      status: 'CONFIRMED'
    };
    this.storage.exportSalesOrders.push(so);
    return so;
  }

  createExportInvoice(invData) {
    const totalUSD = Number(invData.totalAmountUSD || 0);
    const exchangeRate = Number(invData.exchangeRate || 16250);
    const totalIDR = totalUSD * exchangeRate;

    const inv = {
      id: `INV-EXP-${Date.now()}`,
      invoiceNo: invData.invoiceNo || `INV-EXP-2026-${String(this.storage.exportInvoices.length + 1).padStart(3, '0')}`,
      soNumber: invData.soNumber,
      buyerName: invData.buyerName,
      totalAmountUSD: totalUSD,
      exchangeRate,
      totalAmountIDR: totalIDR,
      taxFacility: 'PPN 0% PASAL 4B UU PPN',
      paymentStatus: 'UNPAID'
    };
    this.storage.exportInvoices.push(inv);

    // Auto-Journal: Debet Piutang Usaha Ekspor USD (1132) vs Kredit Pendapatan Ekspor PPN 0% (4120)
    this.postJournal(
      inv.invoiceNo,
      `[FAKTUR EKSPOR PPN 0%] ${inv.invoiceNo} ${inv.buyerName} ($ ${totalUSD} USD @ Rp ${exchangeRate})`,
      [
        { accountCode: '1132', debit: totalIDR, credit: 0 },
        { accountCode: '4120', debit: 0, credit: totalIDR }
      ]
    );
    return inv;
  }

  createExportDeliveryOrder(doData) {
    const netWeight = Number(doData.netWeightGram || 0);
    const cogsIDR = Number(doData.cogsAmountIDR || (netWeight * 1310000)); // Standard production cost rate

    const positions = this.calculateVaultStockPositions();
    const vault1160 = positions.vaults.find(v => v.account === '1160');
    if (!vault1160 || vault1160.balanceGrams < netWeight - 0.0001) {
      throw new Error(`Insufficient Stock in Export Vault 1160! Available: ${vault1160?.balanceGrams || 0}g, Requested: ${netWeight}g`);
    }

    const doItem = {
      id: `DO-EXP-${Date.now()}`,
      doNumber: doData.doNumber || `DO-EXP-2026-${String(this.storage.exportDeliveryOrders.length + 1).padStart(3, '0')}`,
      invoiceNo: doData.invoiceNo,
      buyerName: doData.buyerName,
      netWeightGram: netWeight,
      cogsAmountIDR: cogsIDR,
      courierName: doData.courierName || 'Brinks Global Secured Transport',
      pebNumber: doData.pebNumber || 'PEB-2026-001',
      awbNumber: doData.awbNumber || 'AWB-FEDEX-001',
      status: 'SHIPPED'
    };
    this.storage.exportDeliveryOrders.push(doItem);

    // Auto-Journal: Debet HPP Ekspor (5115) vs Kredit Persediaan Perhiasan Ekspor (1160)
    this.postJournal(
      doItem.doNumber,
      `[SURAT JALAN EKSPOR DO] Pengeluaran Fisik Ekspor ${doItem.doNumber} (${netWeight}g) via ${doItem.courierName}`,
      [
        { accountCode: '5115', debit: cogsIDR, credit: 0 },
        { accountCode: '1160', debit: 0, credit: cogsIDR }
      ]
    );
    return doItem;
  }

  // 4. DOMAIN KASIR & KEUANGAN (CASHIER & TREASURY)
  receiveExportCustomerPayment(invoiceNo, { amountUSD, exchangeRate = 16250, bankAccount = '1111-USD', voucherNo = 'BBM-EXP-01', bankRef = 'SWIFT-IN-001' }) {
    const inv = this.storage.exportInvoices.find(i => i.invoiceNo === invoiceNo);
    if (!inv) throw new Error('Export invoice not found');

    const amountIDR = amountUSD * exchangeRate;
    inv.paymentStatus = 'PAID';

    // Auto-Journal: Debet Bank Devisa USD (1111-USD) vs Kredit Piutang Ekspor USD (1132)
    this.postJournal(
      voucherNo,
      `[BBM PELUNASAN EKSPOR] Penerimaan Devisa DHE ${inv.invoiceNo} ($ ${amountUSD} USD @ Rp ${exchangeRate}) Ref ${bankRef}`,
      [
        { accountCode: bankAccount, debit: amountIDR, credit: 0 },
        { accountCode: '1132', debit: 0, credit: amountIDR }
      ]
    );
    return inv;
  }

  receiveLocalCustomerPayment(invoiceNo, { amountIDR, bankAccount = '1111-IDR', voucherNo = 'BBM-LOK-01', bankRef = 'MUTASI-BCA-001' }) {
    const inv = this.storage.localInvoices.find(i => i.invoiceNo === invoiceNo);
    if (!inv) throw new Error('Local invoice not found');

    inv.paymentStatus = 'PAID';

    // Auto-Journal: Debet Bank BCA IDR (1111-IDR) vs Kredit Piutang Usaha Lokal (1130)
    this.postJournal(
      voucherNo,
      `[BBM PELUNASAN LOKAL] Penerimaan Pelunasan Faktur ${inv.invoiceNo} Ref ${bankRef}`,
      [
        { accountCode: bankAccount, debit: amountIDR, credit: 0 },
        { accountCode: '1130', debit: 0, credit: amountIDR }
      ]
    );
    return inv;
  }

  issueMasterCheque(bookNumber, checkNumber, { payee, amountIDR, voucherNo }) {
    const book = this.storage.chequeBooks.find(b => b.bookNumber === bookNumber);
    if (!book) throw new Error('Cheque book not found');

    const leaf = book.leaves.find(l => l.checkNumber === checkNumber);
    if (!leaf) throw new Error('Cheque leaf not found');
    if (leaf.status !== 'AVAILABLE') throw new Error(`Cheque ${checkNumber} is not available (Status: ${leaf.status})`);
    if (amountIDR > book.maxLimitPerCheque) throw new Error(`Amount exceeds maximum leaf limit of Rp ${book.maxLimitPerCheque.toLocaleString()}`);

    leaf.status = 'USED';
    leaf.payee = payee;
    leaf.amount = amountIDR;
    leaf.voucherNo = voucherNo;
    leaf.isCleared = false;
    return leaf;
  }

  clearMasterCheque(bookNumber, checkNumber) {
    const book = this.storage.chequeBooks.find(b => b.bookNumber === bookNumber);
    const leaf = book?.leaves.find(l => l.checkNumber === checkNumber);
    if (!leaf || leaf.status !== 'USED') throw new Error('Invalid cheque to clear');
    leaf.isCleared = true;
    leaf.status = 'CLEARED';
    return leaf;
  }

  // 5. DOMAIN AKUNTANSI & LAPORAN (FINANCIAL STATEMENTS)
  calculateGeneralLedger() {
    const glBalances = {};
    this.storage.chartOfAccounts.forEach(acc => {
      glBalances[acc.code] = {
        code: acc.code,
        name: acc.name,
        category: acc.category,
        normalSide: acc.normalSide,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0
      };
    });

    this.storage.journals.forEach(j => {
      j.lines.forEach(l => {
        if (glBalances[l.accountCode]) {
          glBalances[l.accountCode].totalDebit += (Number(l.debit) || 0);
          glBalances[l.accountCode].totalCredit += (Number(l.credit) || 0);
        }
      });
    });

    Object.values(glBalances).forEach(gl => {
      if (gl.normalSide === 'DEBIT') {
        gl.balance = gl.totalDebit - gl.totalCredit;
      } else {
        gl.balance = gl.totalCredit - gl.totalDebit;
      }
    });

    return glBalances;
  }

  calculateIncomeStatement() {
    const gl = this.calculateGeneralLedger();
    const revenue = (gl['4111']?.balance || 0) + (gl['4120']?.balance || 0);
    const cogs = (gl['5110']?.balance || 0) + (gl['5115']?.balance || 0) + (gl['5120']?.balance || 0);
    const grossProfit = revenue - cogs;
    const operatingExpenses = (gl['6100']?.balance || 0);
    const netIncome = grossProfit - operatingExpenses;

    return {
      revenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netIncome
    };
  }
}

// ─── TEST SUITE EXECUTION ───

describe('PT TAN ERP: Comprehensive Closed-Loop (#loop) End-to-End Suite', () => {
  let sys;

  beforeEach(() => {
    sys = new TANErpSystemEngine();
  });

  // =========================================================================
  // DOMAIN 1: PEMBELIAN & PENGADAAN (PURCHASING & PROCUREMENT)
  // =========================================================================
  describe('Domain 1: Pembelian (PR, PO Impor, PO Lokal 2-Tahap, Scrap XRF, Cicilan)', () => {
    test('1.1 Purchase Request (PR) Lifecycle: Non-Posting, Approval, & Pre-filled Conversion', () => {
      // 1. Operator creates PR for Local Gold
      const prLocal = sys.createPurchaseRequest({
        category: 'GOLD_LOCAL',
        itemName: 'Emas Batangan Antam 1kg (999.9)',
        estimatedWeightGram: 1000,
        estimatedBudgetIDR: 1300000000,
        recommendedSupplier: 'PT Pegadaian (Persero) Jakarta'
      });

      expect(prLocal.status).toBe('PENDING_APPROVAL');
      expect(prLocal.isPosting).toBe(false);
      expect(sys.storage.journals.length).toBe(0); // Non-posting rule

      // 2. Direct approval by Manager/Director
      sys.approvePurchaseRequest(prLocal.id);
      expect(prLocal.status).toBe('APPROVED');

      // 3. Convert PR to PO Lokal
      const conversion = sys.convertPRToPO(prLocal.id, {
        poNumber: 'PO-LOK-001',
        pricePerGramIDR: 1300000,
        courierName: 'Bpk. Budi Santoso'
      });

      expect(conversion.pr.status).toBe('CONVERTED TO PO');
      expect(conversion.po.poNumber).toBe('PO-LOK-001');
      expect(conversion.po.totalAmount).toBe(1300000000);
      expect(conversion.po.remainingBalanceIDR).toBe(1300000000);
    });

    test('1.2 PO Emas Lokal 2-Stage Lifecycle: Transit 1159 -> Kedatangan Vault 1157 dengan 4-TTD', () => {
      const po = sys.createLocalPurchaseOrder({
        poNumber: 'PO-LOK-002',
        supplierName: 'PT Pegadaian Jakarta',
        quantityGrams: 2000,
        pricePerGramIDR: 1300000,
        courierName: 'Bpk. Budi Santoso'
      });

      // Stage 1: Cash/Bank Out -> Emas di Tangan Kurir (Transit 1159)
      sys.payLocalPurchaseStage1(po.poNumber, {
        paymentSource: '1111-IDR',
        bankReferenceNo: 'TRC-BCA-889911',
        voucherNo: 'BBK-LOK-001'
      });

      expect(po.paymentStatus).toBe('PAID');
      expect(po.status).toBe('PAID_IN_TRANSIT_COURIER');

      const glStage1 = sys.calculateGeneralLedger();
      expect(glStage1['1159'].balance).toBe(2600000000); // 2.6 Milyar in transit
      expect(glStage1['1157'].balance).toBe(0); // Not yet in main vault
      expect(glStage1['1111-IDR'].balance).toBe(-2600000000); // Bank IDR reduced

      // Stage 2: Courier arrives at Vault -> Serah Terima 4-TTD (Transit 1159 -> Vault 1157)
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {
        safeBoxSlot: 'DRAWER-A-01',
        securitySealNo: 'SEAL-PGD-998822',
        barSerialNumbers: 'ANT-991, ANT-992'
      });

      expect(po.isVaultReceived).toBe(true);
      expect(po.status).toContain('VERIFIED 4 TTD');

      const glStage2 = sys.calculateGeneralLedger();
      expect(glStage2['1159'].balance).toBe(0); // Transit cleared
      expect(glStage2['1157'].balance).toBe(2600000000); // Safely stocked in Vault Utama
    });

    test('1.3 PO Impor Valas USD (YLG Singapore): Down Payment 1135, PPh 22 0.25%, & TTB Vault Impor 1158', () => {
      // 1. Issue PO Impor for 1000g (32.1507 oz @ $2,400/oz = $77,161.79 USD)
      const po = sys.createImportPurchaseOrder({
        poNumber: 'PO-IMP-001',
        supplierName: 'YLG Bullion Singapore',
        quantityGrams: 1000,
        priceUSDPerOz: 2400,
        exchangeRate: 16250
      });

      expect(po.currency).toBe('USD');
      expect(po.totalAmountUSD).toBeCloseTo(77161.79, 1);

      // 2. Pay 100% Down Payment USD from BCA Devisa (1111-USD)
      sys.payImportPurchaseDownPayment(po.poNumber, {
        amountUSD: po.totalAmountUSD,
        exchangeRate: 16250,
        bankAccount: '1111-USD',
        voucherNo: 'BBK-USD-001',
        bankRef: 'SWIFT-BCA-YLG-01'
      });

      const glDP = sys.calculateGeneralLedger();
      expect(glDP['1135'].balance).toBeCloseTo(po.totalAmountIDR, 0); // Uang Muka Impor
      expect(glDP['1111-USD'].balance).toBeCloseTo(-po.totalAmountIDR, 0); // Devisa Out

      // 3. Pay PPh 22 Impor 0.25% to Kas Negara / DJBC (Debet 1135 vs Bank 1111-IDR)
      const pph22Amount = po.totalAmountIDR * 0.0025;
      sys.payCustomsPPh22Impor(po.poNumber, {
        pph22AmountIDR: pph22Amount,
        voucherNo: 'BBK-TAX-01',
        bankRef: 'BILLING-DJBC-889'
      });

      // 4. Physical Goods Arrive in Customs Vault (TTB GRN 1158) -> Uang Muka 1135 closed into 1158
      sys.createGoodsReceipt({
        grnNumber: 'GRN-IMP-001',
        poNumber: po.poNumber,
        documentWeightGram: 1000,
        receivedWeightGram: 1000,
        targetVault: '1158',
        unitPriceIDR: po.totalAmountIDR / 1000
      });

      const glFinal = sys.calculateGeneralLedger();
      expect(glFinal['1158'].balance).toBeCloseTo(po.totalAmountIDR, 0); // Stored in Vault Impor
    });

    test('1.4 Pembelian Emas Scrap & Leburan dengan Uji Kadar XRF % dan Konversi Fine Gold', () => {
      // 500g scrap at 75.5% purity = 377.5g fine gold @ Rp 1,200,000/fine g = Rp 453,000,000
      const scrap = sys.createScrapPurchase({
        receiptNo: 'NOTA-SCRAP-001',
        supplierName: 'Toko Emas Sumber Rejeki',
        grossWeight: 500,
        xrfPurity: 75.5,
        pricePerFineGram: 1200000,
        paymentSource: '1110' // Kas Kecil
      });

      expect(scrap.estimatedFineGold).toBe(377.5);
      expect(scrap.totalAmount).toBe(453000000);

      const gl = sys.calculateGeneralLedger();
      expect(gl['1152'].balance).toBe(453000000); // Stored in Scrap Vault
      expect(gl['1110'].balance).toBe(-453000000); // Cash out
    });
  });

  // =========================================================================
  // DOMAIN 2: GUDANG & VAULT (WAREHOUSE & INVENTORY MANAGEMENT)
  // =========================================================================
  describe('Domain 2: Gudang & Brankas (TTB, Discrepancy, WIP SPK, Settlement Mass Conservation, Silver Alloy, Transfer)', () => {
    test('2.1 Penerimaan Barang TTB: Komparasi Timbangan & Deteksi Discrepancy Berat', () => {
      const grn = sys.createGoodsReceipt({
        grnNumber: 'GRN-TEST-001',
        poNumber: 'PO-IMP-TEST',
        documentWeightGram: 1000.00,
        receivedWeightGram: 999.85, // 0.15g short
        targetVault: '1158',
        safeBoxSlot: 'SLOT-B2',
        securitySealNo: 'SEAL-MALCA-99'
      });

      expect(grn.weightDiscrepancyGram).toBe(-0.15);
      expect(grn.receivedWeightGram).toBe(999.85);
      expect(grn.safeBoxSlot).toBe('SLOT-B2');
    });

    test('2.2 Rantai Produksi Perhiasan: Pengeluaran WIP 11502 & Settlement Konservasi Massa Emas 100%', () => {
      // 1. Initial Local Purchase to fund Vault 1157
      const po = sys.createLocalPurchaseOrder({ poNumber: 'PO-LOK-PROD', quantityGrams: 1000, pricePerGramIDR: 1300000 });
      sys.payLocalPurchaseStage1(po.poNumber, {});
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {});

      // 2. Issue SPK: 500g pure gold out of 1157 into WIP 11502
      const spk = sys.createProductionSPK({
        spkNo: 'SPK-2026-001',
        jewelryType: 'Cincin Dubai 18K',
        targetKarat: '750',
        fineGoldNeeded: 500.00
      });

      const glWIP = sys.calculateGeneralLedger();
      expect(glWIP['1157'].balance).toBe(650000000); // 500g left (Rp 650 Juta)
      expect(glWIP['11502'].balance).toBe(650000000); // 500g in WIP

      // 3. Workshop Settlement: 490g Finished Jewelry + 8g Scrap Retur + 2g Loss = 500g (Balanced!)
      const settlement = sys.settleProductionSPK(spk.spkNo, {
        joNumber: 'JO-2026-001',
        jewelryOutputWeight: 490.00,
        scrapReturnWeight: 8.00,
        goldLossWeight: 2.00,
        laborFeeIDR: 7500000 // Ongkos kerja tukang
      });

      expect(settlement.status).toBe('COMPLETED');
      expect(spk.status).toBe('COMPLETED');

      // 4. Verify GL Balances
      const glFinal = sys.calculateGeneralLedger();
      expect(glFinal['11502'].balance).toBe(0); // WIP cleared
      expect(glFinal['1160'].balance).toBe((490 * 1300000) + 7500000); // Finished goods vault
      expect(glFinal['1152'].balance).toBe(8 * 1200000); // Scrap return vault
      expect(glFinal['5120'].balance).toBe((2 * 1300000) + (8 * 100000)); // Yield Loss & Scrap discount variance
    });

    test('2.3 Deteksi Pelanggaran Konservasi Massa Emas pada Settlement Produksi (Anti-Kebocoran)', () => {
      const spk = sys.createProductionSPK({
        spkNo: 'SPK-2026-FAIL',
        fineGoldNeeded: 500.00
      });

      // Attempt settlement with missing 10g unaccounted (480 + 8 + 2 = 490 !== 500)
      expect(() => {
        sys.settleProductionSPK(spk.spkNo, {
          jewelryOutputWeight: 480.00,
          scrapReturnWeight: 8.00,
          goldLossWeight: 2.00
        });
      }).toThrow(/CONSERVATION OF MASS BREACH/);
    });

    test('2.4 Vault Perak (1153) & Penambahan Perak ke Emas Batangan (Alloy) dengan Guard-Rail Stok', () => {
      // 1. Receive 5000g Fine Silver @ Rp 16,500/g = Rp 82,500,000
      sys.recordSilverReceipt({
        weightGrams: 5000,
        pricePerGram: 16500,
        sourceAccount: '1111-IDR'
      });

      // 2. Guard-rail: Try to use 6000g silver (Exceeds stock)
      expect(() => {
        sys.addSilverToGoldAlloy({
          goldInitialWeightGram: 1000,
          goldPurityInitial: 99.99,
          silverWeightGram: 6000
        });
      }).toThrow(/Insufficient Silver Stock/);

      // 3. Valid Alloy: Add 100g silver to 1000g 99.99% gold -> 1100g alloyed bar (90.90% purity)
      const alloy = sys.addSilverToGoldAlloy({
        goldInitialWeightGram: 1000,
        goldPurityInitial: 99.99,
        silverWeightGram: 100,
        silverPricePerGram: 16500,
        targetAccount: '1157'
      });

      expect(alloy.totalFinalWeightGram).toBe(1100);
      expect(alloy.finalEstimatedPurity).toBe(90.90);

      const gl = sys.calculateGeneralLedger();
      expect(gl['1153'].balance).toBe(82500000 - 1650000); // 4900g silver remaining
      expect(gl['1157'].balance).toBe(1650000); // Silver alloy value added to Gold Vault
    });

    test('2.5 Transfer Antar-Vault dengan Validasi Saldo Sumber & Auto-Jurnal SAK EMKM', () => {
      // Fund Vault 1157 with 1000g
      const po = sys.createLocalPurchaseOrder({ poNumber: 'PO-TRF', quantityGrams: 1000, pricePerGramIDR: 1300000 });
      sys.payLocalPurchaseStage1(po.poNumber, {});
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {});

      // Attempt to transfer 1500g (Exceeds stock)
      expect(() => {
        sys.transferBetweenVaults({
          fromAccount: '1157',
          toAccount: '1158',
          quantityGrams: 1500
        });
      }).toThrow(/Insufficient source vault stock/);

      // Valid Transfer: 400g from 1157 to 1158
      sys.transferBetweenVaults({
        fromAccount: '1157',
        toAccount: '1158',
        quantityGrams: 400,
        estimatedValueIDR: 520000000
      });

      const positions = sys.calculateVaultStockPositions();
      const vault1157 = positions.vaults.find(v => v.account === '1157');
      const vault1158 = positions.vaults.find(v => v.account === '1158');

      expect(vault1157.balanceGrams).toBe(600); // 1000 - 400 = 600g
      expect(vault1158.balanceGrams).toBe(400); // +400g
    });
  });

  // =========================================================================
  // DOMAIN 3: PENJUALAN & EKSPOR (SALES & EXPORT TRADING)
  // =========================================================================
  describe('Domain 3: Penjualan (Local Cash, Credit 30d, DP, PMK 48/2023 Bebas PPN, Export PPN 0% USD)', () => {
    test('3.1 Penjualan Lokal Tunai Lunas (Bank 1111-IDR vs Penjualan 4111 & HPP 5110 vs Vault 1157)', () => {
      // Stock 1000g in 1157
      const po = sys.createLocalPurchaseOrder({ poNumber: 'PO-STOCK', quantityGrams: 1000, pricePerGramIDR: 1300000 });
      sys.payLocalPurchaseStage1(po.poNumber, {});
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {});

      // 1. SO Local: 1000g @ Rp 1,380,000/g = Rp 1.38 Milyar
      const so = sys.createLocalSalesOrder({
        soNumber: 'SO-LOK-001',
        customerName: 'Toko Emas Gadjah Berlian',
        quantityGrams: 1000,
        unitPriceIDR: 1380000,
        paymentMode: 'cash'
      });

      // 2. DO Local: Dispatch 1000g from Vault 1157
      sys.createLocalDeliveryOrder({
        doNumber: 'SJ-LOK-001',
        soNumber: so.soNumber,
        customerName: so.customerName,
        sourceVault: '1157',
        netWeightGram: 1000,
        cogsAmountIDR: 1300000000
      });

      // 3. Invoice Local: PMK 48/2023 Non-BKP Bebas PPN
      const inv = sys.createLocalInvoice({
        invoiceNo: 'INV-LOK-001',
        soNumber: so.soNumber,
        customerName: so.customerName,
        paymentMode: 'cash',
        totalAmountIDR: 1380000000
      });

      expect(inv.paymentStatus).toBe('PAID');
      expect(inv.taxFacility).toContain('BEBAS PPN');

      // 4. Financial & Stock Verification
      const gl = sys.calculateGeneralLedger();
      expect(gl['1111-IDR'].balance).toBe(1380000000 - 1300000000); // Rp 80 Juta net cash surplus
      expect(gl['4111'].balance).toBe(1380000000); // Penjualan Lokal
      expect(gl['5110'].balance).toBe(1300000000); // HPP Lokal

      const pnl = sys.calculateIncomeStatement();
      expect(pnl.grossProfit).toBe(80000000); // Rp 80 Juta Gross Profit
    });

    test('3.2 Penjualan Lokal Tempo / Kredit 30 Hari & Pelunasan Kasir BBM', () => {
      // Stock 500g in 1157
      const po = sys.createLocalPurchaseOrder({ poNumber: 'PO-CR', quantityGrams: 500, pricePerGramIDR: 1300000 });
      sys.payLocalPurchaseStage1(po.poNumber, {});
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {});

      // Dispatch DO & Issue Credit Invoice
      sys.createLocalDeliveryOrder({
        doNumber: 'SJ-LOK-CR',
        customerName: 'PT Mulia Jaya',
        sourceVault: '1157',
        netWeightGram: 500,
        cogsAmountIDR: 650000000
      });

      const inv = sys.createLocalInvoice({
        invoiceNo: 'INV-LOK-CR',
        customerName: 'PT Mulia Jaya',
        paymentMode: 'credit',
        totalAmountIDR: 690000000
      });

      expect(inv.paymentStatus).toBe('UNPAID');

      const glCredit = sys.calculateGeneralLedger();
      expect(glCredit['1130'].balance).toBe(690000000); // Piutang Usaha Lokal

      // Customer Pays Invoice -> Kasir Issues BBM
      sys.receiveLocalCustomerPayment(inv.invoiceNo, {
        amountIDR: 690000000,
        voucherNo: 'BBM-CR-001',
        bankRef: 'MUTASI-BCA-9922'
      });

      expect(inv.paymentStatus).toBe('PAID');
      const glPaid = sys.calculateGeneralLedger();
      expect(glPaid['1130'].balance).toBe(0); // Piutang cleared
      expect(glPaid['1111-IDR'].balance).toBe(690000000 - 650000000); // Net cash surplus
    });

    test('3.3 Penjualan Lokal dengan Down Payment (DP) & Penutupan Liabilitas 2116-1', () => {
      // Issue Invoice: Rp 1.38 M Total, Rp 300 Juta DP, Rp 1.08 M Sisa Bayar
      const inv = sys.createLocalInvoice({
        invoiceNo: 'INV-LOK-DP',
        customerName: 'Toko Sumber Rejeki',
        paymentMode: 'cash',
        totalAmountIDR: 1380000000,
        downPaymentIDR: 300000000
      });

      expect(inv.netReceivableIDR).toBe(1080000000);

      // Verify Auto-Journal has 3 lines: Debet Bank 1.08M, Debet DP 300M, Kredit Penjualan 1.38M
      const jrn = sys.storage.journals.find(j => j.ref === inv.invoiceNo);
      expect(jrn.lines).toHaveLength(3);
      expect(jrn.lines[0].accountCode).toBe('1111-IDR');
      expect(jrn.lines[0].debit).toBe(1080000000);
      expect(jrn.lines[1].accountCode).toBe('2116-1');
      expect(jrn.lines[1].debit).toBe(300000000);
      expect(jrn.lines[2].accountCode).toBe('4111');
      expect(jrn.lines[2].credit).toBe(1380000000);
    });

    test('3.4 Penjualan Ekspor Perhiasan USD: PPN 0%, PEB/AWB, Kargo Brinks, & Pelunasan Devisa DHE', () => {
      // 1. Stock Finished Jewelry in Export Vault 1160 (Cost = 500g * 1.3M + 5M labor = 655M)
      const po = sys.createLocalPurchaseOrder({ poNumber: 'PO-EXP-MAT', quantityGrams: 500, pricePerGramIDR: 1300000 });
      sys.payLocalPurchaseStage1(po.poNumber, {});
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {});
      const spk = sys.createProductionSPK({ fineGoldNeeded: 500 });
      sys.settleProductionSPK(spk.spkNo, { jewelryOutputWeight: 500, scrapReturnWeight: 0, goldLossWeight: 0, laborFeeIDR: 5000000 });

      // 2. Export SO: 500g @ $85/g = $42,500 USD
      const so = sys.createExportSalesOrder({
        soNumber: 'SO-EXP-001',
        buyerName: 'Dubai Gold & Jewelry DMCC',
        netWeightGram: 500,
        priceUSDPerGram: 85
      });

      // 3. Export Invoice: PPN 0% @ Rp 16,250 = Rp 690,625,000
      const inv = sys.createExportInvoice({
        invoiceNo: 'INV-EXP-001',
        soNumber: so.soNumber,
        buyerName: so.buyerName,
        totalAmountUSD: 42500,
        exchangeRate: 16250
      });

      // 4. Export DO: Kargo Brinks & PEB (Deduct exact FG production cost 655M)
      sys.createExportDeliveryOrder({
        doNumber: 'DO-EXP-001',
        invoiceNo: inv.invoiceNo,
        buyerName: inv.buyerName,
        netWeightGram: 500,
        cogsAmountIDR: 655000000,
        courierName: 'Brinks Global Secured Transport',
        pebNumber: 'PEB-2026-00881',
        awbNumber: 'AWB-EK-998811'
      });

      const glExport = sys.calculateGeneralLedger();
      expect(glExport['1132'].balance).toBe(690625000); // Piutang Ekspor USD
      expect(glExport['4120'].balance).toBe(690625000); // Pendapatan Ekspor PPN 0%
      expect(glExport['1160'].balance).toBe(0); // Export Vault depleted

      // 5. Kasir receives Foreign Exchange DHE in BCA USD (1111-USD)
      sys.receiveExportCustomerPayment(inv.invoiceNo, {
        amountUSD: 42500,
        exchangeRate: 16250,
        bankAccount: '1111-USD',
        voucherNo: 'BBM-EXP-001',
        bankRef: 'SWIFT-DMCC-BCA-001'
      });

      expect(inv.paymentStatus).toBe('PAID');
      const glFinal = sys.calculateGeneralLedger();
      expect(glFinal['1132'].balance).toBe(0); // Piutang ekspor cleared
      expect(glFinal['1111-USD'].balance).toBe(690625000); // USD Cash in Bank BCA
    });
  });

  // =========================================================================
  // DOMAIN 4: KASIR & KEUANGAN (CASHIER, TREASURY & BANKING)
  // =========================================================================
  describe('Domain 4: Kasir & Keuangan (Bank Reference No, Vouchers, Master Cheque Book)', () => {
    test('4.1 Pencatatan & Verifikasi Bank Reference No (Trace ID Mutasi Bank) di Seluruh Voucher', () => {
      const po = sys.createLocalPurchaseOrder({ poNumber: 'PO-VCH', quantityGrams: 500, pricePerGramIDR: 1300000 });
      sys.payLocalPurchaseStage1(po.poNumber, {
        bankReferenceNo: 'BCA-TRC-99882233',
        voucherNo: 'BBK-001'
      });

      expect(po.paymentHistory[0].bankReferenceNo).toBe('BCA-TRC-99882233');

      // Journal entry description must contain the trace ID for bank recon audit
      const jrn = sys.storage.journals.find(j => j.ref === 'BBK-001');
      expect(jrn.description).toContain('BCA-TRC-99882233');
    });

    test('4.2 Master Cheque / Bilyet Giro: Validasi Limit Per Lembar & Siklus AVAILABLE -> USED -> CLEARED', () => {
      // 1. Issue Cheque for Rp 150 Juta to PT Antam
      const leaf = sys.issueMasterCheque('BOOK-BCA-2026A', 'BG-BCA-998801', {
        payee: 'PT Antam Tbk',
        amountIDR: 150000000,
        voucherNo: 'BCK-001'
      });

      expect(leaf.status).toBe('USED');
      expect(leaf.payee).toBe('PT Antam Tbk');
      expect(leaf.amount).toBe(150000000);
      expect(leaf.isCleared).toBe(false);

      // 2. Guard-rail: Try to reuse already used cheque leaf
      expect(() => {
        sys.issueMasterCheque('BOOK-BCA-2026A', 'BG-BCA-998801', {
          payee: 'Supplier B',
          amountIDR: 50000000
        });
      }).toThrow(/not available/);

      // 3. Guard-rail: Try to issue cheque exceeding Rp 500 Jt leaf limit
      expect(() => {
        sys.issueMasterCheque('BOOK-BCA-2026A', 'BG-BCA-998802', {
          payee: 'Big Supplier',
          amountIDR: 600000000 // Exceeds 500M
        });
      }).toThrow(/exceeds maximum leaf limit/);

      // 4. Clear Cheque
      const cleared = sys.clearMasterCheque('BOOK-BCA-2026A', 'BG-BCA-998801');
      expect(cleared.status).toBe('CLEARED');
      expect(cleared.isCleared).toBe(true);
    });
  });

  // =========================================================================
  // DOMAIN 5: AKUNTANSI & INTEGRITAS SAK EMKM
  // =========================================================================
  describe('Domain 5: Akuntansi (Invarian Keseimbangan Jurnal SAK EMKM & Laporan Dinamis)', () => {
    test('5.1 Invarian Mutlak: 100% Entri Jurnal Transaksi Memiliki Total Debit === Total Credit', () => {
      // Execute complex multi-stage business cycle
      const po = sys.createLocalPurchaseOrder({ poNumber: 'PO-FULL', quantityGrams: 1000, pricePerGramIDR: 1300000 });
      sys.payLocalPurchaseStage1(po.poNumber, {});
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {});

      const spk = sys.createProductionSPK({ fineGoldNeeded: 500 });
      sys.settleProductionSPK(spk.spkNo, { jewelryOutputWeight: 490, scrapReturnWeight: 8, goldLossWeight: 2, laborFeeIDR: 5000000 });

      sys.createLocalDeliveryOrder({ netWeightGram: 500, cogsAmountIDR: 650000000 });
      sys.createLocalInvoice({ totalAmountIDR: 690000000, paymentMode: 'cash' });

      // Audit all recorded journals
      expect(sys.storage.journals.length).toBeGreaterThan(4);
      sys.storage.journals.forEach(j => {
        const totalDebit = j.lines.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = j.lines.reduce((s, l) => s + (l.credit || 0), 0);
        expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
      });
    });

    test('5.2 Laporan Keuangan Dinamis SAK EMKM Terkalkulasi 100% Akurat dari Jurnal Riil', () => {
      // Run complete cycle
      const po = sys.createLocalPurchaseOrder({ poNumber: 'PO-PNL', quantityGrams: 1000, pricePerGramIDR: 1300000 });
      sys.payLocalPurchaseStage1(po.poNumber, {});
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {});

      sys.createLocalDeliveryOrder({ netWeightGram: 1000, cogsAmountIDR: 1300000000 });
      sys.createLocalInvoice({ totalAmountIDR: 1380000000, paymentMode: 'cash' });

      const pnl = sys.calculateIncomeStatement();
      expect(pnl.revenue).toBe(1380000000);
      expect(pnl.cogs).toBe(1300000000);
      expect(pnl.grossProfit).toBe(80000000);
      expect(pnl.netIncome).toBe(80000000);
    });
  });

  // =========================================================================
  // DOMAIN 6: 5 EXTREME FAILURE MODE STRESS TESTS (#loop)
  // =========================================================================
  describe('Domain 6: 5 Extreme Failure Mode Stress Tests (#loop)', () => {
    test('6.1 Stress Test 1: Corrupt / Racy Payload & Bad Account Code Rejection', () => {
      expect(() => {
        sys.postJournal('FAIL-COA', 'Bad COA test', [
          { accountCode: '9999-NONEXISTENT', debit: 1000000, credit: 0 },
          { accountCode: '1110', debit: 0, credit: 1000000 }
        ]);
      }).toThrow(/not found in COA/);

      expect(() => {
        sys.postJournal('FAIL-UNBALANCED', 'Unbalanced test', [
          { accountCode: '1110', debit: 1000000, credit: 0 },
          { accountCode: '1111-IDR', debit: 0, credit: 999999 }
        ]);
      }).toThrow(/Unbalanced Journal/);
    });

    test('6.2 Stress Test 2: Over-depletion & Negative Stock Prevention in Vault Dispatches', () => {
      // Empty vault initially
      expect(() => {
        sys.createLocalDeliveryOrder({
          doNumber: 'SJ-FAIL',
          sourceVault: '1157',
          netWeightGram: 500
        });
      }).toThrow(/Insufficient Stock in Vault 1157/);

      expect(() => {
        sys.createExportDeliveryOrder({
          doNumber: 'DO-FAIL',
          netWeightGram: 500
        });
      }).toThrow(/Insufficient Stock in Export Vault 1160/);
    });

    test('6.3 Stress Test 3: Floating Point Assay Gram Invariance (0.1g + 0.2g === 0.3g)', () => {
      // Fund with 0.3g
      const po = sys.createLocalPurchaseOrder({ poNumber: 'PO-FLOAT', quantityGrams: 0.3, pricePerGramIDR: 1300000 });
      sys.payLocalPurchaseStage1(po.poNumber, {});
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {});

      // Dispatch 0.1g + 0.2g in 2 separate shipments
      sys.createLocalDeliveryOrder({ doNumber: 'DO-FL1', netWeightGram: 0.1, cogsAmountIDR: 130000 });
      sys.createLocalDeliveryOrder({ doNumber: 'DO-FL2', netWeightGram: 0.2, cogsAmountIDR: 260000 });

      const positions = sys.calculateVaultStockPositions();
      const vault1157 = positions.vaults.find(v => v.account === '1157');
      expect(vault1157.balanceGrams).toBeCloseTo(0, 4);
    });

    test('6.4 Stress Test 4: Large Financial Numbers Handling (Tens of Billions Rupiah)', () => {
      // 20 kg Gold = 20,000g @ Rp 1,350,000/g = Rp 27 Billion
      const po = sys.createLocalPurchaseOrder({
        poNumber: 'PO-BILLION',
        quantityGrams: 20000,
        pricePerGramIDR: 1350000
      });
      expect(po.totalAmount).toBe(27000000000);

      sys.payLocalPurchaseStage1(po.poNumber, { voucherNo: 'BBK-BIG' });
      sys.confirmLocalVaultArrivalStage2(po.poNumber, {});

      const gl = sys.calculateGeneralLedger();
      expect(gl['1157'].balance).toBe(27000000000);
    });

    test('6.5 Stress Test 5: Multi-Currency Foreign Exchange Rate Stability', () => {
      const po = sys.createImportPurchaseOrder({
        poNumber: 'PO-FX-TEST',
        quantityGrams: 1000,
        priceUSDPerOz: 2500,
        exchangeRate: 16500 // Spot rate
      });

      const expectedUSD = (1000 / 31.1034768) * 2500;
      const expectedIDR = expectedUSD * 16500;

      expect(po.totalAmountUSD).toBeCloseTo(expectedUSD, 2);
      expect(po.totalAmountIDR).toBeCloseTo(expectedIDR, 0);
    });
  });
});
