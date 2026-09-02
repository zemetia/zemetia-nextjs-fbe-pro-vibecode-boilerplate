import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Search, Filter, Printer, CheckCircle2, ShieldCheck, ArrowRight, DollarSign, MoreHorizontal } from 'lucide-react';
import {
  apiErrorMessage,
  partnerService,
  productService,
  salesOrderService
} from '../services';
import { exportSalesOrderPdf } from '../services/pdfService';
import {
  Modal,
  useModal,
  toast,
  Combobox,
  NumberInput,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
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

  const loadInitialData = async () => {
    try {
      // 1. Customers (buyer overseas)
      const custs = await partnerService.list({ role: 'customer', origin: 'OVERSEAS', limit: 100 });
      setCustomers((custs.items || []).map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        country: c.countryName,
        countryIso2: c.countryIso2
      })));
      if (custs.items.length > 0 && !form.selectedCustomerId) {
        setForm(prev => ({
          ...prev,
          selectedCustomerId: custs.items[0].id,
          buyerName: custs.items[0].name,
          country: custs.items[0].countryName || 'Overseas Buyer'
        }));
      }

      // 2. Finished Goods = produk perhiasan (form JEWELRY) dari database
      const items = await productService.list();
      const fgs = items.filter(p => p.form === 'JEWELRY').map(p => ({
        id: p.id,
        sku: p.code,
        name: p.name,
        type: 'Perhiasan',
        karat: p.defaultPurityPercent ? String(p.defaultPurityPercent) : '750',
        purity: p.defaultPurityPercent ?? 75.0,
        goldColor: 'Yellow Gold',
        stdWeightGram: 0,
        laborFeeIDRPerGram: 0,
        hsCode: '7113.19.90',
        inventoryAccount: '1160'
      }));
      setFinishedGoods(fgs);

      // 3. Stored Sales Orders (dari database)
      const orders = await salesOrderService.list({ type: 'EXPORT', limit: 100 });
      setSalesOrders((orders.items || []).map(so => ({
        id: so.id,
        soNumber: so.number,
        customerPONumber: so.customerPoNumber || '',
        date: so.date,
        buyerName: so.partnerName,
        country: so.partnerName,
        weightGrams: so.first_item?.weight_gram ?? 0,
        pricePerGramUSD: so.first_item?.price_per_unit ?? 0,
        totalUSD: so.goodsAmount,
        totalIDR: Math.round(so.goodsAmount * (so.exchangeRate ?? 16250)),
        status: so.statusLabel,
        invoiced: so.status === 'CONFIRMED',
        createdAt: so.createdAt
      })));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat data sales order ekspor.'));
    }
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
      toast.warning('Mohon lengkapi No SO, Buyer, Berat Gram, dan Harga USD/Gram Fixing.');
      return;
    }

    const selectedCust = customers.find(c => c.id === form.selectedCustomerId || c.code === form.selectedCustomerId);
    if (!selectedCust) {
      toast.warning('Pilih buyer overseas dari daftar master customer.');
      return;
    }

    try {
      const so = await salesOrderService.create({
        type: 'EXPORT',
        payment_type: 'PO',
        partner_id: selectedCust.id,
        date: form.date,
        customer_po_number: form.customerPONumber || undefined,
        currency_code: 'USD',
        exchange_rate: Number(form.exchangeRate) || undefined,
        items: [{
          product_id: form.selectedSKU || finishedGoods[0]?.id,
          weight_unit: 'GRAM',
          weight_gram: Number(form.weightGrams),
          purity_percent: Number(form.karat || 750),
          price_per_unit: Number(form.pricePerGramUSD)
        }],
        notes: form.itemDescription || undefined
      });
      await salesOrderService.confirm(so.id, 'EXPORT');

      // Muat ulang register dari database
      const orders = await salesOrderService.list({ type: 'EXPORT', limit: 100 });
      setSalesOrders((orders.items || []).map(item => ({
        id: item.id,
        soNumber: item.number,
        customerPONumber: item.customerPoNumber || '',
        date: item.date,
        buyerName: item.partnerName,
        country: item.partnerName,
        weightGrams: item.first_item?.weight_gram ?? 0,
        pricePerGramUSD: item.first_item?.price_per_unit ?? 0,
        totalUSD: item.goodsAmount,
        totalIDR: Math.round(item.goodsAmount * (item.exchangeRate ?? 16250)),
        status: item.statusLabel,
        invoiced: item.status === 'CONFIRMED',
        createdAt: item.createdAt
      })));

      toast.success(`Export Sales Order (${so.number}) berhasil disimpan & harga terkunci.`);
      loadInitialData();
      setActiveView('list');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menyimpan sales order ekspor.'));
    }
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
                <TableHead className="w-16 text-center">Aksi</TableHead>
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
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 p-0 text-fg-soft hover:text-fg hover:bg-surface-raised cursor-pointer mx-auto"
                            aria-label={`Aksi untuk ${so.soNumber}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 z-[1100]">
                          <DropdownMenuItem
                            onClick={async () => {
                              await exportSalesOrderPdf(so);
                              toast.success(`Dokumen Export Sales Order (${so.soNumber}) siap dicetak.`);
                            }}
                            className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                          >
                            <Printer className="h-4 w-4" />
                            <span>Cetak Export Sales Order</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
