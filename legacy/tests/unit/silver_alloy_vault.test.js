/**
 * Silver Inventory & Alloy Addition to Gold Vault Unit Tests
 * Tests: Silver stock tracking, alloy math & purity, balance guard-rails, and SAK EMKM COA auto-journaling.
 */

// ─── Business Logic under Test ───

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

function recordSilverReceipt(currentTransactions, receiptData) {
  const weightGrams = Number(receiptData.weightGrams || 0);
  const pricePerGram = Number(receiptData.pricePerGram || 16500);
  const totalValueIDR = Number(receiptData.totalValueIDR || (weightGrams * pricePerGram));
  const sourceAccount = receiptData.sourceAccount || '1111-IDR';

  const newReceipt = {
    id: `SLV-REC-${Date.now()}`,
    transactionType: 'RECEIPT',
    date: receiptData.date || '2026-08-20',
    supplierName: receiptData.supplierName || 'PT Antam / Supplier Perak',
    weightGrams,
    pricePerGram,
    totalValueIDR,
    sourceAccount,
    targetVaultAccount: '1153'
  };

  const journalEntry = {
    entryNumber: `JRN-SLV-${Date.now()}`,
    date: newReceipt.date,
    description: `[PENERIMAAN-PERAK] Penerimaan ${weightGrams}g perak`,
    lines: [
      { accountCode: '1153', accountName: 'Silver & Logam Mulia Lain', debit: totalValueIDR, credit: 0 },
      { accountCode: sourceAccount, accountName: 'Bank / Kas / Hutang', debit: 0, credit: totalValueIDR }
    ]
  };

  return {
    success: true,
    transaction: newReceipt,
    journal: journalEntry,
    updatedTransactions: [newReceipt, ...currentTransactions]
  };
}

function recordSilverAdditionToGold(currentTransactions, additionData) {
  const totalSilverIn = currentTransactions
    .filter(t => t.transactionType === 'RECEIPT')
    .reduce((sum, t) => sum + Number(t.weightGrams || 0), 0);
  const totalSilverOut = currentTransactions
    .filter(t => t.transactionType === 'ALLOY_ADDITION')
    .reduce((sum, t) => sum + Number(t.silverWeightGram || 0), 0);
  const availableSilver = totalSilverIn - totalSilverOut;

  const silverWeightGram = Number(additionData.silverWeightGram || 0);
  if (silverWeightGram <= 0) {
    return { success: false, message: 'Berat perak yang ditambahkan harus lebih besar dari 0 gram.' };
  }

  if (silverWeightGram > availableSilver) {
    return {
      success: false,
      message: `Saldo stok perak tidak mencukupi. Tersedia: ${availableSilver} gram, diminta: ${silverWeightGram} gram.`
    };
  }

  const goldInitialWeightGram = Number(additionData.goldInitialWeightGram || 0);
  const goldPurityInitial = Number(additionData.goldPurityInitial || 99.99);
  const silverPricePerGram = Number(additionData.silverPricePerGram || 16500);
  const totalSilverValueIDR = Number(additionData.totalSilverValueIDR || (silverWeightGram * silverPricePerGram));
  const targetAccount = additionData.targetAccount || '1157';
  const targetVaultName = additionData.targetVaultName || 'Vault Utama PT TAN';
  const totalFinalWeightGram = goldInitialWeightGram + silverWeightGram;

  const fineGoldWeight = goldInitialWeightGram * (goldPurityInitial / 100);
  const finalEstimatedPurity = totalFinalWeightGram > 0
    ? (fineGoldWeight / totalFinalWeightGram) * 100
    : goldPurityInitial;

  const newAddition = {
    id: `ALLOY-SLV-${Date.now()}`,
    transactionType: 'ALLOY_ADDITION',
    date: additionData.date || '2026-08-26',
    targetAccount,
    targetVaultName,
    goldBarRef: additionData.goldBarRef || 'Emas Batangan',
    goldInitialWeightGram,
    goldPurityInitial,
    silverWeightGram,
    silverPricePerGram,
    totalSilverValueIDR,
    totalFinalWeightGram,
    finalEstimatedPurity: Number(finalEstimatedPurity.toFixed(2))
  };

  const journalEntry = {
    entryNumber: `JRN-ALLOY-${Date.now()}`,
    date: newAddition.date,
    description: `[ALLOY-PERAK] Penambahan ${silverWeightGram}g Perak ke ${newAddition.goldBarRef}`,
    lines: [
      { accountCode: targetAccount, accountName: targetVaultName, debit: totalSilverValueIDR, credit: 0 },
      { accountCode: '1153', accountName: 'Silver & Logam Mulia Lain', debit: 0, credit: totalSilverValueIDR }
    ]
  };

  return {
    success: true,
    transaction: newAddition,
    journal: journalEntry,
    updatedTransactions: [newAddition, ...currentTransactions]
  };
}

function calculateVaultStockPosition(warehouses, silverTransactions) {
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

  const allMovements = [];

  silverTransactions.forEach(st => {
    if (st.transactionType === 'RECEIPT') {
      const weight = Number(st.weightGrams || 0);
      const val = Number(st.totalValueIDR || (weight * 16500));
      if (vaultBalances['1153']) {
        vaultBalances['1153'].totalInGrams += weight;
        vaultBalances['1153'].balanceGrams += weight;
        vaultBalances['1153'].totalValueIDR += val;
      }
      allMovements.push({
        docType: 'PENERIMAAN PERAK',
        warehouseAccount: '1153',
        inQty: weight,
        outQty: 0,
        valueIDR: val
      });
    } else if (st.transactionType === 'ALLOY_ADDITION') {
      const silverWeight = Number(st.silverWeightGram || 0);
      const val = Number(st.totalSilverValueIDR || (silverWeight * 16500));
      const targetAcc = st.targetAccount || '1157';

      // Deduct from Silver Vault (1153)
      if (vaultBalances['1153']) {
        vaultBalances['1153'].totalOutGrams += silverWeight;
        vaultBalances['1153'].balanceGrams -= silverWeight;
        vaultBalances['1153'].totalValueIDR -= val;
      }
      allMovements.push({
        docType: 'ALLOY / KELUAR PERAK',
        warehouseAccount: '1153',
        inQty: 0,
        outQty: silverWeight,
        valueIDR: val
      });

      // Add into Target Gold Vault (1157/11502)
      if (vaultBalances[targetAcc]) {
        vaultBalances[targetAcc].totalInGrams += silverWeight;
        vaultBalances[targetAcc].balanceGrams += silverWeight;
        vaultBalances[targetAcc].totalValueIDR += val;
      }
      allMovements.push({
        docType: 'ALLOY / TAMBAH PERAK',
        warehouseAccount: targetAcc,
        inQty: silverWeight,
        outQty: 0,
        valueIDR: val
      });
    }
  });

  return {
    vaults: Object.values(vaultBalances),
    movements: allMovements
  };
}

// ─── Tests ───

describe('Silver (Perak) Inventory & Gold Alloy Vault Integration', () => {
  test('1. getDefaultWarehouses should contain WH-VAULT-06 (Akun 1153 - Silver & Logam Mulia Lain)', () => {
    const warehouses = getDefaultWarehouses();
    const silverVault = warehouses.find(w => w.account === '1153');
    expect(silverVault).toBeDefined();
    expect(silverVault.id).toBe('WH-VAULT-06');
    expect(silverVault.name).toContain('Perak');
  });

  test('2. recordSilverReceipt should record silver receipt and post auto-journal Debet 1153 / Kredit 1111-IDR', () => {
    const initialList = [];
    const receiptData = {
      date: '2026-08-20',
      supplierName: 'PT Antam Tbk',
      weightGrams: 2000,
      pricePerGram: 16500,
      sourceAccount: '1111-IDR'
    };

    const res = recordSilverReceipt(initialList, receiptData);
    expect(res.success).toBe(true);
    expect(res.transaction.weightGrams).toBe(2000);
    expect(res.transaction.totalValueIDR).toBe(33000000);

    const jrn = res.journal;
    expect(jrn.lines).toHaveLength(2);
    expect(jrn.lines[0].accountCode).toBe('1153');
    expect(jrn.lines[0].debit).toBe(33000000);
    expect(jrn.lines[1].accountCode).toBe('1111-IDR');
    expect(jrn.lines[1].credit).toBe(33000000);
  });

  test('3. recordSilverAdditionToGold should fail with error message if requested silver exceeds available stock', () => {
    // Current stock is 1000g
    const currentTransactions = [
      { transactionType: 'RECEIPT', weightGrams: 1000, pricePerGram: 16500 }
    ];

    const additionData = {
      goldInitialWeightGram: 1000,
      goldPurityInitial: 99.99,
      silverWeightGram: 1500, // 1500g exceeds 1000g available
      targetAccount: '1157',
      targetVaultName: 'Vault Utama PT TAN',
      goldBarRef: 'LM-ANTAM-1000G'
    };

    const res = recordSilverAdditionToGold(currentTransactions, additionData);
    expect(res.success).toBe(false);
    expect(res.message).toContain('tidak mencukupi');
  });

  test('4. recordSilverAdditionToGold should succeed, compute correct final alloy weight and purity, and post auto-journal Debet 1157 / Kredit 1153', () => {
    const currentTransactions = [
      { transactionType: 'RECEIPT', weightGrams: 5000, pricePerGram: 16500 }
    ];

    const additionData = {
      date: '2026-08-26',
      goldInitialWeightGram: 1000,
      goldPurityInitial: 99.99,
      silverWeightGram: 100, // 100g silver added
      silverPricePerGram: 16500,
      targetAccount: '1157',
      targetVaultName: 'Vault Utama PT TAN',
      goldBarRef: 'LM-ANTAM-1000G / Seri B-1029'
    };

    const res = recordSilverAdditionToGold(currentTransactions, additionData);
    expect(res.success).toBe(true);
    expect(res.transaction.totalFinalWeightGram).toBe(1100);
    // Fine gold = 1000 * 0.9999 = 999.9g; Purity = 999.9 / 1100 * 100 = 90.90%
    expect(res.transaction.finalEstimatedPurity).toBeCloseTo(90.90, 1);
    expect(res.transaction.totalSilverValueIDR).toBe(1650000);

    const jrn = res.journal;
    expect(jrn.lines[0].accountCode).toBe('1157');
    expect(jrn.lines[0].debit).toBe(1650000);
    expect(jrn.lines[1].accountCode).toBe('1153');
    expect(jrn.lines[1].credit).toBe(1650000);
    expect(jrn.lines[0].debit).toBe(jrn.lines[1].credit); // Balanced SAK EMKM
  });

  test('5. calculateVaultStockPosition should accurately deduct silver from 1153 and add alloy mass to target gold vault', () => {
    const warehouses = getDefaultWarehouses();
    const transactions = [
      { transactionType: 'RECEIPT', weightGrams: 5000, totalValueIDR: 82500000 },
      {
        transactionType: 'ALLOY_ADDITION',
        silverWeightGram: 200,
        totalSilverValueIDR: 3300000,
        targetAccount: '11502',
        targetVaultName: 'Vault Emas WIP (Produksi Perhiasan)'
      }
    ];

    const position = calculateVaultStockPosition(warehouses, transactions);
    const silverVault = position.vaults.find(v => v.account === '1153');
    const wipVault = position.vaults.find(v => v.account === '11502');

    // Silver vault balance should be 5000 - 200 = 4800g
    expect(silverVault.balanceGrams).toBe(4800);
    expect(silverVault.totalValueIDR).toBe(82500000 - 3300000);

    // WIP vault should have received 200g of alloyed silver
    expect(wipVault.totalInGrams).toBe(200);
    expect(wipVault.balanceGrams).toBe(200);

    // Check movements list
    const silverOutMovement = position.movements.find(m => m.docType === 'ALLOY / KELUAR PERAK');
    const goldInMovement = position.movements.find(m => m.docType === 'ALLOY / TAMBAH PERAK');
    expect(silverOutMovement).toBeDefined();
    expect(silverOutMovement.outQty).toBe(200);
    expect(goldInMovement).toBeDefined();
    expect(goldInMovement.inQty).toBe(200);
  });
});
