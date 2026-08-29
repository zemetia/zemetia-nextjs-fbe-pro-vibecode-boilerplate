/**
 * Unit Tests for Local Gold Sales & Trading (Penjualan Emas Lokal IDR)
 * Tests: Sales Orders, Surat Jalan Pengeluaran Vault (Local DO), Faktur Penjualan Lokal (Invoice),
 * SAK EMKM Auto-Journaling, Multi-Bar detection, and Vault Stock Movements.
 */

describe('Local Gold Sales & Trading Business Logic & SAK EMKM Accounting', () => {

  function calculateLocalSaleTotals({ quantityGrams, unitPriceIDR, estimatedCostPerGram = 1300000 }) {
    const qty = Number(quantityGrams || 0);
    const price = Number(unitPriceIDR || 0);
    const costPerG = Number(estimatedCostPerGram || 1300000);

    const totalAmountIDR = qty * price;
    const cogsAmountIDR = qty * costPerG;
    const grossProfitIDR = totalAmountIDR - cogsAmountIDR;

    return {
      quantityGrams: qty,
      unitPriceIDR: price,
      totalAmountIDR,
      cogsAmountIDR,
      grossProfitIDR
    };
  }

  function detectBarCount(serialText) {
    if (!serialText) return 0;
    return serialText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).length;
  }

  function generateLocalDeliveryOrderJournals(doItem) {
    const netWeight = Number(doItem.netWeightGram || doItem.quantityGrams || 0);
    const costPerG = Number(doItem.estimatedCostPerGram || 1300000);
    const totalCOGS = Number(doItem.cogsAmountIDR || (netWeight * costPerG));
    const sourceVault = doItem.sourceVault || '1157';

    return {
      entryNumber: `JRN-DO-${Date.now()}`,
      date: doItem.date || '2026-08-16',
      description: `[HPP-SJ-LOKAL] Pengakuan HPP Surat Jalan ${doItem.doNumber} - ${doItem.customerName}`,
      lines: [
        { accountCode: '5110', accountName: 'Harga Pokok Penjualan', debit: totalCOGS, credit: 0 },
        { accountCode: sourceVault, accountName: 'Persediaan Vault', debit: 0, credit: totalCOGS }
      ]
    };
  }

  function generateLocalInvoiceJournals(inv) {
    const isCash = inv.paymentMode === 'cash';
    const isCredit = inv.paymentMode === 'credit';
    const isDP = inv.paymentMode === 'dp';

    const debitAccount = isCash
      ? (inv.paymentSourceAccount || '1111-IDR')
      : isCredit
      ? '1130' // Piutang Usaha Lokal
      : '1111-IDR';

    const creditAccount = isDP ? '2116-1' : '4111';
    const subtotal = Number(inv.subtotalIDR || inv.totalAmountIDR || 0);
    const dpDeduction = Number(inv.downPaymentIDR || 0);
    const netPayable = Math.max(0, subtotal - dpDeduction);

    const lines = [
      { accountCode: debitAccount, debit: netPayable, credit: 0 }
    ];

    if (dpDeduction > 0) {
      lines.push({
        accountCode: '2116-1',
        accountName: 'Uang Muka Penjualan',
        debit: dpDeduction,
        credit: 0
      });
    }

    lines.push({
      accountCode: creditAccount,
      debit: 0,
      credit: subtotal
    });

    return {
      entryNumber: `JRN-INV-${Date.now()}`,
      date: inv.date || '2026-08-16',
      description: `[FAKTUR-PENJUALAN-LOKAL] ${inv.invoiceNo} - ${inv.customerName}`,
      lines
    };
  }

  function calculateVaultStockBalance(initialStockGrams, deliveryOrders) {
    let balance = initialStockGrams;
    deliveryOrders.forEach(doItem => {
      if (doItem.status === 'DELIVERED' || doItem.status === 'SHIPPED') {
        balance -= Number(doItem.netWeightGram || doItem.quantityGrams || 0);
      }
    });
    return balance;
  }

  test('1. Menghitung total nilai penjualan, HPP, dan gross profit dengan akurat', () => {
    const result = calculateLocalSaleTotals({
      quantityGrams: 1000,
      unitPriceIDR: 1380000,
      estimatedCostPerGram: 1300000
    });

    expect(result.totalAmountIDR).toBe(1380000000); // 1.38 Milyar
    expect(result.cogsAmountIDR).toBe(1300000000);  // 1.30 Milyar
    expect(result.grossProfitIDR).toBe(80000000);   // 80 Juta
  });

  test('2. Deteksi jumlah batang/keping emas multi-serial dipisah koma atau enter', () => {
    const single = detectBarCount('ANTAM-998812');
    expect(single).toBe(1);

    const multiComma = detectBarCount('ANTAM-998812, ANTAM-998813, ANTAM-998814');
    expect(multiComma).toBe(3);

    const multiEnter = detectBarCount('ANTAM-001\nANTAM-002\nANTAM-003\nANTAM-004');
    expect(multiEnter).toBe(4);

    const empty = detectBarCount('');
    expect(empty).toBe(0);
  });

  test('3. Surat Jalan Pengeluaran Vault (Local DO) menjurnal Debet HPP 5110 vs Kredit Vault 1157', () => {
    const doItem = {
      doNumber: 'SJ-LOKAL-001',
      customerName: 'Toko Emas Gadjah',
      sourceVault: '1157',
      netWeightGram: 1000,
      cogsAmountIDR: 1300000000,
      status: 'DELIVERED'
    };

    const jDO = generateLocalDeliveryOrderJournals(doItem);
    expect(jDO.lines[0].accountCode).toBe('5110');
    expect(jDO.lines[0].debit).toBe(1300000000);
    expect(jDO.lines[1].accountCode).toBe('1157');
    expect(jDO.lines[1].credit).toBe(1300000000);
    expect(jDO.lines[0].debit).toBe(jDO.lines[1].credit);
  });

  test('4. Faktur Penjualan Tunai menjurnal Debet Bank 1111-IDR vs Kredit Penjualan 4111', () => {
    const inv = {
      invoiceNo: 'INV-LOKAL-001',
      customerName: 'Toko Emas Gadjah',
      paymentMode: 'cash',
      paymentSourceAccount: '1111-IDR',
      subtotalIDR: 1380000000,
      downPaymentIDR: 0,
      totalAmountIDR: 1380000000
    };

    const jInv = generateLocalInvoiceJournals(inv);
    expect(jInv.lines[0].accountCode).toBe('1111-IDR');
    expect(jInv.lines[0].debit).toBe(1380000000);
    expect(jInv.lines[1].accountCode).toBe('4111');
    expect(jInv.lines[1].credit).toBe(1380000000);
  });

  test('5. Faktur Penjualan Tempo menjurnal Debet Piutang Usaha Lokal 1130 vs Kredit Penjualan 4111', () => {
    const inv = {
      invoiceNo: 'INV-LOKAL-002',
      customerName: 'PT Mulia Jaya',
      paymentMode: 'credit',
      subtotalIDR: 690000000,
      downPaymentIDR: 0,
      totalAmountIDR: 690000000
    };

    const jInv = generateLocalInvoiceJournals(inv);
    expect(jInv.lines[0].accountCode).toBe('1130');
    expect(jInv.lines[0].debit).toBe(690000000);
    expect(jInv.lines[1].accountCode).toBe('4111');
    expect(jInv.lines[1].credit).toBe(690000000);
  });

  test('6. Faktur Penjualan dengan Pelunasan Uang Muka (DP) memotong Liabilitas DP 2116-1', () => {
    const inv = {
      invoiceNo: 'INV-LOKAL-003',
      customerName: 'Toko Sumber Rejeki',
      paymentMode: 'cash',
      paymentSourceAccount: '1111-IDR',
      subtotalIDR: 1380000000,
      downPaymentIDR: 300000000, // DP 300 Jt
      totalAmountIDR: 1080000000 // Sisa Bayar 1.08 M
    };

    const jInv = generateLocalInvoiceJournals(inv);
    expect(jInv.lines.length).toBe(3);

    // Line 1: Debet Bank Sisa Bayar (1.08 M)
    expect(jInv.lines[0].accountCode).toBe('1111-IDR');
    expect(jInv.lines[0].debit).toBe(1080000000);

    // Line 2: Debet Tutup Uang Muka DP (300 Jt)
    expect(jInv.lines[1].accountCode).toBe('2116-1');
    expect(jInv.lines[1].debit).toBe(300000000);

    // Line 3: Kredit Total Penjualan (1.38 M)
    expect(jInv.lines[2].accountCode).toBe('4111');
    expect(jInv.lines[2].credit).toBe(1380000000);

    // Balance verification
    const totalDebit = jInv.lines[0].debit + jInv.lines[1].debit;
    expect(totalDebit).toBe(jInv.lines[2].credit);
  });

  test('7. Pengurangan stok brankas vault riil saat Surat Jalan diterbitkan', () => {
    const initialStock = 5000; // 5 kg
    const deliveryOrders = [
      { netWeightGram: 1000, status: 'DELIVERED' },
      { netWeightGram: 500, status: 'DELIVERED' }
    ];

    const finalStock = calculateVaultStockBalance(initialStock, deliveryOrders);
    expect(finalStock).toBe(3500); // 5000 - 1000 - 500 = 3500 gram
  });

});
