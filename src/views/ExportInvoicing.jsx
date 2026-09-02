import React, { useState, useEffect } from 'react';
import { FileText, Globe, DollarSign, Download, Plus, Search, Filter, Printer, CheckCircle2, ShieldCheck, ShoppingBag, MoreHorizontal } from 'lucide-react';
import {
  apiErrorMessage,
  partnerService,
  productService,
  salesInvoiceService,
  salesOrderService
} from '../services';
import { exportCommercialInvoicePdf } from '../services/pdfService';
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

export default function ExportInvoicing() {
  const { modalProps, showModal } = useModal();
  const [activeView, setActiveView] = useState('list'); // 'list' (Table Register) or 'create' (Form)
  const [invoices, setInvoices] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State with Auto-Selection Dropdowns
  const [form, setForm] = useState({
    invoiceNo: 'INV-EXP-2026-001',
    customerPONumber: 'PO-DMCC-2026-8899',
    date: new Date().toISOString().split('T')[0],
    selectedSOId: '',
    selectedCustomerId: '',
    buyerName: 'Dubai Gold & Jewelry Wholesalers DMCC',
    country: 'United Arab Emirates (UAE)',
    pebNumber: 'PEB-2026-088912',
    awbNumber: 'AWB-FEDEX-99881122',
    incoterms: 'FOB Jakarta Port',
    currency: 'USD',
    exchangeRate: 16250,
    selectedSKU: '',
    itemDescription: 'Fine Gold Jewelry 750 (18K) Dubai Casting Ring',
    karat: '750',
    hsCode: '7113.19.90',
    weightGrams: 1000,
    pricePerGramUSD: 85.00
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 1. Customers (buyer overseas) & Finished Goods (perhiasan)
      const custs = await partnerService.list({ role: 'customer', origin: 'OVERSEAS', limit: 100 });
      setCustomers((custs.items || []).map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        country: c.countryName
      })));

      const items = await productService.list();
      setFinishedGoods(items.filter(p => p.form === 'JEWELRY').map(p => ({
        id: p.id,
        sku: p.code,
        name: p.name,
        karat: p.defaultPurityPercent ? String(p.defaultPurityPercent) : '750',
        goldColor: 'Yellow Gold'
      })));

      // 2. Sales Orders ekspor (dari database)
      const orders = await salesOrderService.list({ type: 'EXPORT', limit: 100 });
      setSalesOrders((orders.items || []).map(so => ({
        id: so.id,
        soNumber: so.number,
        customerPONumber: so.customerPoNumber || '',
        buyerName: so.partnerName,
        country: so.partnerName,
        itemDescription: so.first_item?.product.name ?? '',
        weightGrams: so.first_item?.weight_gram ?? 0,
        pricePerGramUSD: so.first_item?.price_per_unit ?? 0,
        exchangeRate: so.exchangeRate
      })));

      // 3. Stored Export Invoices (dari database)
      const invoices = await salesInvoiceService.list({ type: 'EXPORT', limit: 100 });
      setInvoices((invoices.items || []).map(inv => ({
        id: inv.id,
        invoiceNo: inv.number,
        customerPONumber: '',
        date: inv.date,
        buyerName: inv.orderNumber,
        country: '',
        pebNumber: inv.pebNumber || '',
        awbNumber: inv.awbNumber || '',
        itemDescription: inv.items?.[0]?.productName ?? '',
        weightGrams: inv.items?.[0]?.weightGram ?? 0,
        pricePerGramUSD: inv.items?.[0]?.weightGram ? Math.round((inv.subtotalAmount / inv.items[0].weightGram) * 100) / 100 : 0,
        totalUSD: inv.totalAmount,
        totalIDR: Math.round(inv.totalAmount * (inv.exchangeRate ?? 16250)),
        paymentStatus: inv.paymentStatus,
        status: inv.statusLabel,
        exchangeRate: inv.exchangeRate
      })));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat data faktur ekspor.'));
    }
  };

  // Handler Pull From Sales Order (SO)
  const handleSOSelect = (soId) => {
    const foundSO = salesOrders.find(so => (so.id === soId || so.soNumber === soId));
    if (foundSO) {
      setForm({
        ...form,
        selectedSOId: soId,
        customerPONumber: foundSO.customerPONumber || form.customerPONumber || '',
        buyerName: foundSO.buyerName,
        country: foundSO.country,
        itemDescription: foundSO.itemDescription,
        weightGrams: foundSO.weightGrams,
        pricePerGramUSD: foundSO.pricePerGramUSD,
        exchangeRate: foundSO.exchangeRate || 16250
      });
      toast.success(`Data ditarik dari Sales Order ${foundSO.soNumber}`);
    }
  };

  // Calculations
  const totalUSD = (form.weightGrams || 0) * (form.pricePerGramUSD || 0);
  const totalIDR = totalUSD * (form.exchangeRate || 16250);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.invoiceNo || !form.buyerName || !form.weightGrams) {
      toast.warning('Mohon lengkapi No Invoice, Buyer, dan Berat Perhiasan Ekspor.');
      return;
    }

    try {
      // Cari SO acuan (jika faktur ditarik dari SO ekspor)
      const foundSO = salesOrders.find(so => so.id === form.selectedSOId || so.soNumber === form.selectedSOId);

      let orderId = foundSO?.id;
      let orderItemId = foundSO?.orderItemId;

      // Jika tidak ada SO acuan, buat SO ekspor singkat dulu lalu setujui
      if (!orderId) {
        const selectedCust = customers.find(c => c.id === form.selectedCustomerId || c.code === form.selectedCustomerId);
        const selectedSKU = finishedGoods.find(fg => fg.sku === form.selectedSKU || fg.id === form.selectedSKU);
        if (!selectedCust) {
          toast.warning('Pilih buyer overseas dari daftar master customer.');
          return;
        }
        if (!selectedSKU) {
          toast.warning('Pilih item perhiasan dari daftar master perhiasan.');
          return;
        }
        const so = await salesOrderService.create({
          type: 'EXPORT',
          payment_type: 'PO',
          partner_id: selectedCust.id,
          date: form.date,
          customer_po_number: form.customerPONumber || undefined,
          currency_code: 'USD',
          exchange_rate: Number(form.exchangeRate) || undefined,
          items: [{
            product_id: selectedSKU.id,
            weight_unit: 'GRAM',
            weight_gram: Number(form.weightGrams),
            purity_percent: Number(form.karat || 750),
            price_per_unit: Number(form.pricePerGramUSD)
          }],
          notes: form.itemDescription || undefined
        });
        await salesOrderService.confirm(so.id, 'EXPORT');
        orderId = so.id;
        orderItemId = so.items[0].id;
      }

      // Terbitkan Faktur Ekspor (draft) lalu posting — jurnal piutang ekspor (1132) vs pendapatan (4116)
      const invoice = await salesInvoiceService.create({
        type: 'EXPORT',
        order_id: orderId,
        date: form.date,
        currency_code: 'USD',
        exchange_rate: Number(form.exchangeRate) || undefined,
        subtotal_amount: totalUSD,
        dp_amount: 0,
        total_amount: totalUSD,
        tax_facility: 'PPN 0% (Pasal 4B UU PPN)',
        payment_mode: 'CREDIT',
        dhe_bca_account: '1111-USD',
        peb_number: form.pebNumber || undefined,
        awb_number: form.awbNumber || undefined,
        items: [{
          order_item_id: orderItemId,
          weight_gram: Number(form.weightGrams),
          amount: totalUSD
        }],
        notes: form.incoterms || undefined
      });
      await salesInvoiceService.post(invoice.id, 'EXPORT');

      // Muat ulang register dari database
      const invoices = await salesInvoiceService.list({ type: 'EXPORT', limit: 100 });
      setInvoices((invoices.items || []).map(inv => ({
        id: inv.id,
        invoiceNo: inv.number,
        customerPONumber: '',
        date: inv.date,
        buyerName: inv.orderNumber,
        country: '',
        pebNumber: inv.pebNumber || '',
        awbNumber: inv.awbNumber || '',
        itemDescription: inv.items?.[0]?.productName ?? '',
        weightGrams: inv.items?.[0]?.weightGram ?? 0,
        pricePerGramUSD: inv.items?.[0]?.weightGram ? Math.round((inv.subtotalAmount / inv.items[0].weightGram) * 100) / 100 : 0,
        totalUSD: inv.totalAmount,
        totalIDR: Math.round(inv.totalAmount * (inv.exchangeRate ?? 16250)),
        paymentStatus: inv.paymentStatus,
        status: inv.statusLabel,
        exchangeRate: inv.exchangeRate
      })));

      showModal({
        variant: 'success',
        title: `✅ Faktur Ekspor USD (${invoice.number}) Diterbitkan`,
        message: `• Buyer: ${form.buyerName}\n• Nilai Ekspor: $ ${totalUSD.toLocaleString()} USD (Rp ${totalIDR.toLocaleString()})\n• Jurnal Piutang Ekspor diposting ke Akun 1132 vs Pendapatan Ekspor (Akun 4116).\n• Status Pembayaran: 🔴 UNPAID (Siap dilunasi saat DHE masuk di BBM Kasir).`
      });
      setActiveView('list');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menerbitkan faktur ekspor.'));
    }
  };

  const filteredInvoices = invoices.filter(inv =>
    inv.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.customerPONumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.buyerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.pebNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Top Bar Header & Action Controls */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <FileText color="#34d399" size={24} /> Modul Penjualan Ekspor USD (Faktur Ekspor PPN 0% & PEB)
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Penerbitan Faktur Ekspor Ditarik Otomatis Dari Export Sales Order (SO) & Fixing Harga USD
            </p>
          </div>

          <div className="flex gap-3">
            <button
              className={`btn-primary ${
                activeView === 'list'
                  ? 'bg-linear-135 from-emerald to-emerald-dark'
                  : 'bg-none bg-[rgba(15,23,42,0.6)]'
              }`}
              onClick={() => setActiveView('list')}
            >
              <FileText size={18} /> Register Faktur Ekspor
            </button>
            <button
              className={`btn-primary ${
                activeView === 'create'
                  ? 'bg-linear-135 from-gold to-gold-dark'
                  : 'bg-none bg-[rgba(15,23,42,0.6)]'
              }`}
              onClick={() => setActiveView('create')}
            >
              <Plus size={18} /> Buat Faktur Ekspor Dari SO
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: TABLE REGISTER FAKTUR EKSPOR */}
      {activeView === 'list' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
            <h3 className="font-heading text-[1.1rem]">
              📋 Daftar Faktur Ekspor Diterbitkan ({filteredInvoices.length})
            </h3>

            <div className="relative w-75">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={18} />
              <input
                className="form-input pl-9.5 w-full"
                placeholder="Cari Invoice, PO Cust, Buyer, atau PEB..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Invoice</TableHead>
                <TableHead>Ref No. SO</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Buyer Ekspor</TableHead>
                <TableHead>Dokumen PEB</TableHead>
                <TableHead className="text-right">Berat Gram</TableHead>
                <TableHead className="text-right">Total Nilai USD</TableHead>
                <TableHead className="text-right">Equivalent IDR</TableHead>
                <TableHead>Status PPN 0%</TableHead>
                <TableHead className="w-16 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableEmpty colSpan={10} message="Belum ada faktur ekspor." />
              ) : (
                filteredInvoices.map(inv => (
                  <TableRow key={inv.id || inv.invoiceNo}>
                    <TableCell>
                      <strong>{inv.invoiceNo}</strong>
                      {inv.customerPONumber && (
                        <small className="text-fg-muted block text-xs">PO Cust: {inv.customerPONumber}</small>
                      )}
                    </TableCell>
                    <TableCell><small className="text-gold-light">{inv.soNumber || 'SO-EXP-2026-001'}</small></TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell><strong>{inv.buyerName}</strong></TableCell>
                    <TableCell><small className="text-sky-light">{inv.pebNumber}</small></TableCell>
                    <TableCell className="text-right font-bold">{inv.weightGrams} g</TableCell>
                    <TableCell className="text-right font-extrabold text-sky-light">$ {(inv.totalUSD || 0).toLocaleString()} USD</TableCell>
                    <TableCell className="text-right font-bold text-emerald-light">Rp {(inv.totalIDR || 0).toLocaleString()}</TableCell>
                    <TableCell><span className="badge badge-emerald"><ShieldCheck className="inline mr-1" size={12} />{inv.status || 'PPN 0% APPROVED'}</span></TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 p-0 text-fg-soft hover:text-fg hover:bg-surface-raised cursor-pointer mx-auto"
                            aria-label={`Aksi untuk ${inv.invoiceNo}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 z-[1100]">
                          <DropdownMenuItem
                            onClick={async () => {
                              await exportCommercialInvoicePdf(inv);
                              toast.success(`Dokumen Commercial Export Invoice (${inv.invoiceNo}) siap dicetak.`);
                            }}
                            className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                          >
                            <Printer className="h-4 w-4" />
                            <span>Cetak Commercial Invoice</span>
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

      {/* VIEW 2: FORM CREATE FAKTUR EKSPOR (PULL FROM SO) */}
      {activeView === 'create' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-4 text-gold-light">
            ✍️ Form Pembuatan Faktur Ekspor (Penarikan Otomatis Dari Export Sales Order)
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              {/* PULL FROM SALES ORDER (SO) DROPDOWN */}
              <div className="form-group col-span-2 bg-[rgba(245,158,11,0.1)] p-3 rounded-sm border border-gold">
                <label className="form-label text-gold-light font-bold flex items-center gap-2">
                  <ShoppingBag size={18} /> Tarik Otomatis Dari Export Sales Order (SO) & Price Fixing:
                </label>
                <Combobox className="bg-ink text-white font-semibold"
                  value={form.selectedSOId}
                  onChange={handleSOSelect}
                  placeholder="-- (Pilih No. Sales Order SO Ekspor Untuk Tarik Harga & Spesifikasi) --"
                  searchPlaceholder="Cari nomor SO, buyer, atau barang…"
                  emptyText="Sales Order ekspor tidak ditemukan."
                  options={salesOrders.map(so => ({
                    value: so.soNumber,
                    label: `[${so.soNumber}] ${so.buyerName} - ${so.itemDescription} (${so.weightGrams}g @ $${so.pricePerGramUSD}/g = $${so.totalUSD.toLocaleString()} USD)`
                  }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. Commercial Invoice Ekspor</label>
                <input
                  className="form-input"
                  value={form.invoiceNo}
                  onChange={e => setForm({ ...form, invoiceNo: e.target.value })}
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
                <label className="form-label">Tanggal Transaksi</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Buyer Overseas (Dari SO)</label>
                <input
                  className="form-input"
                  value={form.buyerName}
                  onChange={e => setForm({ ...form, buyerName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Negara Tujuan Ekspor</label>
                <input
                  className="form-input"
                  value={form.country}
                  onChange={e => setForm({ ...form, country: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. PEB (Pemberitahuan Ekspor Barang)</label>
                <input
                  className="form-input"
                  value={form.pebNumber}
                  onChange={e => setForm({ ...form, pebNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">No. Airway Bill (AWB / Courier)</label>
                <input
                  className="form-input"
                  value={form.awbNumber}
                  onChange={e => setForm({ ...form, awbNumber: e.target.value })}
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">Rincian Deskripsi Barang Ekspor (Dari SO)</label>
                <input
                  className="form-input"
                  value={form.itemDescription}
                  onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">HS Code Ekspor PPN 0%</label>
                <input
                  className="form-input"
                  value={form.hsCode}
                  onChange={e => setForm({ ...form, hsCode: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Berat Perhiasan Ekspor (Net Weight Gram)</label>
                <NumberInput
                  allowDecimal
                  value={form.weightGrams}
                  onChange={weightGrams => setForm({ ...form, weightGrams })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Harga USD / Gram (Terunci Dari SO)</label>
                <NumberInput
                  allowDecimal
                  className="border border-gold text-gold-light font-bold"
                  value={form.pricePerGramUSD}
                  onChange={pricePerGramUSD => setForm({ ...form, pricePerGramUSD })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kurs BCA e-Rate USD/IDR</label>
                <NumberInput
                  allowDecimal
                  value={form.exchangeRate}
                  onChange={exchangeRate => setForm({ ...form, exchangeRate })}
                />
              </div>
            </div>

            {/* Calculations Card */}
            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] my-5 mx-0 border border-[rgba(52,211,153,0.3)]">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                <div>
                  <span className="stat-lbl">Total Nilai Penjualan Ekspor (USD)</span>
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
                  <span className="stat-lbl">Fasilitas Perpajakan</span>
                  <div className="font-extrabold text-gold-light text-[1.1rem]">
                    PPN 0% (Pasal 4B UU PPN Ekspor)
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary bg-[linear-gradient(135deg,_#10b981,_#059669)]">
              <CheckCircle2 size={18} /> Terbitkan Commercial Invoice & Posting Auto-Jurnal PPN 0%
            </button>
          </form>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
