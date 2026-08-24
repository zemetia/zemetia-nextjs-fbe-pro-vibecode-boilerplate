import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Globe, CheckCircle } from 'lucide-react';
import { getCustomers, saveCustomer } from '../services/storageService';
import {
  Modal,
  useModal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from '../components/ui';

export default function MasterCustomer() {
  const { modalProps, showModal } = useModal();
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
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Kode customer dan nama customer wajib diisi.' });
      return;
    }

    const newCust = {
      id: form.code,
      ...form,
      createdAt: new Date().toISOString()
    };

    await saveCustomer(newCust);
    showModal({ variant: 'success', title: '✅ Master Customer Tersimpan', message: `Customer / Buyer Ekspor "${newCust.name}" (${newCust.code}) berhasil disimpan.` });
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
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Users color="#34d399" size={24} /> Master Customer / Buyer Ekspor
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Kelola Data Pembeli Ekspor Luar Negeri (UAE, Singapore, Hong Kong, USA, Europe)
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Tambah Buyer Ekspor Baru
          </button>
        </div>

        {showForm && (
          <form className="bg-[rgba(15,23,42,0.7)] p-5 rounded-[12px] mb-5 border border-emerald" onSubmit={handleSubmit}>
            <h4 className="text-emerald-light mb-3.5 text-[0.95rem]">➕ Form Tambah Customer / Buyer Ekspor</h4>
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
            <button type="submit" className="btn-primary mt-3 bg-[linear-gradient(135deg,_#10b981,_#059669)]">
              <CheckCircle size={16} /> Simpan Buyer Ekspor
            </button>
          </form>
        )}

        <div className="relative max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
          <input
            className="form-input pl-9.5 w-full"
            placeholder="Cari kode, nama buyer, atau negara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="font-heading text-[1.1rem] mb-4">
          📋 Daftar Customer Ekspor ({filteredCust.length})
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama Buyer</TableHead>
              <TableHead>Negara Tujuan</TableHead>
              <TableHead>Kontak & Email</TableHead>
              <TableHead>Termin Bayar</TableHead>
              <TableHead>Status Market</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCust.length === 0 ? (
              <TableEmpty colSpan={6} message="Belum ada data buyer/customer ekspor." />
            ) : (
              filteredCust.map(c => (
                <TableRow key={c.id || c.code}>
                  <TableCell><strong>{c.code}</strong></TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell><span className="badge badge-gold text-xs">{c.country || 'Global'}</span></TableCell>
                  <TableCell>{c.phone || c.email}</TableCell>
                  <TableCell>{c.paymentTerms || 'NET-30'}</TableCell>
                  <TableCell><span className="badge badge-emerald">EXPORT ONLY</span></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Modal {...modalProps} />
    </div>
  );
}
