import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Globe, CheckCircle } from 'lucide-react';
import { getSuppliers, saveSupplier } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';

export default function MasterSupplier() {
  const { modalProps, showModal } = useModal();
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
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Kode supplier dan nama supplier wajib diisi.' });
      return;
    }

    const newSupp = {
      id: form.code,
      ...form,
      createdAt: new Date().toISOString()
    };

    await saveSupplier(newSupp);
    showModal({ variant: 'success', title: '✅ Master Supplier Tersimpan', message: `Supplier "${newSupp.name}" (${newSupp.code}) berhasil disimpan.` });
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
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Truck color="#38bdf8" size={24} /> Master Supplier Emas (Impor & Lokal)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Kelola Data Supplier Emas Batangan Impor Overseas (Valcambi, PAMP, Heraeus) & Supplier Emas Lokal (Antam, UBS)
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Tambah Supplier Baru
          </button>
        </div>

        {showForm && (
          <form className="bg-[rgba(15,23,42,0.7)] p-5 rounded-[12px] mb-5 border border-sky-light" onSubmit={handleSubmit}>
            <h4 className="text-sky-light mb-3.5 text-[0.95rem]">➕ Form Tambah Supplier Emas</h4>
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
                <Combobox
                  value={form.category}
                  onChange={category => setForm({ ...form, category })}
                  searchPlaceholder="Cari kategori supplier…"
                  emptyText="Kategori tidak ditemukan."
                  options={[
                    { value: 'Overseas Refiner', label: 'Overseas Refiner (Impor USD)' },
                    { value: 'Lokal Producer', label: 'Produsen Emas Lokal (IDR)' },
                    { value: 'Scrap Trader', label: 'Pengepul Scrap / Toko Emas' },
                    { value: 'Consumables Supplier', label: 'Supplier Bahan Kimia / Alloy' }
                  ]}
                />
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
                <Combobox
                  value={form.currency}
                  onChange={currency => setForm({ ...form, currency })}
                  searchPlaceholder="Cari mata uang…"
                  emptyText="Mata uang tidak ditemukan."
                  options={[
                    { value: 'USD', label: 'USD (Dollar AS)' },
                    { value: 'IDR', label: 'IDR (Rupiah)' },
                    { value: 'SGD', label: 'SGD (Singapore Dollar)' },
                    { value: 'EUR', label: 'EUR (Euro)' }
                  ]}
                />
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
            <button type="submit" className="btn-primary mt-3 bg-[linear-gradient(135deg,_#0284c7,_#0369a1)]">
              <CheckCircle size={16} /> Simpan Supplier Emas
            </button>
          </form>
        )}

        <div className="relative max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
          <input
            className="form-input pl-9.5 w-full"
            placeholder="Cari kode, nama supplier, atau negara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="font-heading text-[1.1rem] mb-4">
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
                  <td><span className="badge badge-gold text-xs">{s.category}</span></td>
                  <td>{s.country || 'Indonesia'}</td>
                  <td><strong className="text-sky-light">{s.currency || 'USD'}</strong></td>
                  <td>{s.email || '-'}</td>
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
