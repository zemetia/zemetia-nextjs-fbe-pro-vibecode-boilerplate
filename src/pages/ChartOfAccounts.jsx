import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Plus, Filter, CheckCircle2, ShieldCheck, Tag, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { getCOA, addCOAAccount, saveCOA } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';

export default function ChartOfAccounts() {
  const { modalProps, showModal } = useModal();
  const [accounts, setAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showExportOnly, setShowExportOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newAcc, setNewAcc] = useState({
    code: '',
    name: '',
    category: 'aset',
    type: 'detail'
  });

  const exportAccountCodes = ['1125', '1132', '1135', '1157', '1158', '11502', '1160', '1152', '4110', '4120', '5114', '5115', '5118', '6110'];

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    setAccounts(getCOA());
  };

  const handleReplaceWithExcelCOA = () => {
    showModal({
      variant: 'confirm',
      title: '⚠️ Ganti Seluruh Chart of Accounts',
      message: 'Seluruh COA aplikasi akan diganti dengan struktur resmi dari file "chart of account PT TAN.xlsx".\n\nAkun yang Anda tambahkan sendiri akan hilang. Lanjutkan?',
      confirmLabel: 'Ya, Ganti COA',
      onConfirm: replaceWithExcelCOA
    });
  };

  const replaceWithExcelCOA = async () => {
    if (typeof window !== 'undefined' && window.Storage) {
      const officialCoa = window.Storage.getDefaultChartOfAccounts();
      await window.Storage.set(window.Storage.KEYS.CHART_OF_ACCOUNTS, officialCoa, true);
      showModal({
        variant: 'success',
        title: '✅ Chart of Accounts Diperbarui',
        message: `COA PT TAN berhasil di-replace dengan struktur resmi Excel (${officialCoa.length} akun).`
      });
      loadAccounts();
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!newAcc.code || !newAcc.name) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Kode akun dan nama akun wajib diisi.' });
      return;
    }
    const res = await addCOAAccount({
      ...newAcc,
      balance: 0
    });
    if (res.success) {
      showModal({ variant: 'success', title: '✅ Akun Baru Ditambahkan', message: `Akun ${newAcc.code} — ${newAcc.name} berhasil ditambahkan ke COA PT TAN.` });
      loadAccounts();
      setShowAddForm(false);
      setNewAcc({ code: '', name: '', category: 'aset', type: 'detail' });
    } else {
      showModal({ variant: 'error', title: '❌ Gagal Menambahkan Akun', message: String(res.error) });
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          acc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || acc.category === selectedCategory;
    const matchesExport = !showExportOnly || exportAccountCodes.includes(acc.code);

    return matchesSearch && matchesCategory && matchesExport;
  });

  return (
    <div>
      {/* Header & Control Bar */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen color="#f59e0b" size={24} /> Setting Chart of Accounts (COA Resmi PT TAN)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Struktur Kode Akun Resmi PT TAN (Sesuai File Excel "chart of account PT TAN.xlsx")
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff' }}
              onClick={handleReplaceWithExcelCOA}
            >
              <FileSpreadsheet size={18} /> Replace COA Dari Excel PT TAN
            </button>

            <button
              className="btn-primary"
              style={{
                background: showExportOnly ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)',
                color: '#fff'
              }}
              onClick={() => setShowExportOnly(!showExportOnly)}
            >
              <ShieldCheck size={18} />
              {showExportOnly ? 'Tampilkan Semua Akun' : 'Filter Akun Ekspor PT TAN Only'}
            </button>

            <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus size={18} /> Tambah Akun Baru
            </button>
          </div>
        </div>

        {/* Add Form Collapsible */}
        {showAddForm && (
          <form onSubmit={handleAddAccount} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--accent-gold)' }}>
            <h4 style={{ color: '#fbbf24', marginBottom: '14px', fontSize: '0.95rem' }}>➕ Form Tambah Akun COA Baru</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Kode Akun (misal 1113-3)</label>
                <input
                  className="form-input"
                  placeholder="Kode akun..."
                  value={newAcc.code}
                  onChange={e => setNewAcc({ ...newAcc, code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Akun Keuangan</label>
                <input
                  className="form-input"
                  placeholder="Nama akun..."
                  value={newAcc.name}
                  onChange={e => setNewAcc({ ...newAcc, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select
                  className="form-select"
                  value={newAcc.category}
                  onChange={e => setNewAcc({ ...newAcc, category: e.target.value })}
                >
                  <option value="aset">Aset (1xxx)</option>
                  <option value="kewajiban">Kewajiban (2xxx)</option>
                  <option value="ekuitas">Ekuitas (3xxx)</option>
                  <option value="pendapatan">Pendapatan (4xxx)</option>
                  <option value="beban">Beban / HPP (5xxx)</option>
                  <option value="diluar_usaha">Di Luar Usaha (6xxx)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipe Akun</label>
                <select
                  className="form-select"
                  value={newAcc.type}
                  onChange={e => setNewAcc({ ...newAcc, type: e.target.value })}
                >
                  <option value="detail">Detail (Bisa Di-jurnal)</option>
                  <option value="header">Header (Judul Kelompok)</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
              <CheckCircle2 size={16} /> Simpan Akun Ke COA
            </button>
          </form>
        )}

        {/* Search & Category Filter Tabs */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '38px', width: '100%' }}
              placeholder="Cari kode atau nama akun..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'all', label: 'Semua' },
              { id: 'aset', label: '1 - Aktiva' },
              { id: 'kewajiban', label: '2 - Passiva & Ekuitas' },
              { id: 'pendapatan', label: '3 - Pendapatan' },
              { id: 'beban', label: '4/5 - HPP & Beban' },
              { id: 'diluar_usaha', label: '6 - Di Luar Usaha' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: selectedCategory === tab.id ? 'rgba(245,158,11,0.2)' : 'transparent',
                  color: selectedCategory === tab.id ? '#fbbf24' : 'var(--text-secondary)',
                  fontWeight: selectedCategory === tab.id ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* COA Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>
            📋 Daftar Kode Akun Keuangan ({filteredAccounts.length})
          </h3>
          {showExportOnly && (
            <span className="badge badge-emerald">
              <Tag size={12} /> Menampilkan Akun Ekspor PT TAN
            </span>
          )}
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Kode Akun</th>
                <th>Nama Akun Keuangan</th>
                <th>Kategori SAK</th>
                <th>Tipe</th>
                <th style={{ textAlign: 'right' }}>Saldo Terkini (IDR)</th>
                <th>Penanda PT TAN</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Tidak ada akun yang sesuai dengan pencarian
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => {
                  const isExportAccount = exportAccountCodes.includes(acc.code);
                  const isHeader = acc.type === 'header';
                  return (
                    <tr
                      key={acc.code}
                      style={{
                        background: isHeader ? 'rgba(255,255,255,0.03)' : 'transparent',
                        fontWeight: isHeader ? 700 : 400
                      }}
                    >
                      <td>
                        <strong style={{ color: isHeader ? '#f59e0b' : 'inherit' }}>
                          {acc.code}
                        </strong>
                      </td>
                      <td>
                        <span style={{ paddingLeft: isHeader ? '0' : '16px' }}>
                          {acc.name}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{acc.category}</td>
                      <td>
                        <span className={`badge ${isHeader ? 'badge-gold' : ''}`} style={{ fontSize: '0.7rem' }}>
                          {acc.type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        Rp {(acc.balance || 0).toLocaleString()}
                      </td>
                      <td>
                        {isExportAccount ? (
                          <span className="badge badge-emerald" style={{ fontSize: '0.75rem' }}>
                            <ShieldCheck size={12} /> PT TAN Dedicated
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>PT TAN Excel</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal {...modalProps} />
    </div>
  );
}
