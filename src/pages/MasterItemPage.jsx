import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, CheckCircle, Tag, Layers } from 'lucide-react';
import { getMasterItems, saveMasterItem, getCOA } from '../services/storageService';
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
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Package color="#f59e0b" size={24} /> Master Data Barang / Produk Emas
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Kelola Katalog Emas Batangan 999.9 (Lokal/Impor), Scrap, Perhiasan Karat, Master Alloy, & Batu Permata
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Tambah Barang Master Baru
          </button>
        </div>

        {showForm && (
          <form className="bg-[rgba(15,23,42,0.7)] p-5 rounded-[12px] mb-5 border border-gold" onSubmit={handleSubmit}>
            <h4 className="text-gold-light mb-3.5 text-[0.95rem]">➕ Form Tambah Barang Master</h4>
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
                <Combobox
                  value={form.category}
                  onChange={category => setForm({ ...form, category })}
                  searchPlaceholder="Cari kategori produk…"
                  emptyText="Kategori tidak ditemukan."
                  options={[
                    { value: 'Emas Murni', label: 'Emas Murni 999.9 (LM Lokal/Import)' },
                    { value: 'Emas Impor', label: 'Emas Impor Valcambi/PAMP' },
                    { value: 'Perhiasan 750', label: 'Perhiasan Emas 750 (18K)' },
                    { value: 'Perhiasan 700', label: 'Perhiasan Emas 700 (17K)' },
                    { value: 'Perhiasan 375', label: 'Perhiasan Emas 375 (8K)' },
                    { value: 'Scrap', label: 'Pecahan / Rongsok Scrap' },
                    { value: 'Master Alloy', label: 'Master Alloy (Perak/Tembaga/Zinc)' },
                    { value: 'Batu Permata', label: 'Batu Permata & Zircon' }
                  ]}
                />
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
                <NumberInput
                  allowDecimal
                  value={form.purity}
                  onChange={purity => setForm({ ...form, purity })}
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
            <button type="submit" className="btn-primary mt-3">
              <CheckCircle size={16} /> Simpan Barang Master
            </button>
          </form>
        )}

        <div className="relative max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
          <input
            className="form-input pl-9.5 w-full"
            placeholder="Cari kode, nama, atau kategori barang..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="font-heading text-[1.1rem] mb-4">
          📋 Daftar Barang Master ({filteredItems.length})
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama Barang</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Satuan</TableHead>
              <TableHead className="text-right">Kadar (%)</TableHead>
              <TableHead>Akun GL Stok</TableHead>
              <TableHead>Akun HPP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableEmpty colSpan={7} message="Belum ada data master barang." />
            ) : (
              filteredItems.map(item => (
                <TableRow key={item.id || item.code}>
                  <TableCell><strong>{item.code}</strong></TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell><span className="badge badge-gold text-xs">{item.category}</span></TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{item.purity || '-'}%</TableCell>
                  <TableCell><small className="text-emerald-light">{item.inventoryAccount || '1157'}</small></TableCell>
                  <TableCell><small className="text-sky-light">{item.cogsAccount || '5114'}</small></TableCell>
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
