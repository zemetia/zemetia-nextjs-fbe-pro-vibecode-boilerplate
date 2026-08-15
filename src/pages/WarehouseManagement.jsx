import React, { useState } from 'react';
import { Warehouse, Package, ArrowRightLeft, ShieldCheck, FileText, Plus, CheckCircle2, X, Hammer } from 'lucide-react';
import Modal, { useModal } from '../components/ui/Modal';

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
      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Total Stok Vault LM</span>
            <div className="stat-val gold-gradient-text">3.000 Gram</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Valcambi, Antam & Granule</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(245,158,11,0.1)', borderRadius: '12px', color: '#f59e0b' }}>
            <Warehouse size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Stok Vault Emas WIP Produksi</span>
            <div className="stat-val" style={{ color: '#fbbf24' }}>500 Gram</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dalam Proses Karat 750/700 (Akun 11502)</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(245,158,11,0.15)', borderRadius: '12px', color: '#fbbf24' }}>
            <Hammer size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Stok Perhiasan Siap Ekspor</span>
            <div className="stat-val" style={{ color: '#34d399' }}>1.300 Gram</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Karat 750 & 700 (Akun 1160)</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', color: '#10b981' }}>
            <Package size={24} />
          </div>
        </div>
      </div>

      {/* Warehouse Locations */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Warehouse color="#f59e0b" size={20} /> Lokasi Brankas / Gudang Vault PT TAN (Termasuk Vault WIP)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {warehouses.map(w => (
            <div key={w.id} style={{ background: w.code === 'VAULT-WIP' ? 'rgba(245,158,11,0.08)' : 'rgba(15, 23, 42, 0.6)', padding: '18px', borderRadius: '12px', border: w.code === 'VAULT-WIP' ? '1px solid #fbbf24' : '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '0.95rem', color: w.code === 'VAULT-WIP' ? '#fbbf24' : '#fff' }}>{w.name}</strong>
                <span className="badge badge-emerald">{w.status}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>📍 {w.location}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>👤 PJ: {w.manager}</p>
              <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>Akun COA: {w.account}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Transfer Modal */}
      {showTransferModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '24px', position: 'relative', border: '1px solid var(--accent-gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: '#fbbf24', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={20} /> Form Transfer Emas Ke Vault WIP / Antar Vault
              </h3>
              <button onClick={() => setShowTransferModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Gudang Vault Asal (Pengirim)</label>
                <select
                  className="form-select"
                  value={transferForm.fromVault}
                  onChange={e => setTransferForm({ ...transferForm, fromVault: e.target.value })}
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Gudang Vault Tujuan (Penerima)</label>
                <select
                  className="form-select"
                  value={transferForm.toVault}
                  onChange={e => setTransferForm({ ...transferForm, toVault: e.target.value })}
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Pilih Barang Emas Yang Ditransfer</label>
                <select
                  className="form-select"
                  value={transferForm.itemCode}
                  onChange={e => setTransferForm({ ...transferForm, itemCode: e.target.value })}
                >
                  <option value="GOLD-WIP-9999">Granul Emas Murni 999.9 (Bahan WIP)</option>
                  <option value="LM-VALCAMBI-1KG">Valcambi Suisse Gold Bar 1kg (999.9)</option>
                  <option value="LM-ANTAM-1000G">Emas Batangan Antam 1kg (999.9)</option>
                  <option value="JEWELRY-750">Perhiasan Emas 750 (18K)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Jumlah Berat Emas (Gram)</label>
                <input
                  type="number"
                  className="form-input"
                  value={transferForm.quantityGrams}
                  onChange={e => setTransferForm({ ...transferForm, quantityGrams: Number(e.target.value) })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Catatan Keterangan Transfer</label>
                <input
                  className="form-input"
                  value={transferForm.transferNotes}
                  onChange={e => setTransferForm({ ...transferForm, transferNotes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setShowTransferModal(false)}>
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
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText color="#38bdf8" size={20} /> Kartu Stok Bar / Vault Stock Position (Termasuk Vault WIP)
          </h3>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={() => setShowTransferModal(true)}>
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
                <th style={{ textAlign: 'right' }}>Saldo Stok Akhir</th>
                <th>Bar Serial ID / Job No</th>
              </tr>
            </thead>
            <tbody>
              {stockCards.map(sc => (
                <tr key={sc.id}>
                  <td><strong>{sc.itemCode}</strong></td>
                  <td>{sc.itemName}</td>
                  <td>
                    <span className={`badge ${sc.warehouse.includes('WIP') ? 'badge-gold' : ''}`} style={{ fontSize: '0.75rem' }}>
                      {sc.warehouse}
                    </span>
                  </td>
                  <td style={{ color: '#34d399' }}>{sc.inQty > 0 ? `+${sc.inQty} g` : '-'}</td>
                  <td style={{ color: '#ef4444' }}>{sc.outQty > 0 ? `-${sc.outQty} g` : '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#fbbf24', fontSize: '1rem' }}>{sc.balanceQty} g</td>
                  <td><small style={{ color: '#38bdf8' }}>{sc.serialNo}</small></td>
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
