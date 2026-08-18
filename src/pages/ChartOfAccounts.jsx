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
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <BookOpen color="#f59e0b" size={24} /> Setting Chart of Accounts (COA Resmi PT TAN)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Struktur Kode Akun Resmi PT TAN (Sesuai File Excel "chart of account PT TAN.xlsx")
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              className="btn-primary bg-[linear-gradient(135deg,_#0284c7,_#0369a1)] text-white"
              onClick={handleReplaceWithExcelCOA}
            >
              <FileSpreadsheet size={18} /> Replace COA Dari Excel PT TAN
            </button>

            <button
              className={`btn-primary text-white ${
                showExportOnly
                  ? 'bg-linear-135 from-emerald to-emerald-dark'
                  : 'bg-none bg-white/[0.08]'
              }`}
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
          <form className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] mb-5 border border-gold" onSubmit={handleAddAccount}>
            <h4 className="text-gold-light mb-3.5 text-[0.95rem]">➕ Form Tambah Akun COA Baru</h4>
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
            <button type="submit" className="btn-primary mt-3">
              <CheckCircle2 size={16} /> Simpan Akun Ke COA
            </button>
          </form>
        )}

        {/* Search & Category Filter Tabs */}
        <div className="flex gap-4 flex-wrap items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
            <input
              className="form-input pl-9.5 w-full"
              placeholder="Cari kode atau nama akun..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
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
                className={`cursor-pointer whitespace-nowrap rounded-sm border border-line px-3.5 py-2 text-[0.8rem] ${
                  selectedCategory === tab.id
                    ? 'bg-gold/20 font-semibold text-gold-light'
                    : 'bg-transparent font-normal text-fg-soft'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* COA Table */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-heading text-[1.1rem]">
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
                <th className="text-right">Saldo Terkini (IDR)</th>
                <th>Penanda PT TAN</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td className="text-center text-fg-muted p-7.5" colSpan="6">
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
                      className={isHeader ? 'bg-white/[0.03] font-bold' : 'bg-transparent font-normal'}
                    >
                      <td>
                        <strong className={isHeader ? 'text-gold' : 'text-inherit'}>
                          {acc.code}
                        </strong>
                      </td>
                      <td>
                        <span className={isHeader ? 'pl-0' : 'pl-4'}>
                          {acc.name}
                        </span>
                      </td>
                      <td className="capitalize">{acc.category}</td>
                      <td>
                        <span className={`badge text-[0.7rem] ${isHeader ? 'badge-gold' : ''}`}>
                          {acc.type}
                        </span>
                      </td>
                      <td className="text-right font-semibold">
                        Rp {(acc.balance || 0).toLocaleString()}
                      </td>
                      <td>
                        {isExportAccount ? (
                          <span className="badge badge-emerald text-xs">
                            <ShieldCheck size={12} /> PT TAN Dedicated
                          </span>
                        ) : (
                          <span className="text-fg-muted text-xs">PT TAN Excel</span>
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
