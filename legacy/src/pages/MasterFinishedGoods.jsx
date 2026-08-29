import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, CheckCircle2, Tag, Sparkles, Sliders } from 'lucide-react';
import { getFinishedGoods, saveFinishedGood } from '../services/storageService';
import {
  Modal,
  useModal,
  Combobox,
  NumberInput,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from '../components/ui';

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
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Package color="#fbbf24" size={24} /> Master Finished Goods (Katalog Perhiasan Emas Ekspor)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Katalog SKU Barang Jadi Perhiasan Ekspor (Cincin, Kalung, Gelang, Anting) Lengkap dengan Karat, Warna, Berat Standar, & HS Code
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Tambah Model Finished Goods Baru
          </button>
        </div>

        {/* Create Form Collapsible */}
        {showForm && (
          <form className="bg-[rgba(15,23,42,0.7)] p-5 rounded-[12px] mb-5 border border-gold" onSubmit={handleSubmit}>
            <h4 className="text-gold-light mb-3.5 text-[0.95rem]">➕ Form Tambah Model Perhiasan Ekspor</h4>
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
                <Combobox
                  value={form.type}
                  onChange={type => setForm({ ...form, type })}
                  searchPlaceholder="Cari jenis perhiasan…"
                  emptyText="Jenis perhiasan tidak ditemukan."
                  options={[
                    { value: 'Cincin (Ring)', label: 'Cincin (Ring)' },
                    { value: 'Kalung (Necklace)', label: 'Kalung (Necklace / Chain)' },
                    { value: 'Gelang (Bangle)', label: 'Gelang (Bangle / Bracelet)' },
                    { value: 'Anting (Earring)', label: 'Anting (Earring)' },
                    { value: 'Liontin (Pendant)', label: 'Liontin (Pendant)' }
                  ]}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Kode Karat (Purity)</label>
                <Combobox
                  value={form.karat}
                  onChange={karat => setForm({ ...form, karat })}
                  searchPlaceholder="Cari kode karat…"
                  emptyText="Kode karat tidak ditemukan."
                  options={[
                    { value: '750', label: 'Karat 750 (18K - 75.0%)' },
                    { value: '700', label: 'Karat 700 (17K - 70.0%)' },
                    { value: '375', label: 'Karat 375 (8K - 37.5%)' },
                    { value: '916', label: 'Karat 916 (22K - 91.6%)' }
                  ]}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Warna Emas (Gold Color)</label>
                <Combobox
                  value={form.goldColor}
                  onChange={goldColor => setForm({ ...form, goldColor })}
                  searchPlaceholder="Cari warna emas…"
                  emptyText="Warna emas tidak ditemukan."
                  options={[
                    { value: 'Yellow Gold', label: 'Yellow Gold (Kuning)' },
                    { value: 'Rose Gold', label: 'Rose / Red Gold (Merah)' },
                    { value: 'White Gold', label: 'White Gold (Putih)' },
                    { value: 'Two-Tone', label: 'Two-Tone (Kuning-Putih)' }
                  ]}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Berat Standar (Gram / Pcs)</label>
                <NumberInput
                  allowDecimal
                  value={form.stdWeightGram}
                  onChange={stdWeightGram => setForm({ ...form, stdWeightGram })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ongkos Tukang Standar IDR / Gram</label>
                <NumberInput
                  value={form.laborFeeIDRPerGram}
                  onChange={laborFeeIDRPerGram => setForm({ ...form, laborFeeIDRPerGram })}
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
            <button type="submit" className="btn-primary mt-3">
              <CheckCircle2 size={16} /> Simpan Model Finished Goods
            </button>
          </form>
        )}

        {/* Search & Karat Filter Tabs */}
        <div className="flex gap-4 flex-wrap items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
            <input
              className="form-input pl-9.5 w-full"
              placeholder="Cari SKU, nama model, atau jenis perhiasan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {[
              { id: 'all', label: 'Semua Karat' },
              { id: '750', label: 'Karat 750 (18K)' },
              { id: '700', label: 'Karat 700 (17K)' },
              { id: '375', label: 'Karat 375 (8K)' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedKarat(tab.id)}
                className={`cursor-pointer whitespace-nowrap rounded-sm border border-line px-3.5 py-2 text-[0.8rem] ${
                  selectedKarat === tab.id
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

      {/* Finished Goods Table */}
      <div className="glass-panel p-6">
        <h3 className="font-heading text-[1.1rem] mb-4">
          📋 Katalog Barang Jadi Perhiasan Ekspor ({filteredGoods.length})
        </h3>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode SKU</TableHead>
              <TableHead>Nama Model / Style Design</TableHead>
              <TableHead>Jenis Perhiasan</TableHead>
              <TableHead>Kode Karat</TableHead>
              <TableHead>Warna Gold</TableHead>
              <TableHead className="text-right">Berat Standar (g)</TableHead>
              <TableHead className="text-right">Ongkos Tukang / g</TableHead>
              <TableHead>HS Code PEB</TableHead>
              <TableHead>Akun GL Stok</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGoods.length === 0 ? (
              <TableEmpty colSpan={9} message="Belum ada data master perhiasan jadi." />
            ) : (
              filteredGoods.map(fg => (
                <TableRow key={fg.id || fg.sku}>
                  <TableCell><strong>{fg.sku}</strong></TableCell>
                  <TableCell>{fg.name}</TableCell>
                  <TableCell><span className="badge badge-blue text-xs">{fg.type}</span></TableCell>
                  <TableCell><span className="badge badge-gold text-xs">Karat {fg.karat} ({fg.purity}%)</span></TableCell>
                  <TableCell><span className="badge badge-emerald text-xs">{fg.goldColor}</span></TableCell>
                  <TableCell className="text-right font-bold">{fg.stdWeightGram} g</TableCell>
                  <TableCell className="text-right">Rp {(fg.laborFeeIDRPerGram || 0).toLocaleString()}</TableCell>
                  <TableCell><small className="text-sky-light">{fg.hsCode || '7113.19.90'}</small></TableCell>
                  <TableCell><small className="text-emerald-light">1160 (Perhiasan Ekspor)</small></TableCell>
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
