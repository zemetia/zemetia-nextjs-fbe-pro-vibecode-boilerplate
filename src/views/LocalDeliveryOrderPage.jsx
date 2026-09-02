import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Printer,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Package,
  Award,
  Tag,
  Coins,
  Warehouse,
  History,
  AlertCircle,
  X,
  MoreHorizontal
} from 'lucide-react';
import {
  apiErrorMessage,
  metalLotService,
  partnerService,
  productService,
  salesDeliveryService,
  salesOrderService,
  storageLocationService
} from '../services';
import { exportLocalDeliveryOrderPdf } from '../services/pdfService';
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

export default function LocalDeliveryOrderPage() {
  const { modalProps, showModal } = useModal();
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [masterItemsList, setMasterItemsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDODetail, setSelectedDODetail] = useState(null);

  const [form, setForm] = useState({
    doNumber: 'SJ-LOKAL-2026-001',
    customerPONumber: 'PO-CUST-TGB-881',
    date: new Date().toISOString().split('T')[0],
    selectedSOId: 'SO-LOKAL-2026-001',
    soNumber: 'SO-LOKAL-2026-001',
    invoiceNo: 'INV-LOKAL-2026-001',
    selectedCustomerId: 'CUST-LOKAL-01',
    customerName: 'Toko Emas Gadjah Berlian (Surabaya)',
    customerPhone: '0812-3456-7890',
    customerAddress: 'Jl. Pasar Atom Mall Blok A No. 12, Surabaya',
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    sourceVault: '1157',
    sourceVaultName: 'Vault Utama PT TAN (Akun 1157)',
    netWeightGram: 1000,
    grossWeightGram: 1150,
    barSerialNumbers: 'ANTAM-998812',
    securitySealNo: 'SEAL-VAULT-88912',
    boxCount: 1,
    deliveryMethod: 'KURIR_INTERNAL', // 'KURIR_INTERNAL' | 'COUNTER' | 'EXPEDITION'
    courierName: 'Bpk. Budi (Kurir Internal PT TAN)',
    recipientName: 'Bpk. Hendra (Owner Toko Emas Gadjah)',
    estimatedCostPerGram: 1300000,
    notes: 'Pengeluaran fisik emas batangan Antam 1kg dari Vault Utama PT TAN untuk serah terima ke pembeli'
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  // Helper: map SalesDeliveryVO dari API ke bentuk legacy yang dibaca tabel & modal
  const toLegacyDO = (d) => ({
    id: d.id,
    doNumber: d.number,
    soNumber: d.orderNumber,
    invoiceNo: '',
    date: d.date,
    customerName: d.recipientName || '',
    customerPhone: '',
    customerAddress: '',
    itemName: '',
    barSerialNumbers: '',
    sourceVault: '1157',
    sourceVaultName: 'Vault Utama PT TAN (Akun 1157)',
    netWeightGram: d.totalWeightGram || 0,
    grossWeightGram: d.totalWeightGram || 0,
    securitySealNo: '',
    courierName: d.courierName || 'Kurir Internal',
    status: d.statusLabel,
    cogsAmountIDR: 0,
    createdAt: d.createdAt
  });

  const loadInitialData = async () => {
    try {
      // 1. Sales Orders lokal (dari database)
      const orders = await salesOrderService.listLocal({ limit: 100 });
      setSalesOrders((orders.items || []).map(so => ({
        id: so.id,
        soNumber: so.number,
        customerPONumber: so.customerPoNumber || '-',
        customerId: so.partnerId,
        customerName: so.partnerName,
        customerPhone: '',
        customerAddress: '',
        recipientName: so.partnerName,
        itemCode: so.first_item?.product.code ?? '',
        itemName: so.first_item?.product.name ?? '',
        sourceVault: '1157',
        sourceVaultName: 'Vault Utama PT TAN (Akun 1157)',
        quantityGrams: so.first_item?.weight_gram ?? 0,
        estimatedCostPerGram: 0
      })));

      // 2. Surat Jalan (dari database)
      const deliveries = await salesDeliveryService.list({ type: 'LOCAL', limit: 100 });
      setDeliveryOrders((deliveries.items || []).map(toLegacyDO));

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
        name: p.name,
        vaultAccount: p.form === 'JEWELRY' ? '1160' : p.form === 'SCRAP' ? '1152' : '1157',
        vaultName: p.form === 'JEWELRY' ? 'Vault Perhiasan (Akun 1160)' : p.form === 'SCRAP' ? 'Vault Scrap (Akun 1152)' : 'Vault Utama PT TAN (Akun 1157)'
      })));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat data surat jalan.'));
    }
  };

  // Handler Tarik Data dari Sales Order (SO) - SINGLE SOURCE OF TRUTH (PERSIS SURAT JALAN EKSPOR)
  const handleSOSelect = (soIdOrNumber) => {
    if (!soIdOrNumber || soIdOrNumber === 'MANUAL_FREE_INPUT') {
      setForm(prev => ({
        ...prev,
        selectedSOId: '',
        soNumber: soIdOrNumber === 'MANUAL_FREE_INPUT' ? '' : prev.soNumber,
        customerPONumber: '',
        selectedCustomerId: '',
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        recipientName: ''
      }));
      if (soIdOrNumber === 'MANUAL_FREE_INPUT') {
        toast.info('Mode Input Bebas (Tanpa SO) diaktifkan: Silakan pilih Customer & Item secara manual.');
      }
      return;
    }

    const foundSO = salesOrders.find(so => so.id === soIdOrNumber || so.soNumber === soIdOrNumber);
    if (foundSO) {
      const v = foundSO.sourceVault || '1157';
      const vName = foundSO.sourceVaultName || (v === '1160' ? 'Vault Perhiasan (Akun 1160)' : v === '1152' ? 'Vault Scrap (Akun 1152)' : 'Vault Utama PT TAN (Akun 1157)');
      const netWeight = Number(foundSO.quantityGrams || 1000);
      setForm(prev => ({
        ...prev,
        selectedSOId: foundSO.id || foundSO.soNumber,
        soNumber: foundSO.soNumber || soIdOrNumber,
        customerPONumber: foundSO.customerPONumber || '',
        selectedCustomerId: foundSO.customerId || '',
        customerName: foundSO.customerName,
        customerPhone: foundSO.customerPhone || '',
        customerAddress: foundSO.customerAddress || '',
        recipientName: foundSO.recipientName || foundSO.customerName,
        itemCode: foundSO.itemCode || prev.itemCode,
        itemName: foundSO.itemName || prev.itemName,
        sourceVault: v,
        sourceVaultName: vName,
        netWeightGram: netWeight,
        grossWeightGram: Math.round(netWeight * 1.15),
        estimatedCostPerGram: Number(foundSO.estimatedCostPerGram || prev.estimatedCostPerGram || 1300000)
      }));
      toast.success(`Data Customer & Barang berhasil ditarik dari SO ${foundSO.soNumber}`);
    } else {
      setForm(prev => ({
        ...prev,
        selectedSOId: soIdOrNumber,
        soNumber: soIdOrNumber
      }));
    }
  };

  const handleCustomerSelect = (val) => {
    if (!val) {
      setForm(prev => ({
        ...prev,
        selectedCustomerId: '',
        customerName: '',
        recipientName: ''
      }));
      return;
    }
    const found = customersList.find(c => c.name === val || c.id === val || c.code === val);
    if (found) {
      setForm(prev => ({
        ...prev,
        selectedCustomerId: found.id || found.code,
        customerName: found.name,
        customerPhone: found.phone || prev.customerPhone,
        customerAddress: found.address || prev.customerAddress,
        recipientName: found.name
      }));
    } else {
      setForm(prev => ({
        ...prev,
        selectedCustomerId: '',
        customerName: val,
        recipientName: val
      }));
    }
  };

  const handleItemSelect = (selectedCode) => {
    const foundItem = masterItemsList.find(i => i.code === selectedCode || i.id === selectedCode);
    if (foundItem) {
      setForm(prev => ({
        ...prev,
        itemCode: foundItem.code || selectedCode,
        itemName: foundItem.name || selectedCode,
        sourceVault: foundItem.vaultAccount || prev.sourceVault || '1157',
        sourceVaultName: foundItem.vaultName || prev.sourceVaultName || 'Vault Utama PT TAN (Akun 1157)'
      }));
    } else if (selectedCode) {
      setForm(prev => ({
        ...prev,
        itemCode: selectedCode,
        itemName: selectedCode
      }));
    }
  };

  const handleVaultSelect = (val) => {
    const vName = val === '1157' ? 'Vault Utama PT TAN (Akun 1157)' : val === '1160' ? 'Vault Perhiasan (Akun 1160)' : val === '1152' ? 'Vault Scrap (Akun 1152)' : `Vault Akun ${val}`;
    setForm(prev => ({ ...prev, sourceVault: val, sourceVaultName: vName }));
  };

  const handleDeliveryMethodSelect = (val) => {
    let defaultCourier = form.courierName;
    if (val === 'KURIR_INTERNAL') {
      defaultCourier = 'Bpk. Budi (Kurir Internal PT TAN)';
    } else if (val === 'COUNTER') {
      defaultCourier = form.customerName ? `Diambil Sendiri (${form.customerName})` : 'Diambil Sendiri di Loket Vault';
    } else if (val === 'EXPEDITION') {
      defaultCourier = 'Brinks Global Secured Transport';
    }
    setForm(prev => ({
      ...prev,
      deliveryMethod: val,
      courierName: defaultCourier
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.doNumber || !form.customerName || !form.netWeightGram || form.netWeightGram <= 0) {
      toast.warning('Mohon lengkapi No. Surat Jalan, Nama Customer, dan Berat Emas yang dikeluarkan.');
      return;
    }

    try {
      // Cari SO & item-nya dari database
      const selectedSO = salesOrders.find(so => so.id === form.selectedSOId || so.soNumber === form.soNumber);
      if (!selectedSO) {
        toast.warning('Pilih Sales Order (SO) terlebih dahulu untuk menarik data customer & barang.');
        return;
      }

      const soDetail = await salesOrderService.detailLocal(selectedSO.id);
      const orderItem = soDetail.items[0];
      if (!orderItem) {
        toast.warning('SO ini belum punya baris barang.');
        return;
      }

      // Cari lot stok tersedia untuk produk ini
      const lots = await metalLotService.list({ in_stock: true, limit: 100 });
      const matchingLot = (lots.items || []).find(l => l.productId === orderItem.productId && !l.isDepleted);
      if (!matchingLot) {
        toast.warning('Tidak ada lot stok tersedia untuk produk ini — pastikan stok sudah masuk via TTB terlebih dahulu.');
        return;
      }
      const locations = await storageLocationService.list();
      const location = locations[0];
      if (!location) {
        toast.warning('Belum ada lokasi penyimpanan aktif.');
        return;
      }

      // Buat Surat Jalan (draft) lalu konfirmasi — mutasi ISSUE & jurnal HPP lahir di sini
      const delivery = await salesDeliveryService.create({
        type: 'LOCAL',
        order_id: selectedSO.id,
        date: form.date,
        recipient_name: form.recipientName || form.customerName,
        delivery_method: form.deliveryMethod,
        courier_name: form.courierName || undefined,
        seal_number: form.securitySealNo || undefined,
        box_count: form.boxCount || 1,
        lines: [{
          order_item_id: orderItem.id,
          lot_id: matchingLot.id,
          location_id: location.id,
          gross_weight_gram: Number(form.netWeightGram),
          purity_percent: Number(orderItem.purityPercent)
        }],
        charges: [],
        notes: form.notes || undefined
      });
      await salesDeliveryService.confirm(delivery.id, 'LOCAL');

      // Muat ulang register dari database
      const deliveries = await salesDeliveryService.list({ type: 'LOCAL', limit: 100 });
      setDeliveryOrders((deliveries.items || []).map(toLegacyDO));

      showModal({
        variant: 'success',
        title: '✅ Surat Jalan Lokal Berhasil Diterbitkan',
        message: `• No. SJ      : ${delivery.number}\n• Ref SO      : ${selectedSO.soNumber}\n• Customer    : ${selectedSO.customerName}\n• Produk      : ${orderItem.productName}\n• Berat Fisik : ${Number(form.netWeightGram).toLocaleString('id-ID')} gram keluar dari stok\n• Auto-Jurnal : Debet HPP vs Kredit Persediaan (dictatat saat konfirmasi), saldo stok vault otomatis terpotong.`
      });

      // Reset Form for next input
      setForm(prev => ({
        ...prev,
        doNumber: '',
        barSerialNumbers: '',
        securitySealNo: ''
      }));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menerbitkan surat jalan lokal.'));
    }
  };

  // Filtered List
  const filteredDOs = deliveryOrders.filter(d => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDO = d.doNumber?.toLowerCase().includes(q);
      const matchCust = d.customerName?.toLowerCase().includes(q);
      const matchSO = d.soNumber?.toLowerCase().includes(q);
      const matchBar = d.barSerialNumbers?.toLowerCase().includes(q);
      return matchDO || matchCust || matchSO || matchBar;
    }
    return true;
  });

  const totalGramsOut = deliveryOrders.reduce((sum, d) => sum + Number(d.netWeightGram || d.quantityGrams || 0), 0);

  // Combobox Options - Format informatif persis Surat Jalan Ekspor
  const soOptions = [
    { value: '', label: '-- (Pilih Sales Order Untuk Tarik Otomatis Data Customer & Barang) --' },
    { value: 'MANUAL_FREE_INPUT', label: '✍️ -- Input Bebas (Tanpa SO / Ad-Hoc Counter) --' },
    ...salesOrders.map(so => ({
      value: so.soNumber || so.id,
      label: `[${so.soNumber}] (PO Cust: ${so.customerPONumber || '-'}) — ${so.customerName} (${so.quantityGrams || 0}g ${so.itemName || ''})`
    }))
  ];
  if (form.soNumber && !soOptions.some(o => o.value === form.soNumber)) {
    soOptions.push({ value: form.soNumber, label: form.soNumber });
  }

  const customerOptions = customersList.map(c => ({
    value: c.name,
    label: `${c.name} ${c.phone ? `(${c.phone})` : ''}`
  }));
  if (form.customerName && !customerOptions.some(o => o.value === form.customerName)) {
    customerOptions.unshift({ value: form.customerName, label: form.customerName });
  }

  const itemOptions = masterItemsList.map(i => ({
    value: i.code,
    label: `${i.name} (${i.code})`
  }));
  if (form.itemCode && !itemOptions.some(o => o.value === form.itemCode)) {
    itemOptions.unshift({ value: form.itemCode, label: form.itemName || form.itemCode });
  }

  const vaultOptions = [
    { value: '1157', label: 'Vault Utama LM (1157 - Emas Murni)' },
    { value: '1160', label: 'Vault Perhiasan (1160 - Siap Ekspor/Lokal)' },
    { value: '1152', label: 'Vault Scrap (1152 - Leburan Teruji)' }
  ];

  const deliveryMethodOptions = [
    { value: 'KURIR_INTERNAL', label: '🚗 Kurir Internal PT TAN' },
    { value: 'COUNTER', label: '🏛️ Diambil Sendiri di Loket Vault' },
    { value: 'EXPEDITION', label: '🛡️ Ekspedisi Pengawalan Berasuransi' }
  ];

  const defaultCourierOptions = [
    { value: 'Bpk. Budi (Kurir Internal PT TAN)', label: 'Bpk. Budi (Kurir Internal PT TAN)' },
    { value: 'Bpk. Budi Santoso', label: 'Bpk. Budi Santoso' },
    { value: 'Bpk. Hendra (Logistik PT TAN)', label: 'Bpk. Hendra (Logistik PT TAN)' },
    { value: 'Brinks Global Secured Transport', label: 'Brinks Global Secured Transport' },
    { value: 'Malca-Amit Secure Logistics', label: 'Malca-Amit Secure Logistics' },
    { value: 'Diambil Sendiri oleh Pembeli / Customer', label: 'Diambil Sendiri oleh Pembeli / Customer' }
  ];
  const courierOptions = [...defaultCourierOptions];
  if (form.courierName && !courierOptions.some(o => o.value === form.courierName)) {
    courierOptions.unshift({ value: form.courierName, label: form.courierName });
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="gold" className="px-2 py-0.5 text-xs font-semibold">GUDANG & LOGISTIK LOKAL</Badge>
            <Badge variant="emerald" className="px-2 py-0.5 text-xs">PENGELUARAN FISIK VAULT</Badge>
          </div>
          <h1 className="text-2xl font-bold text-fg mt-1">Surat Jalan Pengeluaran Emas Lokal (Delivery Order)</h1>
          <p className="text-sm text-fg-soft">
            Penerbitan surat jalan resmi & bukti serah terima fisik emas batangan/perhiasan dari brankas vault PT TAN ke kurir atau customer domestik.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-surface-raised rounded-xl border border-line flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-fg-soft font-medium">Total Fisik Emas Keluar (SJ)</p>
              <p className="text-base font-bold text-emerald-400 tabular-nums">
                {totalGramsOut.toLocaleString('id-ID')} <span className="text-xs font-normal">gram</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TOP SECTION: FORMULIR SURAT JALAN LOKAL (FULL-WIDTH ATAS) */}
      <Card className="glass-panel border-line">
        <CardHeader className="pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-fg">Formulir Surat Jalan & Pengeluaran Brankas Vault</CardTitle>
              <CardDescription className="text-xs text-fg-soft">Pencatatan serah terima fisik, nomor seri bar, segel pengaman, dan auto-jurnal HPP 5110</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* PULL FROM SALES ORDER (SO) - PERSIS SURAT JALAN EKSPOR (SINGLE SOURCE OF TRUTH) */}
            <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/[0.08] shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <Label className="text-xs font-bold text-sky-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Tarik Otomatis Dari Sales Order (SO) Penjualan Lokal:
                </Label>
                {form.selectedSOId ? (
                  <Badge variant="sky" className="text-[11px] font-semibold flex items-center gap-1 w-fit">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-300" /> Single Source of Truth: Terkunci ke {form.soNumber}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] text-fg-soft border-line w-fit">
                    Mode Input Bebas (Tanpa SO)
                  </Badge>
                )}
              </div>
              <Combobox
                value={form.selectedSOId || form.soNumber}
                onChange={handleSOSelect}
                placeholder="-- (Pilih Sales Order Untuk Tarik Otomatis Data Customer, Produk & Berat Emas) --"
                searchPlaceholder="Cari nomor SO, nama pelanggan/toko emas, produk emas..."
                emptyText="Sales Order tidak ditemukan di sistem / Firebase."
                options={soOptions}
                className="w-full text-xs font-mono"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-fg-soft">
                <span className="flex items-center gap-1.5">
                  <span>💡</span> Informasi Pelanggan, Ref PO Customer, Produk Emas, dan Brankas Vault otomatis ditarik dari SO tanpa double input.
                </span>
                {form.selectedSOId && (
                  <button
                    type="button"
                    onClick={() => handleSOSelect('MANUAL_FREE_INPUT')}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    Beralih ke Input Bebas (Tanpa SO)
                  </button>
                )}
              </div>
            </div>
            
            {/* Baris 1: Informasi Dokumen & Customer (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-fg-soft">No. Surat Jalan (DO) *</Label>
                <Input
                  type="text"
                  value={form.doNumber}
                  onChange={(e) => setForm({ ...form, doNumber: e.target.value })}
                  className="form-input text-xs font-mono font-bold text-sky-400 mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Tanggal Pengeluaran *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="form-input text-xs mt-1"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-fg-soft">Ref No. SO (Sales Order) *</Label>
                  {form.selectedSOId && (
                    <span className="text-[10px] text-sky-400 flex items-center gap-0.5 font-medium">
                      <ShieldCheck className="w-3 h-3" /> Terkunci
                    </span>
                  )}
                </div>
                <Input
                  type="text"
                  value={form.soNumber}
                  readOnly={Boolean(form.selectedSOId)}
                  onChange={(e) => setForm({ ...form, soNumber: e.target.value })}
                  className={`form-input text-xs font-mono mt-1 ${form.selectedSOId ? 'bg-surface-raised/70 border-sky-500/30 text-sky-300 font-bold cursor-not-allowed' : ''}`}
                  placeholder="SO-LOKAL-xxxx"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-fg-soft">Pelanggan / Toko Emas *</Label>
                  {form.selectedSOId ? (
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Dari SO (SSOT)
                    </span>
                  ) : (
                    <span className="text-[10px] text-fg-soft">Input Bebas</span>
                  )}
                </div>
                {form.selectedSOId ? (
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

            {/* Baris 2: Referensi PO Customer & Kontak (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <Label className="text-xs text-fg-soft">PIC / Penerima Toko Emas</Label>
                <Input
                  type="text"
                  placeholder="Nama PIC penerima"
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                  className="form-input text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">No. Telp / WhatsApp Pelanggan</Label>
                <Input
                  type="text"
                  placeholder="0812-xxxx-xxxx"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  className="form-input text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Alamat Toko / Pengiriman</Label>
                <Input
                  type="text"
                  placeholder="Alamat toko penerima..."
                  value={form.customerAddress}
                  onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                  className="form-input text-xs mt-1"
                />
              </div>
            </div>

            {/* Baris 3: Produk Emas, Vault Asal & Berat Fisik (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-fg-soft">Item Logam Mulia *</Label>
                  {form.selectedSOId && (
                    <span className="text-[10px] text-sky-400 font-medium flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Dari SO
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <Combobox
                    options={itemOptions}
                    value={form.itemCode}
                    onChange={handleItemSelect}
                    placeholder="-- Pilih Produk Emas --"
                    searchPlaceholder="Cari kode atau nama item…"
                    emptyText="Produk emas tidak ditemukan."
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-fg-soft">Brankas Vault Asal (Stok Berkurang) *</Label>
                  {form.selectedSOId && (
                    <span className="text-[10px] text-sky-400 font-medium flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Dari SO
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <Combobox
                    options={vaultOptions}
                    value={form.sourceVault}
                    onChange={handleVaultSelect}
                    placeholder="-- Pilih Vault Asal --"
                    searchPlaceholder="Cari nama atau kode vault…"
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-fg-soft">Berat Bersih / Net Weight (Gram) *</Label>
                  {form.selectedSOId && (
                    <span className="text-[10px] text-emerald-400 font-medium">Bisa Parsial</span>
                  )}
                </div>
                <NumberInput
                  allowDecimal
                  value={form.netWeightGram}
                  onChange={(val) => setForm({ ...form, netWeightGram: val, grossWeightGram: Math.round(val * 1.15) })}
                  className="form-input text-xs text-right font-bold text-emerald-400 mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Berat Kotor / Gross Box (Gram)</Label>
                <NumberInput
                  allowDecimal
                  value={form.grossWeightGram}
                  onChange={(val) => setForm({ ...form, grossWeightGram: val })}
                  className="form-input text-xs text-right text-fg-soft mt-1"
                />
              </div>
            </div>

            {/* Baris 4: Keamanan, Seri Bar & Logistik (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-fg-soft">Nomor Seri Sertifikat / Bar ID</Label>
                <Input
                  type="text"
                  placeholder="Contoh: ANTAM-998812, ANTAM-998813"
                  value={form.barSerialNumbers}
                  onChange={(e) => setForm({ ...form, barSerialNumbers: e.target.value })}
                  className="form-input text-xs font-mono mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Nomor Segel Brankas (Security Seal)</Label>
                <Input
                  type="text"
                  placeholder="SEAL-VAULT-88912"
                  value={form.securitySealNo}
                  onChange={(e) => setForm({ ...form, securitySealNo: e.target.value })}
                  className="form-input text-xs font-mono mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Metode Penyerahan Fisik</Label>
                <div className="mt-1">
                  <Combobox
                    options={deliveryMethodOptions}
                    value={form.deliveryMethod}
                    onChange={handleDeliveryMethodSelect}
                    placeholder="-- Pilih Metode Penyerahan --"
                    searchPlaceholder="Cari metode penyerahan…"
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Nama Kurir / Penerima Serah Terima</Label>
                <div className="mt-1">
                  <Combobox
                    options={courierOptions}
                    value={form.courierName}
                    onChange={(val) => setForm(prev => ({ ...prev, courierName: val }))}
                    placeholder="-- Pilih / Nama Kurir --"
                    searchPlaceholder="Cari nama kurir / pengantar…"
                    className="w-full text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Baris 5: Otorisasi & Tombol Submit */}
            <div className="pt-2 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="p-2.5 bg-sky-500/[0.06] rounded-md border border-sky-500/20 text-xs text-fg-soft flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span>Penerbitan surat jalan otomatis memotong stok brankas vault dan memposting jurnal HPP (Debet 5110 vs Kredit {form.sourceVault}).</span>
              </div>

              <Button type="submit" className="btn-primary text-xs font-bold py-2.5 px-6 flex items-center justify-center gap-2">
                <Truck className="w-4 h-4" /> Terbitkan Surat Jalan & Mutasi Gudang
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>

      {/* BOTTOM SECTION: REGISTER SURAT JALAN LOKAL (FULL-WIDTH BAWAH) */}
      <Card className="glass-panel border-line">
        <CardHeader className="pb-3 border-b border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-fg">Register Surat Jalan Pengeluaran Emas Lokal</CardTitle>
              <CardDescription className="text-xs text-fg-soft">Daftar pengeluaran fisik brankas vault dan pencetakan bukti serah terima resmi (4 TTD)</CardDescription>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-soft" />
              <Input
                type="text"
                placeholder="Cari No. SJ / Customer / Seri Bar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs form-input w-64"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">No</TableHead>
                <TableHead>No. Surat Jalan</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Customer / Penerima</TableHead>
                <TableHead>Produk & Seri Bar</TableHead>
                <TableHead>Brankas Vault</TableHead>
                <TableHead className="text-right">Net (g)</TableHead>
                <TableHead className="text-right">Gross (g)</TableHead>
                <TableHead>Kurir / Pengantar</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-16 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDOs.length === 0 ? (
                <TableEmpty colSpan={11} message="Belum ada surat jalan pengeluaran emas lokal yang diterbitkan." />
              ) : (
                filteredDOs.map((doItem, idx) => (
                  <TableRow key={doItem.id || idx} className="hover:bg-sky-500/[0.03]">
                    <TableCell className="text-center font-mono text-xs">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="font-mono font-bold text-xs text-sky-400">{doItem.doNumber}</div>
                      <div className="text-[10px] text-fg-soft">{doItem.soNumber || '-'}</div>
                    </TableCell>
                    <TableCell className="text-xs text-fg">{doItem.date}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-fg">{doItem.customerName}</div>
                      <div className="text-[10px] text-fg-soft">{doItem.customerPhone || 'Lokal'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-fg font-medium">{doItem.itemName}</div>
                      <div className="text-[10px] font-mono text-gold">{doItem.barSerialNumbers || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-line text-fg-soft">
                        {doItem.sourceVault === '1157' ? 'Vault Utama (1157)' : doItem.sourceVault === '1160' ? 'Vault Perhiasan (1160)' : 'Vault Scrap (1152)'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-emerald-400 tabular-nums">
                      {Number(doItem.netWeightGram || doItem.quantityGrams || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })} g
                    </TableCell>
                    <TableCell className="text-right text-xs text-fg-soft tabular-nums">
                      {Number(doItem.grossWeightGram || (doItem.netWeightGram || 0) * 1.15).toLocaleString('id-ID')} g
                    </TableCell>
                    <TableCell className="text-xs text-fg">
                      <div>{doItem.courierName || 'Kurir Internal'}</div>
                      <div className="text-[10px] text-fg-soft font-mono">{doItem.securitySealNo ? `Segel: ${doItem.securitySealNo}` : ''}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="emerald" className="text-[10px] px-2 py-0.5 font-bold">
                        {doItem.status || 'DELIVERED'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 p-0 text-fg-soft hover:text-fg hover:bg-surface-raised cursor-pointer mx-auto"
                            aria-label={`Aksi untuk ${doItem.doNumber}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 z-[1100]">
                          <DropdownMenuItem
                            onClick={() => setSelectedDODetail(doItem)}
                            className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                          >
                            <FileText className="h-4 w-4" />
                            <span>Lihat Detail & Jurnal</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => exportLocalDeliveryOrderPdf(doItem)}
                            className="flex items-center gap-2 cursor-pointer text-sky-light hover:bg-sky/10 focus:bg-sky/10 focus:text-sky-light"
                          >
                            <Printer className="h-4 w-4 text-sky-light" />
                            <span>Cetak Surat Jalan (4 TTD)</span>
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
      {selectedDODetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface border border-line rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <Badge variant="sky" className="text-[10px] font-mono">DETAIL SURAT JALAN GUDANG</Badge>
                <h3 className="text-lg font-bold text-fg mt-1">{selectedDODetail.doNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDODetail(null)}
                className="p-1 rounded-lg hover:bg-surface-raised text-fg-soft"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-surface-raised rounded-lg border border-line text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-fg-soft">Customer:</span>
                <span className="font-bold text-fg">{selectedDODetail.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Item Logam Mulia:</span>
                <span className="font-bold text-fg">{selectedDODetail.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Nomor Seri Sertifikat:</span>
                <span className="font-mono text-gold font-bold">{selectedDODetail.barSerialNumbers || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Brankas Vault Asal:</span>
                <span className="font-bold text-emerald-400">{selectedDODetail.sourceVaultName || selectedDODetail.sourceVault}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Berat Bersih (Net):</span>
                <span className="font-bold text-emerald-400">{Number(selectedDODetail.netWeightGram || selectedDODetail.quantityGrams).toLocaleString('id-ID')} gram</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-soft">Segel Pengaman & Kurir:</span>
                <span className="font-mono text-sky-400">{selectedDODetail.securitySealNo || '-'} ({selectedDODetail.courierName || 'Kurir'})</span>
              </div>
            </div>

            <div className="p-3 bg-gold/[0.06] rounded-lg border border-gold/20 text-xs space-y-1.5">
              <p className="font-bold text-gold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Posting Jurnal HPP SAK EMKM:
              </p>
              <div className="pl-5 space-y-1 font-mono text-[11px] text-fg">
                <p><strong>Debet</strong>: 5110 (Harga Pokok Penjualan) Rp {Number(selectedDODetail.cogsAmountIDR || 0).toLocaleString('id-ID')}</p>
                <p><strong>Kredit</strong>: {selectedDODetail.sourceVault || '1157'} (Persediaan Vault) Rp {Number(selectedDODetail.cogsAmountIDR || 0).toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button
                type="button"
                onClick={() => exportLocalDeliveryOrderPdf(selectedDODetail)}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Surat Jalan PDF
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
