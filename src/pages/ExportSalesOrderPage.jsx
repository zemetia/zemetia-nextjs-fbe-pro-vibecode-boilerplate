import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, Filter, Printer, CheckCircle2, ShieldCheck, ArrowRight, DollarSign } from 'lucide-react';
import {
  getCustomers,
  getFinishedGoods,
  getExportSalesOrders,
  saveExportSalesOrders
} from '../services/storageService';
import { getStoredUsdRate } from '../services/currencyService';
import {
  Modal,
  useModal,
  Combobox,
  NumberInput,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from '../components/ui';

export default function ExportSalesOrderPage() {
  const { modalProps, showModal } = useModal();
  const [activeView, setActiveView] = useState('list'); // 'list' or 'create'
  const [salesOrders, setSalesOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    soNumber: 'SO-EXP-2026-001',
    customerPONumber: 'PO-DMCC-2026-8899',
    date: new Date().toISOString().split('T')[0],
    selectedCustomerId: '',
    buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
    country: 'United Arab Emirates (UAE)',
    paymentTerms: 'NET 30 (LC at Sight)',
    incoterms: 'FOB Jakarta Port',
    currency: 'USD',
    exchangeRate: 16250,
    selectedSKU: '',
    itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
    karat: '750',
    weightGrams: 1000,
    pricePerGramUSD: 85.00, // Fixed Gold Price USD/Gram
    deliveryTargetDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    // 1. Customers
    const custs = getCustomers();
    setCustomers(custs);
    if (custs.length > 0 && !form.selectedCustomerId) {
      setForm(prev => ({
        ...prev,
        selectedCustomerId: custs[0].id || custs[0].code,
        buyerName: custs[0].name,
        country: custs[0].country || 'United Arab Emirates'
      }));
    }

    // 2. Finished Goods
    const fgs = getFinishedGoods();
    setFinishedGoods(fgs);

    // 3. Stored Sales Orders
    setSalesOrders(getExportSalesOrders());
  };

  const handleCustomerSelect = (custId) => {
    const found = customers.find(c => (c.id === custId || c.code === custId));
    if (found) {
      setForm({
        ...form,
        selectedCustomerId: custId,
        buyerName: found.name,
        country: found.country || 'Overseas Buyer'
      });
    }
  };

  const handleSKUSelect = (skuCode) => {
    const found = finishedGoods.find(fg => (fg.sku === skuCode || fg.id === skuCode));
    if (found) {
      setForm({
        ...form,
        selectedSKU: skuCode,
        itemDescription: `${found.name} (${found.type} Karat ${found.karat} ${found.goldColor})`,
        karat: found.karat
      });
    }
  };

  const totalUSD = (form.weightGrams || 0) * (form.pricePerGramUSD || 0);
  const totalIDR = totalUSD * (form.exchangeRate || 16250);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.soNumber || !form.buyerName || !form.weightGrams || !form.pricePerGramUSD) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Mohon lengkapi No SO, Buyer, Berat Gram, dan Harga USD/Gram Fixing.' });
      return;
    }

    const newSO = {
      id: form.soNumber,
      ...form,
      totalUSD,
      totalIDR,
      status: 'FIXED / IN PRODUCTION',
      invoiced: false,
      createdAt: new Date().toISOString()
    };

    const list = getExportSalesOrders();
    list.unshift(newSO);
    await saveExportSalesOrders(list);

    showModal({
      variant: 'success',
      title: `✅ Export Sales Order (${newSO.soNumber}) Tersimpan`,
      message: `• Buyer: ${newSO.buyerName}\n• Harga dikunci (fixed price): $ ${form.pricePerGramUSD}/g\n• Berat: ${newSO.weightGrams}g`
    });
    loadInitialData();
    setActiveView('list');
  };

  const filteredOrders = salesOrders.filter(so =>
    so.soNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    so.customerPONumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    so.buyerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <ShoppingBag color="#f59e0b" size={24} /> Export Sales Order (SO Ekspor & Gold Price Fixing)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Modul Input Kontrak Pesanan Ekspor & Penguncian Harga Emas USD/Gram (Price Fixing Basis Faktur Ekspor)
            </p>
          </div>

          <div className="flex gap-3">
            <button
              className={`btn-primary ${
                activeView === 'list'
                  ? 'bg-linear-135 from-gold to-gold-dark'
                  : 'bg-none bg-[rgba(15,23,42,0.6)]'
              }`}
              onClick={() => setActiveView('list')}
            >
              <ShoppingBag size={18} /> Register Sales Order (SO)
            </button>
            <button
              className={`btn-primary ${
                activeView === 'create'
                  ? 'bg-linear-135 from-emerald to-emerald-dark'
                  : 'bg-none bg-[rgba(15,23,42,0.6)]'
              }`}
              onClick={() => setActiveView('create')}
            >
              <Plus size={18} /> Buat Sales Order (SO) Baru
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: REGISTER TABLE SO EKSPOR */}
      {activeView === 'list' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
            <h3 className="font-heading text-[1.1rem]">
              📋 Daftar Sales Order Ekspor Aktif ({filteredOrders.length})
            </h3>

            <div className="relative w-75">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
              <input
                className="form-input pl-9.5 w-full"
                placeholder="Cari No. SO, PO Customer, atau Nama Buyer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. SO Ekspor</TableHead>
                <TableHead>Tanggal Fixing</TableHead>
                <TableHead>Buyer Overseas</TableHead>
                <TableHead>Negara</TableHead>
                <TableHead className="text-right">Berat Gram</TableHead>
                <TableHead className="text-right">Harga Fixing USD/g</TableHead>
                <TableHead className="text-right">Total Contract USD</TableHead>
                <TableHead>Status Pesanan</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableEmpty colSpan={9} message="Belum ada Sales Order Ekspor dibuat" />
              ) : (
                filteredOrders.map(so => (
                  <TableRow key={so.id || so.soNumber}>
                    <TableCell>
                      <strong>{so.soNumber}</strong>
                      {so.customerPONumber && (
                        <small className="text-fg-muted block text-xs">PO Cust: {so.customerPONumber}</small>
                      )}
                    </TableCell>
                    <TableCell>{so.date}</TableCell>
                    <TableCell><strong>{so.buyerName}</strong></TableCell>
                    <TableCell>{so.country}</TableCell>
                    <TableCell className="text-right font-bold">{so.weightGrams} g</TableCell>
                    <TableCell className="text-right text-gold-light font-bold">$ {so.pricePerGramUSD} / g</TableCell>
                    <TableCell className="text-right font-extrabold text-sky-light">$ {(so.totalUSD || 0).toLocaleString()} USD</TableCell>
                    <TableCell><span className="badge badge-gold">{so.status || 'FIXED / IN PRODUCTION'}</span></TableCell>
                    <TableCell>
                      <button
                        className="btn-primary py-1.5 px-2.5 text-xs"
                        onClick={() => showModal({
                          variant: 'info',
                          title: `🖨️ Cetak Export Sales Order ${so.soNumber}`,
                          message: `• Buyer: ${so.buyerName}\n• No. PO Customer: ${so.customerPONumber || '-'}\n• Berat: ${so.weightGrams}g\n• Total Nilai: $ ${(so.totalUSD || 0).toLocaleString()} USD`
                        })}
                      >
                        <Printer size={14} /> Cetak SO
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* VIEW 2: FORM CREATE SALES ORDER */}
      {activeView === 'create' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-4 text-gold-light">
            ✍️ Form Input Export Sales Order (SO) & Fixing Harga USD
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Pilih Buyer Overseas (Dari Master Customer)</label>
                <Combobox
                  value={form.selectedCustomerId}
                  onChange={handleCustomerSelect}
                  placeholder="-- (Pilih Buyer Overseas) --"
                  searchPlaceholder="Cari nama buyer atau negara…"
                  emptyText="Buyer tidak ditemukan di master customer."
                  options={customers.map(c => ({
                    value: c.id || c.code,
                    label: `${c.name} (${c.country || 'Overseas'})`
                  }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. Export Sales Order (SO)</label>
                <input
                  className="form-input"
                  value={form.soNumber}
                  onChange={e => setForm({ ...form, soNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. PO Customer (Buyer PO)</label>
                <input
                  className="form-input font-semibold text-gold-light"
                  placeholder="Contoh: PO-DMCC-2026-8899"
                  value={form.customerPONumber}
                  onChange={e => setForm({ ...form, customerPONumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Fixing Kontrak SO</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Syarat Pembayaran (Payment Terms)</label>
                <input
                  className="form-input"
                  value={form.paymentTerms}
                  onChange={e => setForm({ ...form, paymentTerms: e.target.value })}
                />
              </div>

              {/* Auto Select Item / Finished Goods */}
              <div className="form-group col-span-2">
                <label className="form-label">Pilih Perhiasan Pesanan (Master Finished Goods)</label>
                <Combobox
                  value={form.selectedSKU}
                  onChange={handleSKUSelect}
                  placeholder="-- (Pilih Item Perhiasan) --"
                  searchPlaceholder="Cari SKU, nama, atau karat…"
                  emptyText="Item perhiasan tidak ditemukan."
                  options={finishedGoods.map(fg => ({
                    value: fg.sku,
                    label: `[${fg.sku}] ${fg.name} - Karat ${fg.karat} (${fg.goldColor})`
                  }))}
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">Rincian Spesifikasi Perhiasan Pesanan</label>
                <input
                  className="form-input"
                  value={form.itemDescription}
                  onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Pesanan (Gross Weight Gram)</label>
                <NumberInput
                  allowDecimal
                  value={form.weightGrams}
                  onChange={weightGrams => setForm({ ...form, weightGrams })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">HARGA FIXING KONTRAK (USD / Gram)</label>
                <NumberInput
                  allowDecimal
                  className="border border-gold text-gold-light font-bold"
                  value={form.pricePerGramUSD}
                  onChange={pricePerGramUSD => setForm({ ...form, pricePerGramUSD })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kurs BCA e-Rate USD/IDR (Acuan Kontrak)</label>
                <NumberInput
                  allowDecimal
                  value={form.exchangeRate}
                  onChange={exchangeRate => setForm({ ...form, exchangeRate })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Tanggal Pengiriman (Delivery Target)</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.deliveryTargetDate}
                  onChange={e => setForm({ ...form, deliveryTargetDate: e.target.value })}
                />
              </div>
            </div>

            {/* Calculations Summary Card */}
            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] my-5 mx-0 border border-[rgba(245,158,11,0.4)]">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                <div>
                  <span className="stat-lbl">Total Nilai Kontrak SO (USD)</span>
                  <div className="font-extrabold text-sky-light text-[1.4rem]">
                    $ {totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                  </div>
                </div>
                <div>
                  <span className="stat-lbl">Nilai Kesetaraan Rupiah (IDR)</span>
                  <div className="font-extrabold text-emerald-light text-[1.3rem]">
                    Rp {totalIDR.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="stat-lbl">Status Penguncian Harga</span>
                  <div className="font-extrabold text-gold-light text-[1.1rem]">
                    GOLD PRICE FIXED
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary bg-[linear-gradient(135deg,_#f59e0b,_#d97706)]">
              <CheckCircle2 size={18} /> Simpan Export Sales Order & Kunci Harga USD
            </button>
          </form>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
