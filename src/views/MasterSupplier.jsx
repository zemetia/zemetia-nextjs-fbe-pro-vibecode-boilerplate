import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle,
  Edit,
  Trash2,
  Eye,
  Download,
  X,
  Building2,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Tag,
  RefreshCw,
  AlertCircle,
  Layers,
  Globe2,
  Banknote,
  MoreHorizontal
} from 'lucide-react';
import {
  getSuppliers,
  saveSupplier,
  deleteSupplier
} from '../services/storageService';
import { SupplierDTO } from '../dto';
import {
  toast,
  Combobox,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Modal,
  useModal,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../components/ui';

// Daftar opsi jenis komoditas standar perdagangan & pengadaan emas PT TAN
// PENTING: HANYA JENIS BARANG SAJA, TANPA ATRIBUT BERAT/GRAMATUR!
const STANDARD_COMMODITY_TYPES = [
  'Emas Batangan 999.9 (Bullion Bar)',
  'Emas Butiran (Granule / Grain)',
  'Emas Galeri 24',
  'LBMA Good Delivery Gold Bar',
  'Perhiasan Emas Karat (750 / 700 / 375)',
  'Scrap Emas / Perhiasan Bekas',
  'Emas Rongsok Kadar Campur',
  'Perak Murni (Silver Bar / Granule 99.9%)',
  'Master Alloy (Copper / Zinc / Karat)',
  'Bahan Kimia Refineri (Nitric Acid / Borax / Potas)',
  'Kowi & Crucible Lebur (Clay / Graphite)',
  'Alat Uji & Timbangan Lab QC',
  'Jasa Refineri / Pengolahan Emas'
];

const CATEGORY_OPTIONS = [
  { value: 'LOCAL', label: 'Produsen / Distributor LM Lokal (IDR)' },
  { value: 'OVERSEAS', label: 'Overseas Refiner & Bullion Dealer (USD/SGD)' },
  { value: 'SCRAP', label: 'Pengepul Scrap & Perhiasan Bekas' },
  { value: 'ALLOY', label: 'Supplier Master Alloy & Perak' },
  { value: 'CONSUMABLE', label: 'Bahan Kimia Refineri & Consumables' }
];

const CURRENCY_OPTIONS = [
  { value: 'IDR', label: 'IDR (Rupiah Indonesia)' },
  { value: 'USD', label: 'USD (United States Dollar)' },
  { value: 'SGD', label: 'SGD (Singapore Dollar)' },
  { value: 'EUR', label: 'EUR (Euro)' }
];

const PAYMENT_TERMS_OPTIONS = [
  { value: 'CASH', label: 'CASH / Tunai' },
  { value: 'COD', label: 'COD (Cash on Delivery)' },
  { value: 'NET-7', label: 'NET-7 (Tempo 7 Hari)' },
  { value: 'NET-14', label: 'NET-14 (Tempo 14 Hari)' },
  { value: 'NET-30', label: 'NET-30 (Tempo 30 Hari)' },
  { value: 'CBD', label: 'CBD (Cash Before Delivery / Uang Muka)' }
];

const TAX_STATUS_OPTIONS = [
  { value: 'NON_PKP', label: 'Non-PKP (Bukan Pengusaha Kena Pajak)' },
  { value: 'PKP', label: 'PKP (Pengusaha Kena Pajak)' }
];

const emptySupplierForm = {
  id: '',
  code: '',
  name: '',
  category: 'LOCAL',
  suppliedItems: [],
  country: 'Indonesia',
  currency: 'IDR',
  paymentTerms: 'CASH',
  taxStatus: 'NON_PKP',
  npwp: '',
  contact: '',
  phone: '',
  email: '',
  address: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountHolder: '',
  notes: '',
  status: 'ACTIVE'
};

export default function MasterSupplier() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState(emptySupplierForm);
  const [customCommodityInput, setCustomCommodityInput] = useState('');

  // Modal dialog profile detail
  const [detailSupplier, setDetailSupplier] = useState(null);

  // Hook konfirmasi modal hapus
  const { modalProps, showModal } = useModal();

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = () => {
    const list = getSuppliers();
    setSuppliers(list);
  };

  // Helper pembuat kode supplier otomatis
  const generateSupplierCode = (cat = form.category) => {
    let prefix = 'SUPP-LOK';
    if (cat === 'OVERSEAS') prefix = 'SUPP-IMP';
    else if (cat === 'SCRAP') prefix = 'SUPP-SCRAP';
    else if (cat === 'ALLOY') prefix = 'SUPP-ALLOY';
    else if (cat === 'CONSUMABLE') prefix = 'SUPP-CONS';

    const numbers = suppliers
      .map(s => s.code || '')
      .filter(c => c.startsWith(prefix))
      .map(c => {
        const parts = c.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        return isNaN(num) ? 0 : num;
      });

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextCode = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
    setForm(prev => ({ ...prev, code: nextCode }));
  };

  // Toggle pilihan jenis barang yang disuplai (HANYA JENIS, TANPA BERAT)
  const toggleSuppliedItem = (itemType) => {
    setForm(prev => {
      const current = Array.isArray(prev.suppliedItems) ? [...prev.suppliedItems] : [];
      const exists = current.includes(itemType);
      const updated = exists ? current.filter(i => i !== itemType) : [...current, itemType];
      return { ...prev, suppliedItems: updated };
    });
  };

  // Tambah jenis barang kustom
  const handleAddCustomCommodity = () => {
    const trimmed = customCommodityInput.trim();
    if (!trimmed) return;
    if (!form.suppliedItems.includes(trimmed)) {
      setForm(prev => ({
        ...prev,
        suppliedItems: [...prev.suppliedItems, trimmed]
      }));
    }
    setCustomCommodityInput('');
  };

  // Buka form untuk tambah baru
  const handleOpenAddForm = () => {
    setIsEditMode(false);
    const initialCategory = 'LOCAL';
    let prefix = 'SUPP-LOK';
    const numbers = suppliers
      .map(s => s.code || '')
      .filter(c => c.startsWith(prefix))
      .map(c => {
        const parts = c.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        return isNaN(num) ? 0 : num;
      });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const autoCode = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;

    setForm({
      ...emptySupplierForm,
      code: autoCode,
      category: initialCategory,
      suppliedItems: ['Emas Batangan 999.9 (Bullion Bar)']
    });
    setShowForm(true);
  };

  // Buka form untuk edit data eksisting
  const handleEdit = (supp) => {
    setIsEditMode(true);
    setForm({
      id: supp.id || supp.code,
      code: supp.code || '',
      name: supp.name || '',
      category: supp.category || 'LOCAL',
      suppliedItems: Array.isArray(supp.suppliedItems) ? [...supp.suppliedItems] : [],
      country: supp.country || 'Indonesia',
      currency: supp.currency || 'IDR',
      paymentTerms: supp.paymentTerms || 'CASH',
      taxStatus: supp.taxStatus || 'NON_PKP',
      npwp: supp.npwp || '',
      contact: supp.contact || '',
      phone: supp.phone || '',
      email: supp.email || '',
      address: supp.address || '',
      bankName: supp.bankName || '',
      bankAccountNumber: supp.bankAccountNumber || '',
      bankAccountHolder: supp.bankAccountHolder || '',
      notes: supp.notes || '',
      status: supp.status || 'ACTIVE'
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler Hapus Supplier dengan Konfirmasi Modal
  const handleDelete = (supp) => {
    showModal({
      variant: 'confirm',
      title: 'Hapus Master Supplier',
      message: `Apakah Anda yakin ingin menghapus supplier "${supp.name}" (${supp.code})?\n\nPerhatian: Data supplier yang dihapus tidak dapat dipulihkan.`,
      confirmLabel: 'Hapus Sekarang',
      onConfirm: async () => {
        await deleteSupplier(supp.id || supp.code);
        toast.success(`Supplier "${supp.name}" berhasil dihapus.`);
        loadSuppliers();
        if (detailSupplier?.code === supp.code) {
          setDetailSupplier(null);
        }
      }
    });
  };

  // Submit form dengan validasi DTO
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validation = SupplierDTO.validateForm(form);
    if (!validation.success) {
      toast.warning(validation.errorMessages.join('\n'));
      return;
    }

    const payload = {
      ...validation.data,
      id: form.id || form.code,
      updatedAt: new Date().toISOString()
    };

    try {
      const res = await saveSupplier(payload);
      if (res.success) {
        toast.success(
          isEditMode
            ? `Supplier "${payload.name}" (${payload.code}) berhasil diperbarui.`
            : `Supplier baru "${payload.name}" (${payload.code}) berhasil ditambahkan.`
        );
        loadSuppliers();
        setShowForm(false);
        setIsEditMode(false);
        setForm(emptySupplierForm);
      }
    } catch (err) {
      toast.error('Gagal menyimpan supplier: ' + err.message);
    }
  };

  // Ekspor daftar supplier ke CSV
  const handleExportCSV = () => {
    if (filteredSuppliers.length === 0) {
      toast.warning('Tidak ada data supplier untuk diekspor.');
      return;
    }

    const headers = [
      'Kode',
      'Nama Supplier',
      'Kategori',
      'Negara',
      'Mata Uang',
      'Termin Bayar',
      'Status Pajak',
      'NPWP',
      'PIC / Kontak',
      'Telepon',
      'Email',
      'Bank Penerima',
      'No Rekening',
      'Atas Nama Rekening',
      'Jenis Barang Disuplai',
      'Status',
      'Alamat',
      'Catatan'
    ];

    const rows = filteredSuppliers.map(s => [
      s.code,
      s.name,
      s.category,
      s.country || 'Indonesia',
      s.currency || 'IDR',
      s.paymentTerms || 'CASH',
      s.taxStatus || 'NON_PKP',
      s.npwp || '-',
      s.contact || '-',
      s.phone || '-',
      s.email || '-',
      s.bankName || '-',
      s.bankAccountNumber || '-',
      s.bankAccountHolder || '-',
      Array.isArray(s.suppliedItems) ? s.suppliedItems.join('; ') : '-',
      s.status || 'ACTIVE',
      s.address || '-',
      s.notes || '-'
    ]);

    const csvString = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Master_Supplier_PT_TAN_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Daftar supplier berhasil diekspor ke CSV.');
  };

  // Filter list
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.code?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.country?.toLowerCase().includes(q) ||
        s.contact?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        (Array.isArray(s.suppliedItems) && s.suppliedItems.some(item => item.toLowerCase().includes(q)));

      const matchCategory = categoryFilter === 'ALL' || s.category === categoryFilter;
      const matchCurrency = currencyFilter === 'ALL' || s.currency === currencyFilter;
      const matchStatus = statusFilter === 'ALL' || (s.status || 'ACTIVE') === statusFilter;

      return matchSearch && matchCategory && matchCurrency && matchStatus;
    });
  }, [suppliers, searchQuery, categoryFilter, currencyFilter, statusFilter]);

  // Statistik KPI Top Summary
  const kpiStats = useMemo(() => {
    const total = suppliers.length;
    const overseas = suppliers.filter(s => s.category === 'OVERSEAS' || s.currency !== 'IDR').length;
    const local = suppliers.filter(s => s.category === 'LOCAL').length;
    const scrap = suppliers.filter(s => s.category === 'SCRAP').length;
    const consumables = suppliers.filter(s => s.category === 'CONSUMABLE' || s.category === 'ALLOY').length;
    return { total, overseas, local, scrap, consumables };
  }, [suppliers]);

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'OVERSEAS':
        return <Badge variant="sky">✈️ Impor Valas</Badge>;
      case 'LOCAL':
        return <Badge variant="gold">🏛️ Produsen Lokal</Badge>;
      case 'SCRAP':
        return <Badge variant="orange">♻️ Pengepul Scrap</Badge>;
      case 'ALLOY':
        return <Badge variant="emerald">🧪 Master Alloy</Badge>;
      case 'CONSUMABLE':
        return <Badge variant="sky">📦 Bahan Kimia</Badge>;
      default:
        return <Badge variant="outline">{cat}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER HALAMAN & ACTIONS */}
      <div className="glass-panel p-6 border-b border-line">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="p-2.5 rounded-md bg-gold/10 text-gold border border-gold/25">
                <Truck size={24} />
              </span>
              <div>
                <h1 className="font-heading text-xl font-bold tracking-wide text-fg">
                  Master Data Supplier & Pemasok Emas
                </h1>
                <p className="text-xs text-fg-soft mt-0.5">
                  Direktori Resmi Produsen Emas Lokal, Bullion Overseas LBMA, Pengepul Scrap, Perak & Consumables PT TAN
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2"
              onClick={handleExportCSV}
              title="Unduh data dalam format CSV"
            >
              <Download size={15} /> Ekspor CSV
            </button>

            <button
              className="btn-primary text-xs flex items-center gap-1.5 px-4 py-2"
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                  setIsEditMode(false);
                } else {
                  handleOpenAddForm();
                }
              }}
            >
              {showForm ? (
                <>
                  <X size={15} /> Tutup Form
                </>
              ) : (
                <>
                  <Plus size={15} /> Tambah Supplier Baru
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. TOP KPI SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2 border-t border-line/60">
          <div className="bg-surface/50 border border-line p-3.5 rounded-md flex items-center justify-between">
            <div>
              <p className="text-[0.7rem] uppercase tracking-wider text-fg-muted font-medium">Total Supplier</p>
              <h3 className="text-lg font-bold text-fg tabular-nums mt-0.5">{kpiStats.total} Mitra</h3>
            </div>
            <span className="p-2 rounded bg-surface border border-line text-fg-soft">
              <Building2 size={18} />
            </span>
          </div>

          <div className="bg-surface/50 border border-sky/30 p-3.5 rounded-md flex items-center justify-between">
            <div>
              <p className="text-[0.7rem] uppercase tracking-wider text-sky-light font-medium">Impor Valas (LBMA)</p>
              <h3 className="text-lg font-bold text-sky-light tabular-nums mt-0.5">{kpiStats.overseas} Mitra</h3>
            </div>
            <span className="p-2 rounded bg-sky/10 border border-sky/25 text-sky-light">
              <Globe2 size={18} />
            </span>
          </div>

          <div className="bg-surface/50 border border-gold/30 p-3.5 rounded-md flex items-center justify-between">
            <div>
              <p className="text-[0.7rem] uppercase tracking-wider text-gold font-medium">Produsen Lokal (IDR)</p>
              <h3 className="text-lg font-bold text-gold tabular-nums mt-0.5">{kpiStats.local} Mitra</h3>
            </div>
            <span className="p-2 rounded bg-gold/10 border border-gold/25 text-gold">
              <Banknote size={18} />
            </span>
          </div>

          <div className="bg-surface/50 border border-orange/30 p-3.5 rounded-md flex items-center justify-between">
            <div>
              <p className="text-[0.7rem] uppercase tracking-wider text-orange font-medium">Scrap & Consumables</p>
              <h3 className="text-lg font-bold text-orange tabular-nums mt-0.5">
                {kpiStats.scrap + kpiStats.consumables} Mitra
              </h3>
            </div>
            <span className="p-2 rounded bg-orange/10 border border-orange/25 text-orange">
              <Layers size={18} />
            </span>
          </div>
        </div>
      </div>

      {/* 3. FORM INPUT / EDIT SUPPLIER */}
      {showForm && (
        <div className="glass-panel p-6 border border-gold/30 rounded-lg shadow-lg animate-in fade-in duration-200">
          <div className="flex justify-between items-center pb-3.5 mb-4 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded bg-gold/15 text-gold">
                {isEditMode ? <Edit size={18} /> : <Plus size={18} />}
              </span>
              <h3 className="font-heading text-base font-bold text-fg">
                {isEditMode ? `Edit Data Supplier: ${form.name}` : 'Formulir Tambah Supplier Baru'}
              </h3>
            </div>
            <button
              className="text-fg-muted hover:text-fg p-1 rounded transition-colors"
              onClick={() => setShowForm(false)}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1: Kode, Nama, Kategori, Negara */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="form-group">
                <label className="form-label flex items-center justify-between">
                  <span>Kode Supplier <span className="text-danger">*</span></span>
                  <button
                    type="button"
                    onClick={() => generateSupplierCode(form.category)}
                    className="text-[0.7rem] text-gold hover:underline flex items-center gap-1 font-normal"
                    title="Buat kode supplier otomatis"
                  >
                    <RefreshCw size={11} /> Auto Code
                  </button>
                </label>
                <input
                  className="form-input font-mono"
                  placeholder="Contoh: SUPP-LOK-001"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="form-group lg:col-span-2">
                <label className="form-label">
                  Nama Perusahaan / Supplier <span className="text-danger">*</span>
                </label>
                <input
                  className="form-input"
                  placeholder="Contoh: PT Antam Tbk / YLG Bullion Pte Ltd"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kategori Supplier</label>
                <Combobox
                  value={form.category}
                  onChange={category => {
                    setForm(prev => ({ ...prev, category }));
                    if (!isEditMode) generateSupplierCode(category);
                  }}
                  options={CATEGORY_OPTIONS}
                  searchPlaceholder="Pilih kategori supplier…"
                  emptyText="Kategori tidak ditemukan."
                />
              </div>
            </div>

            {/* Row 2: Negara, Valas Utama, Termin Bayar, Status Pajak */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="form-group">
                <label className="form-label">Negara Asal</label>
                <input
                  className="form-input"
                  placeholder="Indonesia / Singapore / Switzerland"
                  value={form.country}
                  onChange={e => setForm({ ...form, country: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mata Uang Utama Transaksi</label>
                <Combobox
                  value={form.currency}
                  onChange={currency => setForm({ ...form, currency })}
                  options={CURRENCY_OPTIONS}
                  searchPlaceholder="Pilih valas…"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Termin Pembayaran</label>
                <Combobox
                  value={form.paymentTerms}
                  onChange={paymentTerms => setForm({ ...form, paymentTerms })}
                  options={PAYMENT_TERMS_OPTIONS}
                  searchPlaceholder="Pilih termin bayar…"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status Perpajakan</label>
                <Combobox
                  value={form.taxStatus}
                  onChange={taxStatus => setForm({ ...form, taxStatus })}
                  options={TAX_STATUS_OPTIONS}
                  searchPlaceholder="Pilih status pajak…"
                />
              </div>
            </div>

            {/* SEKSI KHUSUS: JENIS KOMODITAS / BARANG YANG DISUPLAI (TANPA BERAT) */}
            <div className="bg-surface/60 border border-gold/25 p-4 rounded-md space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-gold" />
                  <label className="text-sm font-semibold text-fg">
                    Jenis Barang / Komoditas yang Disuplai
                  </label>
                </div>
                <span className="text-[0.75rem] text-gold-light bg-gold/10 px-2.5 py-0.5 rounded border border-gold/20">
                  ⚠️ Hanya jenis komoditas saja (tanpa kuantitas/berat)
                </span>
              </div>
              <p className="text-xs text-fg-soft">
                Pilih jenis barang yang dipasok oleh supplier ini. Klik untuk mengaktifkan atau menonaktifkan:
              </p>

              {/* Chips Pilihan Standar */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STANDARD_COMMODITY_TYPES.map(itemType => {
                  const isSelected = form.suppliedItems?.includes(itemType);
                  return (
                    <button
                      key={itemType}
                      type="button"
                      onClick={() => toggleSuppliedItem(itemType)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        isSelected
                          ? 'bg-gold/20 text-gold-light border-gold font-medium shadow-sm'
                          : 'bg-surface/80 text-fg-muted border-line hover:border-gold/40 hover:text-fg'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {itemType}
                    </button>
                  );
                })}
              </div>

              {/* Input Tambah Jenis Barang Kustom */}
              <div className="flex items-center gap-2 pt-2 border-t border-line/50">
                <input
                  className="form-input text-xs flex-1 max-w-[400px]"
                  placeholder="Tambahkan jenis komoditas kustom lainnya…"
                  value={customCommodityInput}
                  onChange={e => setCustomCommodityInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomCommodity();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomCommodity}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  + Tambah Jenis
                </button>

                {form.suppliedItems?.length > 0 && (
                  <span className="text-xs text-fg-soft ml-auto">
                    Terpilih: <strong className="text-gold">{form.suppliedItems.length}</strong> jenis komoditas
                  </span>
                )}
              </div>
            </div>

            {/* Row 3: Kontak, Telepon, Email, NPWP */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="form-group">
                <label className="form-label">Contact Person (PIC)</label>
                <input
                  className="form-input"
                  placeholder="Nama PIC / Bagian Penjualan"
                  value={form.contact}
                  onChange={e => setForm({ ...form, contact: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. Telepon / WhatsApp</label>
                <input
                  className="form-input"
                  placeholder="021-xxxx / 0812-xxxx"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Operasional</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="sales@supplier.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nomor NPWP</label>
                <input
                  className="form-input"
                  placeholder="00.000.000.0-000.000"
                  value={form.npwp}
                  onChange={e => setForm({ ...form, npwp: e.target.value })}
                />
              </div>
            </div>

            {/* Row 4: Informasi Bank Pembayaran */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface/40 p-3.5 rounded-md border border-line">
              <div className="form-group">
                <label className="form-label">Bank Penerima</label>
                <input
                  className="form-input"
                  placeholder="Bank BCA / Mandiri / DBS"
                  value={form.bankName}
                  onChange={e => setForm({ ...form, bankName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nomor Rekening</label>
                <input
                  className="form-input font-mono"
                  placeholder="Nomor rekening transfer"
                  value={form.bankAccountNumber}
                  onChange={e => setForm({ ...form, bankAccountNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Atas Nama Rekening</label>
                <input
                  className="form-input"
                  placeholder="Nama pemilik rekening bank"
                  value={form.bankAccountHolder}
                  onChange={e => setForm({ ...form, bankAccountHolder: e.target.value })}
                />
              </div>
            </div>

            {/* Row 5: Alamat & Catatan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Alamat Kantor / Refinery</label>
                <textarea
                  className="form-textarea text-xs"
                  rows={2}
                  placeholder="Alamat fisik lengkap kantor atau pabrik/refinery..."
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Catatan Operasional & Legalitas</label>
                <textarea
                  className="form-textarea text-xs"
                  rows={2}
                  placeholder="Catatan sertifikasi LBMA, jadwal pengiriman, otorisasi kurir..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            {/* Tombol Simpan & Batal */}
            <div className="flex justify-between items-center pt-3 border-t border-line">
              <button
                type="button"
                className="btn-secondary text-xs px-4 py-2"
                onClick={() => {
                  setShowForm(false);
                  setIsEditMode(false);
                  setForm(emptySupplierForm);
                }}
              >
                Batal
              </button>

              <button
                type="submit"
                className="btn-primary text-xs flex items-center gap-1.5 px-5 py-2 font-semibold"
              >
                <CheckCircle size={16} />
                {isEditMode ? 'Simpan Perubahan Supplier' : 'Simpan Supplier Baru'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. FILTER & SEARCH TOOLBAR */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[280px] flex-1 max-w-[420px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={16} />
          <input
            className="form-input pl-9.5 text-xs w-full"
            placeholder="Cari kode, nama supplier, kontak, atau jenis barang…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-[180px]">
            <Combobox
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: 'ALL', label: 'Semua Kategori' },
                ...CATEGORY_OPTIONS
              ]}
              searchPlaceholder="Filter kategori…"
            />
          </div>

          <div className="w-[130px]">
            <Combobox
              value={currencyFilter}
              onChange={setCurrencyFilter}
              options={[
                { value: 'ALL', label: 'Semua Valas' },
                ...CURRENCY_OPTIONS
              ]}
              searchPlaceholder="Filter valas…"
            />
          </div>

          <div className="w-[130px]">
            <Combobox
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'Semua Status' },
                { value: 'ACTIVE', label: 'Aktif' },
                { value: 'INACTIVE', label: 'Non-Aktif' }
              ]}
              searchPlaceholder="Filter status…"
            />
          </div>

          {(searchQuery || categoryFilter !== 'ALL' || currencyFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('ALL');
                setCurrencyFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="btn-secondary text-xs px-2.5 py-1.5 text-fg-muted hover:text-fg"
              title="Reset seluruh filter"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 5. TABEL DATA MASTER SUPPLIER */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="font-heading text-base font-bold text-fg flex items-center gap-2">
            <span>📋 Daftar Master Supplier Terdaftar</span>
            <span className="text-xs font-normal text-fg-muted bg-surface px-2 py-0.5 rounded border border-line">
              Menampilkan {filteredSuppliers.length} dari {suppliers.length} mitra
            </span>
          </h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Kode</TableHead>
              <TableHead>Nama Perusahaan</TableHead>
              <TableHead className="w-[160px]">Kategori</TableHead>
              <TableHead>Jenis Barang yang Disuplai</TableHead>
              <TableHead className="w-[100px]">Valas</TableHead>
              <TableHead className="w-[150px]">Kontak & Telp</TableHead>
              <TableHead className="w-[90px] text-center">Status</TableHead>
              <TableHead className="w-16 text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? (
              <TableEmpty
                colSpan={8}
                message={
                  searchQuery || categoryFilter !== 'ALL'
                    ? 'Tidak ada data supplier yang cocok dengan filter pencarian.'
                    : 'Belum ada data master supplier emas.'
                }
              />
            ) : (
              filteredSuppliers.map(s => {
                const items = Array.isArray(s.suppliedItems) ? s.suppliedItems : [];
                return (
                  <TableRow key={s.id || s.code} className="hover:bg-gold/[0.04] transition-colors">
                    <TableCell>
                      <strong className="font-mono text-xs text-gold-light">{s.code}</strong>
                    </TableCell>

                    <TableCell>
                      <div>
                        <strong className="text-fg font-semibold">{s.name}</strong>
                        <div className="text-[0.72rem] text-fg-soft flex items-center gap-2 mt-0.5">
                          <span>{s.country || 'Indonesia'}</span>
                          {s.taxStatus === 'PKP' ? (
                            <span className="text-emerald-light font-medium">• PKP</span>
                          ) : (
                            <span className="text-fg-muted">• Non-PKP</span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {getCategoryBadge(s.category)}
                    </TableCell>

                    {/* JENIS BARANG YANG DISUPLAI (HANYA JENIS, TANPA BERAT) */}
                    <TableCell>
                      {items.length === 0 ? (
                        <span className="text-xs text-fg-muted italic">- Tidak dispesifikasikan -</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[380px]">
                          {items.slice(0, 3).map((item, idx) => (
                            <span
                              key={idx}
                              className="text-[0.68rem] bg-surface/90 text-fg-soft px-2 py-0.5 rounded border border-line whitespace-nowrap"
                            >
                              {item}
                            </span>
                          ))}
                          {items.length > 3 && (
                            <span className="text-[0.68rem] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-mono">
                              +{items.length - 3} lagi
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="font-mono text-xs">
                        <strong className={s.currency !== 'IDR' ? 'text-sky-light' : 'text-fg'}>
                          {s.currency || 'IDR'}
                        </strong>
                        <div className="text-[0.7rem] text-fg-soft">{s.paymentTerms || 'CASH'}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        <div className="text-fg truncate max-w-[140px]" title={s.contact}>
                          {s.contact || '-'}
                        </div>
                        <div className="text-[0.7rem] text-fg-soft truncate max-w-[140px]" title={s.phone || s.email}>
                          {s.phone || s.email || '-'}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      {(s.status || 'ACTIVE') === 'ACTIVE' ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.6)]" title="Aktif" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-fg-muted" title="Nonaktif" />
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 p-0 text-fg-soft hover:text-fg hover:bg-surface-raised cursor-pointer mx-auto"
                            aria-label={`Aksi untuk ${s.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 z-[1100]">
                          <DropdownMenuItem
                            onClick={() => setDetailSupplier(s)}
                            className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                          >
                            <Eye className="h-4 w-4 text-sky-light" />
                            <span>Lihat Profil Lengkap</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEdit(s)}
                            className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                          >
                            <Edit className="h-4 w-4 text-gold" />
                            <span>Edit Data Supplier</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(s)}
                            className="flex items-center gap-2 cursor-pointer text-danger hover:bg-danger/10 focus:bg-danger/10 focus:text-danger"
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                            <span>Hapus Supplier</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 6. MODAL DETAIL PROFIL LENGKAP SUPPLIER */}
      {detailSupplier && (
        <div
          className="fixed inset-0 z-[1050] flex items-center justify-center bg-[rgba(3,7,18,0.78)] p-4 backdrop-blur-[6px] animate-in fade-in duration-150"
          onClick={() => setDetailSupplier(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-[680px] overflow-y-auto rounded-lg border border-t-[3px] border-line border-t-gold bg-linear-160 from-[#1a2338] to-surface p-6 shadow-modal animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex justify-between items-start pb-3.5 mb-4 border-b border-line">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded bg-gold/15 text-gold border border-gold/30">
                  <Building2 size={22} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gold-light font-bold bg-gold/10 px-2 py-0.5 rounded border border-gold/20">
                      {detailSupplier.code}
                    </span>
                    {getCategoryBadge(detailSupplier.category)}
                  </div>
                  <h3 className="text-lg font-bold text-fg mt-1">
                    {detailSupplier.name}
                  </h3>
                </div>
              </div>

              <button
                className="text-fg-muted hover:text-fg p-1.5 rounded transition-colors"
                onClick={() => setDetailSupplier(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Seksi Jenis Komoditas yang Disuplai */}
              <div className="bg-surface/80 p-3.5 rounded border border-gold/20">
                <div className="flex items-center gap-1.5 text-gold font-semibold text-xs mb-2">
                  <Tag size={14} /> Jenis Barang / Komoditas yang Disuplai (Tanpa Berat):
                </div>
                {Array.isArray(detailSupplier.suppliedItems) && detailSupplier.suppliedItems.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {detailSupplier.suppliedItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="bg-gold/15 text-gold-light border border-gold/30 px-2.5 py-1 rounded-full text-xs"
                      >
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-fg-muted italic">Tidak ada spesifikasi komoditas tercatat.</p>
                )}
              </div>

              {/* Grid Informasi Finansial & Pajak */}
              <div className="grid grid-cols-2 gap-3 bg-surface/50 p-3.5 rounded border border-line">
                <div>
                  <span className="text-fg-muted block text-[0.7rem] uppercase">Mata Uang Transaksi</span>
                  <strong className="text-sm text-sky-light font-mono">{detailSupplier.currency || 'IDR'}</strong>
                </div>
                <div>
                  <span className="text-fg-muted block text-[0.7rem] uppercase">Termin Pembayaran</span>
                  <strong className="text-sm text-fg">{detailSupplier.paymentTerms || 'CASH'}</strong>
                </div>
                <div>
                  <span className="text-fg-muted block text-[0.7rem] uppercase">Status Perpajakan</span>
                  <span className="font-semibold text-fg">
                    {detailSupplier.taxStatus === 'PKP' ? 'PKP (Pengusaha Kena Pajak)' : 'Non-PKP'}
                  </span>
                </div>
                <div>
                  <span className="text-fg-muted block text-[0.7rem] uppercase">Nomor NPWP</span>
                  <span className="font-mono text-fg">{detailSupplier.npwp || '-'}</span>
                </div>
              </div>

              {/* Rekening Bank */}
              <div className="bg-surface/50 p-3.5 rounded border border-line space-y-1">
                <div className="flex items-center gap-1.5 text-fg font-semibold text-xs mb-1">
                  <CreditCard size={14} className="text-sky-light" /> Informasi Rekening Bank Pembayaran
                </div>
                <div className="grid grid-cols-3 gap-2 text-[0.75rem]">
                  <div>
                    <span className="text-fg-muted block text-[0.68rem]">Nama Bank:</span>
                    <strong className="text-fg">{detailSupplier.bankName || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-fg-muted block text-[0.68rem]">No. Rekening:</span>
                    <strong className="text-fg font-mono">{detailSupplier.bankAccountNumber || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-fg-muted block text-[0.68rem]">Atas Nama:</span>
                    <strong className="text-fg">{detailSupplier.bankAccountHolder || '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Kontak & Lokasi */}
              <div className="grid grid-cols-2 gap-3 bg-surface/50 p-3.5 rounded border border-line">
                <div>
                  <span className="text-fg-muted block text-[0.7rem] uppercase flex items-center gap-1">
                    <Phone size={12} /> PIC / Kontak
                  </span>
                  <strong className="text-fg">{detailSupplier.contact || '-'}</strong>
                  <div className="text-fg-soft text-[0.72rem] mt-0.5">{detailSupplier.phone || '-'}</div>
                </div>
                <div>
                  <span className="text-fg-muted block text-[0.7rem] uppercase flex items-center gap-1">
                    <Mail size={12} /> Email
                  </span>
                  <span className="text-fg">{detailSupplier.email || '-'}</span>
                  <div className="text-fg-soft text-[0.72rem] mt-0.5">{detailSupplier.country || 'Indonesia'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-fg-muted block text-[0.7rem] uppercase flex items-center gap-1">
                    <MapPin size={12} /> Alamat Fisik
                  </span>
                  <p className="text-fg mt-0.5">{detailSupplier.address || '-'}</p>
                </div>
              </div>

              {/* Catatan */}
              {detailSupplier.notes && (
                <div className="bg-surface/30 p-3 rounded border border-line/60">
                  <span className="text-fg-muted block text-[0.7rem] uppercase flex items-center gap-1 mb-1">
                    <FileText size={12} /> Catatan Tambahan
                  </span>
                  <p className="text-fg-soft whitespace-pre-wrap">{detailSupplier.notes}</p>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex justify-between items-center mt-5 pt-3.5 border-t border-line">
              <button
                type="button"
                className="btn-secondary text-xs px-4 py-2"
                onClick={() => setDetailSupplier(null)}
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-primary text-xs flex items-center gap-1 px-4 py-2"
                  onClick={() => {
                    const supp = detailSupplier;
                    setDetailSupplier(null);
                    handleEdit(supp);
                  }}
                >
                  <Edit size={14} /> Edit Data Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DIALOG KONFIRMASI (useModal) */}
      <Modal {...modalProps} />
    </div>
  );
}

