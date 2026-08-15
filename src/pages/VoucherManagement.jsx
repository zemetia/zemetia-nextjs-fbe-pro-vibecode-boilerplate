import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Printer, CheckCircle, FileSpreadsheet, Filter, CheckSquare, Clock, AlertCircle, Building2, Layers, Lock, ShieldAlert, FileText, DollarSign, Calculator } from 'lucide-react';
import { getCOA, getPurchaseOrders } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';

export default function VoucherManagement() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('BBK'); // BBK, BKK, BCK (Bukti Cek Keluar), BKM, BBM
  const [vouchers, setVouchers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [chequeBooks, setChequeBooks] = useState([]);

  const [form, setForm] = useState({
    voucherType: 'BBK',
    voucherNo: '',
    date: new Date().toISOString().split('T')[0],
    selectedPONumber: '', // Ref No. PO
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
    const list = getPurchaseOrders();
    setPurchaseOrders(list);
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

  // Handler Saat User Memilih Nomor PO Pembelian (Auto-Pull Tagihan & Sisa Hutang)
  const handleSelectPO = (e) => {
    const poNum = e.target.value;
    if (!poNum) {
      setForm(prev => ({
        ...prev,
        selectedPONumber: '',
        poTotalAmountIDR: 0,
        poPaidAmountIDR: 0,
        poRemainingIDR: 0
      }));
      return;
    }

    const selectedPO = purchaseOrders.find(p => (p.poNumber === poNum || p.id === poNum));
    if (selectedPO) {
      const totalIDR = selectedPO.totalLandedCostIDR || ((selectedPO.totalAmountUSD || 0) * (selectedPO.exchangeRate || 16250)) || Number(selectedPO.total || 0);
      const paidIDR = Number(selectedPO.paidAmountIDR || 0);
      const remaining = Math.max(0, totalIDR - paidIDR);

      // Tentukan default bank rekening bayar (USD jika impor, IDR jika lokal)
      const defaultBank = selectedPO.currency === 'USD' ? '1111-USD' : selectedPO.currency === 'SGD' ? '1111-SGD' : '1111-IDR';

      setForm(prev => ({
        ...prev,
        selectedPONumber: selectedPO.poNumber || selectedPO.id,
        payeePayer: selectedPO.supplierName || selectedPO.supplier || 'Supplier Emas',
        bankAccountCode: defaultBank,
        accountCode: '2111', // Hutang Usaha Dagang
        poTotalAmountIDR: totalIDR,
        poPaidAmountIDR: paidIDR,
        poRemainingIDR: remaining,
        amount: remaining > 0 ? remaining : totalIDR,
        description: `Pembayaran Tagihan PO ${selectedPO.poNumber || selectedPO.id} - ${selectedPO.supplierName || selectedPO.supplier}`
      }));
    }
  };

  // Ambil buku cek aktif berdasarkan bank yang dipilih
  const currentChequeBook = chequeBooks.find(b => b.bankName === form.checkBankName) || chequeBooks[0];
  const availableChequeLeaves = (currentChequeBook?.leaves || []).filter(l => l.status === 'AVAILABLE');
  const maxChequeLimit = currentChequeBook?.maxLimitPerCheque || 500000000;

  const handleCreateVoucher = (e) => {
    e.preventDefault();
    if (!form.payeePayer || !form.amount) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Penerima / Penyetor dan Jumlah Nominal wajib diisi.' });
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
          variant: 'danger',
          title: 'Melebihi Limit Plafon Cek',
          message: `Nominal Rp ${Number(form.amount).toLocaleString()} melebihi batas limit per lembar buku cek ${form.checkBankName} (Maksimal Rp ${maxChequeLimit.toLocaleString()}).`
        });
        return;
      }
    }

    const newVoucher = {
      id: Date.now(),
      voucherNumber: `${currentType}-${Date.now().toString().slice(-6)}`,
      voucherType: currentType,
      type: currentType,
      date: form.date,
      selectedPONumber: form.selectedPONumber,
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
      window.Storage.set(key, list);

      // JURNAL SAK EMKM OTOMATIS:
      const creditBankGl = isCheque ? '2115' : form.bankAccountCode;
      const creditBankName = isCheque 
        ? 'Hutang Cek / Bilyet Giro Beredar' 
        : form.bankAccountCode === '1111-USD'
        ? 'Bank BCA Devisa USD'
        : form.bankAccountCode === '1111-SGD'
        ? 'Bank BCA Devisa SGD'
        : 'Bank BCA IDR Operasional';

      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-${currentType}-${Date.now().toString().slice(-6)}`,
        date: form.date,
        description: isCheque
          ? `Penerbitan Cek/Bilyet Giro (${newVoucher.checkNumber}) - ${newVoucher.payee} [Ref: ${newVoucher.selectedPONumber || 'Non-PO'}]`
          : `Pembayaran Voucher ${currentType} (${newVoucher.voucherNumber}) - ${newVoucher.payee} [Ref: ${newVoucher.selectedPONumber || 'Non-PO'}]`,
        lines: [
          { accountCode: form.accountCode, accountName: coaAccounts.find(a => a.code === form.accountCode)?.name || 'Hutang Usaha', debit: Number(form.amount), credit: 0 },
          { accountCode: creditBankGl, accountName: creditBankName, debit: 0, credit: Number(form.amount) }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      // UPDATE REKONSILIASI CICILAN / SISA HUTANG PADA PURCHASE ORDER TERKAIT
      if (form.selectedPONumber) {
        const storedPOs = window.Storage.get('erp_purchase_orders') || [];
        const updatedPOs = storedPOs.map(po => {
          if (po.poNumber === form.selectedPONumber || po.id === form.selectedPONumber) {
            const currentPaid = Number(po.paidAmountIDR || 0) + Number(form.amount);
            const totalCost = Number(po.totalLandedCostIDR || po.total || 0);
            const newRemaining = Math.max(0, totalCost - currentPaid);
            const isFullyPaid = newRemaining === 0;

            return {
              ...po,
              paidAmountIDR: currentPaid,
              remainingBalanceIDR: newRemaining,
              paymentStatus: isFullyPaid ? 'PAID (LUNAS)' : 'PARTIALLY_PAID (MENYICIL)',
              lastPaymentVoucher: newVoucher.voucherNumber,
              lastPaymentDate: form.date
            };
          }
          return po;
        });
        window.Storage.set('erp_purchase_orders', updatedPOs);
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
        message: `Voucher (${newVoucher.voucherNumber}) berhasil disimpan dan diposting ke Buku Besar!\n${newVoucher.selectedPONumber ? `• Tagihan PO: ${newVoucher.selectedPONumber} berhasil direkonsiliasi.\n` : ''}${isCheque ? `• No. Cek/BG Terkunci: ${newVoucher.checkNumber}\n• Status: BEREDAR (Akun 2115)` : `• Sumber Bank: ${creditBankName}`}`
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

    if (!confirm(`Konfirmasi Kliring & Pencairan Cek/BG (${voucher.checkNumber}) senilai Rp ${voucher.amount.toLocaleString()}?\nSaldo Bank BCA IDR (Akun 1111) akan resmi terpotong.`)) {
      return;
    }

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

  return (
    <div>
      {/* Header & Controls */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CreditCard color="#f59e0b" size={24} /> Manajemen Pembayaran Kas, Bank, & Cek / Bilyet Giro (BG)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Penerbitan Voucher BBK/BCK Terhubung No. PO Pembelian, Validasi Sisa Tagihan, & Auto-Jurnal SAK EMKM
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Terbitkan Voucher {activeTab} Baru
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['BBK', 'BCK', 'BKK', 'BBM', 'BKM'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setForm({ ...form, voucherType: tab, paymentMethod: tab === 'BCK' ? 'cheque' : 'transfer' }); }}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: activeTab === tab ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(15,23,42,0.6)',
                color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                fontWeight: activeTab === tab ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {getTabLabel(tab)}
            </button>
          ))}
        </div>

        {/* Create Voucher Form */}
        {showForm && (
          <form onSubmit={handleCreateVoucher} style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '20px', borderRadius: '12px', marginTop: '20px', border: '1px solid var(--accent-gold)' }}>
            <h4 style={{ color: '#fbbf24', marginBottom: '14px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} /> Form Terbitkan Voucher {activeTab} {activeTab === 'BCK' ? '(Cek / Bilyet Giro)' : ''}
            </h4>

            <div className="form-grid">
              {/* DROPDOWN PILIH REFERENSI NO. PO PEMBELIAN */}
              <div className="form-group" style={{ gridColumn: 'span 2', background: 'rgba(56,189,248,0.1)', padding: '12px', borderRadius: '8px', border: '1px solid #38bdf8' }}>
                <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} /> Hubungkan Pembayaran ke Nomor Purchase Order (PO):
                </label>
                <select
                  className="form-select"
                  style={{ border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem' }}
                  value={form.selectedPONumber}
                  onChange={handleSelectPO}
                >
                  <option value="">-- Tanpa PO (Pembayaran Operasional / Non-PO) --</option>
                  {purchaseOrders.map(po => (
                    <option key={po.id || po.poNumber} value={po.poNumber || po.id}>
                      {po.poNumber} — {po.supplierName || po.supplier} (Total: {po.currency || 'IDR'} {(po.totalAmountUSD || po.total || 0).toLocaleString()} | Status: {po.paymentStatus || 'UNPAID'})
                    </option>
                  ))}
                </select>

                {form.selectedPONumber && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '10px', background: 'rgba(15,23,42,0.8)', padding: '10px', borderRadius: '6px' }}>
                    <div>
                      <span className="stat-lbl">Total Nilai PO</span>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>Rp {form.poTotalAmountIDR.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="stat-lbl">Sudah Dibayar</span>
                      <div style={{ fontWeight: 700, color: '#34d399' }}>Rp {form.poPaidAmountIDR.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="stat-lbl">Sisa Hutang Tagihan</span>
                      <div style={{ fontWeight: 800, color: '#fbbf24' }}>Rp {form.poRemainingIDR.toLocaleString()}</div>
                    </div>
                  </div>
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
                <label className="form-label">Penerima Pembayaran (Payee / Supplier)</label>
                <input
                  className="form-input"
                  style={{ fontWeight: 700, color: '#fbbf24' }}
                  value={form.payeePayer}
                  onChange={e => setForm({ ...form, payeePayer: e.target.value })}
                />
              </div>

              {/* SUMBER REKENING BANK */}
              {activeTab !== 'BKK' && activeTab !== 'BKM' && (
                <div className="form-group">
                  <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700 }}>Rekening Bank Pembayar</label>
                  <select
                    className="form-select"
                    value={form.bankAccountCode}
                    onChange={e => setForm({ ...form, bankAccountCode: e.target.value })}
                  >
                    <option value="1111-IDR">Bank BCA IDR Operasional (1111-IDR)</option>
                    <option value="1111-USD">Bank BCA Devisa USD (1111-USD)</option>
                    <option value="1111-SGD">Bank BCA Devisa SGD (1111-SGD)</option>
                  </select>
                </div>
              )}

              {/* KHUSUS CEK / BILYET GIRO */}
              {activeTab === 'BCK' && (
                <>
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700 }}>Bank Penerbit Buku Cek</label>
                    <select
                      className="form-select"
                      style={{ border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 700 }}
                      value={form.checkBankName}
                      onChange={e => setForm({ ...form, checkBankName: e.target.value, checkNumber: '' })}
                    >
                      {chequeBooks.map(b => (
                        <option key={b.id || b.bookNumber} value={b.bankName}>
                          {b.bankName} (Buku: {b.bookNumber} | Limit: Rp {Number(b.maxLimitPerCheque).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ background: 'rgba(245,158,11,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ color: '#fbbf24', fontWeight: 700 }}>Pilih Lembar Cek/BG yang Tersedia</label>
                      <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                        {availableChequeLeaves.length} Lembar Siap Pakai
                      </span>
                    </div>
                    <select
                      className="form-select"
                      style={{ border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: 700 }}
                      value={form.checkNumber}
                      onChange={e => setForm({ ...form, checkNumber: e.target.value })}
                    >
                      <option value="">-- Pilih Lembar Cek Siap Pakai --</option>
                      {availableChequeLeaves.map(l => (
                        <option key={l.checkNumber} value={l.checkNumber}>
                          {l.checkNumber} (Status: TERSEDIA)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ background: 'rgba(56,189,248,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid #38bdf8' }}>
                    <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700 }}>Tanggal Jatuh Tempo Kliring (Due Date)</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 700 }}
                      value={form.checkDueDate}
                      onChange={e => setForm({ ...form, checkDueDate: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Alokasi Akun COA (Lawan)</label>
                <select
                  className="form-select"
                  value={form.accountCode}
                  onChange={e => setForm({ ...form, accountCode: e.target.value })}
                >
                  {coaAccounts.map(a => (
                    <option key={a.code} value={a.code}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Nominal Bayar / Cicilan (IDR)</label>
                  {activeTab === 'BCK' && (
                    <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                      <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Maks: Rp {maxChequeLimit.toLocaleString()}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  className="form-input"
                  style={{
                    border: Number(form.amount) > maxChequeLimit && activeTab === 'BCK' ? '2px solid #ef4444' : '1px solid #10b981',
                    color: Number(form.amount) > maxChequeLimit && activeTab === 'BCK' ? '#ef4444' : '#34d399',
                    fontWeight: 800,
                    fontSize: '1.1rem'
                  }}
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Keterangan Pembayaran</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
              <CheckCircle size={16} /> Terbitkan Voucher {activeTab} & Rekonsiliasi Sisa Tagihan PO
            </button>
          </form>
        )}
      </div>

      {/* Voucher Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Daftar Voucher {getTabLabel(activeTab)} ({vouchers.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. Voucher</th>
                <th>Tanggal</th>
                <th>Ref No. PO</th>
                <th>Penerima Pembayaran</th>
                {activeTab === 'BCK' && <th>No. Cek / Bank</th>}
                {activeTab === 'BCK' && <th>Jatuh Tempo Kliring</th>}
                <th>Rekening / COA</th>
                <th style={{ textAlign: 'right' }}>Nominal (IDR)</th>
                <th>Status Pembayaran</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'BCK' ? 10 : 8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Belum ada data voucher {activeTab} yang diterbitkan.
                  </td>
                </tr>
              ) : (
                vouchers.map(v => (
                  <tr key={v.id || v.voucherNumber}>
                    <td><strong>{v.voucherNumber}</strong></td>
                    <td>{v.date}</td>
                    <td>
                      {v.selectedPONumber ? (
                        <span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>
                          <FileText size={11} style={{ display: 'inline', marginRight: '4px' }} />
                          {v.selectedPONumber}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Non-PO</span>
                      )}
                    </td>
                    <td><strong>{v.payee || v.payer || '-'}</strong></td>
                    {activeTab === 'BCK' && (
                      <td>
                        <strong style={{ color: '#fbbf24' }}>{v.checkNumber || 'BG-BCA-001'}</strong><br/>
                        <small style={{ color: 'var(--text-muted)' }}>{v.checkBankName || 'Bank BCA'}</small>
                      </td>
                    )}
                    {activeTab === 'BCK' && (
                      <td>
                        <span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {v.checkDueDate || v.date}
                        </span>
                      </td>
                    )}
                    <td>
                      <small style={{ color: '#38bdf8' }}>
                        {v.bankAccountCode || v.accountCode}
                      </small>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                      Rp {(v.amount || 0).toLocaleString()}
                    </td>
                    <td>
                      {v.isCleared ? (
                        <span className="badge badge-emerald">✅ CAIR / LUNAS</span>
                      ) : (
                        <span className="badge badge-gold" style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b' }}>
                          ⏳ BEREDAR (OUTSTANDING)
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {activeTab === 'BCK' && !v.isCleared && (
                          <button
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                            onClick={() => handleClearCheque(v)}
                          >
                            <CheckSquare size={13} /> Kliringkan Cair
                          </button>
                        )}
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                          onClick={() => alert(`🖨️ Mencetak PDF Voucher ${v.voucherNumber} [Ref PO: ${v.selectedPONumber || 'Non-PO'}] untuk ${v.payee}...`)}
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
