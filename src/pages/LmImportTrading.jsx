import React, { useState, useEffect } from 'react';
import { PlaneTakeoff, Plus, Calculator, RefreshCw, Scale, Printer, Sparkles, History, AlertCircle } from 'lucide-react';
import { createPurchaseOrder, getPurchaseOrders } from '../services/storageService';
import { fetchBcaERateUSD, getStoredUsdRate } from '../services/currencyService';
import Modal, { useModal } from '../components/ui/Modal';
import NumberInput from '../components/ui/NumberInput';

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
    
    // Field Model Realita Lapangan YLG Singapore (All-In Kesepakatan USD)
    quantityUnits: 16000, // 16,000 oz
    baseAmountUSD: 1300000, // $1,300,000 (Total Nilai Kesepakatan Logam Mulia USD)
    
    logisticsPartner: 'BRINKS Global Services',
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

  // Nilai Total All-In Gold USD
  const totalGoldAmountUSD = Number(formData.baseAmountUSD || 0);
  const effectivePricePerGramUSD = totalWeightGrams > 0 ? (totalGoldAmountUSD / totalWeightGrams) : 0;
  const effectivePricePerOzUSD = totalWeightOz > 0 ? (totalGoldAmountUSD / totalWeightOz) : 0;

  // Konversi ke IDR & Landed Cost
  const totalGoldAmountIDR = totalGoldAmountUSD * formData.exchangeRate;
  const totalLandedCostIDR = totalGoldAmountIDR;
  const unitLandedCostIDRPerGram = totalWeightGrams > 0 ? (totalLandedCostIDR / totalWeightGrams) : 0;

  // Langsung Submit & Terbitkan PO Resmi
  const handleDirectSubmit = async (e) => {
    e.preventDefault();
    if (!formData.quantityUnits || !formData.baseAmountUSD) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Mohon lengkapi Jumlah Pesanan dan Nilai Kesepakatan Total USD.' });
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
      totalAmountUSD: totalGoldAmountUSD,
      
      importDuty: 0,
      pph22Import: 0,
      freightAndInsurance: 0,
      totalLandedCostIDR: totalLandedCostIDR,
      unitLandedCostIDRPerGram: Math.round(unitLandedCostIDRPerGram),
      
      // Data Tracking Cicilan Awal
      paidAmountIDR: 0,
      remainingBalanceIDR: totalLandedCostIDR,
      paymentStatus: 'UNPAID',
      paymentHistory: [],
      
      barSerialNumbers: formData.barSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
      logisticsCarrier: formData.logisticsPartner || 'BRINKS Global Services',
      notes: `Impor Emas ${formData.supplierName}: Total Nilai $${totalGoldAmountUSD.toLocaleString()} (${formData.quantityUnits.toLocaleString()} ${unitMode})`,
      
      items: [
        {
          itemId: 'LM-IMPORT-LBMA',
          itemCode: 'LM-IMPORT-LBMA',
          itemName: `Emas Batangan 999.9 LBMA (${formData.supplierName})`,
          quantity: Math.round(totalWeightGrams * 100) / 100,
          unit: 'gram',
          unitPrice: effectivePricePerGramUSD,
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
        message: `PO Impor (${res.order?.poNumber || 'PO-IMP'}) berhasil diterbitkan!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n• Supplier: ${formData.supplierName}\n• Total Nilai: $ ${totalGoldAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} (Rp ${totalLandedCostIDR.toLocaleString()})\n• HPP Bersih / Gram: Rp ${Math.round(unitLandedCostIDRPerGram).toLocaleString()} / g\n• Status Pembayaran: 🔴 UNPAID (Siap dicicil/dilunasi via BBK di Voucher Management)\n• Status Fisik: APPROVED (Siap diterima di Vault TTB)`
      });
      loadOrders();
    } else {
      showModal({ variant: 'error', title: 'Gagal Menyimpan PO', message: JSON.stringify(res.errors, null, 2) });
    }
  };

  return (
    <div>
      {/* Form Container */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <PlaneTakeoff color="#f59e0b" size={24} /> Form Purchase Order LM Import (YLG Singapore Model)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Kontrak Pembelian Resmi Eksternal Logam Mulia Valuta Asing (USD)
            </p>
          </div>

          {/* Unit Selector */}
          <div className="flex gap-2 bg-[rgba(15,23,42,0.8)] p-1.5 rounded-[10px] border border-line">
            <button
              type="button"
              className={`btn-primary text-[0.85rem] ${unitMode === 'oz' ? 'bg-linear-135 from-gold to-gold-dark text-white' : 'bg-transparent text-fg-soft'}`}
              onClick={() => setUnitMode('oz')}
            >
              <Scale size={16} /> Satuan Troy Ounce (oz)
            </button>
            <button
              type="button"
              className={`btn-primary text-[0.85rem] ${unitMode === 'gram' ? 'bg-linear-135 from-emerald to-emerald-dark text-white' : 'bg-transparent text-fg-soft'}`}
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
                className="form-select font-bold text-gold-light"
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
              <div className="flex justify-between items-center">
                <label className="form-label">Kurs USD ke IDR</label>
                <button
                  type="button"
                  onClick={syncLiveRate}
                  className="bg-transparent border-0 text-gold-light text-xs cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw size={12} className={loadingRate ? 'animate-spin' : ''} /> Sync BCA e-Rate
                </button>
              </div>
              <NumberInput
                value={formData.exchangeRate}
                onChange={exchangeRate => setFormData({ ...formData, exchangeRate })}
              />
            </div>

            {/* JUMLAH PESANAN */}
            <div className="form-group">
              <label className="form-label text-gold-light font-bold">
                Jumlah Pesanan Emas ({unitMode.toUpperCase()})
              </label>
              <NumberInput
                className="border border-gold text-gold-light font-bold"
                value={formData.quantityUnits}
                onChange={quantityUnits => setFormData({ ...formData, quantityUnits })}
              />
              <small className="text-fg-muted mt-1 block">
                Ekivalen: <strong>{totalWeightGrams.toLocaleString(undefined, { maximumFractionDigits: 2 })} Gram</strong> ({totalWeightOz.toLocaleString(undefined, { maximumFractionDigits: 2 })} oz)
              </small>
            </div>

            {/* HARGA TOTAL KESEPAKATAN USD */}
            <div className="form-group">
              <label className="form-label text-sky-light font-bold">
                Total Kesepakatan Nilai Beli Emas (USD $)
              </label>
              <NumberInput
                allowDecimal
                className="border border-sky-light text-sky-light font-bold"
                placeholder="Contoh: 1300000"
                value={formData.baseAmountUSD}
                onChange={baseAmountUSD => setFormData({ ...formData, baseAmountUSD })}
              />
              <small className="text-emerald-light font-semibold block mt-1">
                Estimasi Harga: <strong>$ {effectivePricePerOzUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })} / oz</strong> ($ {effectivePricePerGramUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })} / g)
              </small>
            </div>

            {/* LOGISTIK & PENGIRIMAN CARRIER */}
            <div className="form-group">
              <label className="form-label">Kargo Pengamanan & Pengiriman</label>
              <input
                className="form-input"
                value={formData.logisticsPartner}
                onChange={e => setFormData({ ...formData, logisticsPartner: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">No. Seri Batangan / Segel Koper (Bar Serial IDs)</label>
              <input
                className="form-input"
                value={formData.barSerials}
                onChange={e => setFormData({ ...formData, barSerials: e.target.value })}
              />
            </div>
          </div>

          {/* Rincian Kalkulasi Landed Cost */}
          <div className="bg-[rgba(15,23,42,0.7)] p-5 rounded-[12px] my-5 mx-0 border border-gold">
            <h4 className="text-gold-light text-[0.95rem] mb-3.5 flex items-center gap-2">
              <Calculator size={18} /> Rincian Struktur Harga Beli Emas Impor (Buku PT TAN)
            </h4>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              <div>
                <span className="stat-lbl">1. Nilai Total Beli (USD)</span>
                <div className="font-extrabold text-gold-light text-[1.2rem]">$ {totalGoldAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <span className="stat-lbl">2. Kurs Acuan Transaksi</span>
                <div className="font-bold text-fg text-[1.1rem]">Rp {Number(formData.exchangeRate || 0).toLocaleString()}</div>
              </div>
              <div>
                <span className="stat-lbl">3. Total Landed Cost (IDR)</span>
                <div className="font-extrabold text-emerald-light text-[1.2rem]">
                  Rp {totalLandedCostIDR.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="stat-lbl">4. Estimasi HPP / Gram</span>
                <div className="font-extrabold text-sky-light text-[1.2rem]">
                  Rp {Math.round(unitLandedCostIDRPerGram).toLocaleString()} / g
                </div>
              </div>
            </div>
          </div>

          {/* SINGLE DIRECT SUBMIT BUTTON - LANGSUNG JADI */}
          <button
            type="submit"
            className="btn-primary w-full justify-center p-3.5 text-base font-extrabold bg-[linear-gradient(135deg,_#10b981,_#059669)] border-0 shadow-[0_4px_15px_rgba(16,185,129,0.3)] cursor-pointer"
          >
            <Plus size={20} /> 🚀 Terbitkan Purchase Order Resmi (Langsung Jadi & Siap TTB)
          </button>
        </form>
      </div>

      {/* Existing Orders Table */}
      <div className="glass-panel p-6">
        <h3 className="font-heading text-[1.1rem] mb-4 flex items-center gap-2">
          <Sparkles color="#fbbf24" size={18} /> Riwayat Purchase Order LM Import ({orders.length})
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
                  <td className="text-center text-fg-muted p-7.5" colSpan="9">
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
                    <span className="badge badge-rose">
                      🔴 UNPAID
                    </span>
                  );
                  if (paidIDR >= totalCostIDR && totalCostIDR > 0) {
                    paymentBadge = (
                      <span className="badge badge-emerald">
                        🟢 PAID / LUNAS
                      </span>
                    );
                  } else if (paidIDR > 0 && remainingIDR > 0) {
                    paymentBadge = (
                      <span className="badge badge-gold text-xs">
                        🟡 PARTIALLY PAID<br/>
                        <small className="font-bold">Bayar: Rp {paidIDR.toLocaleString()} | Sisa: Rp {remainingIDR.toLocaleString()}</small>
                      </span>
                    );
                  }

                  return (
                    <tr key={po.id || po.poNumber}>
                      <td><strong className="text-sky-light">{po.poNumber}</strong></td>
                      <td><strong>{po.supplierName || po.supplier}</strong></td>
                      <td>{po.orderDate}</td>
                      <td>
                        <span className="badge badge-gold text-xs">
                          {po.quantityUnits ? `${po.quantityUnits.toLocaleString()} ${po.unitMode || 'oz'}` : `${po.weightGrams || 1000} g`}
                        </span>
                      </td>
                      <td className="font-extrabold text-gold-light">
                        $ {(po.totalAmountUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="font-bold text-emerald-light">
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
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            className="btn-primary py-1.5 px-2.5 text-xs bg-[rgba(56,189,248,0.2)] border border-sky-light text-sky-light cursor-pointer"
                            onClick={() => setSelectedPOHistory(po)}
                          >
                            <History size={13} /> Riwayat Cicilan
                          </button>
                          <button
                            className="btn-primary py-1.5 px-2.5 text-xs cursor-pointer"
                            onClick={() => showModal({
                              variant: 'info',
                              title: `🖨️ Cetak Dokumen PO ${po.poNumber}`,
                              message: `• Supplier: ${po.supplierName || po.supplier}\n• Total Nilai: $ ${(po.totalAmountUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} (Rp ${totalCostIDR.toLocaleString()})\n• Status Pembayaran: ${paidIDR >= totalCostIDR && totalCostIDR > 0 ? '🟢 LUNAS' : paidIDR > 0 ? `🟡 DICICIL (Terbayar Rp ${paidIDR.toLocaleString()} | Sisa Rp ${remainingIDR.toLocaleString()})` : '🔴 BELUM BAYAR'}\n• Status Fisik: ${po.status === 'received' ? 'Diterima di Vault TTB' : 'Approved (Open)'}`
                            })}
                          >
                            <Printer size={13} /> Cetak PO
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-5">
          <div className="glass-panel w-full max-w-[650px] p-6 bg-[#0f172a] border border-gold">
            <div className="flex justify-between items-center mb-4 border-b border-line pb-3">
              <h3 className="font-heading text-[1.2rem] text-gold-light flex items-center gap-2">
                <History size={20} /> Log Riwayat Pembayaran BBK (Audit Trail)
              </h3>
              <button
                className="btn-primary py-1 px-2.5 text-xs bg-rose/20 border border-rose text-rose cursor-pointer"
                onClick={() => setSelectedPOHistory(null)}
              >
                ✕ Tutup
              </button>
            </div>

            <div className="bg-white/3 p-3.5 rounded-lg mb-4">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <span className="stat-lbl">Nomor PO</span>
                  <strong className="text-sky-light">{selectedPOHistory.poNumber}</strong>
                </div>
                <div>
                  <span className="stat-lbl">Supplier</span>
                  <strong>{selectedPOHistory.supplierName || selectedPOHistory.supplier}</strong>
                </div>
                <div>
                  <span className="stat-lbl">Total Tagihan PO</span>
                  <strong className="text-gold-light">
                    Rp {(selectedPOHistory.totalLandedCostIDR || (selectedPOHistory.totalAmountUSD * (selectedPOHistory.exchangeRate || 16250))).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            <h4 className="text-[0.9rem] text-sky-light mb-2.5">
              📋 Rincian Transaksi Voucher BBK yang Diterbitkan:
            </h4>

            {(!selectedPOHistory.paymentHistory || selectedPOHistory.paymentHistory.length === 0) ? (
              <div className="p-6 text-center text-fg-muted bg-[rgba(15,23,42,0.6)] rounded-lg">
                <AlertCircle size={28} className="text-rose mx-auto mb-2" />
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
                      <th className="text-right">Nominal Cicilan</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPOHistory.paymentHistory.map((pmt, i) => (
                      <tr key={i}>
                        <td><strong className="text-sky-light">{pmt.voucherNo}</strong></td>
                        <td>{pmt.date}</td>
                        <td><small>{pmt.bank || 'Bank BCA Devisa USD'}</small></td>
                        <td className="text-right font-extrabold text-emerald-light">
                          Rp {Number(pmt.amount || 0).toLocaleString()}
                        </td>
                        <td><span className="badge badge-emerald">✅ POSTED</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
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
