import React, { useState } from 'react';
import { Warehouse, Package, ArrowRightLeft, ShieldCheck, FileText, Plus, CheckCircle2, X, Hammer } from 'lucide-react';
import Modal, { useModal } from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';
import NumberInput from '../components/ui/NumberInput';

export default function WarehouseManagement() {
  const { modalProps, showModal } = useModal();
  const [warehouses, setWarehouses] = useState([
    { id: 'WH-VAULT-01', name: 'Vault Utama PT TAN', code: 'VAULT-PRI', location: 'Lantai 2 Safe Room', manager: 'Budi Santoso', status: 'Active', account: '1157' },
    { id: 'WH-VAULT-02', name: 'Vault Emas Impor Transit', code: 'VAULT-IMP', location: 'Lantai 2 Customs Safe', manager: 'Siti Aminah', status: 'Active', account: '1158' },
    { id: 'WH-VAULT-04', name: 'Vault Emas WIP (Produksi Perhiasan)', code: 'VAULT-WIP', location: 'Lantai 2 Manufacturing Vault', manager: 'Hendra (Head of Production)', status: 'Active', account: '11502' },
    { id: 'WH-VAULT-03', name: 'Vault Perhiasan Siap Ekspor', code: 'VAULT-EXP', location: 'Lantai 3 Dispatch Vault', manager: 'Ahmad Hidayat', status: 'Active', account: '1160' }
  ]);

  const [stockCards, setStockCards] = useState([
    { id: 1, itemCode: 'LM-ANTAM-1000G', itemName: 'Emas Batangan Antam 1kg (999.9)', warehouse: 'Vault Utama PT TAN', inQty: 1000, outQty: 0, balanceQty: 1000, unit: 'gram', serialNo: 'ANT-991100' },
    { id: 2, itemCode: 'LM-VALCAMBI-1KG', itemName: 'Valcambi Suisse Gold Bar 1kg (999.9 LBMA)', warehouse: 'Vault Emas Impor Transit', inQty: 2000, outQty: 0, balanceQty: 2000, unit: 'gram', serialNo: 'VC-998811, VC-998812' },
    { id: 3, itemCode: 'GOLD-WIP-9999', itemName: 'Emas Murni WIP (Dalam Proses Produksi Karat)', warehouse: 'Vault Emas WIP (Produksi Perhiasan)', inQty: 500, outQty: 0, balanceQty: 500, unit: 'gram', serialNo: 'WIP-JOB-2026-01' },
    { id: 4, itemCode: 'JEWELRY-750', itemName: 'Perhiasan Emas 750 (18K) Ekspor', warehouse: 'Vault Perhiasan Siap Ekspor', inQty: 1300, outQty: 0, balanceQty: 1300, unit: 'gram', serialNo: 'EXP-BATCH-01' }
  ]);

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromVault: 'Vault Utama PT TAN',
    toVault: 'Vault Emas WIP (Produksi Perhiasan)',
    itemCode: 'GOLD-WIP-9999',
    quantityGrams: 200,
    transferNotes: 'Pengeluaran bahan baku emas murni ke Brankas WIP Produksi'
  });

  const handleExecuteTransfer = (e) => {
    e.preventDefault();
    if (transferForm.fromVault === transferForm.toVault) {
      showModal({ variant: 'warning', title: 'Gudang Tidak Valid', message: 'Gudang asal dan gudang tujuan tidak boleh sama.' });
      return;
    }
    if (!transferForm.quantityGrams || transferForm.quantityGrams <= 0) {
      showModal({ variant: 'warning', title: 'Jumlah Tidak Valid', message: 'Jumlah gram transfer harus lebih besar dari 0.' });
      return;
    }

    const selectedItem = stockCards.find(s => s.itemCode === transferForm.itemCode) || { itemName: 'Emas Murni 999.9' };

    const newRecordFrom = {
      id: Date.now(),
      itemCode: transferForm.itemCode,
      itemName: selectedItem.itemName,
      warehouse: transferForm.fromVault,
      inQty: 0,
      outQty: Number(transferForm.quantityGrams),
      balanceQty: 800,
      unit: 'gram',
      serialNo: `ISSUED TO ${transferForm.toVault}`
    };

    const newRecordTo = {
      id: Date.now() + 1,
      itemCode: transferForm.itemCode,
      itemName: selectedItem.itemName,
      warehouse: transferForm.toVault,
      inQty: Number(transferForm.quantityGrams),
      outQty: 0,
      balanceQty: 700,
      unit: 'gram',
      serialNo: `WIP RECEIPT FROM ${transferForm.fromVault}`
    };

    setStockCards([newRecordTo, newRecordFrom, ...stockCards]);
    setShowTransferModal(false);
    showModal({
      variant: 'success',
      title: '✅ Transfer Antar Vault Tercatat',
      message: `Emas ${transferForm.quantityGrams} gram dipindahkan dari ${transferForm.fromVault} ke ${transferForm.toVault}.`
    });
  };

  return (
    <div>
      {/* Header Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 mb-6">
        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Total Stok Vault LM</span>
            <div className="stat-val bg-linear-135 from-[#fef08a] via-gold to-gold-dark bg-clip-text text-transparent">3.000 Gram</div>
            <p className="text-xs text-fg-soft">Valcambi, Antam & Granule</p>
          </div>
          <div className="p-3 bg-[rgba(245,158,11,0.1)] rounded-[12px] text-gold">
            <Warehouse size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Stok Vault Emas WIP Produksi</span>
            <div className="stat-val text-gold-light">500 Gram</div>
            <p className="text-xs text-fg-soft">Dalam Proses Karat 750/700 (Akun 11502)</p>
          </div>
          <div className="p-3 bg-[rgba(245,158,11,0.15)] rounded-[12px] text-gold-light">
            <Hammer size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Stok Perhiasan Siap Ekspor</span>
            <div className="stat-val text-emerald-light">1.300 Gram</div>
            <p className="text-xs text-fg-soft">Karat 750 & 700 (Akun 1160)</p>
          </div>
          <div className="p-3 bg-[rgba(16,185,129,0.1)] rounded-[12px] text-emerald">
            <Package size={24} />
          </div>
        </div>
      </div>

      {/* Warehouse Locations */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="font-heading text-[1.1rem] mb-4 flex items-center gap-2.5">
          <Warehouse color="#f59e0b" size={20} /> Lokasi Brankas / Gudang Vault PT TAN (Termasuk Vault WIP)
        </h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {warehouses.map(w => (
            <div key={w.id} className={`rounded-[12px] border p-4.5 ${w.code === 'VAULT-WIP' ? 'border-gold-light bg-gold/[0.08]' : 'border-line bg-[rgba(15,23,42,0.6)]'}`}>
              <div className="flex justify-between items-center mb-2">
                <strong className={`text-[0.95rem] ${w.code === 'VAULT-WIP' ? 'text-gold-light' : 'text-white'}`}>{w.name}</strong>
                <span className="badge badge-emerald">{w.status}</span>
              </div>
              <p className="text-[0.8rem] text-fg-soft mb-1">📍 {w.location}</p>
              <p className="text-[0.8rem] text-fg-muted mb-1">👤 PJ: {w.manager}</p>
              <span className="badge badge-gold text-[0.7rem]">Akun COA: {w.account}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Transfer Modal */}
      {showTransferModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-[4px] flex justify-center items-center z-[1000] p-4">
          <div className="glass-panel w-full max-w-[540px] p-6 relative border border-gold">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-gold-light text-[1.1rem] flex items-center gap-2">
                <ArrowRightLeft size={20} /> Form Transfer Emas Ke Vault WIP / Antar Vault
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="cursor-pointer border-0 bg-none text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer}>
              <div className="form-group mb-3.5">
                <label className="form-label">Gudang Vault Asal (Pengirim)</label>
                <Combobox
                  value={transferForm.fromVault}
                  onChange={fromVault => setTransferForm({ ...transferForm, fromVault })}
                  placeholder="-- Pilih Gudang Asal --"
                  searchPlaceholder="Cari nama gudang vault…"
                  emptyText="Gudang tidak ditemukan."
                  options={warehouses.map(w => ({ value: w.name, label: w.name }))}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label">Gudang Vault Tujuan (Penerima)</label>
                <Combobox
                  value={transferForm.toVault}
                  onChange={toVault => setTransferForm({ ...transferForm, toVault })}
                  placeholder="-- Pilih Gudang Tujuan --"
                  searchPlaceholder="Cari nama gudang vault…"
                  emptyText="Gudang tidak ditemukan."
                  options={warehouses.map(w => ({ value: w.name, label: w.name }))}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label">Pilih Barang Emas Yang Ditransfer</label>
                <Combobox
                  value={transferForm.itemCode}
                  onChange={itemCode => setTransferForm({ ...transferForm, itemCode })}
                  searchPlaceholder="Cari kode atau nama barang…"
                  emptyText="Barang tidak ditemukan."
                  options={[
                    { value: 'GOLD-WIP-9999', label: 'Granul Emas Murni 999.9 (Bahan WIP)' },
                    { value: 'LM-VALCAMBI-1KG', label: 'Valcambi Suisse Gold Bar 1kg (999.9)' },
                    { value: 'LM-ANTAM-1000G', label: 'Emas Batangan Antam 1kg (999.9)' },
                    { value: 'JEWELRY-750', label: 'Perhiasan Emas 750 (18K)' }
                  ]}
                />
              </div>

              <div className="form-group mb-3.5">
                <label className="form-label">Jumlah Berat Emas (Gram)</label>
                <NumberInput
                  value={transferForm.quantityGrams}
                  onChange={quantityGrams => setTransferForm({ ...transferForm, quantityGrams })}
                />
              </div>

              <div className="form-group mb-5">
                <label className="form-label">Catatan Keterangan Transfer</label>
                <input
                  className="form-input"
                  value={transferForm.transferNotes}
                  onChange={e => setTransferForm({ ...transferForm, transferNotes: e.target.value })}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-primary bg-[rgba(255,255,255,0.1)]" onClick={() => setShowTransferModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  <CheckCircle2 size={16} /> Proses Transfer Ke Vault WIP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement Card Table */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-heading text-[1.1rem] flex items-center gap-2.5">
            <FileText color="#38bdf8" size={20} /> Kartu Stok Bar / Vault Stock Position (Termasuk Vault WIP)
          </h3>
          <button className="btn-primary py-2 px-4 text-[0.8rem]" onClick={() => setShowTransferModal(true)}>
            <ArrowRightLeft size={16} /> Transfer Emas Antar Vault
          </button>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Kode Barang</th>
                <th>Nama Emas / Produk</th>
                <th>Gudang Vault</th>
                <th>Masuk (g)</th>
                <th>Keluar (g)</th>
                <th className="text-right">Saldo Stok Akhir</th>
                <th>Bar Serial ID / Job No</th>
              </tr>
            </thead>
            <tbody>
              {stockCards.map(sc => (
                <tr key={sc.id}>
                  <td><strong>{sc.itemCode}</strong></td>
                  <td>{sc.itemName}</td>
                  <td>
                    <span className={`badge text-xs ${sc.warehouse.includes('WIP') ? 'badge-gold' : ''}`}>
                      {sc.warehouse}
                    </span>
                  </td>
                  <td className="text-emerald-light">{sc.inQty > 0 ? `+${sc.inQty} g` : '-'}</td>
                  <td className="text-danger">{sc.outQty > 0 ? `-${sc.outQty} g` : '-'}</td>
                  <td className="text-right font-extrabold text-gold-light text-base">{sc.balanceQty} g</td>
                  <td><small className="text-sky-light">{sc.serialNo}</small></td>
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
