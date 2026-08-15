import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Printer, CheckCircle, FileSpreadsheet, Filter, CheckSquare, Clock, AlertCircle, Building2, Layers, Lock, ShieldAlert } from 'lucide-react';
import { getCOA } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';

export default function VoucherManagement() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('BBK'); // BBK, BKK, BCK (Bukti Cek Keluar), BKM, BBM
  const [vouchers, setVouchers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [chequeBooks, setChequeBooks] = useState([]);

  const [form, setForm] = useState({
    voucherType: 'BBK',
    voucherNo: '',
    date: new Date().toISOString().split('T')[0],
    payeePayer: 'Supplier Emas Lokal / Vendor',
    paymentMethod: 'transfer', // 'transfer', 'cash', 'cheque' (Cek/BG)
    checkBankName: 'Bank BCA (KCU Thamrin)',
    checkNumber: '', // Nomor Seri Lembar Cek / Bilyet Giro
    checkDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], // Jatuh Tempo Kliring
    accountCode: '2111', // Hutang Usaha / Beban
    amount: 50000000,
    description: 'Pembayaran Pembelian Emas Batangan via Bilyet Giro BCA (Tempo 7 Hari)'
  });

  useEffect(() => {
    setCoaAccounts(getCOA().filter(a => a.type === 'detail'));
    loadVouchers();
    loadChequeBooks();
  }, [activeTab]);

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
          id: 'VOUCH-BCK-001',
          voucherNumber: 'BCK-2026-001',
          voucherType: 'BCK',
          type: 'BCK',
          date: new Date().toISOString().split('T')[0],
          payee: 'PT Antam Tbk / Pegadaian',
          payer: 'PT TAN',
          paymentMethod: 'cheque',
          checkNumber: 'BG-BCA-998801',
          checkBankName: 'Bank BCA (KCU Thamrin)',
          checkDueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          accountCode: '2111',
          amount: 150000000,
          description: 'Pembayaran 100g Emas Batangan via Bilyet Giro BCA (Jatuh Tempo Kliring 5 Hari)',
          status: 'BEREDAR (OUTSTANDING)',
          isCleared: false,
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
          variant: 'error',
          title: '❌ Transaksi Ditolak — Melebihi Limit Per Lembar',
          message: `Nominal Rp ${Number(form.amount).toLocaleString()} melebihi batas limit per lembar buku cek ${form.checkBankName}.\nMaksimal: Rp ${maxChequeLimit.toLocaleString()}`
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
      payee: form.payeePayer,
      payer: form.payeePayer,
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
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-${currentType}-${Date.now().toString().slice(-6)}`,
        date: form.date,
        description: isCheque
          ? `Penerbitan Cek/Bilyet Giro (${newVoucher.checkNumber}) - Penerima: ${newVoucher.payee} [Jatuh Tempo: ${newVoucher.checkDueDate}]`
          : `Pembayaran Voucher ${currentType} (${newVoucher.voucherNumber}) - ${newVoucher.payee}`,
        lines: [
          { accountCode: form.accountCode, accountName: coaAccounts.find(a => a.code === form.accountCode)?.name || 'Hutang Usaha', debit: Number(form.amount), credit: 0 },
          { accountCode: isCheque ? '2115' : '1111-IDR', accountName: isCheque ? 'Hutang Cek / Bilyet Giro Beredar' : 'Bank BCA IDR', debit: 0, credit: Number(form.amount) }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

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
        title: `✅ Voucher ${currentType} (${newVoucher.voucherNumber}) Diterbitkan`,
        message: isCheque
          ? `• No. Cek/BG terkunci: ${newVoucher.checkNumber}\n• Limit plafon: Rp ${maxChequeLimit.toLocaleString()} (aman)\n• Jatuh tempo kliring: ${newVoucher.checkDueDate}\n• Status: BEREDAR (Akun 2115)`
          : `Penerima / Penyetor: ${newVoucher.payee}\nNominal: Rp ${Number(newVoucher.amount).toLocaleString()}`
      });
      loadVouchers();
      setShowForm(false);
    }
  };

  // Handler Pencairan / Kliring Cek di Bank
  const handleClearCheque = (voucher) => {
    if (voucher.isCleared) {
      showModal({ variant: 'info', title: 'Sudah Dicairkan', message: 'Cek / Bilyet Giro ini sudah dicairkan sebelumnya.' });
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
        title: `🎉 Cek/BG (${voucher.checkNumber}) Sukses Dikliringkan`,
        message: `• Saldo Bank BCA (1111-IDR) terpotong: Rp ${voucher.amount.toLocaleString()}\n• Akun BG gantung (2115) ditutup.`
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
              Penerbitan Voucher, Validasi Limit Plafon Master Cek Bank, Kliring Pencairan, & Auto-Jurnal SAK EMKM
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
            <h4 style={{ color: '#fbbf24', marginBottom: '14px', fontSize: '0.95rem' }}>
              ➕ Form Terbitkan Voucher {activeTab} {activeTab === 'BCK' ? '(Cek / Bilyet Giro Terdaftar)' : ''}
            </h4>
            <div className="form-grid">
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
                <label className="form-label">Penerima Pembayaran (Payee)</label>
                <input
                  className="form-input"
                  style={{ fontWeight: 700, color: '#fbbf24' }}
                  value={form.payeePayer}
                  onChange={e => setForm({ ...form, payeePayer: e.target.value })}
                />
              </div>

              {/* KHUSUS CEK / BILYET GIRO DENGAN FILTER BANK & MASTER REGISTER */}
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
                  <label className="form-label">Nominal Pembayaran (IDR)</label>
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
                {Number(form.amount) > maxChequeLimit && activeTab === 'BCK' && (
                  <small style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <ShieldAlert size={14} /> Peringatan: Melebihi batas plafon buku cek (Maks Rp {maxChequeLimit.toLocaleString()})!
                  </small>
                )}
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Keterangan / Keperluan Pembayaran</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
              <CheckCircle size={16} /> Terbitkan Voucher & Kunci Lembar {activeTab === 'BCK' ? 'Cek Beredar (2115)' : 'Bank Keluar'}
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
                <th>Penerima Pembayaran</th>
                {activeTab === 'BCK' && <th>No. Cek / Bank</th>}
                {activeTab === 'BCK' && <th>Jatuh Tempo Kliring</th>}
                <th>Akun COA</th>
                <th style={{ textAlign: 'right' }}>Nominal (IDR)</th>
                <th>Status Pembayaran</th>
                <th>Aksi & Pencairan</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'BCK' ? 9 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Belum ada data voucher {activeTab} yang diterbitkan.
                  </td>
                </tr>
              ) : (
                vouchers.map(v => (
                  <tr key={v.id || v.voucherNumber}>
                    <td><strong>{v.voucherNumber}</strong></td>
                    <td>{v.date}</td>
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
                    <td><small style={{ color: '#38bdf8' }}>{v.accountCode}</small></td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                      Rp {(v.amount || 0).toLocaleString()}
                    </td>
                    <td>
                      {v.isCleared ? (
                        <span className="badge badge-emerald">✅ CAIR (CLEARED)</span>
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
                          onClick={() => showModal({
                            variant: 'info',
                            title: `🖨️ Cetak PDF Voucher ${v.voucherNumber}`,
                            message: `No. Cek/BG: ${v.checkNumber || '-'}\nUntuk: ${v.payee}`
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
