import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, CheckCircle, Tag, Layers } from 'lucide-react';
import { getMasterItems, saveMasterItem, getCOA } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';

export default function MasterItemPage() {
  const { modalProps, showModal } = useModal();
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'Emas Murni',
    unit: 'gram',
    weight: 1000,
    purity: 99.99,
    minStock: 100,
    inventoryAccount: '1157',
    cogsAccount: '5114',
    salesAccount: '4110',
    description: ''
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = () => {
    setItems(getMasterItems());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Kode barang dan nama barang wajib diisi.' });
      return;
    }

    const newItem = {
      id: form.code,
      ...form,
      createdAt: new Date().toISOString()
    };

    await saveMasterItem(newItem);
    showModal({ variant: 'success', title: '✅ Barang Master Tersimpan', message: `Barang "${newItem.name}" (${newItem.code}) berhasil disimpan.` });
    loadItems();
    setShowForm(false);
    setForm({
      code: '', name: '', category: 'Emas Murni', unit: 'gram', weight: 1000, purity: 99.99, minStock: 100, inventoryAccount: '1157', cogsAccount: '5114', salesAccount: '4110', description: ''
    });
  };

  const filteredItems = items.filter(i => 
    i.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Package color="#f59e0b" size={24} /> Master Data Barang / Produk Emas
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Kelola Katalog Emas Batangan 999.9 (Lokal/Impor), Scrap, Perhiasan Karat, Master Alloy, & Batu Permata
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Tambah Barang Master Baru
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--accent-gold)' }}>
            <h4 style={{ color: '#fbbf24', marginBottom: '14px', fontSize: '0.95rem' }}>➕ Form Tambah Barang Master</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Kode Barang (misal: LM-ANTAM-500G)</label>
                <input
                  className="form-input"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Barang</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Kategori Produk</label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  <option value="Emas Murni">Emas Murni 999.9 (LM Lokal/Import)</option>
                  <option value="Emas Impor">Emas Impor Valcambi/PAMP</option>
                  <option value="Perhiasan 750">Perhiasan Emas 750 (18K)</option>
                  <option value="Perhiasan 700">Perhiasan Emas 700 (17K)</option>
                  <option value="Perhiasan 375">Perhiasan Emas 375 (8K)</option>
                  <option value="Scrap">Pecahan / Rongsok Scrap</option>
                  <option value="Master Alloy">Master Alloy (Perak/Tembaga/Zinc)</option>
                  <option value="Batu Permata">Batu Permata & Zircon</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Satuan</label>
                <input
                  className="form-input"
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Kadar Emas (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.purity}
                  onChange={e => setForm({ ...form, purity: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Akun Inventori GL (1xxx)</label>
                <input
                  className="form-input"
                  value={form.inventoryAccount}
                  onChange={e => setForm({ ...form, inventoryAccount: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
              <CheckCircle size={16} /> Simpan Barang Master
            </button>
          </form>
        )}

        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '38px', width: '100%' }}
            placeholder="Cari kode, nama, atau kategori barang..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Daftar Barang Master ({filteredItems.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th>Satuan</th>
                <th>Kadar (%)</th>
                <th>Akun GL Stok</th>
                <th>Akun HPP</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id || item.code}>
                  <td><strong>{item.code}</strong></td>
                  <td>{item.name}</td>
                  <td><span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>{item.category}</span></td>
                  <td>{item.unit}</td>
                  <td>{item.purity || '-'}%</td>
                  <td><small style={{ color: '#34d399' }}>{item.inventoryAccount || '1157'}</small></td>
                  <td><small style={{ color: '#38bdf8' }}>{item.cogsAccount || '5114'}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal {...modalProps} />
    </div>
  );
}
