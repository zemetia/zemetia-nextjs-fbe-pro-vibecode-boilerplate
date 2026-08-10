import React, { useState, useEffect } from 'react';
import { Warehouse, Package, ArrowRightLeft, ShieldCheck, Tag, FileText } from 'lucide-react';
import { getMasterItems } from '../services/storageService';

export default function WarehouseManagement() {
  const [warehouses, setWarehouses] = useState([
    { id: 'WH-VAULT-01', name: 'Vault Utama PT TAN', code: 'VAULT-PRI', location: 'Lantai 2 Safe Room', manager: 'Budi Santoso', status: 'Active' },
    { id: 'WH-VAULT-02', name: 'Vault Emas Impor Transit', code: 'VAULT-IMP', location: 'Lantai 2 Customs Safe', manager: 'Siti Aminah', status: 'Active' },
    { id: 'WH-VAULT-03', name: 'Vault Perhiasan Siap Ekspor', code: 'VAULT-EXP', location: 'Lantai 3 Dispatch Vault', manager: 'Ahmad Hidayat', status: 'Active' }
  ]);

  const [stockCards, setStockCards] = useState([
    { id: 1, itemCode: 'LM-ANTAM-1000G', itemName: 'Emas Batangan Antam 1kg (999.9)', warehouse: 'Vault Utama PT TAN', inQty: 1000, outQty: 0, balanceQty: 1000, unit: 'gram', serialNo: 'ANT-991100' },
    { id: 2, itemCode: 'LM-VALCAMBI-1KG', itemName: 'Valcambi Suisse Gold Bar 1kg (999.9 LBMA)', warehouse: 'Vault Emas Impor Transit', inQty: 2000, outQty: 0, balanceQty: 2000, unit: 'gram', serialNo: 'VC-998811, VC-998812' },
    { id: 3, itemCode: 'JEWELRY-750', itemName: 'Perhiasan Emas 750 (18K) Ekspor', warehouse: 'Vault Perhiasan Siap Ekspor', inQty: 1300, outQty: 0, balanceQty: 1300, unit: 'gram', serialNo: 'EXP-BATCH-01' }
  ]);

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
            <span className="stat-lbl">Stok Perhiasan Siap Ekspor</span>
            <div className="stat-val" style={{ color: '#34d399' }}>1.300 Gram</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Karat 750 & 700</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', color: '#10b981' }}>
            <Package size={24} />
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div>
            <span className="stat-lbl">Lokasi Gudang Vault</span>
            <div className="stat-val" style={{ color: '#38bdf8' }}>3 Brankas</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Secure Safe Rooms</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(59,130,246,0.1)', borderRadius: '12px', color: '#3b82f6' }}>
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      {/* Warehouse Locations */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Warehouse color="#f59e0b" size={20} /> Lokasi Brankas / Gudang Vault PT TAN
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {warehouses.map(w => (
            <div key={w.id} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '0.95rem', color: '#fbbf24' }}>{w.name}</strong>
                <span className="badge badge-emerald">{w.status}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>📍 {w.location}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>👤 Penanggung Jawab: {w.manager}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Movement Card Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText color="#38bdf8" size={20} /> Kartu Stok Bar / Vault Stock Position
          </h3>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={() => alert('🔄 Memproses Transfer Antar Gudang Vault...')}>
            <ArrowRightLeft size={16} /> Transfer Antar Vault
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
                <th>Bar Serial ID / Lot</th>
              </tr>
            </thead>
            <tbody>
              {stockCards.map(sc => (
                <tr key={sc.id}>
                  <td><strong>{sc.itemCode}</strong></td>
                  <td>{sc.itemName}</td>
                  <td><span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>{sc.warehouse}</span></td>
                  <td style={{ color: '#34d399' }}>+{sc.inQty} g</td>
                  <td style={{ color: '#ef4444' }}>-{sc.outQty} g</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#fbbf24', fontSize: '1rem' }}>{sc.balanceQty} g</td>
                  <td><small style={{ color: '#38bdf8' }}>{sc.serialNo}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
