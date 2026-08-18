import React, { useState, useEffect } from 'react';
import { PlaneTakeoff, Plus, CheckCircle, Calculator, RefreshCw, Building2, CreditCard, DollarSign, ShieldCheck, Truck, Scale, Tag, Printer, Sparkles, FileText, History, AlertCircle } from 'lucide-react';
import { createPurchaseOrder, getPurchaseOrders } from '../services/storageService';
import { fetchBcaERateUSD, getStoredUsdRate } from '../services/currencyService';
import Modal, { useModal } from '../components/ui/Modal';

export default function LmImportTrading() {
  const { modalProps, showModal } = useModal();
  const [orders, setOrders] = useState([]);
  const [loadingRate, setLoadingRate] = useState(false);
  const [unitMode, setUnitMode] = useState('oz'); // 'oz' (Troy Ounce) or 'gram' (Gram)
  const [selectedPOHistory, setSelectedPOHistory] = useState(null); // State for Payment History Modal

  const [formData, setFormData] = useState({
    supplierName: 'YLG Bullion Singapore Pte Ltd',
    orderDate: new Date().toISOString().split('T')[0],
    currency: 'USD',
    paymentTerms: '100% Cash Before Delivery (Advance TT)',
    exchangeRate: getStoredUsdRate(),
    
    // Field Model Realita Lapangan YLG Singapore
    quantityUnits: 16000, // 16,000 oz
    baseAmountUSD: 1300000, // $1,300,000 (Harga Kesepakatan Base Metal)
    premiumPerUnitUSD: 2.00, // $2.00 / oz (Biaya Ongkos Kirim Brinks All-In)
    
    importDutyIDR: 0,
    pph22ImportIDR: 0,
    freightAndHandlingLocalIDR: 0,
    barSerials: 'YLG-SG-998811 s/d YLG-SG-998850 (Brinks Vault Sealed)'
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

  // Langsung Submit & Terbitkan PO Resmi
  const handleDirectSubmit = async (e) => {
    e.preventDefault();
    if (!formData.quantityUnits || !formData.baseAmountUSD) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Mohon lengkapi Jumlah Pesanan dan Nilai Kesepakatan Base FOB USD.' });
      return;
    }

    const poPayload = {
      supplier: 'SUPP-YLG-SG',
      supplierName: formData.supplierName,
      orderDate: formData.orderDate,
      currency: formData.currency,
      paymentTerms: formData.paymentTerms,
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
      
      // Data Tracking Cicilan Awal
      paidAmountIDR: 0,
      remainingBalanceIDR: totalLandedCostIDR,
      paymentStatus: 'UNPAID',
      paymentHistory: [],
      
      barSerialNumbers: formData.barSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
      logisticsCarrier: 'BRINKS Global Services',
      notes: `Impor Emas YLG Singapore: Base $${Number(formData.baseAmountUSD).toLocaleString()} + Premium $${totalPremiumUSD.toLocaleString()} ($${formData.premiumPerUnitUSD}/${unitMode}) ➔ Total All-in $${totalAllInGoldUSD.toLocaleString()}`,
      
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
      showModal({
        variant: 'success',
        title: 'Purchase Order Resmi Diterbitkan!',
        message: `PO Impor (${res.order?.poNumber || 'PO-IMP'}) berhasil diterbitkan!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• Supplier: ${formData.supplierName}\n• Total All-In: $ ${totalAllInGoldUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Rp ${totalLandedCostIDR.toLocaleString()})\n• HPP Bersih / Gram: Rp ${Math.round(unitLandedCostIDRPerGram).toLocaleString()} / g\n• Status Pembayaran: 🔴 UNPAID (Siap dicicil/dilunasi via BBK)\n• Status Fisik: APPROVED (Siap diterima di Vault TTB)`
      });
      loadOrders();
    } else {
      showModal({ variant: 'danger', title: 'Gagal Menyimpan PO', message: JSON.stringify(res.errors) });
    }
  };

  return (
    <div>
      {/* Form Container */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PlaneTakeoff color="#f59e0b" size={24} /> Form Purchase Order LM Import (YLG Singapore Model)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Kontrak Pembelian Resmi Eksternal (Base Metal + All-In Premium BRINKS Cargo)
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

            <div className="form-group">
              <label className="form-label">Syarat & Termin Pembayaran</label>
              <input
                className="form-input"
                value={formData.paymentTerms}
                onChange={e => setFormData({ ...formData, paymentTerms: e.target.value })}
              />
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

            {/* LOGISTIK */}
            <div className="form-group">
              <label className="form-label">Kargo Pengamanan & Pengiriman</label>
              <input
                className="form-input"
                disabled
                value="BRINKS Global Services (All-in di Harga Emas via Premium)"
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

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem', fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}
          >
            <Plus size={20} /> 🚀 Terbitkan Purchase Order Resmi (Langsung Jadi & Siap TTB)
          </button>
        </form>
      </div>

      {/* Existing Orders Table with 3-State Payment Badges & Installment History Modal */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles color="#fbbf24" size={18} /> Riwayat Purchase Order LM Import & Monitoring Cicilan ({orders.length})
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. PO</th>
                <th>Supplier Impor</th>
                <th>Tgl PO</th>
                <th>Volume Pesanan</th>
                <th>Total Nilai (USD)</th>
                <th>Total Landed Cost IDR</th>
                <th>Status Pembayaran (Cicilan)</th>
                <th>Status Fisik Brankas</th>
                <th>Aksi & Riwayat</th>
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
                orders.map(po => {
                  const totalCostIDR = po.totalLandedCostIDR || ((po.totalAmountUSD || 0) * (po.exchangeRate || 16250)) || Number(po.total || 0);
                  const paidIDR = Number(po.paidAmountIDR || 0);
                  const remainingIDR = typeof po.remainingBalanceIDR !== 'undefined' ? po.remainingBalanceIDR : Math.max(0, totalCostIDR - paidIDR);
                  
                  // 3-State Status Logic: UNPAID, PARTIALLY PAID, PAID
                  let paymentBadge = (
                    <span className="badge badge-rose" style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444' }}>
                      🔴 UNPAID
                    </span>
                  );
                  if (paidIDR > 0 && remainingIDR > 0) {
                    paymentBadge = (
                      <span className="badge badge-gold" style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b', color: '#fbbf24', fontSize: '0.75rem' }}>
                        🟡 PARTIALLY PAID<br/>
                        <small style={{ fontWeight: 700 }}>Bayar: Rp {paidIDR.toLocaleString()} | Sisa: Rp {remainingIDR.toLocaleString()}</small>
                      </span>
                    );
                  } else if (paidIDR > 0 && remainingIDR === 0) {
                    paymentBadge = (
                      <span className="badge badge-emerald">
                        🟢 PAID / LUNAS
                      </span>
                    );
                  }

                  return (
                    <tr key={po.id || po.poNumber}>
                      <td><strong style={{ color: '#38bdf8' }}>{po.poNumber}</strong></td>
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
                      <td style={{ fontWeight: 700, color: '#34d399' }}>
                        Rp {totalCostIDR.toLocaleString()}
                      </td>
                      <td>{paymentBadge}</td>
                      <td>
                        {po.status === 'received' ? (
                          <span className="badge badge-blue">📦 RECEIVED IN VAULT</span>
                        ) : (
                          <span className="badge badge-emerald">🟢 APPROVED (OPEN)</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(56,189,248,0.2)', border: '1px solid #38bdf8', color: '#38bdf8' }}
                            onClick={() => setSelectedPOHistory(po)}
                          >
                            <History size={13} /> Riwayat Cicilan
                          </button>
                          <button
                            className="btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            onClick={() => alert(`🖨️ Mencetak PDF Dokumen PO Impor Resmi ${po.poNumber} untuk ${po.supplierName}...`)}
                          >
                            <Printer size={13} /> Cetak
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL POPUP RIWAYAT CICILAN PEMBAYARAN PO (AUDIT TRAIL) */}
      {selectedPOHistory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '650px', padding: '24px', background: '#0f172a', border: '1px solid var(--accent-gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={20} /> Log Riwayat Pembayaran BBK (Audit Trail)
              </h3>
              <button
                className="btn-primary"
                style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444' }}
                onClick={() => setSelectedPOHistory(null)}
              >
                ✕ Tutup
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div>
                  <span className="stat-lbl">Nomor PO</span>
                  <strong style={{ color: '#38bdf8' }}>{selectedPOHistory.poNumber}</strong>
                </div>
                <div>
                  <span className="stat-lbl">Supplier</span>
                  <strong>{selectedPOHistory.supplierName || selectedPOHistory.supplier}</strong>
                </div>
                <div>
                  <span className="stat-lbl">Total Tagihan PO</span>
                  <strong style={{ color: '#fbbf24' }}>
                    Rp {(selectedPOHistory.totalLandedCostIDR || (selectedPOHistory.totalAmountUSD * selectedPOHistory.exchangeRate)).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.9rem', color: '#38bdf8', marginBottom: '10px' }}>
              📋 Rincian Transaksi Voucher BBK yang Diterbitkan:
            </h4>

            {(!selectedPOHistory.paymentHistory || selectedPOHistory.paymentHistory.length === 0) ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15,23,42,0.6)', borderRadius: '8px' }}>
                <AlertCircle size={28} color="#ef4444" style={{ margin: '0 auto 8px' }} />
                Belum ada transaksi pembayaran (BBK) untuk PO ini. (Status: 🔴 UNPAID)
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>No. Voucher BBK</th>
                      <th>Tanggal Bayar</th>
                      <th>Rekening Bank</th>
                      <th style={{ textAlign: 'right' }}>Nominal Cicilan</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPOHistory.paymentHistory.map((pmt, i) => (
                      <tr key={i}>
                        <td><strong style={{ color: '#38bdf8' }}>{pmt.voucherNo}</strong></td>
                        <td>{pmt.date}</td>
                        <td><small>{pmt.bank || 'Bank BCA Devisa USD'}</small></td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                          Rp {Number(pmt.amount || 0).toLocaleString()}
                        </td>
                        <td><span className="badge badge-emerald">✅ POSTED</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn-primary"
                onClick={() => setSelectedPOHistory(null)}
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
