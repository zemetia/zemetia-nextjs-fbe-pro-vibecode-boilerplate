import React, { useState, useEffect } from 'react';
import { PlaneTakeoff, Plus, CheckCircle, Calculator, RefreshCw } from 'lucide-react';
import { createPurchaseOrder, getPurchaseOrders } from '../services/storageService';
import { fetchBcaERateUSD, getStoredUsdRate } from '../services/currencyService';

export default function LmImportTrading() {
  const [orders, setOrders] = useState([]);
  const [loadingRate, setLoadingRate] = useState(false);
  const [formData, setFormData] = useState({
    supplierName: 'Valcambi SA Switzerland',
    orderDate: new Date().toISOString().split('T')[0],
    currency: 'USD',
    exchangeRate: getStoredUsdRate(),
    unitPriceUSD: 75.00,
    quantityGrams: 1000,
    importDutyIDR: 10000000,
    pph22ImportIDR: 30375000,
    freightIDR: 5000000,
    barSerials: 'VC-998811, VC-998812'
  });

  useEffect(() => {
    setOrders(getPurchaseOrders());
    syncLiveRate();
  }, []);

  const syncLiveRate = async () => {
    setLoadingRate(true);
    const data = await fetchBcaERateUSD();
    if (data && data.rate) {
      setFormData(prev => ({ ...prev, exchangeRate: data.rate }));
    }
    setLoadingRate(false);
  };

  // Real-time calculations
  const subtotalUSD = formData.quantityGrams * formData.unitPriceUSD;
  const subtotalIDR = subtotalUSD * formData.exchangeRate;
  const totalLandedCostIDR = subtotalIDR + Number(formData.importDutyIDR) + Number(formData.freightIDR);
  const unitLandedCostIDRPerGram = formData.quantityGrams > 0 ? (totalLandedCostIDR / formData.quantityGrams) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const poPayload = {
      supplier: 'SUPP-VALCAMBI',
      supplierName: formData.supplierName,
      orderDate: formData.orderDate,
      currency: formData.currency,
      exchangeRate: Number(formData.exchangeRate),
      importDuty: Number(formData.importDutyIDR),
      pph22Import: Number(formData.pph22ImportIDR),
      freightAndInsurance: Number(formData.freightIDR),
      barSerialNumbers: formData.barSerials.split(',').map(s => s.trim()),
      items: [
        {
          itemId: 'LM-VALCAMBI-1KG',
          itemCode: 'LM-VALCAMBI-1KG',
          itemName: 'Valcambi Suisse Gold Bar 1kg (999.9 LBMA)',
          quantity: Number(formData.quantityGrams),
          unit: 'gram',
          unitPrice: Number(formData.unitPriceUSD)
        }
      ]
    };

    const res = await createPurchaseOrder(poPayload);
    if (res.success) {
      alert('✅ Purchase Order LM Import berhasil disimpan!');
      setOrders(getPurchaseOrders());
    } else {
      alert('❌ Gagal menyimpan PO: ' + JSON.stringify(res.errors));
    }
  };

  return (
    <div>
      {/* Real-time Landed Cost Form */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <PlaneTakeoff color="#f59e0b" size={22} /> Landed Cost Calculator - Impor Logam Mulia USD
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Supplier Impor</label>
              <input
                className="form-input"
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tgl PO Impor</label>
              <input
                type="date"
                className="form-input"
                value={formData.orderDate}
                onChange={e => setFormData({ ...formData, orderDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mata Uang</label>
              <select
                className="form-select"
                value={formData.currency}
                onChange={e => setFormData({ ...formData, currency: e.target.value })}
              >
                <option value="USD">USD (Dollar AS)</option>
                <option value="IDR">IDR (Rupiah)</option>
              </select>
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Kurs USD ke IDR (Dapat Di-adjust)</label>
                <button
                  type="button"
                  onClick={syncLiveRate}
                  style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={12} className={loadingRate ? 'spin' : ''} /> Sync BCA e-Rate
                </button>
              </div>
              <input
                type="number"
                className="form-input"
                value={formData.exchangeRate}
                onChange={e => setFormData({ ...formData, exchangeRate: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Harga Emas FOB (USD / Gram)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.unitPriceUSD}
                onChange={e => setFormData({ ...formData, unitPriceUSD: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Jumlah Berat Emas (Gram)</label>
              <input
                type="number"
                className="form-input"
                value={formData.quantityGrams}
                onChange={e => setFormData({ ...formData, quantityGrams: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bea Masuk (IDR)</label>
              <input
                type="number"
                className="form-input"
                value={formData.importDutyIDR}
                onChange={e => setFormData({ ...formData, importDutyIDR: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Freight & Asuransi (IDR)</label>
              <input
                type="number"
                className="form-input"
                value={formData.freightIDR}
                onChange={e => setFormData({ ...formData, freightIDR: Number(e.target.value) })}
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">No. Seri Batangan / Bar Serial IDs (Pisahkan koma)</label>
              <input
                className="form-input"
                value={formData.barSerials}
                onChange={e => setFormData({ ...formData, barSerials: e.target.value })}
              />
            </div>
          </div>

          {/* Landed Cost Breakdown Display */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid var(--accent-gold)' }}>
            <h4 style={{ color: '#fbbf24', fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={16} /> Rincian Kalkulasi Landed Cost & Kapitalisasi Persediaan IDR
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <span className="stat-lbl">Subtotal FOB (USD)</span>
                <div style={{ fontWeight: 700 }}>$ {subtotalUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <span className="stat-lbl">Subtotal Emas IDR (Konversi Kurs)</span>
                <div style={{ fontWeight: 700 }}>Rp {subtotalIDR.toLocaleString()}</div>
              </div>
              <div>
                <span className="stat-lbl">Total Landed Cost IDR</span>
                <div style={{ fontWeight: 800, color: '#fbbf24' }}>Rp {totalLandedCostIDR.toLocaleString()}</div>
              </div>
              <div>
                <span className="stat-lbl">Unit Landed Cost / Gram IDR</span>
                <div style={{ fontWeight: 800, color: '#34d399', fontSize: '1.1rem' }}>
                  Rp {Math.round(unitLandedCostIDRPerGram).toLocaleString()} / g
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary">
            <Plus size={18} /> Simpan Purchase Order & Kapitalisasi Landed Cost
          </button>
        </form>
      </div>

      {/* Existing Orders */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Riwayat Purchase Order LM Import ({orders.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. PO</th>
                <th>Supplier</th>
                <th>Tgl PO</th>
                <th>Total (USD)</th>
                <th>Kurs Transaksi</th>
                <th>Landed Cost IDR / Gram</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Belum ada data PO LM Import.
                  </td>
                </tr>
              ) : (
                orders.map(po => (
                  <tr key={po.id || po.poNumber}>
                    <td><strong>{po.poNumber}</strong></td>
                    <td>{po.supplierName || po.supplier}</td>
                    <td>{po.orderDate}</td>
                    <td>$ {(po.totalAmountUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>Rp {(po.exchangeRate || 16250).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: '#34d399' }}>
                      Rp {Math.round(po.unitLandedCostIDRPerGram || 0).toLocaleString()} / g
                    </td>
                    <td><span className="badge badge-emerald">{po.status || 'Approved'}</span></td>
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
