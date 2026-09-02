import React, { useState, useEffect } from 'react';
import {
  Flame, Scale, Activity, Plus, Search, Filter, Printer,
  CheckCircle2, FileText, Warehouse, Sparkles, ArrowRightLeft,
  DollarSign, Layers, ShieldCheck, MoreHorizontal
} from 'lucide-react';
import {
  getScrapPurchases,
  saveScrapPurchase,
  getSuppliers,
  getWarehouses
} from '../services/storageService';
import { exportScrapPurchaseReceiptPdf } from '../services/pdfService';
import {
  Modal,
  useModal,
  toast,
  Combobox,
  NumberInput,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '../components/ui';

export default function BuyingScrapMelting() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'register', 'melting-spk'
  const [scrapPurchases, setScrapPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    receiptNo: `NOTA-SCRAP-2026-${Date.now().toString().slice(-4)}`,
    spkMeltingNo: `SPK-MLT-2026-${Date.now().toString().slice(-4)}`,
    date: new Date().toISOString().split('T')[0],
    supplierName: 'Toko Emas Mitra Sejahtera Jakarta',
    itemDescription: 'Pecahan Perhiasan Emas Bekas Karat Campur',
    grossWeight: 500,
    xrfPurity: 75.5, // 75.5% Kadar XRF
    pricePerFineGram: 1200000,
    paymentMethod: 'CASH', // CASH, BANK_BCA, TEMPO
    targetVault: '1152', // 1152 (Vault Scrap) or 11502 (WIP Lebur)
    notes: 'Kondisi fisik telah diuji XRF Spectrometer di Lab PT TAN.'
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    setScrapPurchases(getScrapPurchases());
    setSuppliers(getSuppliers());
  };

  // Calculations
  const estimatedFineGold = Number(((formData.grossWeight || 0) * ((formData.xrfPurity || 0) / 100)).toFixed(2));
  const totalAmount = Math.round(estimatedFineGold * (formData.pricePerFineGram || 0));

  const getCreditAccountInfo = (method) => {
    if (method === 'BANK_BCA') {
      return { code: '1111-IDR', name: 'Bank BCA IDR (Rekening Operasional)' };
    }
    if (method === 'TEMPO') {
      return { code: '2111', name: 'Hutang Usaha (Trade Payables)' };
    }
    return { code: '1110', name: 'Kas Kecil (Petty Cash)' };
  };

  const getTargetVaultName = (vaultCode) => {
    if (vaultCode === '11502') return 'Vault Emas WIP Leburan (Akun 11502)';
    if (vaultCode === '1157') return 'Vault Utama LM 999.9 (Akun 1157)';
    return 'Vault Pecahan Scrap & Leburan (Akun 1152)';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.supplierName || !formData.grossWeight || !formData.xrfPurity || !formData.pricePerFineGram) {
      toast.warning('Mohon lengkapi Supplier, Berat Kotor Scrap, Kadar XRF (%), dan Harga Beli Fine Gold.');
      return;
    }

    const creditAcc = getCreditAccountInfo(formData.paymentMethod);
    const targetVaultName = getTargetVaultName(formData.targetVault);

    const payload = {
      ...formData,
      estimatedFineGold,
      totalAmount,
      creditAccount: creditAcc.code,
      creditAccountName: creditAcc.name,
      targetVaultName,
      status: formData.targetVault === '11502' ? 'IN MELTING PROCESS (WIP)' : 'RECEIVED & STORED IN SCRAP VAULT'
    };

    const result = await saveScrapPurchase(payload);

    if (result.success) {
      showModal({
        variant: 'success',
        title: `✅ Nota Pembelian Scrap (${result.scrap.receiptNo}) Tersimpan`,
        message: `• Supplier: ${formData.supplierName}\n• Berat Kotor: ${formData.grossWeight}g | Kadar XRF: ${formData.xrfPurity}%\n• Estimasi Fine Gold Murni: ${estimatedFineGold}g\n• Total Pembelian: Rp ${totalAmount.toLocaleString()}\n\nJurnal SAK EMKM Diposting:\n• Debet: ${targetVaultName} Rp ${totalAmount.toLocaleString()}\n• Kredit: ${creditAcc.name} Rp ${totalAmount.toLocaleString()}`
      });

      setFormData(prev => ({
        ...prev,
        receiptNo: `NOTA-SCRAP-2026-${Date.now().toString().slice(-4)}`,
        spkMeltingNo: `SPK-MLT-2026-${Date.now().toString().slice(-4)}`,
        grossWeight: 500,
        xrfPurity: 75.5
      }));

      loadInitialData();
      setActiveTab('register');
    } else {
      toast.error('Terjadi kesalahan saat memproses pembelian scrap emas.');
    }
  };

  const filteredPurchases = scrapPurchases.filter(p =>
    p.receiptNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.spkMeltingNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.itemDescription?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header Controls */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Flame color="#ef4444" size={24} /> Modul Pembelian Pecahan Scrap & SPK Lebur Workshop
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Pengujian Kadar XRF Spectrometer, Kalkulasi Fine Gold Murni, Penerbitan SPK Leburan, & Integrasi Persediaan Vault 1152
            </p>
          </div>

          <div className="flex gap-2.5">
            <button
              className={`btn-primary ${
                activeTab === 'create'
                  ? 'bg-linear-135 from-rose-500 to-rose-700 font-bold text-white'
                  : 'bg-[rgba(15,23,42,0.6)] font-medium text-fg-soft'
              }`}
              onClick={() => setActiveTab('create')}
            >
              <Plus size={16} /> Input Pembelian Scrap
            </button>
            <button
              className={`btn-primary ${
                activeTab === 'register'
                  ? 'bg-linear-135 from-gold to-gold-dark font-bold text-white'
                  : 'bg-[rgba(15,23,42,0.6)] font-medium text-fg-soft'
              }`}
              onClick={() => setActiveTab('register')}
            >
              <FileText size={16} /> Register Nota Scrap ({scrapPurchases.length})
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'create', label: '🔥 Form Beli Scrap & Uji Kadar XRF' },
            { id: 'register', label: '📜 Register Riwayat Pembelian Scrap' },
            { id: 'melting-spk', label: '⚗️ Alur SPK Lebur ke Granul Murni' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer whitespace-nowrap rounded-sm border border-line px-3.5 py-[9px] text-[0.8rem] ${
                activeTab === tab.id
                  ? 'bg-linear-135 from-rose-600 to-rose-800 font-bold text-white'
                  : 'bg-[rgba(15,23,42,0.6)] font-medium text-fg-soft'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: FORM PEMBELIAN SCRAP & XRF */}
      {activeTab === 'create' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 text-rose-400 flex items-center gap-2">
            <Scale size={20} /> Form Input Pembelian Emas Scrap & Uji Spektrometer
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">No. Nota Pembelian Scrap</label>
                <input
                  className="form-input font-bold text-gold-light"
                  value={formData.receiptNo}
                  onChange={e => setFormData({ ...formData, receiptNo: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Transaksi</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Toko / Supplier Scrap Emas</label>
                <Combobox
                  value={formData.supplierName}
                  onChange={supplierName => setFormData({ ...formData, supplierName })}
                  placeholder="-- Pilih Supplier / Toko Emas --"
                  searchPlaceholder="Cari nama supplier…"
                  emptyText="Supplier tidak ditemukan."
                  options={[
                    { value: 'Toko Emas Mitra Sejahtera Jakarta', label: 'Toko Emas Mitra Sejahtera Jakarta' },
                    { value: 'Toko Emas Sumber Rejeki Cikini', label: 'Toko Emas Sumber Rejeki Cikini' },
                    { value: 'Toko Emas Bintang Terang Surabaya', label: 'Toko Emas Bintang Terang Surabaya' },
                    ...suppliers.map(s => ({ value: s.name, label: s.name }))
                  ]}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Deskripsi Barang Scrap</label>
                <input
                  className="form-input"
                  value={formData.itemDescription}
                  onChange={e => setFormData({ ...formData, itemDescription: e.target.value })}
                  placeholder="Contoh: Pecahan Kalung & Cincin 750"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Kotor Scrap (Gross Weight Gram)</label>
                <NumberInput
                  allowDecimal
                  value={formData.grossWeight}
                  onChange={grossWeight => setFormData({ ...formData, grossWeight })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hasil Uji Kadar XRF Spectrometer (%)</label>
                <NumberInput
                  allowDecimal
                  value={formData.xrfPurity}
                  onChange={xrfPurity => setFormData({ ...formData, xrfPurity })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Harga Beli Fine Gold Murni / Gram (IDR)</label>
                <NumberInput
                  value={formData.pricePerFineGram}
                  onChange={pricePerFineGram => setFormData({ ...formData, pricePerFineGram })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Metode Pembayaran</label>
                <select
                  className="form-select"
                  value={formData.paymentMethod}
                  onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  <option value="CASH">💵 Kas Tunai / Kas Kecil (Akun 1110)</option>
                  <option value="BANK_BCA">🏦 Transfer Bank BCA IDR (Akun 1111-IDR)</option>
                  <option value="TEMPO">⏳ Hutang Usaha / Tempo (Akun 2111)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tujuan Alur Masuk Brankas</label>
                <select
                  className="form-select"
                  value={formData.targetVault}
                  onChange={e => setFormData({ ...formData, targetVault: e.target.value })}
                >
                  <option value="1152">🏛️ Simpan di Vault Pecahan Scrap & Leburan (Akun 1152)</option>
                  <option value="11502">⚗️ Langsung Terbitkan SPK Lebur Ke Vault WIP (Akun 11502)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">No. SPK Lebur (Auto-Generated)</label>
                <input
                  className="form-input text-fg-soft"
                  value={formData.spkMeltingNo}
                  onChange={e => setFormData({ ...formData, spkMeltingNo: e.target.value })}
                />
              </div>
            </div>

            {/* Real-time Calculation Summary Card */}
            <div className="bg-[rgba(15,23,42,0.7)] p-5 rounded-[12px] my-5 border border-rose-500/30">
              <h4 className="text-rose-400 mb-3 text-[0.95rem] flex items-center gap-2">
                <Sparkles size={16} /> Kalkulasi Otomatis Konversi Kadar & Penjurnalan SAK EMKM:
              </h4>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                <div>
                  <span className="stat-lbl">Estimasi Emas Murni (Fine Gold)</span>
                  <div className="font-extrabold text-gold-light text-[1.3rem]">
                    {estimatedFineGold.toLocaleString()} Gram
                  </div>
                  <small className="text-fg-muted">Kadar: {formData.xrfPurity}% dari {formData.grossWeight}g</small>
                </div>
                <div>
                  <span className="stat-lbl">Total Nilai Pembelian Scrap</span>
                  <div className="font-extrabold text-emerald-light text-[1.3rem]">
                    Rp {totalAmount.toLocaleString()}
                  </div>
                  <small className="text-fg-muted">@ Rp {Number(formData.pricePerFineGram).toLocaleString()} / gram murni</small>
                </div>
                <div>
                  <span className="stat-lbl">Akun Debet Jurnal</span>
                  <div className="font-bold text-sky-light text-[0.9rem]">
                    {getTargetVaultName(formData.targetVault)}
                  </div>
                </div>
                <div>
                  <span className="stat-lbl">Akun Kredit Jurnal</span>
                  <div className="font-bold text-amber-300 text-[0.9rem]">
                    {getCreditAccountInfo(formData.paymentMethod).name}
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary bg-linear-135 from-rose-600 to-rose-800 text-white font-bold py-3 px-6 text-sm">
              <Flame size={18} /> Simpan Nota Pembelian Scrap & Auto-Jurnal Persediaan
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: REGISTER RIWAYAT PEMBELIAN SCRAP */}
      {activeTab === 'register' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
            <div>
              <h3 className="font-heading text-[1.1rem] flex items-center gap-2.5">
                <FileText color="#f59e0b" size={20} /> Register Nota Pembelian Scrap ({filteredPurchases.length} Transaksi)
              </h3>
              <p className="text-[0.8rem] text-fg-soft">
                Daftar transaksi pembelian pecahan perhiasan scrap lengkap dengan hasil uji kadar XRF dan status brankas
              </p>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-fg-soft" />
              <input
                type="text"
                placeholder="Cari no. nota, supplier, SPK..."
                className="form-input pl-9 text-xs py-1.5 rounded-sm w-[250px]"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Nota</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Supplier / Toko</TableHead>
                <TableHead>Deskripsi Barang</TableHead>
                <TableHead className="text-right">Berat Kotor</TableHead>
                <TableHead className="text-right">Kadar XRF</TableHead>
                <TableHead className="text-right">Fine Gold (g)</TableHead>
                <TableHead className="text-right">Total Pembelian</TableHead>
                <TableHead>Status & Brankas</TableHead>
                <TableHead className="w-16 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.length === 0 ? (
                <TableEmpty colSpan={10} message="Belum ada catatan pembelian scrap emas." />
              ) : (
                filteredPurchases.map(p => (
                  <TableRow key={p.id || p.receiptNo}>
                    <TableCell><strong>{p.receiptNo}</strong></TableCell>
                    <TableCell>{p.date}</TableCell>
                    <TableCell><strong>{p.supplierName}</strong></TableCell>
                    <TableCell>{p.itemDescription}</TableCell>
                    <TableCell className="text-right font-medium">{p.grossWeight} g</TableCell>
                    <TableCell className="text-right text-rose-400 font-bold">{p.xrfPurity}%</TableCell>
                    <TableCell className="text-right text-gold-light font-extrabold">{p.estimatedFineGold} g</TableCell>
                    <TableCell className="text-right text-emerald-light font-bold">
                      Rp {Number(p.totalAmount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className="badge badge-emerald text-xs">
                        {p.targetVault === '11502' ? 'WIP Lebur' : 'Vault Scrap (1152)'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 p-0 text-fg-soft hover:text-fg hover:bg-surface-raised cursor-pointer mx-auto"
                            aria-label={`Aksi untuk ${p.receiptNo}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 z-[1100]">
                          <DropdownMenuItem
                            onClick={async () => {
                              await exportScrapPurchaseReceiptPdf(p);
                              toast.success(`Dokumen Nota Pembelian Scrap (${p.receiptNo}) siap dicetak.`);
                            }}
                            className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                          >
                            <Printer className="h-4 w-4" />
                            <span>Cetak Nota Pembelian</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* TAB 3: ALUR SPK LEBUR */}
      {activeTab === 'melting-spk' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 text-gold-light flex items-center gap-2">
            <Flame size={20} /> Alur Peleburan Scrap Workshop PT TAN
          </h3>
          <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] border border-line space-y-4 text-sm text-fg-soft">
            <p>
              1. <strong>Penerimaan & Pengujian XRF:</strong> Pecahan perhiasan scrap ditimbang berat kotornya dan diuji kadar kemurniannya menggunakan mesin XRF Spectrometer.
            </p>
            <p>
              2. <strong>Penerbitan SPK Lebur:</strong> Emas scrap dari Vault Scrap (`1152`) dipindahkan ke Vault WIP Leburan (`11502`).
            </p>
            <p>
              3. <strong>Peleburan (Smelting) & Granulasi:</strong> Emas dilebur di workshop in-house menjadi Granul Murni 999.9 atau Batangan Lokal.
            </p>
            <p>
              4. <strong>Settlement Hasil Leburan:</strong> Hasil granul murni masuk ke **Vault Utama LM 999.9 (Akun 1157)**, dan selisih susut lebur dibukukan ke **Beban Susut Lebur (Akun 5120)**.
            </p>
          </div>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}

