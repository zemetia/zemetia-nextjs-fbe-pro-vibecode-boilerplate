import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, CheckCircle2, Tag, Sparkles, Sliders } from 'lucide-react';
import { getFinishedGoods, saveFinishedGood } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';

export default function MasterFinishedGoods() {
  const { modalProps, showModal } = useModal();
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKarat, setSelectedKarat] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    sku: 'JWL-RNG-750-002',
    name: 'Dubai Luxury Diamond Cut Ring',
    type: 'Cincin (Ring)',
    karat: '750',
    goldColor: 'Yellow Gold',
    stdWeightGram: 5.20,
    laborFeeIDRPerGram: 16000,
    hsCode: '7113.19.90',
    description: 'Perhiasan Emas Ekspor 18K Model Cincin Ukir'
  });

  useEffect(() => {
    loadFinishedGoods();
  }, []);

  const loadFinishedGoods = () => {
    setFinishedGoods(getFinishedGoods());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sku || !form.name) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Kode SKU dan Nama Model Perhiasan wajib diisi.' });
      return;
    }

    const purity = form.karat === '750' ? 75.0 : form.karat === '700' ? 70.0 : form.karat === '375' ? 37.5 : 91.6;

    const newFG = {
      id: form.sku,
      ...form,
      purity,
      inventoryAccount: '1160', // Persediaan Perhiasan Ekspor
      createdAt: new Date().toISOString()
    };

    await saveFinishedGood(newFG);
    showModal({ variant: 'success', title: '✅ Master Finished Goods Tersimpan', message: `Perhiasan "${newFG.name}" (SKU ${newFG.sku}) berhasil disimpan.` });
    loadFinishedGoods();
    setShowForm(false);
  };

  const filteredGoods = finishedGoods.filter(fg => {
    const matchesSearch = fg.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          fg.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          fg.type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesKarat = selectedKarat === 'all' || fg.karat === selectedKarat;
    return matchesSearch && matchesKarat;
  });

  return (
    <div>
      {/* Header & Controls */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Package color="#fbbf24" size={24} /> Master Finished Goods (Katalog Perhiasan Emas Ekspor)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Katalog SKU Barang Jadi Perhiasan Ekspor (Cincin, Kalung, Gelang, Anting) Lengkap dengan Karat, Warna, Berat Standar, & HS Code
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Tambah Model Finished Goods Baru
          </button>
        </div>

        {/* Create Form Collapsible */}
        {showForm && (
          <form onSubmit={handleSubmit} style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--accent-gold)' }}>
            <h4 style={{ color: '#fbbf24', marginBottom: '14px', fontSize: '0.95rem' }}>➕ Form Tambah Model Perhiasan Ekspor</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Kode SKU Perhiasan (misal JWL-RNG-750-002)</label>
                <input
                  className="form-input"
                  value={form.sku}
                  onChange={e => setForm({ ...form, sku: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Model / Style Design</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Jenis Perhiasan</label>
                <select
                  className="form-select"
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                >
                  <option value="Cincin (Ring)">Cincin (Ring)</option>
                  <option value="Kalung (Necklace)">Kalung (Necklace / Chain)</option>
                  <option value="Gelang (Bangle)">Gelang (Bangle / Bracelet)</option>
                  <option value="Anting (Earring)">Anting (Earring)</option>
                  <option value="Liontin (Pendant)">Liontin (Pendant)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Kode Karat (Purity)</label>
                <select
                  className="form-select"
                  value={form.karat}
                  onChange={e => setForm({ ...form, karat: e.target.value })}
                >
                  <option value="750">Karat 750 (18K - 75.0%)</option>
                  <option value="700">Karat 700 (17K - 70.0%)</option>
                  <option value="375">Karat 375 (8K - 37.5%)</option>
                  <option value="916">Karat 916 (22K - 91.6%)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Warna Emas (Gold Color)</label>
                <select
                  className="form-select"
                  value={form.goldColor}
                  onChange={e => setForm({ ...form, goldColor: e.target.value })}
                >
                  <option value="Yellow Gold">Yellow Gold (Kuning)</option>
                  <option value="Rose Gold">Rose / Red Gold (Merah)</option>
                  <option value="White Gold">White Gold (Putih)</option>
                  <option value="Two-Tone">Two-Tone (Kuning-Putih)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Berat Standar (Gram / Pcs)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={form.stdWeightGram}
                  onChange={e => setForm({ ...form, stdWeightGram: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ongkos Tukang Standar IDR / Gram</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.laborFeeIDRPerGram}
                  onChange={e => setForm({ ...form, laborFeeIDRPerGram: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">HS Code Ekspor Bea Cukai</label>
                <input
                  className="form-input"
                  value={form.hsCode}
                  onChange={e => setForm({ ...form, hsCode: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
              <CheckCircle2 size={16} /> Simpan Model Finished Goods
            </button>
          </form>
        )}

        {/* Search & Karat Filter Tabs */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '38px', width: '100%' }}
              placeholder="Cari SKU, nama model, atau jenis perhiasan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {[
              { id: 'all', label: 'Semua Karat' },
              { id: '750', label: 'Karat 750 (18K)' },
              { id: '700', label: 'Karat 700 (17K)' },
              { id: '375', label: 'Karat 375 (8K)' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedKarat(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: selectedKarat === tab.id ? 'rgba(245,158,11,0.2)' : 'transparent',
                  color: selectedKarat === tab.id ? '#fbbf24' : 'var(--text-secondary)',
                  fontWeight: selectedKarat === tab.id ? 600 : 400,
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

      {/* Finished Goods Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Katalog Barang Jadi Perhiasan Ekspor ({filteredGoods.length})
        </h3>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Kode SKU</th>
                <th>Nama Model / Style Design</th>
                <th>Jenis Perhiasan</th>
                <th>Kode Karat</th>
                <th>Warna Gold</th>
                <th>Berat Standar (g)</th>
                <th>Ongkos Tukang / g</th>
                <th>HS Code PEB</th>
                <th>Akun GL Stok</th>
              </tr>
            </thead>
            <tbody>
              {filteredGoods.map(fg => (
                <tr key={fg.id || fg.sku}>
                  <td><strong>{fg.sku}</strong></td>
                  <td>{fg.name}</td>
                  <td>{fg.type}</td>
                  <td><span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>Karat {fg.karat} ({fg.purity}%)</span></td>
                  <td><span className="badge badge-emerald" style={{ fontSize: '0.75rem' }}>{fg.goldColor}</span></td>
                  <td style={{ fontWeight: 700 }}>{fg.stdWeightGram} g</td>
                  <td>Rp {(fg.laborFeeIDRPerGram || 0).toLocaleString()}</td>
                  <td><small style={{ color: '#38bdf8' }}>{fg.hsCode || '7113.19.90'}</small></td>
                  <td><small style={{ color: '#34d399' }}>1160 (Perhiasan Ekspor)</small></td>
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
