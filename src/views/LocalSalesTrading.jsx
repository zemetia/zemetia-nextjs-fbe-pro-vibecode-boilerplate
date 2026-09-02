import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Printer,
  CheckCircle,
  Package,
  DollarSign,
  Wallet,
  ShieldCheck,
  FileText,
  Truck,
  MapPin,
  Send,
  History,
  AlertCircle,
  X,
  Search,
  Filter,
  CheckSquare,
  TrendingUp,
  Coins,
  Receipt,
  MoreHorizontal
} from 'lucide-react';
import {
  apiErrorMessage,
  partnerService,
  productService,
  salesInvoiceService,
  salesOrderService
} from '../services';
import {
  exportLocalSalesInvoicePdf,
  exportLocalDeliveryOrderPdf
} from '../services/pdfService';
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Alert,
  Combobox,
  NumberInput,
  Modal,
  useModal,
  toast,
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

export default function LocalSalesTrading() {
  const { modalProps, showModal } = useModal();
  const [salesList, setSalesList] = useState([]);
  const [masterItemsList, setMasterItemsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' (Tunai/Transfer Lunas), 'credit' (Tempo), 'dp' (Uang Muka)
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PAID' | 'UNPAID' | 'DELIVERED'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSaleDetail, setSelectedSaleDetail] = useState(null); // Modal detail

  const [formData, setFormData] = useState({
    invoiceNo: 'INV-LOKAL-2026-001',
    soNumber: 'SO-LOKAL-2026-001',
    doNumber: 'SJ-LOKAL-2026-001',
    customerPONumber: 'PO-CUST-TGB-881',
    date: new Date().toISOString().split('T')[0],
    selectedCustomerId: '',
    customerName: 'Toko Emas Gadjah Berlian (Surabaya)',
    customerPhone: '0812-3456-7890',
    customerAddress: 'Jl. Pasar Atom Mall Blok A No. 12, Surabaya',
    paymentSourceAccount: '1111-IDR',
    paymentSourceAccountName: 'Bank BCA IDR (Akun 1111-IDR)',
    paymentTerms: 'LUNAS (Transfer BCA)',
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    sourceVault: '1157',
    sourceVaultName: 'Vault Utama PT TAN (Akun 1157)',
    quantityGrams: 1000,
    unitPriceIDR: 1380000, // Rp 1.380.000 / g
    estimatedCostPerGram: 1300000, // Estimasi HPP Rp 1.300.000 / g
    barSerialNumbers: 'ANTAM-998812',
    deliveryMethod: 'KURIR_INTERNAL', // 'COUNTER' | 'KURIR_INTERNAL' | 'EXPEDITION'
    courierName: 'Bpk. Budi (Kurir Internal PT TAN)',
    recipientName: 'Bpk. Hendra (Owner Toko Emas Gadjah)',
    ownerApprovedBy: 'Direktur Utama / Pemilik PT TAN',
    ownerApproved: true,
    notes: 'Penjualan Logam Mulia Emas Batangan 1kg Tunai Lunas via Transfer Bank BCA IDR'
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  // Helper: map SalesOrderVO dari API ke bentuk legacy yang dibaca tabel & modal
  const toLegacySale = (so) => ({
    id: so.id,
    invoiceNo: so.number,
    soNumber: so.number,
    doNumber: '',
    customerPONumber: so.customerPoNumber || '-',
    date: so.date,
    customerId: so.partnerId,
    customerName: so.partnerName,
    customerPhone: '',
    customerAddress: '',
    paymentMode: so.paymentType === 'DP' ? 'dp' : 'credit',
    paymentTerms: so.paymentType === 'DP' ? 'LUNAS (Transfer / Tunai)' : 'TEMPO (Piutang Usaha)',
    paymentSourceAccount: so.paymentType === 'DP' ? '1111-IDR' : '1130',
    paymentSourceAccountName: so.paymentType === 'DP' ? 'Bank BCA IDR' : 'Piutang Usaha Lokal (1130)',
    itemCode: so.first_item?.product.code ?? '',
    itemName: so.first_item?.product.name ?? '',
    sourceVault: '1157',
    sourceVaultName: 'Vault Utama PT TAN (Akun 1157)',
    quantityGrams: so.first_item?.weight_gram ?? 0,
    unitPriceIDR: so.first_item?.price_per_unit ?? 0,
    totalAmountIDR: so.goodsAmount,
    barSerialNumbers: '',
    deliveryMethod: 'COUNTER',
    paymentStatus: so.paymentStatus === 'PAID' ? 'PAID' : so.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : 'UNPAID',
    deliveryStatus: 'DELIVERED',
    cogsAmountIDR: 0,
    grossProfitIDR: 0,
    status: so.statusLabel,
    createdAt: so.createdAt
  });

  const loadInitialData = async () => {
    try {
      // 1. Master Items (produk dari database)
      const items = await productService.list();
      const defaultMasterItems = items.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.formLabel,
        unit: 'gram',
        purity: p.defaultPurityPercent ?? 99.99,
        vaultAccount: p.form === 'JEWELRY' ? '1160' : p.form === 'SCRAP' ? '1152' : '1157',
        vaultName: p.form === 'JEWELRY' ? 'Vault Perhiasan (Akun 1160)' : p.form === 'SCRAP' ? 'Vault Scrap (Akun 1152)' : 'Vault Utama PT TAN (Akun 1157)'
      }));
      setMasterItemsList(defaultMasterItems);

      // 2. Customers (partner berperan customer lokal)
      const custs = await partnerService.list({ role: 'customer', origin: 'LOCAL', limit: 100 });
      const combinedCusts = (custs.items || []).map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        phone: c.phone || '',
        address: c.city || ''
      }));
      setCustomersList(combinedCusts);

      // 3. Stored Sales Orders (dari database)
      const orders = await salesOrderService.listLocal({ limit: 100 });
      setSalesList((orders.items || []).map(toLegacySale));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat data penjualan lokal.'));
    }
  };

  // Helper bar count detection
  const getDetectedBarCount = (text) => {
    if (!text) return 0;
    const items = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    return items.length;
  };

  const detectedBarCount = getDetectedBarCount(formData.barCertificateNo);
  const totalAmount = (formData.quantityGrams || 0) * (formData.unitPriceIDR || 0);
  const totalCOGS = (formData.quantityGrams || 0) * (formData.estimatedCostPerGram || 1300000);
  const estimatedGrossProfit = totalAmount - totalCOGS;

  // Handler Customer Selection
  const handleCustomerSelect = (custId) => {
    const found = customersList.find(c => c.id === custId || c.code === custId);
    if (found) {
      setFormData(prev => ({
        ...prev,
        selectedCustomerId: custId,
        customerName: found.name,
        customerPhone: found.phone || prev.customerPhone,
        customerAddress: found.address || prev.customerAddress,
        recipientName: found.name
      }));
    }
  };

  // Handler Item Selection
  const handleItemSelect = (selectedCode) => {
    const foundItem = masterItemsList.find(i => i.code === selectedCode || i.id === selectedCode);
    if (foundItem) {
      setFormData(prev => ({
        ...prev,
        itemCode: foundItem.code || selectedCode,
        itemName: foundItem.name || selectedCode,
        sourceVault: foundItem.vaultAccount || '1157',
        sourceVaultName: foundItem.vaultName || 'Vault Utama PT TAN (Akun 1157)'
      }));
    }
  };

  // Handler Submit Penjualan Lokal
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.quantityGrams || formData.quantityGrams <= 0) {
      toast.warning('Kuantitas berat emas yang dijual harus lebih besar dari 0 gram.');
      return;
    }

    if (!formData.unitPriceIDR || formData.unitPriceIDR <= 0) {
      toast.warning('Harga satuan emas per gram (IDR) harus diisi.');
      return;
    }

    if (!formData.customerName) {
      toast.warning('Mohon pilih atau masukkan nama pelanggan / pembeli emas lokal.');
      return;
    }

    if (!formData.ownerApproved) {
      toast.warning('Transaksi penjualan emas wajib mendapatkan otorisasi dari Direktur Utama / Pemilik sebelum dicatat.');
      return;
    }

    const selectedItem = masterItemsList.find(i => i.code === formData.itemCode || i.id === formData.itemCode);
    const selectedCust = customersList.find(c => c.name === formData.customerName || c.id === formData.selectedCustomerId || c.code === formData.selectedCustomerId);

    if (!selectedItem || !selectedCust) {
      toast.warning('Pilih produk dan customer dari daftar master terlebih dahulu.');
      return;
    }

    try {
      // 1. Buat Sales Order Lokal (draft) lalu konfirmasi — komitmen penjualan
      const so = await salesOrderService.create({
        type: 'LOCAL',
        payment_type: paymentMode === 'cash' ? 'DP' : 'PO',
        partner_id: selectedCust.id,
        date: formData.date,
        customer_po_number: formData.customerPONumber || undefined,
        currency_code: 'IDR',
        items: [{
          product_id: selectedItem.id,
          weight_unit: 'GRAM',
          weight_gram: Number(formData.quantityGrams),
          purity_percent: Number(selectedItem.purity ?? 99.99),
          price_per_unit: Number(formData.unitPriceIDR)
        }],
        notes: formData.notes || undefined
      });
      await salesOrderService.confirm(so.id, 'LOCAL');

      // 2. Terbitkan Faktur & posting jurnal piutang/pendapatan (PMK 48/2023 bebas PPN)
      const totalValue = totalAmount;
      const invoice = await salesInvoiceService.create({
        type: 'LOCAL',
        order_id: so.id,
        date: formData.date,
        currency_code: 'IDR',
        subtotal_amount: totalValue,
        dp_amount: paymentMode === 'dp' ? Math.round(totalValue * 0.5) : 0,
        total_amount: paymentMode === 'dp' ? totalValue : totalValue,
        tax_facility: 'BEBAS PPN PMK 48/2023',
        payment_mode: paymentMode === 'cash' ? 'CASH' : paymentMode === 'credit' ? 'CREDIT' : 'DP',
        items: [{
          order_item_id: so.items[0].id,
          weight_gram: Number(formData.quantityGrams),
          amount: totalValue
        }]
      });
      await salesInvoiceService.post(invoice.id, 'LOCAL');

      // Muat ulang register dari database
      const orders = await salesOrderService.listLocal({ limit: 100 });
      setSalesList((orders.items || []).map(toLegacySale));

      showModal({
        variant: 'success',
        title: '✅ Penjualan Lokal Berhasil Dicatat & Dijurnal',
        message: `• No. SO     : ${so.number}\\n• No. Faktur : ${invoice.number}\\n• Customer   : ${selectedCust.name}\\n• Total Nilai: Rp ${totalValue.toLocaleString('id-ID')}\\n• Auto-Jurnal: Piutang/Pendapatan 4111 (faktur diposting), HPP & stok keluar saat Surat Jalan dikonfirmasi di menu Surat Jalan Lokal.`
      });

      // Regenerate form untuk input berikutnya (nomor dokumen dibuat otomatis di server)
      setFormData(prev => ({
        ...prev,
        customerPONumber: '',
        barSerialNumbers: '',
        notes: ''
      }));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal mencatat penjualan lokal.'));
    }
  };

  // KPI Stats Calculation
  const totalRevenue = salesList.reduce((sum, s) => sum + Number(s.totalAmountIDR || 0), 0);
  const totalVolumeGrams = salesList.reduce((sum, s) => sum + Number(s.quantityGrams || 0), 0);
  const paidCount = salesList.filter(s => s.paymentStatus === 'PAID').length;
  const unpaidCount = salesList.filter(s => s.paymentStatus === 'UNPAID').length;
  const totalGrossProfit = salesList.reduce((sum, s) => sum + Number(s.grossProfitIDR || 0), 0);

  // Filtered list
  const filteredSales = salesList.filter(s => {
    if (statusFilter === 'PAID' && s.paymentStatus !== 'PAID') return false;
    if (statusFilter === 'UNPAID' && s.paymentStatus !== 'UNPAID') return false;
    if (statusFilter === 'DELIVERED' && s.deliveryStatus !== 'DELIVERED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchInv = s.invoiceNo?.toLowerCase().includes(q);
      const matchCust = s.customerName?.toLowerCase().includes(q);
      const matchBar = s.barSerialNumbers?.toLowerCase().includes(q);
      const matchItem = s.itemName?.toLowerCase().includes(q);
      return matchInv || matchCust || matchBar || matchItem;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="gold" className="px-2 py-0.5 text-xs font-semibold">DOMESTIC GOLD TRADING</Badge>
            <Badge variant="emerald" className="px-2 py-0.5 text-xs">PMK 48/2023 BEBAS PPN</Badge>
          </div>
          <h1 className="text-2xl font-bold text-fg mt-1">Penjualan & Trading Logam Mulia Lokal IDR</h1>
          <p className="text-sm text-fg-soft">
            Pencatatan faktur komersial penjualan emas batangan & perhiasan domestik, pengurangan kartu stok brankas vault, dan auto-jurnal SAK EMKM terintegrasi.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards (5 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="glass-panel border-line">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-fg-soft font-medium">Total Omset Penjualan</p>
              <p className="text-lg font-bold text-fg tabular-nums">
                Rp {totalRevenue > 1000000000 ? `${(totalRevenue / 1000000000).toFixed(2)} M` : totalRevenue.toLocaleString('id-ID')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-line">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-fg-soft font-medium">Volume Gram Terjual</p>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">
                {totalVolumeGrams.toLocaleString('id-ID')} <span className="text-xs font-normal">gram</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-line">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-fg-soft font-medium">Penjualan Tunai / Lunas</p>
              <p className="text-lg font-bold text-sky-400 tabular-nums">{paidCount} Transaksi</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-line">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-fg-soft font-medium">Piutang Dagang (Tempo)</p>
              <p className="text-lg font-bold text-amber-400 tabular-nums">{unpaidCount} Pending</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-line">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600/15 flex items-center justify-center text-emerald-300">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-fg-soft font-medium">Estimasi Gross Profit</p>
              <p className="text-lg font-bold text-emerald-300 tabular-nums">
                Rp {totalGrossProfit > 1000000 ? `${(totalGrossProfit / 1000000).toFixed(1)} Jt` : totalGrossProfit.toLocaleString('id-ID')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TOP SECTION: FORMULIR INPUT PENJUALAN LOKAL (FULL-WIDTH ATAS) */}
      <Card className="glass-panel border-line">
        <CardHeader className="pb-3 border-b border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center text-gold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-fg">Formulir Faktur Penjualan Emas Lokal</CardTitle>
                <CardDescription className="text-xs text-fg-soft">Input transaksi penjualan domestik, pemotongan stok brankas vault, dan auto-jurnal SAK EMKM</CardDescription>
              </div>
            </div>

            {/* Payment Mode Selector Pills */}
            <div className="flex items-center bg-surface-raised p-0.5 rounded-lg border border-line text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => { setPaymentMode('cash'); setFormData(prev => ({ ...prev, paymentSourceAccount: '1111-IDR', paymentSourceAccountName: 'Bank BCA IDR' })); }}
                className={`px-3 py-1.5 rounded-md transition-colors ${paymentMode === 'cash' ? 'bg-gold text-canvas font-bold shadow-sm' : 'text-fg-soft hover:text-fg'}`}
              >
                💵 Tunai / Bank Lunas
              </button>
              <button
                type="button"
                onClick={() => { setPaymentMode('credit'); setFormData(prev => ({ ...prev, paymentSourceAccount: '1130', paymentSourceAccountName: 'Piutang Usaha Lokal (1130)' })); }}
                className={`px-3 py-1.5 rounded-md transition-colors ${paymentMode === 'credit' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-fg-soft hover:text-fg'}`}
              >
                ⏱️ Tempo (Piutang)
              </button>
              <button
                type="button"
                onClick={() => { setPaymentMode('dp'); setFormData(prev => ({ ...prev, paymentSourceAccount: '1111-IDR', paymentSourceAccountName: 'Bank BCA IDR (Uang Muka)' })); }}
                className={`px-3 py-1.5 rounded-md transition-colors ${paymentMode === 'dp' ? 'bg-amber-500 text-canvas font-bold shadow-sm' : 'text-fg-soft hover:text-fg'}`}
              >
                🪙 Uang Muka (DP)
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Baris 1: Informasi Dokumen & Customer (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-fg-soft">No. Faktur Penjualan *</Label>
                <Input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                  className="form-input text-xs font-mono font-bold text-gold mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Tanggal Faktur *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="form-input text-xs mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Pilih Customer (Master)</Label>
                <div className="mt-1">
                  <Combobox
                    options={customersList.map(c => ({ value: c.id, label: `${c.name} (${c.phone || '-'})` }))}
                    value={formData.selectedCustomerId}
                    onChange={handleCustomerSelect}
                    placeholder="-- Cari Customer Lokal --"
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Nama Customer / Toko Emas *</Label>
                <Input
                  type="text"
                  placeholder="Nama Customer"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="form-input text-xs mt-1"
                  required
                />
              </div>
            </div>

            {/* Baris 2: Kontak Customer, Produk Emas & Brankas Vault Asal (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-fg-soft">No. Telp / Alamat Customer</Label>
                <Input
                  type="text"
                  placeholder="No. Telp & Alamat"
                  value={`${formData.customerPhone || ''} ${formData.customerAddress ? `(${formData.customerAddress})` : ''}`}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="form-input text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Item Logam Mulia *</Label>
                <div className="mt-1">
                  <Combobox
                    options={masterItemsList.map(i => ({ value: i.code, label: i.name }))}
                    value={formData.itemCode}
                    onChange={handleItemSelect}
                    placeholder="-- Pilih Produk Emas --"
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Brankas Vault Asal (Stok Keluar) *</Label>
                <Select
                  value={formData.sourceVault}
                  onChange={(e) => {
                    const v = e.target.value;
                    const vName = v === '1157' ? 'Vault Utama PT TAN (Akun 1157)' : v === '1160' ? 'Vault Perhiasan (Akun 1160)' : 'Vault Scrap (Akun 1152)';
                    setFormData({ ...formData, sourceVault: v, sourceVaultName: vName });
                  }}
                  className="form-input text-xs mt-1"
                >
                  <option value="1157">Vault Utama LM (1157 - Emas Murni)</option>
                  <option value="1160">Vault Perhiasan (1160 - Siap Ekspor/Lokal)</option>
                  <option value="1152">Vault Scrap (1152 - Leburan Teruji)</option>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-fg-soft">No. PO Referensi Customer</Label>
                <Input
                  type="text"
                  placeholder="PO Customer (Opsional)"
                  value={formData.customerPONumber}
                  onChange={(e) => setFormData({ ...formData, customerPONumber: e.target.value })}
                  className="form-input text-xs mt-1 font-mono"
                />
              </div>
            </div>

            {/* Baris 3: Kalkulasi Gramasi, Harga Jual, HPP & Live Summary (5 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <Label className="text-xs text-fg-soft">Berat (Gram) *</Label>
                <NumberInput
                  allowDecimal
                  value={formData.quantityGrams}
                  onChange={(val) => setFormData({ ...formData, quantityGrams: val })}
                  className="form-input text-xs text-right font-bold text-emerald-400 mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Harga Jual/g (IDR) *</Label>
                <NumberInput
                  value={formData.unitPriceIDR}
                  onChange={(val) => setFormData({ ...formData, unitPriceIDR: val })}
                  className="form-input text-xs text-right font-bold text-gold mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Estimasi HPP/g (IDR)</Label>
                <NumberInput
                  value={formData.estimatedCostPerGram}
                  onChange={(val) => setFormData({ ...formData, estimatedCostPerGram: val })}
                  className="form-input text-xs text-right text-fg-soft mt-1"
                />
              </div>

              <div className="lg:col-span-2 p-3 bg-surface-raised rounded-lg border border-line flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-fg-soft">Total Nilai Faktur (Bebas PPN):</p>
                  <p className="text-base font-bold text-gold tabular-nums">
                    Rp {totalAmount.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-fg-soft">Estimasi Margin Laba:</p>
                  <p className="text-xs font-semibold text-emerald-400 tabular-nums">
                    + Rp {estimatedGrossProfit.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>

            {/* Baris 4: Nomor Seri Bar, Logistik & Serah Terima (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-fg-soft">Nomor Seri Sertifikat / Bar ID</Label>
                  <span className="text-[11px] text-sky-400">
                    Terdeteksi: <strong>{detectedBarCount} Batang/Keping</strong>
                  </span>
                </div>
                <Input
                  type="text"
                  placeholder="Contoh: ANTAM-998812, ANTAM-998813 (Pisahkan koma/enter)"
                  value={formData.barSerialNumbers}
                  onChange={(e) => setFormData({ ...formData, barSerialNumbers: e.target.value })}
                  className="form-input text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Metode Penyerahan Fisik</Label>
                <Select
                  value={formData.deliveryMethod}
                  onChange={(e) => setFormData({ ...formData, deliveryMethod: e.target.value })}
                  className="form-input text-xs mt-1"
                >
                  <option value="KURIR_INTERNAL">🚗 Kurir Internal PT TAN</option>
                  <option value="COUNTER">🏛️ Diambil Sendiri di Vault</option>
                  <option value="EXPEDITION">🛡️ Ekspedisi Pengawalan Berasuransi</option>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Nama Kurir / Penerima</Label>
                <Input
                  type="text"
                  value={formData.courierName}
                  onChange={(e) => setFormData({ ...formData, courierName: e.target.value })}
                  className="form-input text-xs mt-1"
                />
              </div>
            </div>

            {/* Baris 5: Otorisasi & Tombol Submit (Grid 2 Cols) */}
            <div className="pt-2 border-t border-line grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-8 p-3 bg-gold/[0.06] rounded-md border border-gold/20 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="ownerApprovalCheck"
                  checked={formData.ownerApproved}
                  onChange={(e) => setFormData({ ...formData, ownerApproved: e.target.checked })}
                  className="mt-0.5 accent-gold cursor-pointer"
                />
                <label htmlFor="ownerApprovalCheck" className="text-xs text-fg leading-tight cursor-pointer">
                  <strong>Otorisasi Pengeluaran Logam Mulia:</strong> Disetujui oleh Direktur Utama / Pemilik PT TAN untuk pengeluaran fisik brankas vault & penagihan.
                </label>
              </div>

              <div className="lg:col-span-4">
                <Button type="submit" className="w-full btn-primary text-xs font-bold py-3 flex items-center justify-center gap-2">
                  <Receipt className="w-4 h-4" /> Terbitkan Faktur & Auto-Jurnal SAK EMKM
                </Button>
              </div>
            </div>

          </form>
        </CardContent>
      </Card>

      {/* BOTTOM SECTION: REGISTER RIWAYAT PENJUALAN LOKAL (FULL-WIDTH BAWAH) */}
      <Card className="glass-panel border-line">
        <CardHeader className="pb-3 border-b border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-fg">Register Penjualan Emas Lokal</CardTitle>
              <CardDescription className="text-xs text-fg-soft">Daftar lengkap transaksi penjualan, pengeluaran vault, surat jalan, dan cetak PDF resmi</CardDescription>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-soft" />
                <Input
                  type="text"
                  placeholder="Cari Faktur / Customer..."
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
                  Semua ({salesList.length})
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
                <TableHead>Tanggal</TableHead>
                <TableHead>Customer / Pembeli</TableHead>
                <TableHead>Produk & Seri Bar</TableHead>
                <TableHead>Brankas Vault</TableHead>
                <TableHead className="text-right">Berat (g)</TableHead>
                <TableHead className="text-right">Harga / g</TableHead>
                <TableHead className="text-right">Total Faktur (IDR)</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-16 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableEmpty colSpan={11} message="Belum ada transaksi penjualan lokal yang tercatat." />
              ) : (
                filteredSales.map((sale, idx) => (
                  <TableRow key={sale.id || idx} className="hover:bg-gold/[0.03]">
                    <TableCell className="text-center font-mono text-xs">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-mono font-bold text-xs text-gold">{sale.invoiceNo}</div>
                      <div className="text-[10px] text-fg-soft">{sale.soNumber || '-'}</div>
                    </TableCell>
                    <TableCell className="text-xs text-fg">{sale.date}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-fg">{sale.customerName}</div>
                      <div className="text-[10px] text-fg-soft">{sale.customerPhone || 'Lokal'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-fg font-medium">{sale.itemName}</div>
                      <div className="text-[10px] font-mono text-sky-400">{sale.barSerialNumbers || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-line text-fg-soft">
                        {sale.sourceVault === '1157' ? 'Vault Utama (1157)' : sale.sourceVault === '1160' ? 'Vault Perhiasan (1160)' : 'Vault Scrap (1152)'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-emerald-400 tabular-nums">
                      {Number(sale.quantityGrams || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })} g
                    </TableCell>
                    <TableCell className="text-right text-xs text-fg-soft tabular-nums">
                      Rp {Number(sale.unitPriceIDR || 0).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-fg tabular-nums">
                      Rp {Number(sale.totalAmountIDR || 0).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sale.paymentStatus === 'PAID' ? 'emerald' : 'sky'} className="text-[10px] px-2 py-0.5 font-bold">
                        {sale.paymentStatus === 'PAID' ? 'LUNAS' : 'TEMPO'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 p-0 text-fg-soft hover:text-fg hover:bg-surface-raised cursor-pointer mx-auto"
                            aria-label={`Aksi untuk ${sale.invoiceNo}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 z-[1100]">
                          <DropdownMenuItem
                            onClick={() => setSelectedSaleDetail(sale)}
                            className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                          >
                            <FileText className="h-4 w-4" />
                            <span>Lihat Detail & Jurnal</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => exportLocalSalesInvoicePdf(sale)}
                            className="flex items-center gap-2 cursor-pointer text-gold hover:bg-gold/10 focus:bg-gold/10 focus:text-gold-light"
                          >
                            <Printer className="h-4 w-4 text-gold" />
                            <span>Cetak Faktur Penjualan</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => exportLocalDeliveryOrderPdf(sale)}
                            className="flex items-center gap-2 cursor-pointer text-sky-light hover:bg-sky/10 focus:bg-sky/10 focus:text-sky-light"
                          >
                            <Truck className="h-4 w-4 text-sky-light" />
                            <span>Cetak Surat Jalan (DO)</span>
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

      {/* Detail Modal (Audit Trail & Jurnal Breakdown) */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface border border-line rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <Badge variant="gold" className="text-[10px] font-mono">DETAIL TRANSAKSI PENJUALAN</Badge>
                <h3 className="text-lg font-bold text-fg mt-1">{selectedSaleDetail.invoiceNo}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                className="p-1 rounded-lg hover:bg-surface-raised text-fg-soft"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-fg-soft font-medium">Pelanggan / Customer:</p>
                <p className="font-bold text-fg text-sm">{selectedSaleDetail.customerName}</p>
                <p className="text-fg-soft">{selectedSaleDetail.customerPhone} | {selectedSaleDetail.customerAddress}</p>
              </div>
              <div className="space-y-1">
                <p className="text-fg-soft font-medium">Tanggal & Syarat Bayar:</p>
                <p className="font-bold text-fg">{selectedSaleDetail.date} ({selectedSaleDetail.paymentTerms})</p>
                <p className="text-fg-soft">Rekening Sumber: {selectedSaleDetail.paymentSourceAccountName}</p>
              </div>
            </div>

            {/* Item Breakdown Box */}
            <div className="p-3 bg-surface-raised rounded-lg border border-line text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-fg-soft">Produk Logam Mulia:</span>
                <span className="font-bold text-fg">{selectedSaleDetail.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Nomor Seri / Bar ID:</span>
                <span className="font-mono text-sky-400 font-bold">{selectedSaleDetail.barSerialNumbers || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Brankas Vault Asal (Stok Keluar):</span>
                <span className="font-bold text-emerald-400">{selectedSaleDetail.sourceVaultName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Berat Gramasi:</span>
                <span className="font-bold text-emerald-400">{Number(selectedSaleDetail.quantityGrams).toLocaleString('id-ID')} gram</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Harga Satuan / gram:</span>
                <span className="font-bold text-fg">Rp {Number(selectedSaleDetail.unitPriceIDR).toLocaleString('id-ID')} / g</span>
              </div>
              <div className="border-t border-line pt-2 flex justify-between text-sm font-bold">
                <span className="text-fg">Total Nilai Faktur:</span>
                <span className="text-gold">Rp {Number(selectedSaleDetail.totalAmountIDR).toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Jurnal Akuntansi SAK EMKM Box */}
            <div className="p-3 bg-gold/[0.06] rounded-lg border border-gold/20 text-xs space-y-1.5">
              <p className="font-bold text-gold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Posting Jurnal Otomatis SAK EMKM:
              </p>
              <div className="pl-5 space-y-1 font-mono text-[11px] text-fg">
                <p>1. <strong>Debet</strong>: {selectedSaleDetail.paymentSourceAccount} ({selectedSaleDetail.paymentSourceAccountName}) Rp {Number(selectedSaleDetail.totalAmountIDR).toLocaleString('id-ID')}</p>
                <p>&nbsp;&nbsp;&nbsp;<strong>Kredit</strong>: 4111 (Penjualan Gold Bar) Rp {Number(selectedSaleDetail.totalAmountIDR).toLocaleString('id-ID')}</p>
                <p>2. <strong>Debet</strong>: 5110 (Harga Pokok Penjualan) Rp {Number(selectedSaleDetail.cogsAmountIDR || 0).toLocaleString('id-ID')}</p>
                <p>&nbsp;&nbsp;&nbsp;<strong>Kredit</strong>: {selectedSaleDetail.sourceVault} ({selectedSaleDetail.sourceVaultName}) Rp {Number(selectedSaleDetail.cogsAmountIDR || 0).toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button
                type="button"
                onClick={() => exportLocalDeliveryOrderPdf(selectedSaleDetail)}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5 text-sky-400" /> Cetak Surat Jalan
              </Button>
              <Button
                type="button"
                onClick={() => exportLocalSalesInvoicePdf(selectedSaleDetail)}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Faktur PDF
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
