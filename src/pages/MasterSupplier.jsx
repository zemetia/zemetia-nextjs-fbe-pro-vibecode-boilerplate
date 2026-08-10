import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Globe, CheckCircle } from 'lucide-react';
import { getSuppliers, saveSupplier } from '../services/storageService';

export default function MasterSupplier() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    code: 'SUPP-OVERSEAS-01',
    name: 'Valcambi SA Switzerland',
    category: 'Overseas Refiner',
    country: 'Switzerland (Swiss)',
    currency: 'USD',
    email: 'sales@valcambi.com',
    phone: '+41-91-6955555',
    address: 'Via Passeggiata 3, 6828 Balerna, Switzerland'
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = () => {
    setSuppliers(getSuppliers());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      alert('Kode supplier dan nama supplier wajib diisi');
      return;
    }

    const newSupp = {
      id: form.code,
      ...form,
      createdAt: new Date().toISOString()
    };

    await saveSupplier(newSupp);
    alert(`✅ Master Supplier (${newSupp.name}) Berhasil Disimpan!`);
    loadSuppliers();
    setShowForm(false);
  };

  const filteredSupp = suppliers.filter(s =>
    s.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.country?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck color="#38bdf8" size={24} /> Master Supplier Emas (Impor & Lokal)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Kelola Data Supplier Emas Batangan Impor Overseas (Valcambi, PAMP, Heraeus) & Supplier Emas Lokal (Antam, UBS)
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Tambah Supplier Baru
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #38bdf8' }}>
            <h4 style={{ color: '#38bdf8', marginBottom: '14px', fontSize: '0.95rem' }}>➕ Form Tambah Supplier Emas</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Kode Supplier</label>
                <input
                  className="form-input"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Perusahaan Supplier</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Kategori Supplier</label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  <option value="Overseas Refiner">Overseas Refiner (Impor USD)</option>
                  <option value="Lokal Producer">Produsen Emas Lokal (IDR)</option>
                  <option value="Scrap Trader">Pengepul Scrap / Toko Emas</option>
                  <option value="Consumables Supplier">Supplier Bahan Kimia / Alloy</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Negara / Lokasi</label>
                <input
                  className="form-input"
                  value={form.country}
                  onChange={e => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mata Uang Transaksi</label>
                <select
                  className="form-select"
                  value={form.currency}
                  onChange={e => setForm({ ...form, currency: e.target.value })}
                >
                  <option value="USD">USD (Dollar AS)</option>
                  <option value="IDR">IDR (Rupiah)</option>
                  <option value="SGD">SGD (Singapore Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Email Operasional</label>
                <input
                  className="form-input"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '12px', background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}>
              <CheckCircle size={16} /> Simpan Supplier Emas
            </button>
          </form>
        )}

        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '38px', width: '100%' }}
            placeholder="Cari kode, nama supplier, atau negara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Daftar Supplier Emas ({filteredSupp.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Supplier</th>
                <th>Kategori</th>
                <th>Negara asal</th>
                <th>Valas Utam</th>
                <th>Email Kontak</th>
              </tr>
            </thead>
            <tbody>
              {filteredSupp.map(s => (
                <tr key={s.id || s.code}>
                  <td><strong>{s.code}</strong></td>
                  <td>{s.name}</td>
                  <td><span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>{s.category}</span></td>
                  <td>{s.country || 'Indonesia'}</td>
                  <td><strong style={{ color: '#38bdf8' }}>{s.currency || 'USD'}</strong></td>
                  <td>{s.email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
