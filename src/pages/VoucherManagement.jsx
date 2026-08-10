import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Printer, CheckCircle, FileSpreadsheet, Filter } from 'lucide-react';
import { getCOA } from '../services/storageService';

export default function VoucherManagement() {
  const [activeTab, setActiveTab] = useState('BKK'); // BKK, BKM, BBK, BBM
  const [vouchers, setVouchers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [coaAccounts, setCoaAccounts] = useState([]);

  const [form, setForm] = useState({
    voucherType: 'BKK',
    voucherNo: '',
    date: new Date().toISOString().split('T')[0],
    payeePayer: 'Vendor Cargo Shipping',
    accountCode: '5150',
    amount: 5000000,
    description: 'Pembayaran Biaya Freight & Handling Cargo Ekspor'
  });

  useEffect(() => {
    setCoaAccounts(getCOA().filter(a => a.type === 'detail'));
    loadVouchers();
  }, [activeTab]);

  const loadVouchers = () => {
    // Load vouchers from Storage
    if (typeof window !== 'undefined' && window.Storage) {
      const pmt = window.Storage.get(window.Storage.KEYS.PAYMENT_VOUCHERS) || [];
      const rcp = window.Storage.get(window.Storage.KEYS.RECEIPT_VOUCHERS) || [];
      const all = [...pmt, ...rcp];
      
      const filtered = all.filter(v => {
        if (activeTab === 'BKK') return v.voucherType === 'BKK' || v.type === 'BKK';
        if (activeTab === 'BKM') return v.voucherType === 'BKM' || v.type === 'BKM';
        if (activeTab === 'BBK') return v.voucherType === 'BBK' || v.type === 'BBK';
        if (activeTab === 'BBM') return v.voucherType === 'BBM' || v.type === 'BBM';
        return true;
      });
      setVouchers(filtered);
    }
  };

  const handleCreateVoucher = (e) => {
    e.preventDefault();
    if (!form.payeePayer || !form.amount) {
      alert('Penerima/Penyetor dan Jumlah Nominal wajib diisi');
      return;
    }

    const newVoucher = {
      id: Date.now(),
      voucherNumber: `${activeTab}-${Date.now().toString().slice(-6)}`,
      voucherType: activeTab,
      type: activeTab,
      date: form.date,
      payee: form.payeePayer,
      payer: form.payeePayer,
      accountCode: form.accountCode,
      amount: Number(form.amount),
      description: form.description,
      status: 'approved',
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      const key = (activeTab === 'BKK' || activeTab === 'BBK') 
        ? window.Storage.KEYS.PAYMENT_VOUCHERS 
        : window.Storage.KEYS.RECEIPT_VOUCHERS;
      
      const list = window.Storage.get(key) || [];
      list.unshift(newVoucher);
      window.Storage.set(key, list);
      alert(`✅ Voucher ${activeTab} (${newVoucher.voucherNumber}) Berhasil Diterbitkan!`);
      loadVouchers();
      setShowForm(false);
    }
  };

  const getTabLabel = (tab) => {
    switch (tab) {
      case 'BKK': return '🔴 BKK (Bukti Kas Keluar)';
      case 'BKM': return '🟢 BKM (Bukti Kas Masuk)';
      case 'BBK': return '🔵 BBK (Bukti Bank Keluar)';
      case 'BBM': return '🟣 BBM (Bukti Bank Masuk)';
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
              <CreditCard color="#f59e0b" size={24} /> Manajemen Voucher Keuangan (BKK / BKM / BBK / BBM)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Penerbitan & Cetak Voucher Kas/Bank, Approval Flow, dan Auto-Jurnal SAK EMKM PT TAN
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Terbitkan Voucher {activeTab} Baru
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['BKK', 'BKM', 'BBK', 'BBM'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setForm({ ...form, voucherType: tab }); }}
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
            <h4 style={{ color: '#fbbf24', marginBottom: '14px', fontSize: '0.95rem' }}>➕ Form Terbitkan Voucher {activeTab}</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Tanggal Voucher</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{activeTab.includes('K') ? 'Penerima Pembayaran (Payee)' : 'Penyetor (Payer)'}</label>
                <input
                  className="form-input"
                  value={form.payeePayer}
                  onChange={e => setForm({ ...form, payeePayer: e.target.value })}
                />
              </div>
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
                <label className="form-label">Nominal Rp (IDR)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Keterangan / Memot</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
              <CheckCircle size={16} /> Terbitkan Voucher & Auto-Jurnal
            </button>
          </form>
        )}
      </div>

      {/* Voucher Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Daftar Voucher {activeTab} ({vouchers.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. Voucher</th>
                <th>Tanggal</th>
                <th>Penerima / Penyetor</th>
                <th>Akun COA</th>
                <th style={{ textAlign: 'right' }}>Nominal (IDR)</th>
                <th>Keterangan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Belum ada data voucher {activeTab} yang diterbitkan.
                  </td>
                </tr>
              ) : (
                vouchers.map(v => (
                  <tr key={v.id || v.voucherNumber}>
                    <td><strong>{v.voucherNumber}</strong></td>
                    <td>{v.date}</td>
                    <td>{v.payee || v.payer || '-'}</td>
                    <td>{v.accountCode}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: activeTab.includes('M') ? '#34d399' : '#f8fafc' }}>
                      Rp {(v.amount || 0).toLocaleString()}
                    </td>
                    <td>{v.description || '-'}</td>
                    <td><span className="badge badge-emerald">{v.status || 'Approved'}</span></td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        onClick={() => alert(`🖨️ Mencetak PDF Voucher ${v.voucherNumber}...`)}
                      >
                        <Printer size={14} /> Cetak Voucher
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
