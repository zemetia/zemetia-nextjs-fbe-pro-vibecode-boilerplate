import React, { useState, useEffect } from 'react';
import { PlaneTakeoff, Plus, CheckCircle, Calculator, RefreshCw, Building2, CreditCard, DollarSign, ShieldCheck, Truck, Scale, Tag, Printer, Sparkles, FileText } from 'lucide-react';
import { createPurchaseOrder, getPurchaseOrders } from '../services/storageService';
import { fetchBcaERateUSD, getStoredUsdRate } from '../services/currencyService';
import Modal, { useModal } from '../components/ui/Modal';
import Combobox from '../components/ui/Combobox';
import NumberInput from '../components/ui/NumberInput';

export default function LmImportTrading() {
  const { modalProps, showModal } = useModal();
  const [orders, setOrders] = useState([]);
  const [loadingRate, setLoadingRate] = useState(false);
  const [unitMode, setUnitMode] = useState('oz'); // 'oz' (Troy Ounce) or 'gram' (Gram)

  const [formData, setFormData] = useState({
    supplierName: 'YLG Bullion Singapore Pte Ltd',
    orderDate: new Date().toISOString().split('T')[0],
    currency: 'USD',
    paymentTerms: '100% Telegraphic Transfer (TT) Advance',
    exchangeRate: getStoredUsdRate(),
    
    // Field Model Pembelian Bullion Impor
    quantityUnits: 16000, // 16,000 oz
    baseAmountUSD: 1300000, // $1,300,000 (Harga Kesepakatan Base Metal USD)
    
    importDutyIDR: 0, // Bea Masuk (sering 0% untuk raw bullion LBMA)
    pph22ImportIDR: 0, // PPh 22 Impor
    freightAndHandlingLocalIDR: 0, // Biaya handling lokal tambahan jika ada
    barSerials: 'YLG-SG-998811 s/d YLG-SG-998850 (Brinks Vault Sealed)',
    logisticsPartner: 'BRINKS Global Services'
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

  // Kalkulasi Pembelian Emas USD
  const totalGoldAmountUSD = Number(formData.baseAmountUSD || 0);
  const effectivePricePerGramUSD = totalWeightGrams > 0 ? (totalGoldAmountUSD / totalWeightGrams) : 0;
  const effectivePricePerOzUSD = totalWeightOz > 0 ? (totalGoldAmountUSD / totalWeightOz) : 0;

  // Konversi ke IDR & Landed Cost
  const totalGoldAmountIDR = totalGoldAmountUSD * formData.exchangeRate;
  const totalLandedCostIDR = totalGoldAmountIDR + Number(formData.importDutyIDR || 0) + Number(formData.freightAndHandlingLocalIDR || 0);
  const unitLandedCostIDRPerGram = totalWeightGrams > 0 ? (totalLandedCostIDR / totalWeightGrams) : 0;

  // Langsung Submit & Terbitkan PO Resmi (Tanpa Draft Berbelit-belit)
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
      totalAmountUSD: totalGoldAmountUSD,
      
      importDuty: Number(formData.importDutyIDR),
      pph22Import: Number(formData.pph22ImportIDR),
      freightAndInsurance: Number(formData.freightAndHandlingLocalIDR),
      totalLandedCostIDR: totalLandedCostIDR,
      unitLandedCostIDRPerGram: Math.round(unitLandedCostIDRPerGram),
      
      barSerialNumbers: formData.barSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
      logisticsCarrier: formData.logisticsPartner || 'BRINKS Global Services',
      notes: `Impor Emas ${formData.supplierName}: Nilai FOB $${Number(formData.baseAmountUSD).toLocaleString()} | Kargo: ${formData.logisticsPartner || 'BRINKS Global Services'}`,
      
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
        title: `🎉 Purchase Order ${res.order?.poNumber || 'PO-IMP'} Diterbitkan`,
        message: `• Supplier: ${formData.supplierName}\n• Total Nilai Beli (USD): $ ${totalGoldAmountUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n• Total Landed Cost: Rp ${totalLandedCostIDR.toLocaleString()}\n• HPP Bersih / Gram: Rp ${Math.round(unitLandedCostIDRPerGram).toLocaleString()} / g\n• Syarat Pembayaran: ${formData.paymentTerms} (${formData.currency})\n• Status Pembayaran: Menunggu BBK Kasir di Voucher Management\n• Status Barang: APPROVED & SIAP PENERIMAAN TTB VAULT (Dokumen PIB/SPPB/MAWB dicatat saat TTB)`
      });
      loadOrders();
    } else {
      showModal({ variant: 'error', title: '❌ Gagal Menyimpan PO', message: JSON.stringify(res.errors, null, 2) });
    }
  };

  return (
    <div>
      {/* Form Container */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <PlaneTakeoff color="#f59e0b" size={24} /> Penerbitan Purchase Order LM Import (YLG All-In Model)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Input Langsung Jadi & Terbit Otomatis (Purchase Order Bullion Impor)
            </p>
          </div>

          {/* Unit Selector */}
          <div className="flex gap-2 bg-[rgba(15,23,42,0.8)] p-1.5 rounded-[10px] border border-line">
            <button
              className={`btn-primary text-[0.85rem] ${
                unitMode === 'oz'
                  ? 'bg-linear-135 from-gold to-gold-dark text-white'
                  : 'bg-none bg-transparent text-fg-soft'
              }`}
              onClick={() => setUnitMode('oz')}
            >
              <Scale size={16} /> Satuan Troy Ounce (oz)
            </button>
            <button
              className={`btn-primary text-[0.85rem] ${
                unitMode === 'gram'
                  ? 'bg-linear-135 from-emerald to-emerald-dark text-white'
                  : 'bg-none bg-transparent text-fg-soft'
              }`}
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
              <Combobox className="font-bold text-gold-light"
                value={formData.supplierName}
                onChange={supplierName => setFormData({ ...formData, supplierName })}
                searchPlaceholder="Cari refiner atau bullion dealer…"
                emptyText="Supplier impor tidak ditemukan."
                options={[
                  { value: 'YLG Bullion Singapore Pte Ltd', label: 'YLG Bullion Singapore Pte Ltd (Singapore)' },
                  { value: 'Valcambi SA Switzerland', label: 'Valcambi SA Switzerland (LBMA Refiner)' },
                  { value: 'PAMP SA Switzerland', label: 'PAMP SA Switzerland' },
                  { value: 'Metalor Technologies Singapore', label: 'Metalor Technologies Singapore' },
                  { value: 'Singapore Precious Metals Exchange (SGPMX)', label: 'SGPMX Singapore' },
                  { value: 'Dubai Gold & Commodities Bullion', label: 'Dubai Gold & Commodities Bullion' }
                ]}
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

            {/* TERMIN & KETENTUAN PEMBAYARAN */}
            <div className="form-group">
              <label className="form-label text-sky-light font-bold">Termin & Ketentuan Pembayaran</label>
              <select
                className="form-select border border-sky-light text-sky-light font-bold"
                value={formData.paymentTerms}
                onChange={e => setFormData({ ...formData, paymentTerms: e.target.value })}
              >
                <option value="100% Telegraphic Transfer (TT) Advance">100% Telegraphic Transfer (TT) Advance</option>
                <option value="TT Advance 30% Deposit + 70% Sebelum Kirim">TT Advance 30% Deposit + 70% Sebelum Kirim</option>
                <option value="Letter of Credit (L/C at Sight)">Letter of Credit (L/C at Sight)</option>
                <option value="Cash Against Documents (CAD)">Cash Against Documents (CAD)</option>
                <option value="Net 14 Hari (Open Account)">Net 14 Hari (Open Account)</option>
                <option value="Net 30 Hari (Open Account)">Net 30 Hari (Open Account)</option>
              </select>
              <small className="text-fg-muted mt-1 block">
                Mata Uang: <strong>{formData.currency}</strong> (Akun bank pembayar ditentukan oleh Kasir di BBK)
              </small>
            </div>

            <div className="form-group">
              <div className="flex justify-between items-center">
                <label className="form-label">Kurs USD ke IDR</label>
                <button
                  type="button"
                  onClick={syncLiveRate}
                  className="flex cursor-pointer items-center gap-1 border-0 bg-none text-xs text-gold-light"
                >
                  <RefreshCw size={12} className={loadingRate ? 'animate-spin' : ''} /> Sync BCA e-Rate
                </button>
              </div>
              <NumberInput
                allowDecimal
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
                allowDecimal
                className="border border-gold text-gold-light font-bold"
                value={formData.quantityUnits}
                onChange={quantityUnits => setFormData({ ...formData, quantityUnits })}
              />
              <small className="text-fg-muted mt-1 block">
                Ekivalen: <strong>{totalWeightGrams.toLocaleString(undefined, { maximumFractionDigits: 2 })} Gram</strong> ({totalWeightOz.toLocaleString(undefined, { maximumFractionDigits: 2 })} oz)
              </small>
            </div>

            {/* HARGA TOTAL FOB KESEPAKATAN */}
            <div className="form-group">
              <label className="form-label text-sky-light font-bold">
                Harga Total Kesepakatan Logam Mulia (USD)
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
                <div className="font-extrabold text-gold-light text-[1.2rem]">$ {totalGoldAmountUSD.toLocaleString()}</div>
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
            className="btn-primary w-full justify-center p-3.5 text-base font-extrabold bg-[linear-gradient(135deg,_#10b981,_#059669)] border-0 shadow-[0_4px_15px_rgba(16,185,129,0.3)]"
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
                <th>Syarat Pembayaran</th>
                <th>Volume Pesanan</th>
                <th>Total Beli (USD)</th>
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
                  <td className="text-center text-fg-muted p-7.5" colSpan="11">
                    Belum ada data PO LM Import.
                  </td>
                </tr>
              ) : (
                orders.map(po => {
                  const poTotalUSD = Number(po.totalAmountUSD || (po.currency === 'USD' ? (po.total || po.subtotal) : 0) || po.baseAmountUSD || (po.items && po.items[0]?.unitPrice * (po.weightGrams || po.items[0]?.quantity)) || 0);
                  const poRate = Number(po.exchangeRate || 16250);
                  const poLandedCostIDR = Number(po.totalLandedCostIDR || (poTotalUSD > 0 ? (poTotalUSD * poRate) : (po.total || 0)));
                  const poWeight = Number(po.weightGrams || po.quantityUnits || (po.items && po.items[0]?.quantity) || 1000);
                  const poHppPerGram = Number(po.unitLandedCostIDRPerGram || (poWeight > 0 ? Math.round(poLandedCostIDR / poWeight) : 0));

                  return (
                    <tr key={po.id || po.poNumber}>
                      <td><strong className="text-sky-light">{po.poNumber}</strong></td>
                      <td><strong>{po.supplierName || po.supplier}</strong></td>
                      <td>{po.orderDate}</td>
                      <td><span className="text-xs text-fg-soft font-semibold">{po.paymentTerms || '100% TT Advance'}</span></td>
                      <td>
                        <span className="badge badge-gold text-xs">
                          {po.quantityUnits ? `${po.quantityUnits.toLocaleString()} ${po.unitMode || 'oz'}` : `${poWeight} g`}
                        </span>
                      </td>
                      <td className="font-extrabold text-gold-light">
                        $ {poTotalUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td>Rp {poRate.toLocaleString()}</td>
                      <td className="font-bold text-emerald-light">
                        Rp {poLandedCostIDR.toLocaleString()}
                      </td>
                      <td className="font-extrabold text-sky-light">
                        Rp {poHppPerGram.toLocaleString()}/g
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
                          className="btn-primary py-1.5 px-3 text-xs"
                          onClick={() => showModal({
                            variant: 'info',
                            title: `🖨️ Cetak PDF PO Impor ${po.poNumber}`,
                            message: `Dokumen PO Impor Resmi\n• Supplier: ${po.supplierName || po.supplier}\n• Valuta: ${po.currency || 'USD'}\n• Termin Pembayaran: ${po.paymentTerms || '100% Telegraphic Transfer (TT) Advance'}\n• Total Nilai (USD): $ ${poTotalUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n• Landed Cost: Rp ${poLandedCostIDR.toLocaleString()}\n• Status: ${po.status === 'received' ? 'BARANG DITERIMA DI VAULT' : 'APPROVED (RESMI)'}`
                          })}
                        >
                          <Printer size={13} /> Cetak PO
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal {...modalProps} />
    </div>
  );
}
