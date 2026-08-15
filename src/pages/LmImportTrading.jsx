import React, { useState, useEffect } from 'react';
import { PlaneTakeoff, Plus, CheckCircle, Calculator, RefreshCw, Building2, CreditCard, DollarSign, ShieldCheck, Truck, Scale, Tag, FileEdit, CheckSquare, Printer } from 'lucide-react';
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
    paymentBankAccount: '1111-USD', // 1111-USD (BCA Devisa USD), 1111-SGD (BCA Devisa SGD), 1111-IDR (BCA IDR)
    paymentBankAccountName: 'Bank BCA Devisa USD (No. 889-012-USD1 - Swift: CENAIDJA)',
    exchangeRate: getStoredUsdRate(),
    
    // Field Model Realita Lapangan Pak Sandy (YLG Singapore Style)
    quantityUnits: 16000, // 16,000 oz
    baseAmountUSD: 1300000, // $1,300,000 (Harga Kesepakatan Base Metal)
    premiumPerUnitUSD: 2.00, // $2.00 / oz (Biaya Ongkos Kirim Brinks & Selisih yang di-bundle sebagai Premium)
    
    importDutyIDR: 0,
    pph22ImportIDR: 0,
    freightAndHandlingLocalIDR: 0,
    barSerials: 'YLG-SG-998811 s/d YLG-SG-998850 (Brinks Vault Sealed)',
    logisticsPartner: 'BRINKS Global Services (Dibayar YLG, Ditanggung TAN via Premium $2/oz)'
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

  // Kalkulasi Realita Lapangan: Base Price + (Premium x Qty) = Total All-In ($1,300,000 + $32,000 = $1,332,000)
  const totalPremiumUSD = formData.quantityUnits * Number(formData.premiumPerUnitUSD || 0);
  const totalAllInGoldUSD = Number(formData.baseAmountUSD || 0) + totalPremiumUSD;
  const effectivePricePerGramUSD = totalWeightGrams > 0 ? (totalAllInGoldUSD / totalWeightGrams) : 0;
  const effectivePricePerOzUSD = totalWeightOz > 0 ? (totalAllInGoldUSD / totalWeightOz) : 0;

  // Konversi ke IDR & Landed Cost Buku PT TAN
  const totalGoldAmountIDR = totalAllInGoldUSD * formData.exchangeRate;
  const totalLandedCostIDR = totalGoldAmountIDR + Number(formData.importDutyIDR || 0) + Number(formData.freightAndHandlingLocalIDR || 0);
  const unitLandedCostIDRPerGram = totalWeightGrams > 0 ? (totalLandedCostIDR / totalWeightGrams) : 0;

  const handleSaveOrder = async (statusMode = 'draft') => {
    if (!formData.quantityUnits || !formData.baseAmountUSD) {
      alert('Mohon isi Jumlah Unit dan Nilai Kesepakatan Base FOB USD.');
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
      status: statusMode, // 'draft' or 'approved'
      
      // Rincian Premium & All-in Price
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
      notes: `Impor Emas YLG Singapore: Base $${formData.baseAmountUSD.toLocaleString()} + Premium $${totalPremiumUSD.toLocaleString()} ($${formData.premiumPerUnitUSD}/${unitMode}) ➔ Total All-in $${totalAllInGoldUSD.toLocaleString()}`,
      
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
      if (statusMode === 'draft') {
        alert(`📝 DRAFT Purchase Order (${formData.supplierName}) Berhasil Disimpan!\nStatus: DRAFT (Belum mengikat, dapat diedit / di-approve kapan saja).`);
      } else {
        alert(`✅ Purchase Order Resmi (${formData.supplierName}) Berhasil Diterbitkan!\nStatus: APPROVED (Siap ditarik di menu Penerimaan Barang TTB).`);
      }
      loadOrders();
    } else {
      alert('❌ Gagal menyimpan PO: ' + JSON.stringify(res.errors));
    }
  };

  // Handler Approve Draft 1-Klik
  const handleApproveDraft = (orderId) => {
    if (!confirm('Setujui dan terbitkan draft PO ini menjadi PO RESMI (Approved)?')) return;
    if (typeof window !== 'undefined' && window.PurchaseOrder) {
      window.PurchaseOrder.approveOrder(orderId);
      alert('🎉 Draft PO Berhasil Disetujui & Diterbitkan Resmi (Approved)!');
      loadOrders();
    }
  };

  return (
    <div>
      {/* Form Container */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PlaneTakeoff color="#f59e0b" size={24} /> Pembelian LM Import & Landed Costing (Draft & PO Resmi)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Mendukung Simpan Draft Estimasi Kontrak, Persetujuan PO Resmi, & Perhitungan All-In Premium YLG Singapore
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

        <form onSubmit={e => e.preventDefault()}>
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
              <label className="form-label">Tgl Kontrak PO Impor</label>
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
                value="BRINKS Global Services (Dibayar YLG, Dibebankan ke TAN via Premium)"
                style={{ background: 'rgba(15,23,42,0.8)', color: 'var(--text-secondary)' }}
              />
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

          {/* Rincian Kalkulasi */}
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid var(--accent-gold)' }}>
            <h4 style={{ color: '#fbbf24', fontSize: '0.95rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={18} /> Rincian Struktur Harga Beli Emas All-In (Sesuai Catatan Buku PT TAN)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <span className="stat-lbl">1. Nilai Base Kesepakatan</span>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '1.1rem' }}>$ {formData.baseAmountUSD.toLocaleString()}</div>
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

          {/* DUAL ACTION BUTTONS: DRAFT VS TERBITKAN RESMI */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1, minWidth: '240px', justifyContent: 'center', padding: '12px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fbbf24' }}
              onClick={() => handleSaveOrder('draft')}
            >
              <FileEdit size={18} /> 📝 Simpan Sebagai DRAFT PO (Untuk Review)
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1, minWidth: '240px', justifyContent: 'center', padding: '12px', background: 'linear-gradient(135deg, #10b981, #059669)' }}
              onClick={() => handleSaveOrder('approved')}
            >
              <Plus size={18} /> 🚀 Terbitkan PO Resmi (Approved & Siap TTB)
            </button>
          </div>
        </form>
      </div>

      {/* Existing Orders Table with Draft Status and Approval Actions */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px' }}>
          📋 Riwayat Purchase Order LM Import ({orders.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. PO</th>
                <th>Supplier Impor</th>
                <th>Tgl PO</th>
                <th>Volume Pesanan</th>
                <th>Total All-In (USD)</th>
                <th>Kurs Transaksi</th>
                <th>Landed Cost IDR</th>
                <th>Status PO</th>
                <th>Aksi Dokumen</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    Belum ada data PO LM Import.
                  </td>
                </tr>
              ) : (
                orders.map(po => (
                  <tr key={po.id || po.poNumber}>
                    <td><strong>{po.poNumber}</strong></td>
                    <td><strong>{po.supplierName || po.supplier}</strong></td>
                    <td>{po.orderDate}</td>
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
                    <td>
                      {po.status === 'draft' && (
                        <span className="badge badge-gold" style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b' }}>
                          🟡 DRAFT (DALAM REVIEW)
                        </span>
                      )}
                      {(po.status === 'approved' || po.status === 'open') && (
                        <span className="badge badge-emerald">🟢 APPROVED (RESMI)</span>
                      )}
                      {po.status === 'received' && (
                        <span className="badge badge-blue">📦 RECEIVED IN VAULT</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {po.status === 'draft' && (
                          <button
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                            onClick={() => handleApproveDraft(po.id)}
                          >
                            <CheckSquare size={13} /> Approve PO
                          </button>
                        )}
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                          onClick={() => alert(`🖨️ Mencetak PDF Dokumen PO Impor ${po.poNumber} untuk ${po.supplierName}...`)}
                        >
                          <Printer size={13} /> Cetak
                        </button>
                      </div>
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
