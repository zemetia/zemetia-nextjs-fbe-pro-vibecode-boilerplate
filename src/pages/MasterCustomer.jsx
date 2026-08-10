import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Globe, CheckCircle } from 'lucide-react';
import { getCustomers, saveCustomer } from '../services/storageService';

export default function MasterCustomer() {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    code: 'CUST-EXP-01',
    name: 'Dubai Gold & Jewelry Wholesalers DMCC',
    country: 'United Arab Emirates (UAE)',
    email: 'purchasing@dubaigold.dmcc.ae',
    phone: '+971-4-1234567',
    address: 'Almas Tower, Jumeirah Lakes Towers, Dubai, UAE',
    paymentTerms: 'NET-30',
    marketType: 'EXPORT'
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = () => {
    setCustomers(getCustomers());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      alert('Kode customer dan nama customer wajib diisi');
      return;
    }

    const newCust = {
      id: form.code,
      ...form,
      createdAt: new Date().toISOString()
    };

    await saveCustomer(newCust);
    alert(`✅ Master Customer/Buyer Ekspor (${newCust.name}) Berhasil Disimpan!`);
    loadCustomers();
    setShowForm(false);
  };

  const filteredCust = customers.filter(c =>
    c.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.country?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users color="#34d399" size={24} /> Master Customer / Buyer Ekspor
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Kelola Data Pembeli Ekspor Luar Negeri (UAE, Singapore, Hong Kong, USA, Europe)
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Tambah Buyer Ekspor Baru
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--accent-emerald)' }}>
            <h4 style={{ color: '#34d399', marginBottom: '14px', fontSize: '0.95rem' }}>➕ Form Tambah Customer / Buyer Ekspor</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Kode Customer</label>
                <input
                  className="form-input"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Perusahaan Buyer</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Negara Tujuan Ekspor</label>
                <input
                  className="form-input"
                  value={form.country}
                  onChange={e => setForm({ ...form, country: e.target.value })}
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
              <div className="form-group">
                <label className="form-label">Telepon / Fax</label>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <input
                  className="form-input"
                  value={form.paymentTerms}
                  onChange={e => setForm({ ...form, paymentTerms: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '12px', background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <CheckCircle size={16} /> Simpan Buyer Ekspor
            </button>
          </form>
        )}

        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '38px', width: '100%' }}
            placeholder="Cari kode, nama buyer, atau negara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Daftar Customer Ekspor ({filteredCust.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Buyer</th>
                <th>Negara Tujuan</th>
                <th>Kontak & Email</th>
                <th>Termin Bayar</th>
                <th>Status Market</th>
              </tr>
            </thead>
            <tbody>
              {filteredCust.map(c => (
                <tr key={c.id || c.code}>
                  <td><strong>{c.code}</strong></td>
                  <td>{c.name}</td>
                  <td><span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>{c.country || 'Global'}</span></td>
                  <td>{c.phone || c.email}</td>
                  <td>{c.paymentTerms || 'NET-30'}</td>
                  <td><span className="badge badge-emerald">EXPORT ONLY</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
