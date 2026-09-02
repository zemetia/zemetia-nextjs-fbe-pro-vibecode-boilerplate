import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Package,
  DollarSign,
  Receipt,
  CreditCard,
  Building2,
  Coins,
  History,
  AlertCircle,
  X,
  TrendingUp,
  MoreHorizontal
} from 'lucide-react';
import {
  apiErrorMessage,
  partnerService,
  productService,
  salesInvoiceService,
  salesOrderService
} from '../services';
import { exportLocalSalesInvoicePdf } from '../services/pdfService';
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Modal,
  useModal,
  toast,
  Combobox,
  NumberInput,
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
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../components/ui';

export default function LocalInvoicing() {
  const { modalProps, showModal } = useModal();
  const [invoices, setInvoices] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [masterItemsList, setMasterItemsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'credit' | 'dp'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PAID' | 'UNPAID'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);
  const [selectedSourceDocId, setSelectedSourceDocId] = useState('DO:SJ-LOKAL-2026-001');

  const [form, setForm] = useState({
    invoiceNo: 'INV-LOKAL-2026-001',
    soNumber: 'SO-LOKAL-2026-001',
    doNumber: 'SJ-LOKAL-2026-001',
    customerPONumber: 'PO-CUST-TGB-881',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    selectedCustomerId: 'CUST-LOKAL-01',
    customerName: 'Toko Emas Gadjah Berlian (Surabaya)',
    customerPhone: '0812-3456-7890',
    customerAddress: 'Jl. Pasar Atom Mall Blok A No. 12, Surabaya',
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    quantityGrams: 1000,
    unitPriceIDR: 1380000,
    downPaymentIDR: 0,
    taxFacility: 'BEBAS PPN PMK 48/2023',
    paymentSourceAccount: '1111-IDR',
    paymentSourceAccountName: 'Bank BCA IDR (Akun 1111-IDR)',
    paymentTerms: 'LUNAS (Transfer BCA)',
    barSerialNumbers: 'ANTAM-998812',
    ownerApproved: true,
    ownerApprovedBy: 'Direktur Utama / Pemilik PT TAN',
    notes: 'Penjualan Logam Mulia Emas Batangan 1kg Tunai Lunas via Transfer BCA IDR'
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  // Helper: map SalesInvoiceVO dari API ke bentuk legacy yang dibaca tabel & modal
  const toLegacyInvoice = (inv) => ({
    id: inv.id,
    invoiceNo: inv.number,
    soNumber: inv.orderNumber,
    doNumber: '',
    customerPONumber: '',
    date: inv.date,
    dueDate: inv.dueDate || inv.date,
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    itemCode: inv.items?.[0]?.productCode ?? '',
    itemName: inv.items?.[0]?.productName ?? '',
    quantityGrams: inv.items?.[0]?.weightGram ?? 0,
    unitPriceIDR: inv.subtotalAmount && inv.items?.[0]?.weightGram ? Math.round(inv.subtotalAmount / inv.items[0].weightGram) : 0,
    subtotalIDR: inv.subtotalAmount,
    downPaymentIDR: inv.dpAmount,
    totalAmountIDR: inv.totalAmount,
    taxFacility: inv.taxFacility || '',
    paymentSourceAccount: inv.paymentMode === 'CASH' ? '1111-IDR' : '1130',
    paymentSourceAccountName: inv.paymentMode === 'CASH' ? 'Bank BCA IDR' : 'Piutang Usaha Lokal (1130)',
    paymentTerms: inv.paymentModeLabel,
    paymentMode: inv.paymentMode === 'CASH' ? 'cash' : inv.paymentMode === 'CREDIT' ? 'credit' : 'dp',
    paymentStatus: inv.paymentStatus === 'PAID' ? 'PAID' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : 'UNPAID',
    barSerialNumbers: '',
    ownerApproved: true,
    createdAt: inv.createdAt
  });

  const loadInitialData = async () => {
    try {
      // 1. Faktur (dari database)
      const invoices = await salesInvoiceService.list({ type: 'LOCAL', limit: 100 });
      setInvoices((invoices.items || []).map(toLegacyInvoice));

      // 2. Sales Orders lokal (dari database)
      const orders = await salesOrderService.listLocal({ limit: 100 });
      setSalesOrders((orders.items || []).map(so => ({
        id: so.id,
        soNumber: so.number,
        customerPONumber: so.customerPoNumber || '',
        customerId: so.partnerId,
        customerName: so.partnerName,
        customerPhone: '',
        customerAddress: '',
        itemCode: so.first_item?.product.code ?? '',
        itemName: so.first_item?.product.name ?? '',
        quantityGrams: so.first_item?.weight_gram ?? 0,
        unitPriceIDR: so.first_item?.price_per_unit ?? 0,
        barSerialNumbers: ''
      })));

      // 3. Customers (partner berperan customer lokal)
      const custs = await partnerService.list({ role: 'customer', origin: 'LOCAL', limit: 100 });
      setCustomersList((custs.items || []).map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        phone: c.phone || '',
        address: c.city || ''
      })));

      // 4. Master Items (produk dari database)
      const items = await productService.list();
      setMasterItemsList(items.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name
      })));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat data faktur.'));
    }
  };

  // Handler Tarik Data Dokumen Acuan (DO atau SO) - SINGLE SOURCE OF TRUTH
  const handleSourceDocSelect = (val) => {
    if (!val || val === 'MANUAL_FREE_INPUT') {
      setSelectedSourceDocId('');
      if (val === 'MANUAL_FREE_INPUT') {
        toast.info('Mode Input Bebas diaktifkan: Silakan pilih Customer & Item secara manual.');
      }
      return;
    }

    setSelectedSourceDocId(val);

    if (val.startsWith('DO:')) {
      const doNo = val.replace('DO:', '');
      const foundDO = deliveryOrders.find(d => d.id === doNo || d.doNumber === doNo);
      if (foundDO) {
        setForm(prev => ({
          ...prev,
          doNumber: foundDO.doNumber || doNo,
          soNumber: foundDO.soNumber || prev.soNumber || '',
          customerPONumber: foundDO.customerPONumber || prev.customerPONumber || '',
          customerName: foundDO.customerName || '',
          customerPhone: foundDO.customerPhone || prev.customerPhone || '',
          customerAddress: foundDO.customerAddress || prev.customerAddress || '',
          itemCode: foundDO.itemCode || prev.itemCode,
          itemName: foundDO.itemName || prev.itemName,
          quantityGrams: Number(foundDO.netWeightGram || foundDO.quantityGrams || 1000),
          barSerialNumbers: foundDO.barSerialNumbers || prev.barSerialNumbers || ''
        }));
        toast.success(`Data Customer & Barang berhasil ditarik dari Surat Jalan ${foundDO.doNumber}`);
      }
    } else if (val.startsWith('SO:')) {
      const soNo = val.replace('SO:', '');
      const foundSO = salesOrders.find(s => s.id === soNo || s.soNumber === soNo);
      if (foundSO) {
        setForm(prev => ({
          ...prev,
          soNumber: foundSO.soNumber || soNo,
          doNumber: foundSO.doNumber || prev.doNumber || '',
          customerPONumber: foundSO.customerPONumber || prev.customerPONumber || '',
          customerName: foundSO.customerName || '',
          customerPhone: foundSO.customerPhone || prev.customerPhone || '',
          customerAddress: foundSO.customerAddress || prev.customerAddress || '',
          itemCode: foundSO.itemCode || prev.itemCode,
          itemName: foundSO.itemName || prev.itemName,
          quantityGrams: Number(foundSO.quantityGrams || 1000),
          unitPriceIDR: Number(foundSO.unitPriceIDR || prev.unitPriceIDR || 1380000),
          barSerialNumbers: foundSO.barSerialNumbers || prev.barSerialNumbers || ''
        }));
        toast.success(`Data Customer & Barang berhasil ditarik dari Sales Order ${foundSO.soNumber}`);
      }
    }
  };

  // Calculations
  const subtotal = (form.quantityGrams || 0) * (form.unitPriceIDR || 0);
  const dpDeduction = Number(form.downPaymentIDR || 0);
  const totalAmount = Math.max(0, subtotal - dpDeduction);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.invoiceNo || !form.customerName || !form.quantityGrams || form.quantityGrams <= 0 || !form.unitPriceIDR || form.unitPriceIDR <= 0) {
      toast.warning('Mohon lengkapi No. Faktur, Nama Customer, Berat Emas (g), dan Harga Satuan per gram.');
      return;
    }

    const selectedCust = customersList.find(c => c.name === form.customerName || c.id === form.selectedCustomerId || c.code === form.selectedCustomerId);
    if (!selectedCust) {
      toast.warning('Pilih customer dari daftar master terlebih dahulu.');
      return;
    }

    // Cari SO acuan (jika faktur ditarik dari SO)
    const foundSO = salesOrders.find(s => s.soNumber === form.soNumber);

    try {
      let orderId = foundSO?.id;
      let orderItemId = foundSO?.items?.[0]?.id;

      // Jika tidak ada SO acuan, buat SO lokal singkat dulu (komitmen) lalu konfirmasi
      if (!orderId) {
        const selectedItem = masterItemsList.find(i => i.code === form.itemCode || i.id === form.itemCode);
        if (!selectedItem) {
          toast.warning('Pilih produk dari daftar master terlebih dahulu.');
          return;
        }
        const so = await salesOrderService.create({
          type: 'LOCAL',
          payment_type: paymentMode === 'cash' ? 'DP' : 'PO',
          partner_id: selectedCust.id,
          date: form.date,
          customer_po_number: form.customerPONumber || undefined,
          currency_code: 'IDR',
          items: [{
            product_id: selectedItem.id,
            weight_unit: 'GRAM',
            weight_gram: Number(form.quantityGrams),
            purity_percent: 99.99,
            price_per_unit: Number(form.unitPriceIDR)
          }]
        });
        await salesOrderService.confirm(so.id, 'LOCAL');
        orderId = so.id;
        orderItemId = so.items[0].id;
      }

      // Terbitkan Faktur (draft) lalu posting — jurnal piutang/pendapatan lahir di sini
      const invoice = await salesInvoiceService.create({
        type: 'LOCAL',
        order_id: orderId,
        date: form.date,
        due_date: form.dueDate || null,
        currency_code: 'IDR',
        subtotal_amount: subtotal,
        dp_amount: dpDeduction,
        total_amount: totalAmount,
        tax_facility: form.taxFacility || 'BEBAS PPN PMK 48/2023',
        payment_mode: paymentMode === 'cash' ? 'CASH' : paymentMode === 'credit' ? 'CREDIT' : 'DP',
        items: [{
          order_item_id: orderItemId,
          weight_gram: Number(form.quantityGrams),
          amount: subtotal
        }],
        notes: form.notes || undefined
      });
      await salesInvoiceService.post(invoice.id, 'LOCAL');

      // Muat ulang register dari database
      const invoices = await salesInvoiceService.list({ type: 'LOCAL', limit: 100 });
      setInvoices((invoices.items || []).map(toLegacyInvoice));

      showModal({
        variant: 'success',
        title: '✅ Faktur Penjualan Lokal Berhasil Diterbitkan',
        message: `• No. Faktur  : ${invoice.number}\n• Customer    : ${selectedCust.name}\n• Total Nilai : Rp ${totalAmount.toLocaleString('id-ID')}\n• Auto-Jurnal : Piutang (1130) / Bank vs Pendapatan (4111) — diposting otomatis\n• Fasilitas   : Bebas PPN (PMK 48/2023 Non-BKP Emas Batangan).`
      });

      // Reset Form for next input (nomor dokumen dibuat otomatis di server)
      setForm(prev => ({
        ...prev,
        invoiceNo: '',
        barSerialNumbers: ''
      }));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menerbitkan faktur penjualan lokal.'));
    }
  };

  const totalOmset = invoices.reduce((sum, inv) => sum + Number(inv.totalAmountIDR || 0), 0);
  const paidCount = invoices.filter(inv => inv.paymentStatus === 'PAID').length;
  const unpaidCount = invoices.filter(inv => inv.paymentStatus === 'UNPAID').length;

  const filteredInvoices = invoices.filter(inv => {
    if (statusFilter === 'PAID' && inv.paymentStatus !== 'PAID') return false;
    if (statusFilter === 'UNPAID' && inv.paymentStatus !== 'UNPAID') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInv = inv.invoiceNo?.toLowerCase().includes(q);
      const matchCust = inv.customerName?.toLowerCase().includes(q);
      const matchItem = inv.itemName?.toLowerCase().includes(q);
      const matchBar = inv.barSerialNumbers?.toLowerCase().includes(q);
      return matchInv || matchCust || matchItem || matchBar;
    }
    return true;
  });

  // Combobox Options Dokumen Acuan (DO atau SO)
  const sourceDocOptions = [
    { value: '', label: '-- (Pilih Dokumen Acuan: Surat Jalan DO atau Sales Order SO) --' },
    { value: 'MANUAL_FREE_INPUT', label: '✍️ -- Input Bebas (Tanpa Dokumen Acuan / Counter Langsung) --' },
    ...deliveryOrders.map(doItem => ({
      value: `DO:${doItem.doNumber || doItem.id}`,
      label: `[SJ/DO] ${doItem.doNumber} (Ref SO: ${doItem.soNumber || '-'}) — ${doItem.customerName} (${doItem.netWeightGram || doItem.quantityGrams || 0}g ${doItem.itemName || ''})`
    })),
    ...salesOrders.map(so => ({
      value: `SO:${so.soNumber || so.id}`,
      label: `[SO] ${so.soNumber} (PO Cust: ${so.customerPONumber || '-'}) — ${so.customerName} (${so.quantityGrams || 0}g ${so.itemName || ''})`
    }))
  ];

  const customerOptions = customersList.map(c => ({
    value: c.name,
    label: `${c.name} ${c.phone ? `(${c.phone})` : ''}`
  }));
  if (form.customerName && !customerOptions.some(c => c.value === form.customerName)) {
    customerOptions.unshift({ value: form.customerName, label: form.customerName });
  }

  const handleCustomerSelect = (val) => {
    const found = customersList.find(c => c.name === val || c.id === val || c.code === val);
    if (found) {
      setForm(prev => ({
        ...prev,
        selectedCustomerId: found.id || found.code,
        customerName: found.name,
        customerPhone: found.phone || prev.customerPhone,
        customerAddress: found.address || prev.customerAddress
      }));
    } else {
      setForm(prev => ({ ...prev, customerName: val }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="gold" className="px-2 py-0.5 text-xs font-semibold">FAKTUR KOMERSIAL IDR</Badge>
            <Badge variant="emerald" className="px-2 py-0.5 text-xs">PMK 48/2023 BEBAS PPN</Badge>
          </div>
          <h1 className="text-2xl font-bold text-fg mt-1">Faktur Penjualan Emas Lokal IDR (Invoicing)</h1>
          <p className="text-sm text-fg-soft">
            Penerbitan faktur tagihan komersial penjualan logam mulia domestik, penutupan uang muka (DP), dan auto-jurnal SAK EMKM.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-surface-raised rounded-xl border border-line flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-fg-soft font-medium">Total Omset Faktur Lokal</p>
              <p className="text-base font-bold text-fg tabular-nums">
                Rp {totalOmset > 1000000000 ? `${(totalOmset / 1000000000).toFixed(2)} M` : totalOmset.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TOP SECTION: FORMULIR FAKTUR PENJUALAN LOKAL (FULL-WIDTH ATAS) */}
      <Card className="glass-panel border-line">
        <CardHeader className="pb-3 border-b border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center text-gold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-fg">Formulir Faktur Penjualan Emas Lokal</CardTitle>
                <CardDescription className="text-xs text-fg-soft">Penerbitan invoice resmi dengan fasilitas Bebas PPN (PMK 48/2023)</CardDescription>
              </div>
            </div>

            {/* Mode Pills */}
            <div className="flex items-center bg-surface-raised p-0.5 rounded-lg border border-line text-xs">
              <button
                type="button"
                onClick={() => { setPaymentMode('cash'); setForm(prev => ({ ...prev, paymentSourceAccount: '1111-IDR', paymentSourceAccountName: 'Bank BCA IDR' })); }}
                className={`px-3 py-1 rounded-md transition-colors ${paymentMode === 'cash' ? 'bg-gold text-canvas font-bold shadow-sm' : 'text-fg-soft hover:text-fg'}`}
              >
                💵 Tunai / Bank
              </button>
              <button
                type="button"
                onClick={() => { setPaymentMode('credit'); setForm(prev => ({ ...prev, paymentSourceAccount: '1130', paymentSourceAccountName: 'Piutang Usaha Lokal (1130)' })); }}
                className={`px-3 py-1 rounded-md transition-colors ${paymentMode === 'credit' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-fg-soft hover:text-fg'}`}
              >
                ⏱️ Tempo (Piutang)
              </button>
              <button
                type="button"
                onClick={() => { setPaymentMode('dp'); setForm(prev => ({ ...prev, paymentSourceAccount: '1111-IDR', paymentSourceAccountName: 'Bank BCA IDR (Uang Muka)' })); }}
                className={`px-3 py-1 rounded-md transition-colors ${paymentMode === 'dp' ? 'bg-amber-500 text-canvas font-bold shadow-sm' : 'text-fg-soft hover:text-fg'}`}
              >
                🪙 Uang Muka (DP)
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* PULL FROM DO OR SO DROPDOWN (SINGLE SOURCE OF TRUTH) */}
            <div className="p-4 rounded-xl border border-gold/30 bg-gold/[0.08] shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <Label className="text-xs font-bold text-gold flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Tarik Otomatis Dari Surat Jalan (DO) atau Sales Order (SO):
                </Label>
                {selectedSourceDocId ? (
                  <Badge variant="gold" className="text-[11px] font-semibold flex items-center gap-1 w-fit">
                    <ShieldCheck className="w-3.5 h-3.5 text-gold-light" /> Single Source of Truth: Terkunci ke {form.doNumber || form.soNumber}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] text-fg-soft border-line w-fit">
                    Mode Input Bebas (Tanpa Dokumen Acuan)
                  </Badge>
                )}
              </div>
              <Combobox
                value={selectedSourceDocId}
                onChange={handleSourceDocSelect}
                placeholder="-- (Pilih Surat Jalan DO atau Sales Order SO Untuk Tarik Otomatis Data Customer & Barang) --"
                searchPlaceholder="Cari nomor DO, nomor SO, nama pelanggan/toko emas..."
                emptyText="Dokumen tidak ditemukan di sistem / Firebase."
                options={sourceDocOptions}
                className="w-full text-xs font-mono"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-fg-soft">
                <span className="flex items-center gap-1.5">
                  <span>💡</span> Informasi Pelanggan, Ref PO Customer, Item Emas, dan Berat Gram ditarik dari dokumen sumber tanpa double input.
                </span>
                {selectedSourceDocId && (
                  <button
                    type="button"
                    onClick={() => handleSourceDocSelect('MANUAL_FREE_INPUT')}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    Beralih ke Input Bebas (Tanpa Dokumen Acuan)
                  </button>
                )}
              </div>
            </div>

            {/* Baris 1: No Faktur, Tgl, Jatuh Tempo, Customer (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-fg-soft">No. Faktur Penjualan *</Label>
                <Input
                  type="text"
                  value={form.invoiceNo}
                  onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                  className="form-input text-xs font-mono font-bold text-gold mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Tanggal Faktur *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value, dueDate: e.target.value })}
                  className="form-input text-xs mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Tanggal Jatuh Tempo</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="form-input text-xs mt-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-fg-soft">Customer / Pembeli *</Label>
                  {selectedSourceDocId ? (
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Dari Dokumen (SSOT)
                    </span>
                  ) : (
                    <span className="text-[10px] text-fg-soft">Input Bebas</span>
                  )}
                </div>
                {selectedSourceDocId ? (
                  <Input
                    type="text"
                    value={form.customerName}
                    readOnly
                    className="form-input text-xs font-semibold text-fg bg-surface-raised/70 border-emerald-500/30 cursor-not-allowed mt-1"
                    required
                  />
                ) : (
                  <div className="mt-1">
                    <Combobox
                      value={form.customerName}
                      onChange={handleCustomerSelect}
                      options={customerOptions}
                      placeholder="-- Pilih / Cari Customer --"
                      searchPlaceholder="Cari nama toko / customer…"
                      emptyText="Customer tidak ditemukan."
                      className="w-full text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Baris 2: Ref DO, Ref SO, Ref PO Cust, Kontak & Alamat (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-fg-soft">Ref No. Surat Jalan (DO)</Label>
                  {selectedSourceDocId.startsWith('DO:') && (
                    <span className="text-[10px] text-sky-400 flex items-center gap-0.5 font-medium">
                      <ShieldCheck className="w-3 h-3" /> Terkunci
                    </span>
                  )}
                </div>
                <Input
                  type="text"
                  placeholder="SJ-LOKAL-xxxx"
                  value={form.doNumber}
                  readOnly={selectedSourceDocId.startsWith('DO:')}
                  onChange={(e) => setForm({ ...form, doNumber: e.target.value })}
                  className={`form-input text-xs font-mono mt-1 ${selectedSourceDocId.startsWith('DO:') ? 'bg-surface-raised/70 border-sky-500/30 text-sky-300 font-bold cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-fg-soft">Ref No. Sales Order (SO)</Label>
                  {selectedSourceDocId && (
                    <span className="text-[10px] text-sky-400 flex items-center gap-0.5 font-medium">
                      <ShieldCheck className="w-3 h-3" /> Terkunci
                    </span>
                  )}
                </div>
                <Input
                  type="text"
                  placeholder="SO-LOKAL-xxxx"
                  value={form.soNumber}
                  readOnly={Boolean(selectedSourceDocId)}
                  onChange={(e) => setForm({ ...form, soNumber: e.target.value })}
                  className={`form-input text-xs font-mono mt-1 ${selectedSourceDocId ? 'bg-surface-raised/70 border-sky-500/30 text-sky-300 font-bold cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">No. PO Customer (Ref Pembeli)</Label>
                <Input
                  type="text"
                  placeholder="Contoh: PO-CUST-TGB-881"
                  value={form.customerPONumber}
                  onChange={(e) => setForm({ ...form, customerPONumber: e.target.value })}
                  className="form-input text-xs font-mono font-semibold text-gold mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Kontak & Alamat Customer</Label>
                <Input
                  type="text"
                  placeholder="Alamat toko penerima..."
                  value={`${form.customerPhone || ''} ${form.customerAddress ? `(${form.customerAddress})` : ''}`}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  className="form-input text-xs mt-1"
                />
              </div>
            </div>

            {/* Baris 3: Produk Emas, Nomor Seri, Berat, Harga/g, DP & Total Tagihan (5 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <Label className="text-xs text-fg-soft">Item Logam Mulia *</Label>
                <div className="mt-1">
                  <Combobox
                    options={masterItemsList.map(i => ({ value: i.code, label: i.name }))}
                    value={form.itemCode}
                    onChange={(selectedCode) => {
                      const found = masterItemsList.find(i => i.code === selectedCode);
                      if (found) setForm({ ...form, itemCode: found.code, itemName: found.name });
                    }}
                    placeholder="-- Pilih Produk Emas --"
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Nomor Seri Sertifikat / Bar ID</Label>
                <Input
                  type="text"
                  placeholder="Contoh: ANTAM-998812"
                  value={form.barSerialNumbers}
                  onChange={(e) => setForm({ ...form, barSerialNumbers: e.target.value })}
                  className="form-input text-xs font-mono mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Berat (Gram) *</Label>
                <NumberInput
                  allowDecimal
                  value={form.quantityGrams}
                  onChange={(val) => setForm({ ...form, quantityGrams: val })}
                  className="form-input text-xs text-right font-bold text-emerald-400 mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Harga Jual/g (IDR) *</Label>
                <NumberInput
                  value={form.unitPriceIDR}
                  onChange={(val) => setForm({ ...form, unitPriceIDR: val })}
                  className="form-input text-xs text-right font-bold text-gold mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Potongan Uang Muka (DP)</Label>
                <NumberInput
                  value={form.downPaymentIDR}
                  onChange={(val) => setForm({ ...form, downPaymentIDR: val })}
                  className="form-input text-xs text-right text-fg-soft mt-1"
                />
              </div>
            </div>

            {/* Total Box Summary Banner */}
            <div className="p-3 bg-surface-raised rounded-lg border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-fg-soft">Total Tagihan Faktur Penjualan Emas (Bebas PPN PMK 48/2023):</p>
                <p className="text-xl font-bold text-gold tabular-nums">
                  Rp {totalAmount.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="emerald" className="text-xs px-2.5 py-1">
                  PMK 48/2023 NON-BKP RESMI
                </Badge>
                <Badge variant="outline" className="text-xs text-fg-soft">
                  Subtotal: Rp {subtotal.toLocaleString('id-ID')} {dpDeduction > 0 ? `(DP -Rp ${dpDeduction.toLocaleString('id-ID')})` : ''}
                </Badge>
              </div>
            </div>

            {/* Baris 4: Otorisasi & Tombol Submit */}
            <div className="pt-2 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="p-2.5 bg-gold/[0.06] rounded-md border border-gold/20 text-xs text-fg-soft flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gold flex-shrink-0" />
                <span>Auto-Jurnal: Debet {paymentMode === 'cash' ? 'Bank BCA 1111-IDR' : 'Piutang Usaha 1130'} vs Kredit Penjualan Gold Bar 4111.</span>
              </div>

              <Button type="submit" className="btn-primary text-xs font-bold py-2.5 px-6 flex items-center justify-center gap-2">
                <Receipt className="w-4 h-4" /> Terbitkan Faktur & Auto-Jurnal SAK EMKM
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>

      {/* BOTTOM SECTION: REGISTER FAKTUR PENJUALAN LOKAL (FULL-WIDTH BAWAH) */}
      <Card className="glass-panel border-line">
        <CardHeader className="pb-3 border-b border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-fg">Register Faktur Penjualan Emas Lokal</CardTitle>
              <CardDescription className="text-xs text-fg-soft">Daftar faktur komersial domestik IDR, status pembayaran, dan cetak PDF resmi</CardDescription>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-soft" />
                <Input
                  type="text"
                  placeholder="Cari No. Faktur / Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs form-input w-48 sm:w-64"
                />
              </div>

              <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-lg border border-line text-xs">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded ${statusFilter === 'ALL' ? 'bg-gold text-canvas font-bold' : 'text-fg-soft hover:text-fg'}`}
                >
                  Semua ({invoices.length})
                </button>
                <button
                  onClick={() => setStatusFilter('PAID')}
                  className={`px-2.5 py-1 rounded ${statusFilter === 'PAID' ? 'bg-emerald-500 text-white font-bold' : 'text-fg-soft hover:text-fg'}`}
                >
                  Lunas ({paidCount})
                </button>
                <button
                  onClick={() => setStatusFilter('UNPAID')}
                  className={`px-2.5 py-1 rounded ${statusFilter === 'UNPAID' ? 'bg-sky-500 text-white font-bold' : 'text-fg-soft hover:text-fg'}`}
                >
                  Tempo ({unpaidCount})
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">No</TableHead>
                <TableHead>No. Faktur</TableHead>
                <TableHead>Tanggal / Tempo</TableHead>
                <TableHead>Customer / Pembeli</TableHead>
                <TableHead>Produk & Seri Bar</TableHead>
                <TableHead className="text-right">Berat (g)</TableHead>
                <TableHead className="text-right">Harga / g</TableHead>
                <TableHead className="text-right">Total Faktur (IDR)</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-16 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableEmpty colSpan={10} message="Belum ada faktur penjualan lokal yang tercatat." />
              ) : (
                filteredInvoices.map((inv, idx) => (
                  <TableRow key={inv.id || idx} className="hover:bg-gold/[0.03]">
                    <TableCell className="text-center font-mono text-xs">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-mono font-bold text-xs text-gold">{inv.invoiceNo}</div>
                      <div className="text-[10px] text-fg-soft">{inv.doNumber ? `SJ: ${inv.doNumber}` : (inv.soNumber || '-')}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-fg">{inv.date}</div>
                      <div className="text-[10px] text-fg-soft">{inv.dueDate ? `JT: ${inv.dueDate}` : ''}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-fg">{inv.customerName}</div>
                      <div className="text-[10px] text-fg-soft">{inv.customerPhone || 'Lokal'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-fg font-medium">{inv.itemName}</div>
                      <div className="text-[10px] font-mono text-sky-400">{inv.barSerialNumbers || '-'}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-emerald-400 tabular-nums">
                      {Number(inv.quantityGrams || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })} g
                    </TableCell>
                    <TableCell className="text-right text-xs text-fg-soft tabular-nums">
                      Rp {Number(inv.unitPriceIDR || 0).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-fg tabular-nums">
                      Rp {Number(inv.totalAmountIDR || 0).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={inv.paymentStatus === 'PAID' ? 'emerald' : 'sky'} className="text-[10px] px-2 py-0.5 font-bold">
                        {inv.paymentStatus === 'PAID' ? 'LUNAS' : 'TEMPO'}
                      </Badge>
                    </TableCell>
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
                            onClick={() => setSelectedInvoiceDetail(inv)}
                            className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                          >
                            <FileText className="h-4 w-4" />
                            <span>Lihat Detail & Jurnal</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => exportLocalSalesInvoicePdf(inv)}
                            className="flex items-center gap-2 cursor-pointer text-gold hover:bg-gold/10 focus:bg-gold/10 focus:text-gold-light"
                          >
                            <Printer className="h-4 w-4 text-gold" />
                            <span>Cetak Faktur Penjualan</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedInvoiceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface border border-line rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <Badge variant="gold" className="text-[10px] font-mono">DETAIL FAKTUR PENJUALAN</Badge>
                <h3 className="text-lg font-bold text-fg mt-1">{selectedInvoiceDetail.invoiceNo}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceDetail(null)}
                className="p-1 rounded-lg hover:bg-surface-raised text-fg-soft"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-surface-raised rounded-lg border border-line text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-fg-soft">Customer:</span>
                <span className="font-bold text-fg">{selectedInvoiceDetail.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Produk Logam Mulia:</span>
                <span className="font-bold text-fg">{selectedInvoiceDetail.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Nomor Seri Sertifikat:</span>
                <span className="font-mono text-sky-400 font-bold">{selectedInvoiceDetail.barSerialNumbers || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Berat Gramasi:</span>
                <span className="font-bold text-emerald-400">{Number(selectedInvoiceDetail.quantityGrams).toLocaleString('id-ID')} gram</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Harga Satuan / gram:</span>
                <span className="font-bold text-fg">Rp {Number(selectedInvoiceDetail.unitPriceIDR).toLocaleString('id-ID')} / g</span>
              </div>
              <div className="border-t border-line pt-2 flex justify-between text-sm font-bold">
                <span className="text-fg">Total Nilai Faktur:</span>
                <span className="text-gold">Rp {Number(selectedInvoiceDetail.totalAmountIDR).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="p-3 bg-gold/[0.06] rounded-lg border border-gold/20 text-xs space-y-1.5">
              <p className="font-bold text-gold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Posting Jurnal SAK EMKM:
              </p>
              <div className="pl-5 space-y-1 font-mono text-[11px] text-fg">
                <p><strong>Debet</strong>: {selectedInvoiceDetail.paymentSourceAccount || '1111-IDR'} ({selectedInvoiceDetail.paymentSourceAccountName || 'Bank BCA IDR'}) Rp {Number(selectedInvoiceDetail.totalAmountIDR).toLocaleString('id-ID')}</p>
                <p><strong>Kredit</strong>: 4111 (Penjualan Gold Bar) Rp {Number(selectedInvoiceDetail.totalAmountIDR).toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button
                type="button"
                onClick={() => exportLocalSalesInvoicePdf(selectedInvoiceDetail)}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Faktur Penjualan PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Global UI Modal */}
      <Modal {...modalProps} />
    </div>
  );
}
