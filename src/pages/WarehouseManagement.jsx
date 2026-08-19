import React, { useState, useEffect } from 'react';
import {
  Warehouse, Package, ArrowRightLeft, ShieldCheck, FileText,
  Plus, CheckCircle2, X, Hammer, Printer, Search, Filter,
  Layers, Sparkles, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  getWarehouses,
  calculateVaultStockPosition,
  recordVaultTransfer,
  getMasterItems,
  getFinishedGoods
} from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';
import NumberInput from '../components/ui/NumberInput';

export default function WarehouseManagement() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('movements'); // 'movements', 'vaults', 'transfers'
  const [warehouses, setWarehouses] = useState([]);
  const [stockPosition, setStockPosition] = useState({
    vaults: [],
    movements: [],
    summary: {
      totalLMGrams: 0,
      lmMainGrams: 0,
      lmImportGrams: 0,
      wipGrams: 0,
      exportGrams: 0,
      scrapGrams: 0,
      totalVaultGrams: 0,
      grandTotalValueIDR: 0
    }
  });

  const [selectedVaultFilter, setSelectedVaultFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [masterItems, setMasterItems] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromVaultId: 'WH-VAULT-01',
    fromVaultName: 'Vault Utama PT TAN',
    fromAccount: '1157',
    toVaultId: 'WH-VAULT-04',
    toVaultName: 'Vault Emas WIP (Produksi Perhiasan)',
    toAccount: '11502',
    itemCode: 'GOLD-WIP-9999',
    itemName: 'Granul Emas Murni 999.9 (Bahan WIP)',
    quantityGrams: 100,
    transferNotes: 'Pengeluaran bahan baku emas murni ke Brankas WIP Produksi'
  });

  useEffect(() => {
    loadDynamicStockData();
  }, []);

  const loadDynamicStockData = () => {
    const whList = getWarehouses();
    setWarehouses(whList);
    const position = calculateVaultStockPosition();
    setStockPosition(position);
    setMasterItems(getMasterItems());
    setFinishedGoods(getFinishedGoods());
  };

  const handleFromVaultChange = (vaultName) => {
    const found = warehouses.find(w => w.name === vaultName);
    if (found) {
      setTransferForm(prev => ({
        ...prev,
        fromVaultId: found.id,
        fromVaultName: found.name,
        fromAccount: found.account
      }));
    }
  };

  const handleToVaultChange = (vaultName) => {
    const found = warehouses.find(w => w.name === vaultName);
    if (found) {
      setTransferForm(prev => ({
        ...prev,
        toVaultId: found.id,
        toVaultName: found.name,
        toAccount: found.account
      }));
    }
  };

  const handleItemChange = (code) => {
    const allItems = [
      { code: 'GOLD-WIP-9999', name: 'Granul Emas Murni 999.9 (Bahan WIP)' },
      { code: 'LM-ANTAM-1000G', name: 'Emas Batangan Antam 1kg (999.9)' },
      { code: 'LM-VALCAMBI-1KG', name: 'Valcambi Suisse Gold Bar 1kg (999.9 LBMA)' },
      { code: 'SCRAP-MIX-750', name: 'Scrap Perhiasan Emas Karat 750 / Potongan' },
      { code: 'JEWELRY-750', name: 'Perhiasan Emas 750 (18K) Siap Ekspor' },
      ...masterItems.map(i => ({ code: i.code || i.id, name: i.name })),
      ...finishedGoods.map(fg => ({ code: fg.sku || fg.id, name: fg.name }))
    ];
    const found = allItems.find(i => i.code === code);
    setTransferForm(prev => ({
      ...prev,
      itemCode: code,
      itemName: found ? found.name : code
    }));
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();

    if (transferForm.fromAccount === transferForm.toAccount) {
      showModal({
        variant: 'warning',
        title: 'Gudang Asal & Tujuan Sama',
        message: 'Gudang vault asal dan tujuan transfer tidak boleh sama.'
      });
      return;
    }

    if (!transferForm.quantityGrams || Number(transferForm.quantityGrams) <= 0) {
      showModal({
        variant: 'warning',
        title: 'Jumlah Tidak Valid',
        message: 'Jumlah berat transfer harus lebih besar dari 0 gram.'
      });
      return;
    }

    // Check available balance in source vault
    const sourceVaultData = stockPosition.vaults.find(v => v.account === transferForm.fromAccount);
    const availableQty = sourceVaultData ? sourceVaultData.balanceGrams : 0;
    if (availableQty < Number(transferForm.quantityGrams)) {
      showModal({
        variant: 'warning',
        title: 'Saldo Stok Vault Kurang',
        message: `Saldo brankas ${transferForm.fromVaultName} hanya ${availableQty.toLocaleString()} gram. Transfer sebesar ${Number(transferForm.quantityGrams).toLocaleString()} gram melebihi saldo yang ada.`
      });
      return;
    }

    const estimatedVal = Number(transferForm.quantityGrams) * 1300000;

    const result = await recordVaultTransfer({
      ...transferForm,
      estimatedValueIDR: estimatedVal
    });

    if (result.success) {
      setShowTransferModal(false);
      showModal({
        variant: 'success',
        title: `✅ Transfer Emas Antar-Vault (${result.transfer.id}) Berhasil`,
        message: `• Pemindahan: ${transferForm.quantityGrams} gram ${transferForm.itemName}\n• Dari: ${transferForm.fromVaultName} (Akun ${transferForm.fromAccount})\n• Ke: ${transferForm.toVaultName} (Akun ${transferForm.toAccount})\n• Jurnal EMKM Otomatis Diposting:\n  - Debet: Akun ${transferForm.toAccount} Rp ${estimatedVal.toLocaleString()}\n  - Kredit: Akun ${transferForm.fromAccount} Rp ${estimatedVal.toLocaleString()}`
      });
      loadDynamicStockData();
    } else {
      showModal({
        variant: 'danger',
        title: 'Gagal Menyimpan Transfer',
        message: 'Terjadi kesalahan saat memproses transfer antar vault.'
      });
    }
  };

  const handlePrintStockReport = () => {
    showModal({
      variant: 'info',
      title: '🖨️ Cetak Laporan Posisi Fisik Brankas Vault PT TAN',
      message: `Posisi Brankas Real-Time PT TAN:\n\n• Total Stok Logam Mulia (1157 + 1158): ${stockPosition.summary.totalLMGrams.toLocaleString()} Gram\n• Total Emas WIP Produksi (11502): ${stockPosition.summary.wipGrams.toLocaleString()} Gram\n• Total Perhiasan Siap Ekspor (1160): ${stockPosition.summary.exportGrams.toLocaleString()} Gram\n• Total Emas Scrap (1152): ${stockPosition.summary.scrapGrams.toLocaleString()} Gram\n\nGrand Total Emas Fisik: ${stockPosition.summary.totalVaultGrams.toLocaleString()} Gram\nEstimasi Total Nilai Persediaan: Rp ${stockPosition.summary.grandTotalValueIDR.toLocaleString()}\n\nBerkas laporan siap dicetak atau diekspor ke PDF.`
    });
  };

  // Filter movements
  const filteredMovements = stockPosition.movements.filter(m => {
    const matchVault = selectedVaultFilter === 'ALL' || m.warehouseAccount === selectedVaultFilter;
    const matchSearch = searchQuery === '' ||
      m.docNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.refNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.serialNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.docType?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchVault && matchSearch;
  });

  const availableItemOptions = [
    { value: 'GOLD-WIP-9999', label: 'Granul Emas Murni 999.9 (Bahan WIP)' },
    { value: 'LM-ANTAM-1000G', label: 'Emas Batangan Antam 1kg (999.9)' },
    { value: 'LM-VALCAMBI-1KG', label: 'Valcambi Suisse Gold Bar 1kg (999.9 LBMA)' },
    { value: 'SCRAP-MIX-750', label: 'Scrap Perhiasan Emas Karat 750 / Potongan' },
    { value: 'JEWELRY-750', label: 'Perhiasan Emas 750 (18K) Siap Ekspor' },
    ...masterItems.map(i => ({ value: i.code || i.id, label: `${i.code || i.id} - ${i.name}` })),
    ...finishedGoods.map(fg => ({ value: fg.sku || fg.id, label: `${fg.sku || fg.id} - ${fg.name}` }))
  ];

  return (
    <div>
      {/* Header Controls */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <Warehouse color="#f59e0b" size={24} /> Modul Gudang & Kartu Stok Brankas Vault Real-Time
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Integrasi Real-Time TTB Penerimaan Emas, Pembelian Lokal, SPK WIP Produksi, Surat Jalan DO Ekspor, & Mutasi Antar-Brankas
            </p>
          </div>

          <div className="flex gap-2.5">
            <button className="btn-primary" onClick={handlePrintStockReport}>
              <Printer size={16} /> Cetak Posisi Vault PDF
            </button>
            <button
              className="btn-primary bg-linear-135 from-gold to-gold-dark font-bold text-white"
              onClick={() => setShowTransferModal(true)}
            >
              <ArrowRightLeft size={16} /> Transfer Antar-Vault
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'movements', label: '📜 Kartu Stok Real-Time (Mutasi In/Out)' },
            { id: 'vaults', label: '🏛️ Posisi & Rincian per Brankas Vault' },
            { id: 'transfers', label: '🔄 Riwayat Mutasi Internal Antar-Vault' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer whitespace-nowrap rounded-sm border border-line px-3.5 py-[9px] text-[0.8rem] ${
                activeTab === tab.id
                  ? 'bg-linear-135 from-gold to-gold-dark font-bold text-white'
                  : 'bg-[rgba(15,23,42,0.6)] font-medium text-fg-soft'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mb-6">
        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Total Stok Vault LM (Murni 999.9)</span>
            <div className="stat-val bg-linear-135 from-[#fef08a] via-gold to-gold-dark bg-clip-text text-transparent">
              {stockPosition.summary.totalLMGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">
              Lokal (1157): {stockPosition.summary.lmMainGrams}g | Impor (1158): {stockPosition.summary.lmImportGrams}g
            </p>
          </div>
          <div className="p-3 bg-[rgba(245,158,11,0.1)] rounded-[12px] text-gold">
            <Warehouse size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Vault Emas WIP Produksi</span>
            <div className="stat-val text-gold-light">
              {stockPosition.summary.wipGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">Dalam Proses Karat 750/700 (Akun 11502)</p>
          </div>
          <div className="p-3 bg-[rgba(245,158,11,0.15)] rounded-[12px] text-gold-light">
            <Hammer size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Vault Perhiasan Siap Ekspor</span>
            <div className="stat-val text-emerald-light">
              {stockPosition.summary.exportGrams.toLocaleString()} Gram
            </div>
            <p className="text-xs text-fg-soft">Finished Goods Karat 750 (Akun 1160)</p>
          </div>
          <div className="p-3 bg-[rgba(16,185,129,0.1)] rounded-[12px] text-emerald">
            <Package size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Total Estimasi Nilai Seluruh Vault</span>
            <div className="stat-val text-sky-light text-[1.15rem]">
              Rp {stockPosition.summary.grandTotalValueIDR.toLocaleString()}
            </div>
            <p className="text-xs text-fg-soft">
              Total Fisik: {stockPosition.summary.totalVaultGrams.toLocaleString()} Gram Emas
            </p>
          </div>
          <div className="p-3 bg-[rgba(56,189,248,0.1)] rounded-[12px] text-sky">
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      {/* TAB 1: KARTU STOK MUTASI REAL-TIME */}
      {activeTab === 'movements' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
            <div>
              <h3 className="font-heading text-[1.1rem] flex items-center gap-2.5">
                <FileText color="#38bdf8" size={20} /> Kartu Stok Bar & Mutasi Fisik Emas Real-Time ({filteredMovements.length} Mutasi)
              </h3>
              <p className="text-[0.8rem] text-fg-soft">
                Tersambung langsung ke TTB Impor/Lokal, SPK Workshop, Pengiriman DO Ekspor, dan Mutasi Antar-Brankas
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-fg-soft" />
                <select
                  className="form-select text-xs py-1.5 px-2.5 rounded-sm bg-bg-surface border-line text-white"
                  value={selectedVaultFilter}
                  onChange={e => setSelectedVaultFilter(e.target.value)}
                >
                  <option value="ALL">Semua Brankas Vault</option>
                  <option value="1157">Vault Utama (Akun 1157)</option>
                  <option value="1158">Vault Impor (Akun 1158)</option>
                  <option value="11502">Vault WIP Produksi (Akun 11502)</option>
                  <option value="1160">Vault Siap Ekspor (Akun 1160)</option>
                  <option value="1152">Vault Scrap & Leburan (Akun 1152)</option>
                </select>
              </div>

              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-fg-soft" />
                <input
                  type="text"
                  placeholder="Cari no. dokumen, serial, barang..."
                  className="form-input pl-9 text-xs py-1.5 rounded-sm w-[220px]"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jenis Dokumen</th>
                  <th>No. Referensi / Dokumen</th>
                  <th>Gudang Vault</th>
                  <th>Nama Emas / Produk</th>
                  <th className="text-right">Masuk (+)</th>
                  <th className="text-right">Keluar (-)</th>
                  <th className="text-right">Saldo Berjalan</th>
                  <th>Serial Bar / Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-fg-soft">
                      Belum ada catatan mutasi stok untuk filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map(m => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap">{m.date}</td>
                      <td>
                        <span className={`badge text-xs ${
                          m.docType.includes('TTB') || m.docType.includes('LOKAL') ? 'badge-emerald' :
                          m.docType.includes('WIP') ? 'badge-gold' :
                          m.docType.includes('EKSPOR') ? 'badge-sky' : 'badge-purple'
                        }`}>
                          {m.docType}
                        </span>
                      </td>
                      <td>
                        <strong>{m.docNo}</strong>
                        {m.refNo && m.refNo !== '-' && <div className="text-[0.7rem] text-fg-muted">Ref: {m.refNo}</div>}
                      </td>
                      <td>
                        <span className="text-xs text-gold-light font-medium">{m.warehouseName}</span>
                      </td>
                      <td><strong>{m.itemName}</strong></td>
                      <td className="text-right text-emerald-light font-bold">
                        {m.inQty > 0 ? `+${m.inQty.toLocaleString()} g` : '-'}
                      </td>
                      <td className="text-right text-danger font-bold">
                        {m.outQty > 0 ? `-${m.outQty.toLocaleString()} g` : '-'}
                      </td>
                      <td className="text-right font-extrabold text-gold-light text-base">
                        {m.balanceQty.toLocaleString()} g
                      </td>
                      <td>
                        <small className="text-fg-soft">{m.serialNo}</small>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RINCIAN PER BRANKAS VAULT */}
      {activeTab === 'vaults' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 flex items-center gap-2.5">
            <Warehouse color="#f59e0b" size={20} /> Posisi Fisik & Akun COA per Brankas Vault PT TAN
          </h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
            {stockPosition.vaults.map(w => (
              <div
                key={w.id || w.account}
                className={`rounded-[12px] border p-5 ${
                  w.account === '11502' ? 'border-gold-light bg-gold/[0.08]' :
                  w.account === '1160' ? 'border-emerald/40 bg-emerald/[0.04]' :
                  'border-line bg-[rgba(15,23,42,0.6)]'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <strong className="text-[1.05rem] text-white">{w.name}</strong>
                  <span className="badge badge-emerald">{w.status || 'Active'}</span>
                </div>

                <div className="bg-[rgba(15,23,42,0.8)] p-3.5 rounded-[10px] mb-3 border border-line/50">
                  <div className="text-xs text-fg-soft">Saldo Fisik Emas:</div>
                  <div className="text-[1.4rem] font-extrabold text-gold-light">
                    {Math.max(0, w.balanceGrams).toLocaleString()} Gram
                  </div>
                  <div className="text-xs text-emerald-light font-medium mt-0.5">
                    Nilai Aset: Rp {Math.max(0, w.totalValueIDR).toLocaleString()}
                  </div>
                </div>

                <div className="text-[0.8rem] space-y-1 text-fg-soft mb-3">
                  <p>📍 <strong>Lokasi:</strong> {w.location}</p>
                  <p>👤 <strong>Penanggung Jawab:</strong> {w.manager}</p>
                  <p>📥 <strong>Total Masuk:</strong> +{w.totalInGrams.toLocaleString()} g</p>
                  <p>📤 <strong>Total Keluar:</strong> -{w.totalOutGrams.toLocaleString()} g</p>
                </div>

                <div className="flex justify-between items-center border-t border-line/50 pt-2.5">
                  <span className="badge badge-gold text-[0.7rem]">Akun COA: {w.account}</span>
                  <button
                    className="btn-primary py-1 px-2.5 text-xs"
                    onClick={() => {
                      setTransferForm(prev => ({
                        ...prev,
                        fromVaultId: w.id,
                        fromVaultName: w.name,
                        fromAccount: w.account
                      }));
                      setShowTransferModal(true);
                    }}
                  >
                    Transfer Keluar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RIWAYAT MUTASI INTERNAL ANTAR-VAULT */}
      {activeTab === 'transfers' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <div>
              <h3 className="font-heading text-[1.1rem] flex items-center gap-2.5">
                <ArrowRightLeft color="#8b5cf6" size={20} /> Riwayat Transfer Emas Internal Antar-Vault
              </h3>
              <p className="text-[0.8rem] text-fg-soft">
                Semua pemindahan fisik antar-brankas otomatis menjurnal mutasi debet/kredit akun persediaan SAK EMKM
              </p>
            </div>

            <button
              className="btn-primary bg-linear-135 from-purple to-purple-dark text-white font-bold"
              onClick={() => setShowTransferModal(true)}
            >
              <Plus size={16} /> Buat Transfer Baru
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>No. Transfer</th>
                  <th>Tanggal</th>
                  <th>Gudang Asal (Kredit)</th>
                  <th>Gudang Tujuan (Debet)</th>
                  <th>Barang Emas</th>
                  <th className="text-right">Berat Gram</th>
                  <th className="text-right">Estimasi Nilai Jurnal</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.filter(m => m.docType.includes('TRANSFER')).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-fg-soft">
                      Belum ada riwayat transfer internal antar-vault.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.filter(m => m.docType.includes('TRANSFER') && m.inQty > 0).map(m => (
                    <tr key={m.id}>
                      <td><strong>{m.docNo}</strong></td>
                      <td>{m.date}</td>
                      <td>
                        <span className="badge badge-rose text-xs">
                          {m.refNo?.replace('Diterima dari ', '') || 'Vault Asal'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-emerald text-xs">
                          {m.warehouseName}
                        </span>
                      </td>
                      <td><strong>{m.itemName}</strong></td>
                      <td className="text-right font-extrabold text-gold-light text-base">
                        {m.inQty.toLocaleString()} g
                      </td>
                      <td className="text-right text-sky-light font-bold">
                        Rp {m.valueIDR.toLocaleString()}
                      </td>
                      <td><small className="text-fg-soft">{m.serialNo}</small></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INTERACTIVE TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-[4px] flex justify-center items-center z-[1000] p-4">
          <div className="glass-panel w-full max-w-[560px] p-6 relative border border-gold">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-gold-light text-[1.15rem] flex items-center gap-2">
                <ArrowRightLeft size={20} /> Form Transfer Emas Antar-Brankas Vault
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="cursor-pointer border-0 bg-none text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer}>
              <div className="form-group mb-3.5">
                <label className="form-label">Gudang Vault Asal (Pengirim / Sisi Kredit Jurnal)</label>
                <Combobox
                  value={transferForm.fromVaultName}
                  onChange={handleFromVaultChange}
                  placeholder="-- Pilih Gudang Asal --"
                  searchPlaceholder="Cari nama gudang vault…"
                  emptyText="Gudang tidak ditemukan."
                  options={warehouses.map(w => ({
                    value: w.name,
                    label: `${w.name} (Akun ${w.account})`
                  }))}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label">Gudang Vault Tujuan (Penerima / Sisi Debet Jurnal)</label>
                <Combobox
                  value={transferForm.toVaultName}
                  onChange={handleToVaultChange}
                  placeholder="-- Pilih Gudang Tujuan --"
                  searchPlaceholder="Cari nama gudang vault…"
                  emptyText="Gudang tidak ditemukan."
                  options={warehouses.map(w => ({
                    value: w.name,
                    label: `${w.name} (Akun ${w.account})`
                  }))}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label">Pilih Jenis Barang Emas</label>
                <Combobox
                  value={transferForm.itemCode}
                  onChange={handleItemChange}
                  placeholder="-- Pilih Barang Emas --"
                  searchPlaceholder="Cari kode atau nama barang…"
                  emptyText="Barang tidak ditemukan."
                  options={availableItemOptions}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label">Jumlah Berat Emas (Gram)</label>
                <NumberInput
                  allowDecimal
                  value={transferForm.quantityGrams}
                  onChange={quantityGrams => setTransferForm(prev => ({ ...prev, quantityGrams }))}
                />
              </div>

              <div className="form-group mb-4">
                <label className="form-label">Catatan Keterangan Transfer</label>
                <input
                  className="form-input"
                  value={transferForm.transferNotes}
                  onChange={e => setTransferForm(prev => ({ ...prev, transferNotes: e.target.value }))}
                />
              </div>

              <div className="bg-[rgba(15,23,42,0.8)] p-3.5 rounded-[10px] mb-5 border border-line text-xs space-y-1">
                <div className="text-gold-light font-bold">ℹ️ Info Auto-Jurnal Persediaan SAK EMKM:</div>
                <div className="text-fg-soft">
                  • Debet: {transferForm.toVaultName} (Akun {transferForm.toAccount})
                </div>
                <div className="text-fg-soft">
                  • Kredit: {transferForm.fromVaultName} (Akun {transferForm.fromAccount})
                </div>
                <div className="text-emerald-light font-bold">
                  • Estimasi Nilai Jurnal: Rp {(Number(transferForm.quantityGrams || 0) * 1300000).toLocaleString()}
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  className="btn-primary bg-[rgba(255,255,255,0.1)]"
                  onClick={() => setShowTransferModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary bg-linear-135 from-gold to-gold-dark font-bold text-white"
                >
                  <CheckCircle2 size={16} /> Proses Transfer & Auto-Jurnal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}

