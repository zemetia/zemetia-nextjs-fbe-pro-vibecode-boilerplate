import React, { useState, useEffect } from 'react';
import { PlaneTakeoff, Plus, CheckCircle, Calculator, RefreshCw, Building2, CreditCard, DollarSign, ShieldCheck, Truck, Scale, Tag, Printer, Sparkles, FileText } from 'lucide-react';
import { createPurchaseOrder, getPurchaseOrders } from '../services/storageService';
import { fetchBcaERateUSD, getStoredUsdRate } from '../services/currencyService';

export default function LmImportTrading() {
  const [orders, setOrders] = useState([]);
  const [loadingRate, setLoadingRate] = useState(false);
  const [unitMode, setUnitMode] = useState('oz'); // 'oz' (Troy Ounce) or 'gram' (Gram)

  const [formData, setFormData] = useState({
    supplierName: 'YLG Bullion Singapore Pte Ltd',
    orderDate: new Date().toISOString().split('T')[0],
    currency: 'USD',
    paymentBankAccount: '1111-USD',
    paymentBankAccountName: 'Bank BCA Devisa USD (No. 889-012-USD1 - Swift: CENAIDJA)',
    exchangeRate: getStoredUsdRate(),
    
    // Field Model Realita Lapangan YLG Singapore
    quantityUnits: 16000, // 16,000 oz
    baseAmountUSD: 1300000, // $1,300,000 (Harga Kesepakatan Base Metal)
    premiumPerUnitUSD: 2.00, // $2.00 / oz (Biaya Ongkos Kirim Brinks All-In)
    
    // Dokumen Kepabeanan & Impor
    pibNo: '001234/PIB/KPU-TP/2026',
    sppbNo: 'SPPB-009876/KPU.01/2026',
    mawbNo: 'SQ-618-99881122',
    
    importDutyIDR: 0, // Bea Masuk (sering 0% untuk raw bullion LBMA)
    pph22ImportIDR: 0, // PPh 22 Impor
    freightAndHandlingLocalIDR: 0, // Biaya handling lokal tambahan jika ada
    barSerials: 'YLG-SG-998811 s/d YLG-SG-998850 (Brinks Vault Sealed)',
    logisticsPartner: 'BRINKS Global Services (All-in via Premium $2/oz)'
  });

  useEffect(() => {
    loadOrders();
    syncLiveRate();
  }, []);

  const loadOrders = () => {
    const list = getPurchaseOrders();
    setOrders(list);
  };

  const syncLiveRate = async () => {
    setLoadingRate(true);
    const data = await fetchBcaERateUSD();
    if (data && data.rate) {
      setFormData(prev => ({ ...prev, exchangeRate: data.rate }));
    }
    setLoadingRate(false);
  };

  // Konversi Satuan (1 Troy Ounce = 31.1034768 Gram)
  const OZ_TO_GRAM = 31.1034768;
  const totalWeightGrams = unitMode === 'oz' ? formData.quantityUnits * OZ_TO_GRAM : formData.quantityUnits;
  const totalWeightOz = unitMode === 'oz' ? formData.quantityUnits : (formData.quantityUnits / OZ_TO_GRAM);

  // Kalkulasi All-In Premium
  const totalPremiumUSD = formData.quantityUnits * Number(formData.premiumPerUnitUSD || 0);
  const totalAllInGoldUSD = Number(formData.baseAmountUSD || 0) + totalPremiumUSD;
  const effectivePricePerGramUSD = totalWeightGrams > 0 ? (totalAllInGoldUSD / totalWeightGrams) : 0;
  const effectivePricePerOzUSD = totalWeightOz > 0 ? (totalAllInGoldUSD / totalWeightOz) : 0;

  // Konversi ke IDR & Landed Cost
  const totalGoldAmountIDR = totalAllInGoldUSD * formData.exchangeRate;
  const totalLandedCostIDR = totalGoldAmountIDR + Number(formData.importDutyIDR || 0) + Number(formData.freightAndHandlingLocalIDR || 0);
  const unitLandedCostIDRPerGram = totalWeightGrams > 0 ? (totalLandedCostIDR / totalWeightGrams) : 0;

  // Langsung Submit & Terbitkan PO Resmi (Tanpa Draft Berbelit-belit)
  const handleDirectSubmit = async (e) => {
    e.preventDefault();
    if (!formData.quantityUnits || !formData.baseAmountUSD) {
      alert('Mohon lengkapi Jumlah Pesanan dan Nilai Kesepakatan Base FOB USD.');
      return;
    }

    const poPayload = {
      supplier: 'SUPP-YLG-SG',
      supplierName: formData.supplierName,
      orderDate: formData.orderDate,
      currency: formData.currency,
      paymentBankAccount: formData.paymentBankAccount,
      paymentBankAccountName: formData.paymentBankAccountName,
      exchangeRate: Number(formData.exchangeRate),
      status: 'approved', // Langsung Resmi & Siap TTB
      
      unitMode,
      quantityUnits: Number(formData.quantityUnits),
      weightGrams: Math.round(totalWeightGrams * 100) / 100,
      weightOz: Math.round(totalWeightOz * 100) / 100,
      baseAmountUSD: Number(formData.baseAmountUSD),
      premiumPerUnitUSD: Number(formData.premiumPerUnitUSD),
      totalPremiumUSD: totalPremiumUSD,
      totalAmountUSD: totalAllInGoldUSD,
      
      importDuty: Number(formData.importDutyIDR),
      pph22Import: Number(formData.pph22ImportIDR),
      freightAndInsurance: Number(formData.freightAndHandlingLocalIDR),
      totalLandedCostIDR: totalLandedCostIDR,
      unitLandedCostIDRPerGram: Math.round(unitLandedCostIDRPerGram),
      
      barSerialNumbers: formData.barSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
      logisticsCarrier: 'BRINKS Global Services',
      pibNo: formData.pibNo,
      sppbNo: formData.sppbNo,
      mawbNo: formData.mawbNo,
      notes: `Impor Emas YLG Singapore: Base $${Number(formData.baseAmountUSD).toLocaleString()} + Premium $${totalPremiumUSD.toLocaleString()} ($${formData.premiumPerUnitUSD}/${unitMode}) ➔ Total All-in $${totalAllInGoldUSD.toLocaleString()} | PIB: ${formData.pibNo || '-'} | SPPB: ${formData.sppbNo || '-'} | MAWB: ${formData.mawbNo || '-'}`,
      
      items: [
        {
          itemId: 'LM-IMPORT-LBMA',
          itemCode: 'LM-IMPORT-LBMA',
          itemName: `Emas Batangan 999.9 LBMA (${formData.supplierName})`,
          quantity: Math.round(totalWeightGrams * 100) / 100,
          unit: 'gram',
          unitPriceUSD: effectivePricePerGramUSD,
          unitPriceIDR: Math.round(unitLandedCostIDRPerGram)
        }
      ]
    };

    const res = await createPurchaseOrder(poPayload);
    if (res.success) {
      alert(`🎉 PURCHASE ORDER RESMI BERHASIL DITERBITKAN!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• No. PO: ${res.order?.poNumber || 'PO-IMP'}\n• Supplier: ${formData.supplierName}\n• Dokumen Kepabeanan:\n   1. No. PIB: ${formData.pibNo || '-'}\n   2. No. SPPB: ${formData.sppbNo || '-'}\n   3. No. MAWB: ${formData.mawbNo || '-'}\n• Total All-In (USD): $ ${totalAllInGoldUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n• Total Landed Cost: Rp ${totalLandedCostIDR.toLocaleString()}\n• HPP Bersih / Gram: Rp ${Math.round(unitLandedCostIDRPerGram).toLocaleString()} / g\n• Rekening Bayar: ${formData.paymentBankAccountName}\n• Status: APPROVED & SIAP PENERIMAAN TTB VAULT`);
      loadOrders();
    } else {
      alert('❌ Gagal menyimpan PO: ' + JSON.stringify(res.errors));
    }
  };

  return (
    <div>
      {/* Form Container */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PlaneTakeoff color="#f59e0b" size={24} /> Penerbitan Purchase Order LM Import (YLG All-In Model)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Input Langsung Jadi & Terbit Otomatis (Base Metal + Premium BRINKS All-In)
            </p>
          </div>

          {/* Unit Selector */}
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(15,23,42,0.8)', padding: '6px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button
              className="btn-primary"
              style={{
                background: unitMode === 'oz' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                color: unitMode === 'oz' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.85rem'
              }}
              onClick={() => setUnitMode('oz')}
            >
              <Scale size={16} /> Satuan Troy Ounce (oz)
            </button>
            <button
              className="btn-primary"
              style={{
                background: unitMode === 'gram' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                color: unitMode === 'gram' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.85rem'
              }}
              onClick={() => setUnitMode('gram')}
            >
              <Scale size={16} /> Satuan Gram (g)
            </button>
          </div>
        </div>

        <form onSubmit={handleDirectSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Supplier Impor Emas</label>
              <select
                className="form-select"
                style={{ fontWeight: 700, color: '#fbbf24' }}
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
              >
                <option value="YLG Bullion Singapore Pte Ltd">YLG Bullion Singapore Pte Ltd (Singapore)</option>
                <option value="Valcambi SA Switzerland">Valcambi SA Switzerland (LBMA Refiner)</option>
                <option value="PAMP SA Switzerland">PAMP SA Switzerland</option>
                <option value="Metalor Technologies Singapore">Metalor Technologies Singapore</option>
                <option value="Singapore Precious Metals Exchange (SGPMX)">SGPMX Singapore</option>
                <option value="Dubai Gold & Commodities Bullion">Dubai Gold & Commodities Bullion</option>
              </select>
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

            {/* SELEKSI REKENING BANK VALAS */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700 }}>Rekening Bank Pembayaran Impor</label>
              <select
                className="form-select"
                style={{ border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 700 }}
                value={formData.paymentBankAccount}
                onChange={e => {
                  const val = e.target.value;
                  const name = val === '1111-USD'
                    ? 'Bank BCA Devisa USD (No. 889-012-USD1 - Swift: CENAIDJA)'
                    : val === '1111-SGD'
                    ? 'Bank BCA Devisa SGD / UOB Singapore (No. 889-012-SGD1)'
                    : 'Bank BCA IDR Operasional (No. 889-012-3456)';
                  setFormData({ ...formData, paymentBankAccount: val, paymentBankAccountName: name });
                }}
              >
                <option value="1111-USD">Bank BCA Devisa USD (No. 889-012-USD1 - Swift: CENAIDJA)</option>
                <option value="1111-SGD">Bank BCA Devisa SGD / UOB Singapore (No. 889-012-SGD1)</option>
                <option value="1111-IDR">Bank BCA IDR Operasional (No. 889-012-3456)</option>
              </select>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Kurs USD ke IDR</label>
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

            {/* JUMLAH PESANAN */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#fbbf24', fontWeight: 700 }}>
                Jumlah Pesanan Emas ({unitMode.toUpperCase()})
              </label>
              <input
                type="number"
                className="form-input"
                style={{ border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: 700 }}
                value={formData.quantityUnits}
                onChange={e => setFormData({ ...formData, quantityUnits: Number(e.target.value) })}
              />
              <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Ekivalen: <strong>{totalWeightGrams.toLocaleString(undefined, { maximumFractionDigits: 2 })} Gram</strong> ({totalWeightOz.toLocaleString(undefined, { maximumFractionDigits: 2 })} oz)
              </small>
            </div>

            {/* HARGA BASE FOB KESEPAKATAN */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#38bdf8', fontWeight: 700 }}>
                Harga Kesepakatan Base Metal (USD)
              </label>
              <input
                type="number"
                className="form-input"
                style={{ border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 700 }}
                placeholder="Contoh: 1300000"
                value={formData.baseAmountUSD}
                onChange={e => setFormData({ ...formData, baseAmountUSD: Number(e.target.value) })}
              />
            </div>

            {/* BIAYA PREMIUM ($ / UNIT) */}
            <div className="form-group" style={{ background: 'rgba(245,158,11,0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <label className="form-label" style={{ color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag size={16} /> Biaya "PREMIUM" (USD / {unitMode.toUpperCase()}):
              </label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                style={{ border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: 800, fontSize: '1rem' }}
                placeholder="Misal: 2.00 (artinya $2/oz)"
                value={formData.premiumPerUnitUSD}
                onChange={e => setFormData({ ...formData, premiumPerUnitUSD: Number(e.target.value) })}
              />
              <small style={{ color: '#34d399', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                Total Biaya Premium: <strong>+$ {totalPremiumUSD.toLocaleString()}</strong> (All-in Brinks Cargo)
              </small>
            </div>

            {/* LOGISTIK & PENGIRIMAN CARRIER */}
            <div className="form-group">
              <label className="form-label">Kargo Pengamanan & Pengiriman</label>
              <input
                className="form-input"
                disabled
                value="BRINKS Global Services (All-in di Harga Emas via Premium)"
                style={{ background: 'rgba(15,23,42,0.8)', color: 'var(--text-secondary)' }}
              />
            </div>

            {/* DOKUMEN IMPOR & KEPABEANAN */}
            <div className="form-group" style={{ gridColumn: 'span 2', background: 'rgba(59, 130, 246, 0.08)', padding: '16px', borderRadius: '10px', border: '1px solid #3b82f6' }}>
              <label className="form-label" style={{ color: '#60a5fa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '0.95rem' }}>
                <FileText size={18} /> Dokumen Impor & Kepabeanan (Customs Clearance)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: '#93c5fd' }}>1. No. PIB (Pemberitahuan Impor)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: 001234/PIB/KPU-TP/2026"
                    value={formData.pibNo}
                    onChange={e => setFormData({ ...formData, pibNo: e.target.value })}
                    style={{ border: '1px solid #3b82f6', color: '#60a5fa', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: '#86efac' }}>2. No. SPPB (Persetujuan Pengeluaran)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: SPPB-009876/KPU.01/2026"
                    value={formData.sppbNo}
                    onChange={e => setFormData({ ...formData, sppbNo: e.target.value })}
                    style={{ border: '1px solid #22c55e', color: '#4ade80', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: '#fcd34d' }}>3. No. MAWB (Master Air Waybill)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: SQ-618-99881122"
                    value={formData.mawbNo}
                    onChange={e => setFormData({ ...formData, mawbNo: e.target.value })}
                    style={{ border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: 600 }}
                  />
                </div>
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">No. Seri Batangan / Segel Koper Brinks (Bar Serial IDs)</label>
              <input
                className="form-input"
                value={formData.barSerials}
                onChange={e => setFormData({ ...formData, barSerials: e.target.value })}
              />
            </div>
          </div>

          {/* Rincian Kalkulasi All-In */}
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid var(--accent-gold)' }}>
            <h4 style={{ color: '#fbbf24', fontSize: '0.95rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={18} /> Rincian Struktur Harga Beli Emas All-In (Buku PT TAN)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <span className="stat-lbl">1. Nilai Base Kesepakatan</span>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1.1rem' }}>$ {Number(formData.baseAmountUSD || 0).toLocaleString()}</div>
              </div>
              <div>
                <span className="stat-lbl">2. Tambahan Premium (${formData.premiumPerUnitUSD}/{unitMode})</span>
                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '1.1rem' }}>+$ {totalPremiumUSD.toLocaleString()}</div>
              </div>
              <div>
                <span className="stat-lbl">3. Total All-In Harga Emas (USD)</span>
                <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '1.3rem' }}>
                  $ {totalAllInGoldUSD.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="stat-lbl">4. Total Landed Cost (IDR)</span>
                <div style={{ fontWeight: 800, color: '#34d399', fontSize: '1.3rem' }}>
                  Rp {totalLandedCostIDR.toLocaleString()}
                </div>
                <small style={{ color: '#38bdf8', fontWeight: 700 }}>HPP: Rp {Math.round(unitLandedCostIDRPerGram).toLocaleString()} / gram</small>
              </div>
            </div>
          </div>

          {/* SINGLE DIRECT SUBMIT BUTTON - LANGSUNG JADI */}
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem', fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}
          >
            <Plus size={20} /> 🚀 Terbitkan Purchase Order Resmi (Langsung Jadi & Siap TTB)
          </button>
        </form>
      </div>

      {/* Existing Orders Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles color="#fbbf24" size={18} /> Riwayat Purchase Order LM Import ({orders.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. PO</th>
                <th>Supplier Impor</th>
                <th>Tgl PO</th>
                <th>Dokumen Impor</th>
                <th>Volume Pesanan</th>
                <th>Total All-In (USD)</th>
                <th>Kurs Transaksi</th>
                <th>Landed Cost IDR</th>
                <th>HPP / Gram</th>
                <th>Status PO</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Belum ada data PO LM Import.
                  </td>
                </tr>
              ) : (
                orders.map(po => (
                  <tr key={po.id || po.poNumber}>
                    <td><strong style={{ color: '#38bdf8' }}>{po.poNumber}</strong></td>
                    <td><strong>{po.supplierName || po.supplier}</strong></td>
                    <td>{po.orderDate}</td>
                    <td>
                      {(po.pibNo || po.sppbNo || po.mawbNo) ? (
                        <div style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                          {po.pibNo && <div><span style={{ color: '#93c5fd' }}>PIB:</span> <strong style={{ color: '#bfdbfe' }}>{po.pibNo}</strong></div>}
                          {po.sppbNo && <div><span style={{ color: '#86efac' }}>SPPB:</span> <strong style={{ color: '#bbf7d0' }}>{po.sppbNo}</strong></div>}
                          {po.mawbNo && <div><span style={{ color: '#fcd34d' }}>MAWB:</span> <strong style={{ color: '#fde68a' }}>{po.mawbNo}</strong></div>}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>
                        {po.quantityUnits ? `${po.quantityUnits.toLocaleString()} ${po.unitMode || 'oz'}` : `${po.weightGrams || 1000} g`}
                      </span>
                    </td>
                    <td style={{ fontWeight: 800, color: '#fbbf24' }}>
                      $ {(po.totalAmountUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>Rp {(po.exchangeRate || 16250).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: '#34d399' }}>
                      Rp {(po.totalLandedCostIDR || ((po.totalAmountUSD || 0) * (po.exchangeRate || 16250))).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 800, color: '#38bdf8' }}>
                      Rp {Math.round(po.unitLandedCostIDRPerGram || 0).toLocaleString()}/g
                    </td>
                    <td>
                      {po.status === 'received' ? (
                        <span className="badge badge-blue">📦 RECEIVED IN VAULT</span>
                      ) : (
                        <span className="badge badge-emerald">🟢 APPROVED (RESMI)</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        onClick={() => alert(`🖨️ Mencetak PDF Dokumen PO Impor Resmi ${po.poNumber} untuk ${po.supplierName}...`)}
                      >
                        <Printer size={13} /> Cetak PO
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
