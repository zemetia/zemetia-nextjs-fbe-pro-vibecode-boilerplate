import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Printer, CheckCircle, FileSpreadsheet, Filter, CheckSquare, Clock, AlertCircle, Building2, Layers, Lock, ShieldAlert, FileText, DollarSign, Calculator } from 'lucide-react';
import { getCOA, getPurchaseOrders, recordPOPayment } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';
import NumberInput from '../components/ui/NumberInput';

export default function VoucherManagement() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('BBK'); // BBK, BKK, BCK (Bukti Cek Keluar), BKM, BBM
  const [vouchers, setVouchers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [chequeBooks, setChequeBooks] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    voucherType: 'BBK',
    voucherNo: '',
    date: new Date().toISOString().split('T')[0],
    selectedPONumber: '', // Ref No. PO
    paymentCategory: 'PO_PRINCIPAL', // 'PO_PRINCIPAL', 'CUSTOMS_DUTY_PPH22', 'LOGISTICS_HANDLING', 'OTHER_EXPENSE'
    poTotalAmountIDR: 0,
    poPaidAmountIDR: 0,
    poRemainingIDR: 0,
    payeePayer: 'Supplier Emas Lokal / Vendor',
    bankAccountCode: '1111-IDR', // Bank BCA IDR (1111-IDR), Bank BCA USD (1111-USD), SGD (1111-SGD)
    paymentMethod: 'transfer', // 'transfer', 'cash', 'cheque' (Cek/BG)
    checkBankName: 'Bank BCA (KCU Thamrin)',
    checkNumber: '', // Nomor Seri Lembar Cek / Bilyet Giro
    checkDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], // Jatuh Tempo Kliring
    accountCode: '2111', // Hutang Usaha / Beban
    amount: 50000000,
    description: 'Pembayaran Pelunasan Tagihan PO Emas'
  });

  useEffect(() => {
    setCoaAccounts(getCOA().filter(a => a.type === 'detail'));
    loadVouchers();
    loadChequeBooks();
    loadPurchaseOrders();
  }, [activeTab]);

  const loadPurchaseOrders = () => {
    const importPOs = getPurchaseOrders();
    const localPurchases = (typeof window !== 'undefined' && window.Storage)
      ? (window.Storage.get('pttan_local_purchases') || []).filter(p => !p.paymentMode || p.paymentMode === 'credit' || String(p.poNumber || '').startsWith('PO-LOKAL'))
      : [];

    const unifiedList = [
      ...importPOs,
      ...localPurchases.map(lp => ({
        ...lp,
        id: lp.poNumber || lp.id,
        poNumber: lp.poNumber,
        supplierName: lp.supplierName,
        supplier: lp.supplierName,
        currency: lp.currency || 'IDR',
        exchangeRate: lp.exchangeRate || 1,
        total: lp.totalAmount,
        totalLandedCostIDR: lp.totalLandedCostIDR || lp.totalAmount,
        paidAmountIDR: Number(lp.paidAmountIDR || 0),
        remainingBalanceIDR: typeof lp.remainingBalanceIDR !== 'undefined' ? Number(lp.remainingBalanceIDR) : Math.max(0, Number(lp.totalAmount || 0) - Number(lp.paidAmountIDR || 0)),
        customsPaidAmountIDR: Number(lp.customsPaidAmountIDR || 0),
        logisticsPaidAmountIDR: Number(lp.logisticsPaidAmountIDR || 0),
        otherExpensesPaidAmountIDR: Number(lp.otherExpensesPaidAmountIDR || 0),
        paymentStatus: lp.paymentStatus || (Number(lp.paidAmountIDR || 0) >= Number(lp.totalAmount || 0) && Number(lp.totalAmount || 0) > 0 ? 'PAID' : Number(lp.paidAmountIDR || 0) > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
        paymentHistory: lp.paymentHistory || []
      }))
    ];
    setPurchaseOrders(unifiedList);
  };

  const loadChequeBooks = () => {
    if (typeof window !== 'undefined' && window.Storage) {
      const books = window.Storage.get('pttan_cheque_books') || [];
      setChequeBooks(books);
    }
  };

  const loadVouchers = () => {
    if (typeof window !== 'undefined' && window.Storage) {
      const pmt = window.Storage.get(window.Storage.KEYS.PAYMENT_VOUCHERS) || [
        {
          id: 'VOUCH-BBK-001',
          voucherNumber: 'BBK-2026-001',
          voucherType: 'BBK',
          type: 'BBK',
          date: new Date().toISOString().split('T')[0],
          selectedPONumber: 'PO-IMP-2026-001',
          paymentCategory: 'PO_PRINCIPAL',
          payee: 'YLG Bullion Singapore Pte Ltd',
          payer: 'PT TAN',
          bankAccountCode: '1111-USD',
          bankAccountName: 'Bank BCA Devisa USD',
          accountCode: '2111',
          amount: 21645000000,
          description: 'Pelunasan Pembayaran Impor 16,000 oz Gold Bullion YLG Singapore (Ref: PO-IMP-2026-001)',
          status: 'APPROVED & PAID',
          isCleared: true,
          createdAt: new Date().toISOString()
        }
      ];
      const rcp = window.Storage.get(window.Storage.KEYS.RECEIPT_VOUCHERS) || [];
      const all = [...pmt, ...rcp];

      const filtered = all.filter(v => {
        if (activeTab === 'BBK') return v.voucherType === 'BBK' || v.type === 'BBK';
        if (activeTab === 'BKK') return v.voucherType === 'BKK' || v.type === 'BKK';
        if (activeTab === 'BCK') return v.voucherType === 'BCK' || v.type === 'BCK' || v.paymentMethod === 'cheque';
        if (activeTab === 'BBM') return v.voucherType === 'BBM' || v.type === 'BBM';
        if (activeTab === 'BKM') return v.voucherType === 'BKM' || v.type === 'BKM';
        return true;
      });
      setVouchers(filtered);
    }
  };

  // Helper untuk menentukan konfigurasi default per kategori pengeluaran PO
  const getCategoryDefaults = (category, selectedPO) => {
    if (!selectedPO) {
      if (category === 'CUSTOMS_DUTY_PPH22') {
        return {
          paymentCategory: category,
          payeePayer: 'Kas Negara / DJBC (ID Billing PPh 22 Impor 0.25%)',
          bankAccountCode: '1111-IDR',
          accountCode: '1135',
          amount: 0,
          description: 'Pembayaran ID Billing DJBC - PPh 22 Impor (0,25%)'
        };
      }
      if (category === 'LOGISTICS_HANDLING') {
        return {
          paymentCategory: category,
          payeePayer: 'PT BRINKS Global Services / Vendor Kargo',
          bankAccountCode: '1111-IDR',
          accountCode: '5150',
          amount: 0,
          description: 'Pembayaran Biaya Freight & Handling Kargo'
        };
      }
      if (category === 'OTHER_EXPENSE') {
        return {
          paymentCategory: category,
          payeePayer: 'PT Sucofindo / Surveyor / Vendor Terkait',
          bankAccountCode: '1111-IDR',
          accountCode: '5150',
          amount: 0,
          description: 'Biaya Tambahan Operasional Pengadaan'
        };
      }
      return {
        paymentCategory: 'PO_PRINCIPAL',
        payeePayer: 'Supplier Emas Lokal / Vendor',
        bankAccountCode: '1111-IDR',
        accountCode: '2111',
        amount: 50000000,
        description: 'Pembayaran Pelunasan Tagihan PO Emas'
      };
    }

    const totalIDR = selectedPO.totalLandedCostIDR || ((selectedPO.totalAmountUSD || 0) * (selectedPO.exchangeRate || 16250)) || Number(selectedPO.total || 0);
    const paidIDR = Number(selectedPO.paidAmountIDR || 0);
    const remaining = Math.max(0, totalIDR - paidIDR);
    const pph22Est = Math.round(totalIDR * 0.0025); // 0,25% PPh 22

    if (category === 'CUSTOMS_DUTY_PPH22') {
      return {
        paymentCategory: category,
        payeePayer: 'Kas Negara / DJBC (ID Billing PPh 22 Impor 0.25%)',
        bankAccountCode: '1111-IDR', // Selalu IDR via MPN G2 / Bank Persepsi
        accountCode: '1135', // PPh 22 Dibayar Di Muka (Impor Emas)
        amount: pph22Est,
        description: `Pembayaran ID Billing DJBC - PPh 22 Impor (0,25%) Ref PO: ${selectedPO.poNumber || selectedPO.id} (${selectedPO.supplierName || selectedPO.supplier})`
      };
    } else if (category === 'LOGISTICS_HANDLING') {
      return {
        paymentCategory: category,
        payeePayer: selectedPO.logisticsCarrier || 'PT BRINKS Global Services / Vendor Kargo',
        bankAccountCode: '1111-IDR',
        accountCode: '5150', // Biaya Freight & Insurance Impor / Ekspor
        amount: 0,
        description: `Biaya Freight, Kargo & Handling Ekspedisi Ref PO: ${selectedPO.poNumber || selectedPO.id}`
      };
    } else if (category === 'OTHER_EXPENSE') {
      return {
        paymentCategory: category,
        payeePayer: 'PT Sucofindo / Surveyor / Vendor Terkait',
        bankAccountCode: '1111-IDR',
        accountCode: '5150',
        amount: 0,
        description: `Biaya Tambahan Pengadaan Ref PO: ${selectedPO.poNumber || selectedPO.id}`
      };
    } else {
      // PO_PRINCIPAL
      const defaultBank = selectedPO.currency === 'USD' ? '1111-USD' : selectedPO.currency === 'SGD' ? '1111-SGD' : '1111-IDR';
      return {
        paymentCategory: 'PO_PRINCIPAL',
        payeePayer: selectedPO.supplierName || selectedPO.supplier || 'Supplier Emas',
        bankAccountCode: defaultBank,
        accountCode: '2111', // Hutang Usaha Logam Mulia
        amount: remaining > 0 ? remaining : totalIDR,
        description: `Pembayaran Tagihan Pokok PO ${selectedPO.poNumber || selectedPO.id} - ${selectedPO.supplierName || selectedPO.supplier}${selectedPO.paymentTerms ? ` [Termin: ${selectedPO.paymentTerms}]` : ''}`
      };
    }
  };

  // Handler Saat User Memilih Nomor PO Pembelian (Auto-Pull Tagihan & Sisa Hutang)
  const handleSelectPO = (poNum) => {
    if (!poNum) {
      setForm(prev => ({
        ...prev,
        selectedPONumber: '',
        paymentCategory: 'PO_PRINCIPAL',
        poTotalAmountIDR: 0,
        poPaidAmountIDR: 0,
        poRemainingIDR: 0,
        ...getCategoryDefaults('PO_PRINCIPAL', null)
      }));
      return;
    }

    const selectedPO = purchaseOrders.find(p => (p.poNumber === poNum || p.id === poNum));
    if (selectedPO) {
      const totalIDR = selectedPO.totalLandedCostIDR || ((selectedPO.totalAmountUSD || 0) * (selectedPO.exchangeRate || 16250)) || Number(selectedPO.total || 0);
      const paidIDR = Number(selectedPO.paidAmountIDR || 0);
      const remaining = Math.max(0, totalIDR - paidIDR);
      const catDefaults = getCategoryDefaults(form.paymentCategory || 'PO_PRINCIPAL', selectedPO);

      setForm(prev => ({
        ...prev,
        selectedPONumber: selectedPO.poNumber || selectedPO.id,
        poTotalAmountIDR: totalIDR,
        poPaidAmountIDR: paidIDR,
        poRemainingIDR: remaining,
        ...catDefaults
      }));
    }
  };

  // Handler Saat User Mengganti Kategori Pembayaran (Pokok vs Pajak PPh 22 vs Logistik)
  const handleCategoryChange = (newCategory) => {
    const selectedPO = purchaseOrders.find(p => (p.poNumber === form.selectedPONumber || p.id === form.selectedPONumber));
    const defaults = getCategoryDefaults(newCategory, selectedPO);
    setForm(prev => ({
      ...prev,
      ...defaults
    }));
  };

  // Ambil buku cek aktif berdasarkan bank yang dipilih
  const currentChequeBook = chequeBooks.find(b => b.bankName === form.checkBankName) || chequeBooks[0];
  const availableChequeLeaves = (currentChequeBook?.leaves || []).filter(l => l.status === 'AVAILABLE');
  const maxChequeLimit = currentChequeBook?.maxLimitPerCheque || 500000000;

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    if (!form.payeePayer || !form.amount || Number(form.amount) <= 0) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Penerima / Penyetor dan Jumlah Nominal wajib diisi dengan benar (lebih dari 0).' });
      return;
    }

    // VALIDASI SISA TAGIHAN PO (GUARD RAIL OVERPAYMENT HANYA UNTUK POKOK SUPPLIER)
    if (form.selectedPONumber && form.paymentCategory === 'PO_PRINCIPAL' && form.poRemainingIDR > 0 && Number(form.amount) > form.poRemainingIDR) {
      showModal({
        variant: 'warning',
        title: '⚠️ Nominal Melebihi Sisa Tagihan',
        message: `Nominal cicilan pokok yang Anda input (Rp ${Number(form.amount).toLocaleString()}) melebihi sisa tagihan hutang PO ${form.selectedPONumber} (Sisa: Rp ${Number(form.poRemainingIDR).toLocaleString()}).\n\nSilakan sesuaikan nominal cicilan atau bayar pas sisa tagihan.`
      });
      return;
    }

    const isCheque = activeTab === 'BCK' || form.paymentMethod === 'cheque';
    const currentType = isCheque ? 'BCK' : activeTab;

    // VALIDASI LIMIT MAKSIMAL PER LEMBAR CEK (GUARD RAIL)
    if (isCheque) {
      if (!form.checkNumber) {
        showModal({ variant: 'warning', title: 'Nomor Cek Belum Dipilih', message: 'Pilih nomor lembar Cek / Bilyet Giro yang tersedia.' });
        return;
      }
      if (Number(form.amount) > maxChequeLimit) {
        showModal({
          variant: 'error',
          title: '❌ Transaksi Ditolak — Melebihi Limit Plafon Cek',
          message: `Nominal Rp ${Number(form.amount).toLocaleString()} melebihi batas limit per lembar buku cek ${form.checkBankName} (Maksimal Rp ${maxChequeLimit.toLocaleString()}).`
        });
        return;
      }
    }

    const categoryLabels = {
      'PO_PRINCIPAL': '💰 Pelunasan Pokok Supplier',
      'CUSTOMS_DUTY_PPH22': '🏛️ Pajak PPh 22 Impor (0,25%)',
      'LOGISTICS_HANDLING': '🚚 Logistik & Handling',
      'OTHER_EXPENSE': '📑 Biaya Tambahan'
    };

    const newVoucher = {
      id: Date.now(),
      voucherNumber: `${currentType}-${Date.now().toString().slice(-6)}`,
      voucherType: currentType,
      type: currentType,
      date: form.date,
      selectedPONumber: form.selectedPONumber,
      paymentCategory: form.paymentCategory || 'PO_PRINCIPAL',
      categoryLabel: categoryLabels[form.paymentCategory] || '💰 Pelunasan Pokok Supplier',
      payee: form.payeePayer,
      payer: form.payeePayer,
      bankAccountCode: form.bankAccountCode,
      paymentMethod: isCheque ? 'cheque' : 'transfer',
      checkNumber: isCheque ? form.checkNumber : '',
      checkBankName: isCheque ? form.checkBankName : '',
      checkDueDate: isCheque ? form.checkDueDate : '',
      accountCode: form.accountCode,
      amount: Number(form.amount),
      description: form.description,
      status: isCheque ? 'BEREDAR (OUTSTANDING)' : 'APPROVED & PAID',
      isCleared: !isCheque,
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      const key = currentType.startsWith('B') && (currentType.includes('K') || currentType === 'BCK')
        ? window.Storage.KEYS.PAYMENT_VOUCHERS 
        : window.Storage.KEYS.RECEIPT_VOUCHERS;
      
      const list = window.Storage.get(key) || [];
      list.unshift(newVoucher);
      await window.Storage.set(key, list);

      // JURNAL SAK EMKM OTOMATIS:
      const isReceipt = currentType === 'BBM' || currentType === 'BKM';
      const bankGl = isCheque ? '2115' : form.bankAccountCode;
      const bankName = isCheque 
        ? 'Hutang Cek / Bilyet Giro Beredar' 
        : form.bankAccountCode === '1111-USD'
        ? 'Bank BCA Devisa USD'
        : form.bankAccountCode === '1111-SGD'
        ? 'Bank BCA Devisa SGD'
        : form.bankAccountCode === '1110'
        ? 'Kas Kecil (Petty Cash)'
        : 'Bank BCA IDR Operasional';

      const lawanAccountName = coaAccounts.find(a => a.code === form.accountCode)?.name || (
        form.accountCode === '1135' ? 'PPh 22 Dibayar Di Muka (Impor Emas)' :
        form.accountCode === '5150' ? 'Biaya Freight & Insurance Impor / Ekspor' :
        form.accountCode === '1159' ? 'Persediaan Emas Transit' :
        isReceipt ? 'Piutang Usaha' : 'Hutang Usaha'
      );

      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-${currentType}-${Date.now().toString().slice(-6)}`,
        date: form.date,
        description: isCheque
          ? `Penerbitan Cek/Bilyet Giro (${newVoucher.checkNumber}) - ${newVoucher.payee} [${newVoucher.categoryLabel}] [Ref: ${newVoucher.selectedPONumber || 'Non-PO'}]`
          : isReceipt
          ? `Penerimaan Kas/Bank Voucher ${currentType} (${newVoucher.voucherNumber}) dari ${newVoucher.payer} [Ref: ${newVoucher.selectedPONumber || 'Non-PO'}]`
          : `Pembayaran Voucher ${currentType} (${newVoucher.voucherNumber}) - ${newVoucher.payee} [${newVoucher.categoryLabel}] [Ref: ${newVoucher.selectedPONumber || 'Non-PO'}]`,
        lines: isReceipt
          ? [
              { accountCode: bankGl, accountName: bankName, debit: Number(form.amount), credit: 0 },
              { accountCode: form.accountCode, accountName: lawanAccountName, debit: 0, credit: Number(form.amount) }
            ]
          : [
              { accountCode: form.accountCode, accountName: lawanAccountName, debit: Number(form.amount), credit: 0 },
              { accountCode: bankGl, accountName: bankName, debit: 0, credit: Number(form.amount) }
            ],
        createdAt: new Date().toISOString()
      });
      await window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      // UPDATE REKONSILIASI CICILAN / SISA HUTANG PADA PURCHASE ORDER TERKAIT
      if (form.selectedPONumber) {
        await recordPOPayment(form.selectedPONumber, {
          id: newVoucher.id,
          voucherNo: newVoucher.voucherNumber,
          voucherType: currentType,
          category: form.paymentCategory || 'PO_PRINCIPAL',
          categoryLabel: newVoucher.categoryLabel,
          date: form.date,
          amount: Number(form.amount),
          payee: form.payeePayer,
          bank: isCheque ? `Cek/BG: ${newVoucher.checkNumber}` : bankName,
          bankAccountCode: bankGl,
          accountCode: form.accountCode,
          description: form.description
        });
        loadPurchaseOrders();
      }

      // KUNCI STATUS LEMBAR CEK MENJADI 'USED' DI MASTER BUKU CEK
      if (isCheque) {
        const books = window.Storage.get('pttan_cheque_books') || [];
        const updatedBooks = books.map(b => {
          if (b.bankName === form.checkBankName) {
            return {
              ...b,
              leaves: (b.leaves || []).map(l => l.checkNumber === form.checkNumber ? {
                ...l,
                status: 'USED',
                voucherNo: newVoucher.voucherNumber,
                payee: newVoucher.payee,
                amount: newVoucher.amount,
                dueDate: newVoucher.checkDueDate,
                isCleared: false
              } : l)
            };
          }
          return b;
        });
        window.Storage.set('pttan_cheque_books', updatedBooks);
        setChequeBooks(updatedBooks);
      }

      showModal({
        variant: 'success',
        title: `Voucher ${currentType} Diterbitkan!`,
        message: `Voucher (${newVoucher.voucherNumber}) [${newVoucher.categoryLabel}] berhasil disimpan dan diposting ke Buku Besar!\n${newVoucher.selectedPONumber ? `• Tagihan PO: ${newVoucher.selectedPONumber} berhasil dikaitkan.\n` : ''}${isCheque ? `• No. Cek/BG Terkunci: ${newVoucher.checkNumber}\n• Status: BEREDAR (Akun 2115)` : `• Sumber Kas/Bank: ${bankName} (${bankGl})`}`
      });

      loadVouchers();
      setShowForm(false);
    }
  };

  // Handler Pencairan / Kliring Cek di Bank
  const handleClearCheque = (voucher) => {
    if (voucher.isCleared) {
      showModal({ variant: 'info', title: 'Sudah Cair', message: 'Cek / Bilyet Giro ini sudah dicairkan sebelumnya.' });
      return;
    }

    showModal({
      variant: 'confirm',
      title: `Kliring & Pencairan Cek/BG (${voucher.checkNumber})`,
      message: `Nominal: Rp ${voucher.amount.toLocaleString()}\nSaldo Bank BCA IDR (Akun 1111) akan resmi terpotong.`,
      confirmLabel: 'Ya, Cairkan',
      onConfirm: () => postChequeClearing(voucher)
    });
  };

  const postChequeClearing = (voucher) => {
    if (typeof window !== 'undefined' && window.Storage) {
      // 1. Update Voucher Status
      const pmt = window.Storage.get(window.Storage.KEYS.PAYMENT_VOUCHERS) || [];
      const updated = pmt.map(v => {
        if (v.id === voucher.id || v.voucherNumber === voucher.voucherNumber) {
          return {
            ...v,
            status: 'CLEARED (SUDAH CAIR)',
            isCleared: true,
            clearedDate: new Date().toISOString().split('T')[0]
          };
        }
        return v;
      });
      window.Storage.set(window.Storage.KEYS.PAYMENT_VOUCHERS, updated);

      // 2. Post Jurnal Pencairan Bank (Debet 2115 Hutang BG vs Kredit 1111 Bank BCA)
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-CLR-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        description: `Kliring & Pencairan Cek/Bilyet Giro (${voucher.checkNumber}) - ${voucher.payee} [Bank BCA Resmi Terpotong]`,
        lines: [
          { accountCode: '2115', accountName: 'Hutang Cek / Bilyet Giro Beredar', debit: voucher.amount, credit: 0 },
          { accountCode: '1111-IDR', accountName: 'Bank BCA IDR Operasional', debit: 0, credit: voucher.amount }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      // 3. Update Master Cheque Leaf Status to isCleared = true
      const books = window.Storage.get('pttan_cheque_books') || [];
      const updatedBooks = books.map(b => ({
        ...b,
        leaves: (b.leaves || []).map(l => l.checkNumber === voucher.checkNumber ? { ...l, isCleared: true } : l)
      }));
      window.Storage.set('pttan_cheque_books', updatedBooks);
      setChequeBooks(updatedBooks);

      showModal({
        variant: 'success',
        title: 'Cek Sukses Dicairkan!',
        message: `Cek/BG (${voucher.checkNumber}) sukses dikliringkan di Bank BCA!\n• Saldo Bank Terpotong: Rp ${voucher.amount.toLocaleString()}\n• Akun Cek Gantung (2115) Ditutup Nol.`
      });
      loadVouchers();
    }
  };

  const getTabLabel = (tab) => {
    switch (tab) {
      case 'BBK': return '🔵 BBK (Transfer Bank Keluar)';
      case 'BCK': return '🟡 BCK (Cek / Bilyet Giro Keluar)';
      case 'BKK': return '🔴 BKK (Kas Tunai Keluar)';
      case 'BBM': return '🟣 BBM (Bank Masuk)';
      case 'BKM': return '🟢 BKM (Kas Masuk)';
      default: return tab;
    }
  };

  // Filter Vouchers berdasarkan Search Term
  const filteredVouchers = vouchers.filter(v => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (v.voucherNumber && v.voucherNumber.toLowerCase().includes(term)) ||
      (v.selectedPONumber && v.selectedPONumber.toLowerCase().includes(term)) ||
      (v.payee && v.payee.toLowerCase().includes(term)) ||
      (v.payer && v.payer.toLowerCase().includes(term)) ||
      (v.description && v.description.toLowerCase().includes(term)) ||
      (v.categoryLabel && v.categoryLabel.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      {/* Header & Controls */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <CreditCard color="#f59e0b" size={24} /> Manajemen Pembayaran Kas, Bank, & Cek / Bilyet Giro (BG)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Penerbitan Multi-Voucher per PO (Pokok Supplier, Bea Cukai PPh 22 0,25%, Logistik & Handling) & Auto-Jurnal SAK EMKM
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Terbitkan Voucher {activeTab} Baru
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {['BBK', 'BCK', 'BKK', 'BBM', 'BKM'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setForm({ ...form, voucherType: tab, paymentMethod: tab === 'BCK' ? 'cheque' : 'transfer' }); }}
              className={`cursor-pointer rounded-[10px] border border-line px-4.5 py-2.5 text-[0.85rem] ${
                activeTab === tab
                  ? 'bg-linear-135 from-gold to-gold-dark font-bold text-white'
                  : 'bg-[rgba(15,23,42,0.6)] font-medium text-fg-soft'
              }`}
            >
              {getTabLabel(tab)}
            </button>
          ))}
        </div>

        {/* Create Voucher Form */}
        {showForm && (
          <form className="bg-[rgba(15,23,42,0.7)] p-5 rounded-[12px] mt-5 border border-gold" onSubmit={handleCreateVoucher}>
            <h4 className="text-gold-light mb-3.5 text-[0.95rem] flex items-center gap-2">
              <FileText size={18} /> Form Terbitkan Voucher {activeTab} {activeTab === 'BCK' ? '(Cek / Bilyet Giro)' : ''}
            </h4>

            <div className="form-grid">
              {/* DROPDOWN PILIH REFERENSI NO. PO PEMBELIAN */}
              <div className="form-group col-span-2 bg-[rgba(56,189,248,0.1)] p-3.5 rounded-lg border border-sky-light">
                <label className="form-label text-sky-light font-bold flex items-center gap-1.5 mb-1.5">
                  <FileText size={16} /> Hubungkan Pembayaran ke Nomor Purchase Order (PO):
                </label>
                <Combobox className="border border-sky-light text-sky-light font-bold text-[0.95rem]"
                  value={form.selectedPONumber}
                  onChange={handleSelectPO}
                  searchPlaceholder="Cari nomor PO atau nama supplier…"
                  emptyText="Nomor PO tidak ditemukan."
                  options={[
                    { value: '', label: '-- Tanpa PO (Pembayaran Operasional / Non-PO) --' },
                    ...purchaseOrders.map(po => ({
                      value: po.poNumber || po.id,
                      label: `${po.poNumber} — ${po.supplierName || po.supplier} (Total: ${po.currency || 'IDR'} ${(po.totalAmountUSD || po.total || 0).toLocaleString()} | Status: ${po.paymentStatus || 'UNPAID'})`
                    }))
                  ]}
                />

                {form.selectedPONumber && (
                  <>
                    {/* Ringkasan Nilai PO */}
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5 mt-3 bg-[rgba(15,23,42,0.8)] p-2.5 rounded-[6px] border border-line">
                      <div>
                        <span className="stat-lbl">Total Nilai PO</span>
                        <div className="font-bold text-fg">Rp {form.poTotalAmountIDR.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="stat-lbl">Pokok Sudah Dibayar</span>
                        <div className="font-bold text-emerald-light">Rp {form.poPaidAmountIDR.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="stat-lbl">Sisa Hutang Pokok Supplier</span>
                        <div className="font-extrabold text-gold-light">Rp {form.poRemainingIDR.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* SELECTOR KATEGORI PENGELUARAN / ALOKASI BIAYA */}
                    <div className="mt-3.5 pt-3 border-t border-sky-light/30">
                      <label className="form-label text-sky-light font-bold flex items-center gap-1.5 mb-2">
                        <Layers size={15} /> Pilih Kategori / Tujuan Pengeluaran untuk PO ini:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => handleCategoryChange('PO_PRINCIPAL')}
                          className={`p-2.5 text-left rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            form.paymentCategory === 'PO_PRINCIPAL'
                              ? 'bg-gold/20 border-gold text-gold-light shadow-md'
                              : 'bg-canvas/60 border-line text-fg-soft hover:border-gold/50'
                          }`}
                        >
                          <div className="font-bold text-[0.85rem] mb-0.5">💰 Pokok Supplier</div>
                          <div className="text-[0.7rem] text-fg-muted">Hutang Usaha (Akun 2111)</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCategoryChange('CUSTOMS_DUTY_PPH22')}
                          className={`p-2.5 text-left rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            form.paymentCategory === 'CUSTOMS_DUTY_PPH22'
                              ? 'bg-sky/20 border-sky text-sky-light shadow-md'
                              : 'bg-canvas/60 border-line text-fg-soft hover:border-sky/50'
                          }`}
                        >
                          <div className="font-bold text-[0.85rem] mb-0.5">🏛️ Bea Cukai / PPh 22 (0,25%)</div>
                          <div className="text-[0.7rem] text-fg-muted">Uang Muka Pajak (Akun 1135)</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCategoryChange('LOGISTICS_HANDLING')}
                          className={`p-2.5 text-left rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            form.paymentCategory === 'LOGISTICS_HANDLING'
                              ? 'bg-emerald/20 border-emerald text-emerald-light shadow-md'
                              : 'bg-canvas/60 border-line text-fg-soft hover:border-emerald/50'
                          }`}
                        >
                          <div className="font-bold text-[0.85rem] mb-0.5">🚚 Logistik & Kargo</div>
                          <div className="text-[0.7rem] text-fg-muted">Freight & Handling (Akun 5150)</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCategoryChange('OTHER_EXPENSE')}
                          className={`p-2.5 text-left rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            form.paymentCategory === 'OTHER_EXPENSE'
                              ? 'bg-purple-500/20 border-purple-400 text-purple-300 shadow-md'
                              : 'bg-canvas/60 border-line text-fg-soft hover:border-purple-400/50'
                          }`}
                        >
                          <div className="font-bold text-[0.85rem] mb-0.5">📑 Biaya Tambahan</div>
                          <div className="text-[0.7rem] text-fg-muted">Surveyor / Lab / Lainnya</div>
                        </button>
                      </div>

                      {/* Notifikasi Informative Akuntansi untuk Bea Cukai */}
                      {form.paymentCategory === 'CUSTOMS_DUTY_PPH22' && (
                        <div className="mt-2.5 p-2.5 bg-sky-950/40 border border-sky-600/40 rounded text-xs text-sky-200 flex items-start gap-2">
                          <AlertCircle size={16} className="text-sky-400 shrink-0 mt-0.5" />
                          <div>
                            <strong>Pemisahan Rekening & Pajak (SAK EMKM):</strong> Pembayaran PPh 22 Impor (0,25%) ditransfer ke Kas Negara / DJBC (via ID Billing MPN G2) dan didebet ke <strong>Akun 1135 (PPh 22 Dibayar Di Muka - Aset Lancar / Creditable)</strong>. Nominal ini tercatat terkait ke PO ini tanpa memotong sisa hutang komersial supplier.
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Terbit Voucher</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Penerima Pembayaran (Payee / Rekening Tujuan)</label>
                <input
                  className="form-input font-bold text-gold-light"
                  value={form.payeePayer}
                  onChange={e => setForm({ ...form, payeePayer: e.target.value })}
                />
              </div>

              {/* SUMBER REKENING BANK */}
              {activeTab !== 'BKK' && activeTab !== 'BKM' && (
                <div className="form-group">
                  <label className="form-label text-sky-light font-bold">Rekening Bank Pembayar (Kredit)</label>
                  <select
                    className="form-select"
                    value={form.bankAccountCode}
                    onChange={e => setForm({ ...form, bankAccountCode: e.target.value })}
                  >
                    <option value="1111-IDR">Bank BCA IDR Operasional (1111-IDR)</option>
                    <option value="1111-USD">Bank BCA Devisa USD (1111-USD)</option>
                    <option value="1111-SGD">Bank BCA Devisa SGD (1111-SGD)</option>
                    <option value="1110">Kas Kecil / Tunai (1110)</option>
                  </select>
                </div>
              )}

              {/* KHUSUS CEK / BILYET GIRO */}
              {activeTab === 'BCK' && (
                <>
                  <div className="form-group">
                    <label className="form-label text-sky-light font-bold">Bank Penerbit Buku Cek</label>
                    <Combobox className="border border-sky-light text-sky-light font-bold"
                      value={form.checkBankName}
                      onChange={bankName => setForm({ ...form, checkBankName: bankName, checkNumber: '' })}
                      placeholder="-- Pilih Bank Penerbit --"
                      searchPlaceholder="Cari nama bank atau nomor buku…"
                      emptyText="Buku cek tidak ditemukan."
                      options={chequeBooks.map(b => ({
                        value: b.bankName,
                        label: `${b.bankName} (Buku: ${b.bookNumber} | Limit: Rp ${Number(b.maxLimitPerCheque).toLocaleString()})`
                      }))}
                    />
                  </div>

                  <div className="form-group bg-[rgba(245,158,11,0.1)] p-2.5 rounded-sm border border-gold">
                    <div className="flex justify-between items-center">
                      <label className="form-label text-gold-light font-bold">Pilih Lembar Cek/BG yang Tersedia</label>
                      <span className="badge badge-emerald text-[0.7rem]">
                        {availableChequeLeaves.length} Lembar Siap Pakai
                      </span>
                    </div>
                    <Combobox className="border border-gold text-gold-light font-bold"
                      value={form.checkNumber}
                      onChange={checkNumber => setForm({ ...form, checkNumber })}
                      placeholder="-- Pilih Lembar Cek Siap Pakai --"
                      searchPlaceholder="Cari nomor lembar cek…"
                      emptyText="Tidak ada lembar cek yang cocok."
                      options={availableChequeLeaves.map(l => ({
                        value: l.checkNumber,
                        label: `${l.checkNumber} (Status: TERSEDIA)`
                      }))}
                    />
                  </div>

                  <div className="form-group bg-[rgba(56,189,248,0.1)] p-2.5 rounded-sm border border-sky-light">
                    <label className="form-label text-sky-light font-bold">Tanggal Jatuh Tempo Kliring (Due Date)</label>
                    <input
                      type="date"
                      className="form-input border border-sky-light text-sky-light font-bold"
                      value={form.checkDueDate}
                      onChange={e => setForm({ ...form, checkDueDate: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Alokasi Akun COA (Lawan Debet)</label>
                <Combobox
                  value={form.accountCode}
                  onChange={accountCode => setForm({ ...form, accountCode })}
                  placeholder="-- Pilih Akun COA --"
                  searchPlaceholder="Cari kode atau nama akun…"
                  emptyText="Akun tidak ditemukan di COA."
                  options={coaAccounts.map(a => ({ value: a.code, label: `${a.code} - ${a.name}` }))}
                />
              </div>

              <div className="form-group">
                <div className="flex justify-between items-center">
                  <label className="form-label">Nominal Bayar / Transfer (IDR)</label>
                  {activeTab === 'BCK' && (
                    <span className="text-xs text-sky-light font-bold">
                      <Lock className="inline mr-1" size={12} />
                      Maks: Rp {maxChequeLimit.toLocaleString()}
                    </span>
                  )}
                </div>
                <NumberInput
                  className={`text-[1.1rem] font-extrabold ${
                    Number(form.amount) > maxChequeLimit && activeTab === 'BCK'
                      ? 'border-2 border-danger text-danger'
                      : 'border border-emerald text-emerald-light'
                  }`}
                  value={form.amount}
                  onChange={amount => setForm({ ...form, amount })}
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">Keterangan Pembayaran</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary mt-3">
              <CheckCircle size={16} /> Terbitkan Voucher {activeTab} & Posting Jurnal
            </button>
          </form>
        )}
      </div>

      {/* Voucher Table */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
          <h3 className="font-heading text-[1.1rem]">
            📋 Daftar Voucher {getTabLabel(activeTab)} ({filteredVouchers.length})
          </h3>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="🔍 Cari No. Voucher, Ref PO, Penerima…"
              className="form-input text-xs py-1.5 px-3"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. Voucher</th>
                <th>Tanggal</th>
                <th>Ref No. PO & Kategori</th>
                <th>Penerima Pembayaran</th>
                {activeTab === 'BCK' && <th>No. Cek / Bank</th>}
                {activeTab === 'BCK' && <th>Jatuh Tempo Kliring</th>}
                <th>Rekening / COA</th>
                <th className="text-right">Nominal (IDR)</th>
                <th>Status Pembayaran</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td className="text-center text-fg-muted p-7.5" colSpan={activeTab === 'BCK' ? 10 : 8}>
                    {searchTerm ? 'Tidak ada data voucher yang cocok dengan pencarian.' : `Belum ada data voucher ${activeTab} yang diterbitkan.`}
                  </td>
                </tr>
              ) : (
                filteredVouchers.map(v => (
                  <tr key={v.id || v.voucherNumber}>
                    <td><strong>{v.voucherNumber}</strong></td>
                    <td>{v.date}</td>
                    <td>
                      {v.selectedPONumber ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="badge badge-gold text-xs">
                            <FileText className="inline mr-1" size={11} />
                            {v.selectedPONumber}
                          </span>
                          <span className="badge text-[0.68rem] bg-sky-950/60 text-sky-300 border border-sky-700/50">
                            {v.categoryLabel || (v.paymentCategory === 'CUSTOMS_DUTY_PPH22' ? '🏛️ PPh 22 (0,25%)' : v.paymentCategory === 'LOGISTICS_HANDLING' ? '🚚 Logistik' : '💰 Pokok Supplier')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-fg-muted text-[0.8rem]">Non-PO</span>
                      )}
                    </td>
                    <td><strong>{v.payee || v.payer || '-'}</strong></td>
                    {activeTab === 'BCK' && (
                      <td>
                        <strong className="text-gold-light">{v.checkNumber || 'BG-BCA-001'}</strong><br/>
                        <small className="text-fg-muted">{v.checkBankName || 'Bank BCA'}</small>
                      </td>
                    )}
                    {activeTab === 'BCK' && (
                      <td>
                        <span className="badge badge-gold text-xs">
                          <Clock className="inline mr-1" size={12} />
                          {v.checkDueDate || v.date}
                        </span>
                      </td>
                    )}
                    <td>
                      <small className="text-sky-light">
                        {v.bankAccountCode || v.accountCode}
                      </small>
                    </td>
                    <td className="text-right font-extrabold text-emerald-light">
                      Rp {(v.amount || 0).toLocaleString()}
                    </td>
                    <td>
                      {v.isCleared ? (
                        <span className="badge badge-emerald">✅ CAIR / LUNAS</span>
                      ) : (
                        <span className="badge badge-gold bg-[rgba(245,158,11,0.2)] border border-gold">
                          ⏳ BEREDAR (OUTSTANDING)
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        {activeTab === 'BCK' && !v.isCleared && (
                          <button
                            className="btn-primary py-1.5 px-2.5 text-xs bg-[linear-gradient(135deg,_#10b981,_#059669)]"
                            onClick={() => handleClearCheque(v)}
                          >
                            <CheckSquare size={13} /> Kliringkan Cair
                          </button>
                        )}
                        <button
                          className="btn-primary py-1.5 px-2.5 text-xs"
                          onClick={() => showModal({
                            variant: 'info',
                            title: `🖨️ Cetak PDF Voucher ${v.voucherNumber}`,
                            message: `• Ref PO: ${v.selectedPONumber || 'Non-PO'}\n• Kategori: ${v.categoryLabel || 'Pembayaran'}\n• Untuk: ${v.payee}\n• Nominal: Rp ${(v.amount || 0).toLocaleString()}`
                          })}
                        >
                          <Printer size={13} /> Cetak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal {...modalProps} />
    </div>
  );
}
