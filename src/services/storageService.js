// Storage Service Layer wrapping backend handlers in data/storage.js & modules/purchaseOrder.js

export const getCOA = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get(window.Storage.KEYS.CHART_OF_ACCOUNTS) || window.Storage.getDefaultChartOfAccounts();
  }
  return [];
};

export const saveCOA = async (accounts) => {
  if (typeof window !== 'undefined' && window.Storage) {
    return await window.Storage.set(window.Storage.KEYS.CHART_OF_ACCOUNTS, accounts);
  }
  return false;
};

export const addCOAAccount = async (newAccount) => {
  const accounts = getCOA();
  if (accounts.some(a => a.code === newAccount.code)) {
    return { success: false, error: 'Kode akun sudah digunakan' };
  }
  accounts.push(newAccount);
  accounts.sort((a, b) => a.code.localeCompare(b.code));
  await saveCOA(accounts);
  return { success: true };
};

export const getMasterItems = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.getItems() || [];
  }
  return [];
};

export const saveMasterItem = async (item) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const items = getMasterItems();
    items.unshift(item);
    return await window.Storage.set(window.Storage.KEYS.ITEMS, items);
  }
  return false;
};

export const getFinishedGoods = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get('pttan_master_finished_goods') || [
      { id: 'JWL-RNG-750-001', sku: 'JWL-RNG-750-001', name: 'Dubai Arabian Casting Ring', type: 'Cincin (Ring)', karat: '750', purity: 75.0, goldColor: 'Yellow Gold', stdWeightGram: 4.50, laborFeeIDRPerGram: 15000, hsCode: '7113.19.90', inventoryAccount: '1160' },
      { id: 'JWL-CHN-700-005', sku: 'JWL-CHN-700-005', name: 'Italian Hollow Rope Chain', type: 'Kalung (Necklace)', karat: '700', purity: 70.0, goldColor: 'Rose Gold', stdWeightGram: 12.00, laborFeeIDRPerGram: 18000, hsCode: '7113.19.90', inventoryAccount: '1160' },
      { id: 'JWL-BNG-375-010', sku: 'JWL-BNG-375-010', name: 'Stamped Diamond Cut Bangle', type: 'Gelang (Bangle)', karat: '375', purity: 37.5, goldColor: 'White Gold', stdWeightGram: 8.50, laborFeeIDRPerGram: 12000, hsCode: '7113.19.90', inventoryAccount: '1160' }
    ];
  }
  return [];
};

export const saveFinishedGood = async (fg) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const list = getFinishedGoods();
    list.unshift(fg);
    return await window.Storage.set('pttan_master_finished_goods', list);
  }
  return false;
};

export const getCustomers = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get(window.Storage.KEYS.CUSTOMERS) || [];
  }
  return [];
};

export const saveCustomer = async (cust) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const customers = getCustomers();
    customers.unshift(cust);
    return await window.Storage.set(window.Storage.KEYS.CUSTOMERS, customers);
  }
  return false;
};

export const getSuppliers = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get(window.Storage.KEYS.SUPPLIERS) || [];
  }
  return [];
};

export const saveSupplier = async (supp) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const suppliers = getSuppliers();
    suppliers.unshift(supp);
    return await window.Storage.set(window.Storage.KEYS.SUPPLIERS, suppliers);
  }
  return false;
};

export const getPurchaseOrders = () => {
  if (typeof window !== 'undefined' && window.PurchaseOrder) {
    return window.PurchaseOrder.getStoredOrders() || [];
  }
  return [];
};

export const createPurchaseOrder = async (orderData) => {
  if (typeof window !== 'undefined' && window.PurchaseOrder) {
    return await window.PurchaseOrder.createOrder(orderData);
  }
  return { success: false, errors: { system: 'PurchaseOrder module not ready' } };
};

export const recordPOPayment = async (poNumberOrId, paymentData) => {
  let updated = false;

  // 1. Update di PurchaseOrder (PO Impor & Standar)
  if (typeof window !== 'undefined' && window.PurchaseOrder) {
    const res = await window.PurchaseOrder.recordPayment(poNumberOrId, paymentData);
    if (res && res.success) {
      updated = true;
    }
  }

  // 2. Update di Local Purchases (PO Lokal Tempo) jika ada
  if (typeof window !== 'undefined' && window.Storage) {
    const localPurchases = window.Storage.get('pttan_local_purchases') || [];
    const pIndex = localPurchases.findIndex(p => p.id === poNumberOrId || p.poNumber === poNumberOrId || p.receiptNo === poNumberOrId);
    if (pIndex !== -1) {
      const p = localPurchases[pIndex];
      const pmtAmount = parseFloat(paymentData.amount || 0);
      const category = paymentData.category || paymentData.paymentCategory || 'PO_PRINCIPAL';

      let categoryLabel = paymentData.categoryLabel;
      if (!categoryLabel) {
        switch (category) {
          case 'CUSTOMS_DUTY_PPH22':
            categoryLabel = '🏛️ Pajak PPh 22 Impor (0,25%)';
            break;
          case 'LOGISTICS_HANDLING':
            categoryLabel = '🚚 Logistik & Handling';
            break;
          case 'OTHER_EXPENSE':
            categoryLabel = '📑 Biaya Tambahan';
            break;
          default:
            categoryLabel = '💰 Pelunasan Pokok Supplier';
            break;
        }
      }

      const historyEntry = {
        id: paymentData.id || Date.now(),
        voucherNo: paymentData.voucherNo || paymentData.voucherNumber || 'BBK',
        voucherType: paymentData.voucherType || 'BBK',
        date: paymentData.date || new Date().toISOString().split('T')[0],
        category,
        categoryLabel,
        payee: paymentData.payee || p.supplierName || 'Supplier',
        bank: paymentData.bank || paymentData.bankAccountName || 'Bank BCA',
        bankAccountCode: paymentData.bankAccountCode || '1111-IDR',
        accountCode: paymentData.accountCode || (category === 'CUSTOMS_DUTY_PPH22' ? '1135' : '2111'),
        amount: pmtAmount,
        notes: paymentData.notes || paymentData.description || '',
        recordedAt: new Date().toISOString()
      };

      const existingHistory = Array.isArray(p.paymentHistory) ? p.paymentHistory : [];

      let curPaid = parseFloat(p.paidAmountIDR || 0);
      const totalAmt = parseFloat(p.totalAmount || 0);
      let rem = typeof p.remainingBalanceIDR !== 'undefined' ? parseFloat(p.remainingBalanceIDR) : Math.max(0, totalAmt - curPaid);
      let customsPaid = parseFloat(p.customsPaidAmountIDR || 0);
      let logisticsPaid = parseFloat(p.logisticsPaidAmountIDR || 0);
      let otherExpensesPaid = parseFloat(p.otherExpensesPaidAmountIDR || 0);

      if (category === 'PO_PRINCIPAL') {
        curPaid += pmtAmount;
        rem = Math.max(0, totalAmt - curPaid);
      } else if (category === 'CUSTOMS_DUTY_PPH22') {
        customsPaid += pmtAmount;
      } else if (category === 'LOGISTICS_HANDLING') {
        logisticsPaid += pmtAmount;
      } else {
        otherExpensesPaid += pmtAmount;
      }

      const isPaid = rem === 0;

      localPurchases[pIndex] = {
        ...p,
        paidAmountIDR: curPaid,
        remainingBalanceIDR: rem,
        customsPaidAmountIDR: customsPaid,
        logisticsPaidAmountIDR: logisticsPaid,
        otherExpensesPaidAmountIDR: otherExpensesPaid,
        paymentStatus: isPaid ? 'PAID' : curPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
        lastPaymentVoucher: historyEntry.voucherNo,
        lastPaymentDate: historyEntry.date,
        paymentHistory: [historyEntry, ...existingHistory],
        updatedAt: new Date().toISOString()
      };

      await window.Storage.set('pttan_local_purchases', localPurchases);
      updated = true;
    }
  }

  return { success: updated };
};

// ==========================================
// VAULT & WAREHOUSE STOCK SERVICE METHODS
// ==========================================

export const getDefaultWarehouses = () => [
  { id: 'WH-VAULT-01', name: 'Vault Utama PT TAN', code: 'VAULT-PRI', location: 'Lantai 2 Safe Room', manager: 'Budi Santoso', status: 'Active', account: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Utama)' },
  { id: 'WH-VAULT-02', name: 'Vault Emas Impor Transit', code: 'VAULT-IMP', location: 'Lantai 2 Customs Safe', manager: 'Siti Aminah', status: 'Active', account: '1158', accountName: 'Persediaan Logam Mulia Impor' },
  { id: 'WH-VAULT-04', name: 'Vault Emas WIP (Produksi Perhiasan)', code: 'VAULT-WIP', location: 'Lantai 2 Manufacturing Vault', manager: 'Hendra (Head of Production)', status: 'Active', account: '11502', accountName: 'Persediaan Emas WIP (Produksi)' },
  { id: 'WH-VAULT-03', name: 'Vault Perhiasan Siap Ekspor', code: 'VAULT-EXP', location: 'Lantai 3 Dispatch Vault', manager: 'Ahmad Hidayat', status: 'Active', account: '1160', accountName: 'Persediaan Perhiasan Siap Ekspor' },
  { id: 'WH-VAULT-05', name: 'Vault Pecahan Scrap & Leburan', code: 'VAULT-SCRAP', location: 'Lantai 2 Smelting Room', manager: 'Rian (Assay Master)', status: 'Active', account: '1152', accountName: 'Persediaan Emas Scrap & Leburan' }
];

export const getWarehouses = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    const stored = window.Storage.get('pttan_warehouses') || window.Storage.get(window.Storage.KEYS.WAREHOUSES);
    if (Array.isArray(stored) && stored.length > 0) return stored;
  }
  return getDefaultWarehouses();
};

export const getGoodsReceipts = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get('pttan_goods_receipts') || [
      {
        id: 'GRN-2026-001',
        grnNumber: 'GRN-2026-001',
        poNumber: 'PO-IMP-2026-001',
        supplierDoNumber: 'SJ-SUP-VAL-998811',
        pibNo: '001234/PIB/KPU-TP/2026',
        date: '2026-08-10',
        supplierName: 'Valcambi SA Switzerland',
        targetVault: '1158',
        targetVaultName: 'Vault Impor 999.9 (Akun 1158)',
        itemDescription: 'Emas Batangan 999.9 Valcambi Cast Bar 1kg',
        barSerialNumbers: 'VAL-99120, VAL-99121',
        assayCertificateNo: 'ASSAY-VAL-88912',
        receivedWeightGram: 1000,
        unitPriceIDRPerGram: 1350000,
        totalValueIDR: 1350000000,
        status: 'RECEIVED & VERIFIED'
      }
    ];
  }
  return [];
};

export const getLocalPurchases = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get('pttan_local_purchases') || [
      {
        id: '1723450001',
        receiptNo: 'NOTA-PGD-2026-001',
        poNumber: 'PO-LOK-2026-001',
        orderDate: '2026-08-11',
        supplierName: 'PT Pegadaian (Persero) Jakarta',
        itemName: 'Emas Batangan Antam 1kg (999.9)',
        quantityGrams: 1000,
        pricePerGramIDR: 1300000,
        totalAmount: 1300000000,
        barSerialNumbers: 'ANT-991100',
        status: 'RECEIVED & STOCKED IN VAULT (VERIFIED 4 TTD)',
        isVaultReceived: true,
        courierName: 'Bpk. Budi Santoso'
      }
    ];
  }
  return [];
};

export const getScrapPurchases = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get('pttan_scrap_purchases') || [
      {
        id: 'SCRAP-2026-001',
        receiptNo: 'NOTA-SCRAP-2026-001',
        spkMeltingNo: 'SPK-MLT-2026-001',
        date: '2026-08-11',
        supplierName: 'Toko Emas Mitra Sejahtera',
        itemDescription: 'Pecahan Perhiasan Emas Bekas Karat Campur',
        grossWeight: 500,
        xrfPurity: 75.5,
        estimatedFineGold: 377.5,
        pricePerFineGram: 1200000,
        totalAmount: 453000000,
        paymentMethod: 'CASH',
        creditAccount: '1110',
        creditAccountName: 'Kas Kecil (Petty Cash)',
        targetVault: '1152',
        targetVaultName: 'Vault Pecahan Scrap & Leburan (Akun 1152)',
        status: 'RECEIVED & STORED IN SCRAP VAULT',
        createdAt: '2026-08-11T09:00:00.000Z'
      }
    ];
  }
  return [];
};

export const saveScrapPurchase = async (scrapData) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const list = getScrapPurchases();
    const newScrap = {
      id: scrapData.receiptNo || `SCRAP-${Date.now().toString().slice(-6)}`,
      receiptNo: scrapData.receiptNo || `NOTA-SCRAP-${Date.now().toString().slice(-4)}`,
      spkMeltingNo: scrapData.spkMeltingNo || `SPK-MLT-${Date.now().toString().slice(-4)}`,
      date: scrapData.date || new Date().toISOString().split('T')[0],
      supplierName: scrapData.supplierName || 'Toko Emas Mitra',
      itemDescription: scrapData.itemDescription || 'Pecahan Perhiasan Emas Scrap',
      grossWeight: Number(scrapData.grossWeight || 0),
      xrfPurity: Number(scrapData.xrfPurity || 0),
      estimatedFineGold: Number(scrapData.estimatedFineGold || 0),
      pricePerFineGram: Number(scrapData.pricePerFineGram || 0),
      totalAmount: Number(scrapData.totalAmount || 0),
      paymentMethod: scrapData.paymentMethod || 'CASH',
      creditAccount: scrapData.creditAccount || '1110',
      creditAccountName: scrapData.creditAccountName || 'Kas Kecil',
      targetVault: scrapData.targetVault || '1152',
      targetVaultName: scrapData.targetVaultName || 'Vault Pecahan Scrap (1152)',
      status: scrapData.status || 'RECEIVED & STORED IN SCRAP VAULT',
      createdAt: new Date().toISOString()
    };

    list.unshift(newScrap);
    await window.Storage.set('pttan_scrap_purchases', list);

    // Auto-post journal for scrap purchase
    const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
    const entryNum = typeof window.Storage.getNextReferenceNumber === 'function'
      ? await window.Storage.getNextReferenceNumber('journal')
      : `JRN-SCRAP-${Date.now().toString().slice(-6)}`;

    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: newScrap.date,
      description: `Pembelian Scrap Emas (${newScrap.receiptNo}) - ${newScrap.supplierName} [${newScrap.grossWeight}g @ ${newScrap.xrfPurity}% XRF = ${newScrap.estimatedFineGold}g Fine Gold]`,
      lines: [
        { accountCode: newScrap.targetVault, accountName: newScrap.targetVaultName, debit: newScrap.totalAmount, credit: 0 },
        { accountCode: newScrap.creditAccount, accountName: newScrap.creditAccountName, debit: 0, credit: newScrap.totalAmount }
      ],
      createdAt: new Date().toISOString()
    });

    await window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

    return { success: true, scrap: newScrap };
  }
  return { success: false, error: 'Storage not available' };
};

export const getProductionSPK = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get('pttan_production_spk') || [
      {
        id: 'SPK-2026-001',
        spkNo: 'SPK-PROD-2026-001',
        date: '2026-08-12',
        buyerName: 'Dubai Gold & Jewelry DMCC',
        jewelryType: 'Cincin & Kalung Emas 18K',
        targetKarat: '750',
        grossWeight: 500,
        fineGoldNeeded: 381.65,
        masterAlloyNeeded: 124.00,
        status: 'IN_WIP',
        notes: 'Pengeluaran bahan baku emas murni ke Brankas WIP'
      }
    ];
  }
  return [];
};

export const getProductionSettlements = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get('pttan_production_settlements') || [
      {
        id: 'JO-2026-001',
        joNumber: 'JO-2026-001',
        date: '2026-08-14',
        jewelryOutputWeight: 490,
        scrapReturnWeight: 8,
        goldLossWeight: 2,
        laborFeeIDR: 7500000,
        karat: '750',
        status: 'COMPLETED'
      }
    ];
  }
  return [];
};

export const getExportDeliveryOrders = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get('pttan_export_delivery_orders') || [
      {
        id: 'DO-EXP-2026-001',
        doNumber: 'DO-EXP-2026-001',
        customerPONumber: 'PO-DMCC-2026-8899',
        invoiceNo: 'INV-EXP-2026-001',
        soNumber: 'SO-EXP-2026-001',
        goldCertificateNo: 'CERT-FINEGOLD-998812',
        purityCertificateNo: 'ASSAY-KARAT-750-0012',
        date: '2026-08-15',
        buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
        country: 'United Arab Emirates (UAE)',
        courierName: 'Brinks Global Secured Transport',
        awbNumber: 'AWB-FEDEX-99881122',
        pebNumber: 'PEB-2026-088912',
        securitySealNo: 'SEAL-GOLD-998812',
        boxCount: 2,
        itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
        netWeightGram: 450,
        grossWeightGram: 560,
        status: 'SHIPPED / IN TRANSIT'
      }
    ];
  }
  return [];
};

export const getVaultTransfers = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get('pttan_vault_transfers') || [];
  }
  return [];
};

export const recordVaultTransfer = async (transferData) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const list = getVaultTransfers();
    const newTransfer = {
      id: `TRF-${Date.now().toString().slice(-6)}`,
      date: transferData.date || new Date().toISOString().split('T')[0],
      fromVaultId: transferData.fromVaultId,
      fromVaultName: transferData.fromVaultName,
      fromAccount: transferData.fromAccount,
      toVaultId: transferData.toVaultId,
      toVaultName: transferData.toVaultName,
      toAccount: transferData.toAccount,
      itemCode: transferData.itemCode || 'GOLD-GENERIC',
      itemName: transferData.itemName || 'Logam Mulia Emas',
      quantityGrams: Number(transferData.quantityGrams || 0),
      estimatedValueIDR: Number(transferData.estimatedValueIDR || 0),
      transferNotes: transferData.transferNotes || 'Transfer internal brankas vault',
      createdAt: new Date().toISOString()
    };

    list.unshift(newTransfer);
    await window.Storage.set('pttan_vault_transfers', list);

    // Auto-Post Journal Entry for Vault Transfer
    const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
    const entryNum = typeof window.Storage.getNextReferenceNumber === 'function'
      ? await window.Storage.getNextReferenceNumber('journal')
      : `JRN-TRF-${Date.now().toString().slice(-6)}`;

    const journalValue = newTransfer.estimatedValueIDR > 0
      ? newTransfer.estimatedValueIDR
      : newTransfer.quantityGrams * 1300000;

    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: newTransfer.date,
      description: `Transfer Mutasi Antar-Vault: ${newTransfer.quantityGrams}g ${newTransfer.itemName} [${newTransfer.fromVaultName} (${newTransfer.fromAccount}) -> ${newTransfer.toVaultName} (${newTransfer.toAccount})] - ${newTransfer.transferNotes}`,
      lines: [
        { accountCode: newTransfer.toAccount, accountName: newTransfer.toVaultName, debit: journalValue, credit: 0 },
        { accountCode: newTransfer.fromAccount, accountName: newTransfer.fromVaultName, debit: 0, credit: journalValue }
      ],
      createdAt: new Date().toISOString()
    });

    await window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

    return { success: true, transfer: newTransfer };
  }
  return { success: false, error: 'Storage not available' };
};

// Compute Dynamic Vault Stock Positions & Movement Cards
export const calculateVaultStockPosition = () => {
  const warehouses = getWarehouses();
  const grns = getGoodsReceipts();
  const localPurchases = getLocalPurchases();
  const scrapPurchases = getScrapPurchases();
  const spkList = getProductionSPK();
  const settlements = getProductionSettlements();
  const deliveryOrders = getExportDeliveryOrders();
  const transfers = getVaultTransfers();

  // Initialize Balances map per account/vault
  const vaultBalances = {};
  warehouses.forEach(w => {
    vaultBalances[w.account] = {
      id: w.id,
      name: w.name,
      code: w.code,
      account: w.account,
      location: w.location,
      manager: w.manager,
      status: w.status,
      totalInGrams: 0,
      totalOutGrams: 0,
      balanceGrams: 0,
      totalValueIDR: 0
    };
  });

  const allMovements = [];

  // 1. Goods Receipts (TTB Impor / Lokal) -> IN
  grns.forEach(grn => {
    const acc = grn.targetVault || '1158';
    const weight = Number(grn.receivedWeightGram || 0);
    const val = Number(grn.totalValueIDR || (weight * 1350000));
    if (vaultBalances[acc]) {
      vaultBalances[acc].totalInGrams += weight;
      vaultBalances[acc].balanceGrams += weight;
      vaultBalances[acc].totalValueIDR += val;
    }
    allMovements.push({
      id: `GRN-${grn.id || grn.grnNumber}`,
      date: grn.date || '2026-08-10',
      docType: 'TTB / GRN',
      docNo: grn.grnNumber || grn.id,
      refNo: grn.poNumber || '-',
      itemCode: 'LM-IMPORT-LBMA',
      itemName: grn.itemDescription || 'Emas Batangan Impor 999.9',
      warehouseAccount: acc,
      warehouseName: vaultBalances[acc]?.name || 'Vault Impor (1158)',
      inQty: weight,
      outQty: 0,
      unit: 'gram',
      valueIDR: val,
      serialNo: grn.barSerialNumbers || grn.assayCertificateNo || 'Sertifikat Pabean'
    });
  });

  // 2. Local Purchases (Emas Lokal yang sudah tiba di vault) -> IN ke 1157
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
      allMovements.push({
        id: `LOK-${lp.id || lp.receiptNo}`,
        date: lp.orderDate || lp.vaultReceivedAt?.split('T')[0] || '2026-08-11',
        docType: 'PO / NOTA LOKAL',
        docNo: lp.receiptNo || lp.poNumber || 'NOTA-LOKAL',
        refNo: lp.poNumber || lp.receiptNo || '-',
        itemCode: 'LM-ANTAM-9999',
        itemName: lp.itemName || 'Emas Batangan Antam / Lokal 999.9',
        warehouseAccount: acc,
        warehouseName: vaultBalances[acc]?.name || 'Vault Utama (1157)',
        inQty: weight,
        outQty: 0,
        unit: 'gram',
        valueIDR: val,
        serialNo: lp.barSerialNumbers || `Kurir: ${lp.courierName || 'Internal'}`
      });
    }
  });

  // 2b. Scrap Purchases -> IN ke 1152 (atau target vault yang dipilih)
  scrapPurchases.forEach(sc => {
    const acc = sc.targetVault || '1152';
    const weight = Number(sc.grossWeight || sc.estimatedFineGold || 0);
    const val = Number(sc.totalAmount || (weight * 1200000));
    if (vaultBalances[acc]) {
      vaultBalances[acc].totalInGrams += weight;
      vaultBalances[acc].balanceGrams += weight;
      vaultBalances[acc].totalValueIDR += val;
    }
    allMovements.push({
      id: `SCRAP-BUY-${sc.id || sc.receiptNo}`,
      date: sc.date || '2026-08-11',
      docType: 'NOTA BELI SCRAP',
      docNo: sc.receiptNo || sc.id,
      refNo: `SPK: ${sc.spkMeltingNo || '-'} | XRF: ${sc.xrfPurity || 0}%`,
      itemCode: 'SCRAP-MIX',
      itemName: sc.itemDescription || `Scrap Emas Kadar ${sc.xrfPurity}%`,
      warehouseAccount: acc,
      warehouseName: vaultBalances[acc]?.name || 'Vault Scrap (1152)',
      inQty: weight,
      outQty: 0,
      unit: 'gram',
      valueIDR: val,
      serialNo: `Toko: ${sc.supplierName} | Fine Gold: ${sc.estimatedFineGold}g`
    });
  });

  // 3. SPK Issue to WIP Produksi -> OUT dari 1157, IN ke 11502
  spkList.forEach(spk => {
    const fineWeight = Number(spk.fineGoldNeeded || 0);
    const val = fineWeight * 1300000;

    // OUT dari 1157
    if (vaultBalances['1157']) {
      vaultBalances['1157'].totalOutGrams += fineWeight;
      vaultBalances['1157'].balanceGrams -= fineWeight;
      vaultBalances['1157'].totalValueIDR -= val;
    }
    allMovements.push({
      id: `SPK-OUT-${spk.id || spk.spkNo}`,
      date: spk.date || '2026-08-12',
      docType: 'SPK PENGELUARAN WIP',
      docNo: spk.spkNo || spk.id,
      refNo: spk.buyerName || 'Workshop Produksi',
      itemCode: 'GOLD-RAW-9999',
      itemName: `Bahan Emas Murni (${spk.jewelryType || 'Perhiasan'})`,
      warehouseAccount: '1157',
      warehouseName: vaultBalances['1157']?.name || 'Vault Utama (1157)',
      inQty: 0,
      outQty: fineWeight,
      unit: 'gram',
      valueIDR: val,
      serialNo: `SPK: ${spk.spkNo} (Target Karat ${spk.targetKarat || '750'})`
    });

    // IN ke 11502
    if (vaultBalances['11502']) {
      vaultBalances['11502'].totalInGrams += fineWeight;
      vaultBalances['11502'].balanceGrams += fineWeight;
      vaultBalances['11502'].totalValueIDR += val;
    }
    allMovements.push({
      id: `SPK-IN-${spk.id || spk.spkNo}`,
      date: spk.date || '2026-08-12',
      docType: 'SPK PENERIMAAN WIP',
      docNo: spk.spkNo || spk.id,
      refNo: spk.buyerName || 'Workshop Produksi',
      itemCode: 'GOLD-WIP-KARAT',
      itemName: `Emas WIP Dalam Proses Karat ${spk.targetKarat || '750'}`,
      warehouseAccount: '11502',
      warehouseName: vaultBalances['11502']?.name || 'Vault Emas WIP (11502)',
      inQty: fineWeight,
      outQty: 0,
      unit: 'gram',
      valueIDR: val,
      serialNo: `WIP SPK ${spk.spkNo}`
    });
  });

  // 4. Production Settlement -> OUT dari 11502, IN ke 1160 (Perhiasan Jadi) & 1152 (Scrap Retur)
  settlements.forEach(st => {
    const outJewelry = Number(st.jewelryOutputWeight || 0);
    const scrapRet = Number(st.scrapReturnWeight || 0);
    const goldLoss = Number(st.goldLossWeight || 0);
    const totalDeductedWIP = outJewelry + scrapRet + goldLoss;
    const valJewelry = (outJewelry * 1350000) + Number(st.laborFeeIDR || 0);

    // OUT dari 11502
    if (vaultBalances['11502']) {
      vaultBalances['11502'].totalOutGrams += totalDeductedWIP;
      vaultBalances['11502'].balanceGrams -= totalDeductedWIP;
      vaultBalances['11502'].totalValueIDR -= (totalDeductedWIP * 1300000);
    }
    allMovements.push({
      id: `SETTLE-OUT-${st.id || st.joNumber}`,
      date: st.date || '2026-08-14',
      docType: 'SETTLEMENT WORKSHOP',
      docNo: st.joNumber || st.id,
      refNo: `Hasil Jadi ${outJewelry}g | Loss ${goldLoss}g`,
      itemCode: 'GOLD-WIP-KARAT',
      itemName: 'Pelunasan Bahan Emas WIP Karat',
      warehouseAccount: '11502',
      warehouseName: vaultBalances['11502']?.name || 'Vault Emas WIP (11502)',
      inQty: 0,
      outQty: totalDeductedWIP,
      unit: 'gram',
      valueIDR: totalDeductedWIP * 1300000,
      serialNo: `Settle SPK: ${st.joNumber}`
    });

    // IN ke 1160 (Perhiasan Siap Ekspor)
    if (vaultBalances['1160']) {
      vaultBalances['1160'].totalInGrams += outJewelry;
      vaultBalances['1160'].balanceGrams += outJewelry;
      vaultBalances['1160'].totalValueIDR += valJewelry;
    }
    allMovements.push({
      id: `SETTLE-IN-EXP-${st.id || st.joNumber}`,
      date: st.date || '2026-08-14',
      docType: 'FINISH GOODS RECEIPT',
      docNo: st.joNumber || st.id,
      refNo: `Labor Fee: Rp ${(st.laborFeeIDR || 0).toLocaleString()}`,
      itemCode: 'JEWELRY-EXP-750',
      itemName: `Perhiasan Emas Karat ${st.karat || '750'} Siap Ekspor`,
      warehouseAccount: '1160',
      warehouseName: vaultBalances['1160']?.name || 'Vault Perhiasan Siap Ekspor (1160)',
      inQty: outJewelry,
      outQty: 0,
      unit: 'gram',
      valueIDR: valJewelry,
      serialNo: `Batch FG: ${st.joNumber}`
    });

    // IN ke 1152 (Scrap Retur jika ada)
    if (scrapRet > 0 && vaultBalances['1152']) {
      vaultBalances['1152'].totalInGrams += scrapRet;
      vaultBalances['1152'].balanceGrams += scrapRet;
      vaultBalances['1152'].totalValueIDR += (scrapRet * 1200000);
      allMovements.push({
        id: `SCRAP-RET-${st.id || st.joNumber}`,
        date: st.date || '2026-08-14',
        docType: 'SCRAP RETUR LEBURAN',
        docNo: st.joNumber || st.id,
        refNo: 'Sisa Leburan Workshop',
        itemCode: 'SCRAP-RETURN',
        itemName: 'Emas Scrap Retur / Sisa Leburan',
        warehouseAccount: '1152',
        warehouseName: vaultBalances['1152']?.name || 'Vault Scrap (1152)',
        inQty: scrapRet,
        outQty: 0,
        unit: 'gram',
        valueIDR: scrapRet * 1200000,
        serialNo: `Retur JO ${st.joNumber}`
      });
    }
  });

  // 5. Export Delivery Orders (DO) -> OUT dari 1160
  deliveryOrders.forEach(doItem => {
    const weight = Number(doItem.netWeightGram || 0);
    const val = weight * 1380000;
    if (vaultBalances['1160']) {
      vaultBalances['1160'].totalOutGrams += weight;
      vaultBalances['1160'].balanceGrams -= weight;
      vaultBalances['1160'].totalValueIDR -= val;
    }
    allMovements.push({
      id: `DO-EXP-${doItem.id || doItem.doNumber}`,
      date: doItem.date || '2026-08-15',
      docType: 'SURAT JALAN EKSPOR',
      docNo: doItem.doNumber || doItem.id,
      refNo: doItem.soNumber || doItem.customerPONumber || '-',
      itemCode: 'JEWELRY-EXP-750',
      itemName: doItem.itemDescription || 'Fine Gold Jewelry 750 (18K)',
      warehouseAccount: '1160',
      warehouseName: vaultBalances['1160']?.name || 'Vault Perhiasan Siap Ekspor (1160)',
      inQty: 0,
      outQty: weight,
      unit: 'gram',
      valueIDR: val,
      serialNo: `${doItem.goldCertificateNo || 'Cert'} | AWB: ${doItem.awbNumber || '-'}`
    });
  });

  // 6. Internal Vault Transfers
  transfers.forEach(trf => {
    const weight = Number(trf.quantityGrams || 0);
    const val = Number(trf.estimatedValueIDR || (weight * 1300000));
    const fromAcc = trf.fromAccount;
    const toAcc = trf.toAccount;

    // Deduct from Source
    if (vaultBalances[fromAcc]) {
      vaultBalances[fromAcc].totalOutGrams += weight;
      vaultBalances[fromAcc].balanceGrams -= weight;
      vaultBalances[fromAcc].totalValueIDR -= val;
    }
    allMovements.push({
      id: `TRF-OUT-${trf.id}`,
      date: trf.date || '2026-08-16',
      docType: 'TRANSFER ANTAR-VAULT (OUT)',
      docNo: trf.id,
      refNo: `Transfer ke ${trf.toVaultName}`,
      itemCode: trf.itemCode,
      itemName: trf.itemName,
      warehouseAccount: fromAcc,
      warehouseName: trf.fromVaultName,
      inQty: 0,
      outQty: weight,
      unit: 'gram',
      valueIDR: val,
      serialNo: trf.transferNotes || 'Transfer Antar Brankas'
    });

    // Add to Destination
    if (vaultBalances[toAcc]) {
      vaultBalances[toAcc].totalInGrams += weight;
      vaultBalances[toAcc].balanceGrams += weight;
      vaultBalances[toAcc].totalValueIDR += val;
    }
    allMovements.push({
      id: `TRF-IN-${trf.id}`,
      date: trf.date || '2026-08-16',
      docType: 'TRANSFER ANTAR-VAULT (IN)',
      docNo: trf.id,
      refNo: `Diterima dari ${trf.fromVaultName}`,
      itemCode: trf.itemCode,
      itemName: trf.itemName,
      warehouseAccount: toAcc,
      warehouseName: trf.toVaultName,
      inQty: weight,
      outQty: 0,
      unit: 'gram',
      valueIDR: val,
      serialNo: trf.transferNotes || 'Penerimaan Transfer Brankas'
    });
  });

  // Calculate Running Balances chronologically
  allMovements.sort((a, b) => new Date(a.date) - new Date(b.date));
  const accountRunningTotals = {};
  const enrichedMovements = allMovements.map(m => {
    if (!accountRunningTotals[m.warehouseAccount]) {
      accountRunningTotals[m.warehouseAccount] = 0;
    }
    accountRunningTotals[m.warehouseAccount] += (m.inQty - m.outQty);
    return {
      ...m,
      balanceQty: accountRunningTotals[m.warehouseAccount]
    };
  });

  // Reverse so newest appears first on UI table
  enrichedMovements.reverse();

  // Summary Metrics
  const lmMainGrams = Math.max(0, vaultBalances['1157']?.balanceGrams || 0);
  const lmImportGrams = Math.max(0, vaultBalances['1158']?.balanceGrams || 0);
  const totalLMGrams = lmMainGrams + lmImportGrams;
  const wipGrams = Math.max(0, vaultBalances['11502']?.balanceGrams || 0);
  const exportGrams = Math.max(0, vaultBalances['1160']?.balanceGrams || 0);
  const scrapGrams = Math.max(0, vaultBalances['1152']?.balanceGrams || 0);
  const totalVaultGrams = totalLMGrams + wipGrams + exportGrams + scrapGrams;

  let grandTotalValueIDR = 0;
  Object.values(vaultBalances).forEach(vb => {
    grandTotalValueIDR += Math.max(0, vb.totalValueIDR || 0);
  });

  return {
    vaults: Object.values(vaultBalances),
    movements: enrichedMovements,
    summary: {
      totalLMGrams,
      lmMainGrams,
      lmImportGrams,
      wipGrams,
      exportGrams,
      scrapGrams,
      totalVaultGrams,
      grandTotalValueIDR
    }
  };
};

