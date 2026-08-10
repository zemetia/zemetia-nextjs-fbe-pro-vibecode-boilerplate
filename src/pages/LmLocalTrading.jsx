import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Printer, CheckCircle, Package } from 'lucide-react';
import { getMasterItems } from '../services/storageService';

export default function LmLocalTrading() {
  const [purchases, setPurchases] = useState([]);
  const [formData, setFormData] = useState({
    supplierName: 'PT Antam Tbk (Logam Mulia)',
    orderDate: new Date().toISOString().split('T')[0],
    itemCode: 'LM-ANTAM-1000G',
    quantityGrams: 1000,
    unitPriceIDR: 1250000, // Rp 1.250.000 / g
    notes: 'Pembelian Emas Batangan Lokal 999.9'
  });

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = () => {
    if (typeof window !== 'undefined' && window.Storage) {
      const stored = window.Storage.get('pttan_local_purchases') || [];
      setPurchases(stored);
    }
  };

  const totalAmount = formData.quantityGrams * formData.unitPriceIDR;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.quantityGrams || !formData.unitPriceIDR) {
      alert('Jumlah gram dan harga satuan wajib diisi');
      return;
    }

    const newPurchase = {
      id: Date.now(),
      poNumber: `PO-LOKAL-${Date.now().toString().slice(-6)}`,
      ttbNumber: `TTB-LOKAL-${Date.now().toString().slice(-6)}`,
      supplierName: formData.supplierName,
      orderDate: formData.orderDate,
      itemCode: formData.itemCode,
      itemName: 'Emas Batangan 999.9 (Lokal)',
      quantityGrams: Number(formData.quantityGrams),
      unitPriceIDR: Number(formData.unitPriceIDR),
      totalAmount: totalAmount,
      journalAccountDebit: '1157', // Persediaan LM Lokal
      journalAccountCredit: '2110', // Utang Usaha Lokal
      warehouseName: 'Vault Utama PT TAN',
      status: 'Received & Stocked',
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      // 1. Save Purchase
      const list = window.Storage.get('pttan_local_purchases') || [];
      list.unshift(newPurchase);
      window.Storage.set('pttan_local_purchases', list);

      // 2. Auto-Post Journal Entry (Debet 1157 vs Kredit 2110)
      const journals = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      journals.unshift({
        id: Date.now(),
        entryNumber: `JRN-${Date.now().toString().slice(-6)}`,
        date: formData.orderDate,
        description: `Pembelian LM Lokal ${newPurchase.poNumber} - ${formData.supplierName}`,
        lines: [
          { accountCode: '1157', accountName: 'Persediaan Emas Murni 999.9 (LM Lokal)', debit: totalAmount, credit: 0 },
          { accountCode: '2110', accountName: 'Utang Usaha Lokal', debit: 0, credit: totalAmount }
        ],
        createdAt: new Date().toISOString()
      });
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, journals);

      alert(`✅ Pembelian LM Lokal (${newPurchase.poNumber}) Berhasil Disimpan, Otomatis Di-jurnal ke Akun 1157 & Stok Vault Ter-update!`);
      loadPurchases();
    }
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShoppingCart color="#f59e0b" size={22} /> Pembelian Logam Mulia (LM) Lokal IDR
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Supplier Lokal</label>
              <input
                className="form-input"
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tgl Pembelian</label>
              <input
                type="date"
                className="form-input"
                value={formData.orderDate}
                onChange={e => setFormData({ ...formData, orderDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Pilihan Barang Emas</label>
              <select
                className="form-select"
                value={formData.itemCode}
                onChange={e => setFormData({ ...formData, itemCode: e.target.value })}
              >
                <option value="LM-ANTAM-1000G">Emas Batangan Antam 1kg (999.9)</option>
                <option value="LM-ANTAM-100G">Emas Batangan Antam 100g (999.9)</option>
                <option value="LM-UBS-1KG">Emas Batangan UBS 1kg (999.9)</option>
                <option value="GOLD-GRANULE-9999">Granul Emas Murni 999.9</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Berat Emas (Gram)</label>
              <input
                type="number"
                className="form-input"
                value={formData.quantityGrams}
                onChange={e => setFormData({ ...formData, quantityGrams: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Harga Satuan IDR / Gram</label>
              <input
                type="number"
                className="form-input"
                value={formData.unitPriceIDR}
                onChange={e => setFormData({ ...formData, unitPriceIDR: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', margin: '16px 0', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <span className="stat-lbl">Total Pembelian IDR</span>
                <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.2rem' }}>Rp {totalAmount.toLocaleString()}</div>
              </div>
              <div>
                <span className="stat-lbl">Posting Auto-Jurnal</span>
                <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.9rem' }}>Debet: Akun 1157 (Persediaan LM Lokal)</div>
              </div>
              <div>
                <span className="stat-lbl">Tujuan Gudang</span>
                <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.9rem' }}>Vault Utama PT TAN</div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary">
            <Plus size={18} /> Terbitkan PO & TTB Pembelian LM Lokal
          </button>
        </form>
      </div>

      {/* History Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Riwayat Pembelian LM Lokal ({purchases.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. PO / TTB</th>
                <th>Supplier</th>
                <th>Tanggal</th>
                <th>Item Barang</th>
                <th>Berat (g)</th>
                <th style={{ textAlign: 'right' }}>Total Transaksi (IDR)</th>
                <th>Posting Jurnal</th>
                <th>Cetak</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Belum ada riwayat pembelian LM Lokal.
                  </td>
                </tr>
              ) : (
                purchases.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.poNumber}</strong><br/><small style={{ color: 'var(--text-muted)' }}>{p.ttbNumber}</small></td>
                    <td>{p.supplierName}</td>
                    <td>{p.orderDate}</td>
                    <td>{p.itemName}</td>
                    <td>{p.quantityGrams} g</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>Rp {(p.totalAmount || 0).toLocaleString()}</td>
                    <td><span className="badge badge-emerald">JRN-1157</span></td>
                    <td>
                      <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => alert(`🖨️ Mencetak PDF TTB Pembelian ${p.ttbNumber}...`)}>
                        <Printer size={14} /> Cetak TTB
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
