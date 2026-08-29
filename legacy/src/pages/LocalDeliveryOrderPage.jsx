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
  X
} from 'lucide-react';
import {
  getLocalSalesOrders,
  getLocalDeliveryOrders,
  saveLocalDeliveryOrders,
  getJournalEntries,
  saveJournalEntries,
  getNextReferenceNumber,
  getMasterItems,
  getCustomers
} from '../services/storageService';
import { exportLocalDeliveryOrderPdf } from '../services/pdfService';
import {
  Button,
  Input,
  Label,
  Select,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
    selectedSOId: '',
    soNumber: 'SO-LOKAL-2026-001',
    invoiceNo: 'INV-LOKAL-2026-001',
    selectedCustomerId: '',
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

  const loadInitialData = () => {
    setSalesOrders(getLocalSalesOrders() || []);
    setDeliveryOrders(getLocalDeliveryOrders() || []);

    const custs = getCustomers() || [];
    const defaultCusts = [
      { id: 'CUST-LOKAL-01', code: 'CUST-LOKAL-01', name: 'Toko Emas Gadjah Berlian (Surabaya)', phone: '0812-3456-7890', address: 'Jl. Pasar Atom Mall Blok A No. 12, Surabaya' },
      { id: 'CUST-LOKAL-02', code: 'CUST-LOKAL-02', name: 'PT Mulia Jaya Logam (Bandung)', phone: '0813-9876-5432', address: 'Jl. Otista No. 88, Bandung' },
      { id: 'CUST-LOKAL-03', code: 'CUST-LOKAL-03', name: 'Toko Emas Sumber Rejeki (Cikini Jakarta)', phone: '0811-2233-4455', address: 'Gold Center Cikini Blok B-14, Jakarta Pusat' }
    ];
    const combinedCusts = [...defaultCusts];
    custs.forEach(c => {
      if (!combinedCusts.some(cc => cc.id === c.id || cc.code === c.code)) {
        combinedCusts.push(c);
      }
    });
    setCustomersList(combinedCusts);

    const items = getMasterItems() || [];
    const defaultItems = [
      { id: 'LM-ANTAM-1000G', code: 'LM-ANTAM-1000G', name: 'Emas Batangan Antam 1kg (999.9)', vaultAccount: '1157', vaultName: 'Vault Utama PT TAN (Akun 1157)' },
      { id: 'LM-ANTAM-100G', code: 'LM-ANTAM-100G', name: 'Emas Batangan Antam 100g (999.9)', vaultAccount: '1157', vaultName: 'Vault Utama PT TAN (Akun 1157)' },
      { id: 'JEWELRY-LOKAL-750', code: 'JEWELRY-LOKAL-750', name: 'Perhiasan Emas 18K (Karat 750)', vaultAccount: '1160', vaultName: 'Vault Perhiasan (Akun 1160)' },
      { id: 'GOLD-SCRAP-LEBUR', code: 'GOLD-SCRAP-LEBUR', name: 'Emas Scrap / Hasil Leburan Teruji', vaultAccount: '1152', vaultName: 'Vault Scrap & Leburan (Akun 1152)' }
    ];
    const combinedItems = [...defaultItems];
    items.forEach(it => {
      if (!combinedItems.some(c => c.code === it.code || c.id === it.id)) {
        combinedItems.push(it);
      }
    });
    setMasterItemsList(combinedItems);
  };

  // Handler Tarik Data dari Sales Order (SO)
  const handleSOSelect = (soId) => {
    const foundSO = salesOrders.find(so => so.id === soId || so.soNumber === soId);
    if (foundSO) {
      setForm(prev => ({
        ...prev,
        selectedSOId: soId,
        soNumber: foundSO.soNumber || soId,
        customerPONumber: foundSO.customerPONumber || prev.customerPONumber || '',
        customerName: foundSO.customerName,
        customerPhone: foundSO.customerPhone || prev.customerPhone,
        customerAddress: foundSO.customerAddress || prev.customerAddress,
        recipientName: foundSO.customerName,
        itemCode: foundSO.itemCode || prev.itemCode,
        itemName: foundSO.itemName || prev.itemName,
        sourceVault: foundSO.sourceVault || '1157',
        sourceVaultName: foundSO.sourceVaultName || 'Vault Utama PT TAN (Akun 1157)',
        netWeightGram: foundSO.quantityGrams || 1000,
        grossWeightGram: Math.round((foundSO.quantityGrams || 1000) * 1.15)
      }));
      showModal({
        variant: 'success',
        title: `✅ Data Ditarik Dari ${foundSO.soNumber}`,
        message: `• Customer: ${foundSO.customerName}\n• Item: ${foundSO.itemName}\n• Berat: ${foundSO.quantityGrams} gram\nForm Surat Jalan pengeluaran gudang telah terisi otomatis.`
      });
    }
  };

  const handleCustomerSelect = (custId) => {
    const found = customersList.find(c => c.id === custId || c.code === custId);
    if (found) {
      setForm(prev => ({
        ...prev,
        selectedCustomerId: custId,
        customerName: found.name,
        customerPhone: found.phone || prev.customerPhone,
        customerAddress: found.address || prev.customerAddress,
        recipientName: found.name
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
        sourceVault: foundItem.vaultAccount || '1157',
        sourceVaultName: foundItem.vaultName || 'Vault Utama PT TAN (Akun 1157)'
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.doNumber || !form.customerName || !form.netWeightGram || form.netWeightGram <= 0) {
      showModal({
        variant: 'warning',
        title: 'Data Belum Lengkap',
        message: 'Mohon lengkapi No. Surat Jalan, Nama Customer, dan Berat Emas yang dikeluarkan.'
      });
      return;
    }

    const netWeight = Number(form.netWeightGram || 0);
    const costPerG = Number(form.estimatedCostPerGram || 1300000);
    const totalCOGS = netWeight * costPerG;

    const newDO = {
      id: form.doNumber,
      ...form,
      netWeightGram: netWeight,
      grossWeightGram: Number(form.grossWeightGram || netWeight * 1.15),
      cogsAmountIDR: totalCOGS,
      quantityGrams: netWeight,
      status: 'DELIVERED',
      createdAt: new Date().toISOString()
    };

    // 1. Simpan Surat Jalan Lokal
    const list = getLocalDeliveryOrders();
    list.unshift(newDO);
    await saveLocalDeliveryOrders(list);

    // 2. Auto-Post Jurnal HPP (Pengakuan HPP saat fisik keluar dari brankas vault)
    const journals = getJournalEntries();
    const entryNum = await getNextReferenceNumber('journal');
    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: form.date,
      description: `[HPP-SJ-LOKAL] Pengakuan HPP Surat Jalan ${newDO.doNumber} (Ref SO: ${newDO.soNumber || '-'}) - ${newDO.customerName} [${netWeight}g ${newDO.itemName} keluar dari ${form.sourceVaultName}]`,
      lines: [
        { accountCode: '5114', accountName: 'HPP - Logam Mulia Antam', debit: totalCOGS, credit: 0 },
        { accountCode: form.sourceVault, accountName: form.sourceVaultName, debit: 0, credit: totalCOGS }
      ],
      createdAt: new Date().toISOString()
    });
    await saveJournalEntries(journals);

    setDeliveryOrders(getLocalDeliveryOrders());
    showModal({
      variant: 'success',
      title: '✅ Surat Jalan Lokal Berhasil Diterbitkan',
      message: `• No. SJ      : ${newDO.doNumber}\n• Customer    : ${newDO.customerName}\n• Berat Emas  : ${netWeight} gram\n• Brankas Asal: ${form.sourceVaultName}\n• Auto-Jurnal : Debet HPP 5110 vs Kredit Persediaan Vault ${form.sourceVault} (Rp ${totalCOGS.toLocaleString('id-ID')})\n• Saldo fisik brankas vault telah otomatis dipotong di kartu stok gudang.`
    });

    // Reset Form for next input
    setForm(prev => ({
      ...prev,
      doNumber: `SJ-LOKAL-${Date.now().toString().slice(-6)}`,
      barSerialNumbers: '',
      securitySealNo: `SEAL-VAULT-${Date.now().toString().slice(-5)}`
    }));
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-fg">Formulir Surat Jalan & Pengeluaran Brankas Vault</CardTitle>
                <CardDescription className="text-xs text-fg-soft">Pencatatan serah terima fisik, nomor seri bar, segel pengaman, dan auto-jurnal HPP 5110</CardDescription>
              </div>
            </div>

            {/* Quick SO Pull Dropdown */}
            {salesOrders.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-fg-soft whitespace-nowrap">Tarik dari SO:</span>
                <Select
                  value={form.selectedSOId}
                  onChange={(e) => handleSOSelect(e.target.value)}
                  className="form-input text-xs w-56 font-mono"
                >
                  <option value="">-- Pilih Sales Order (SO) --</option>
                  {salesOrders.map(so => (
                    <option key={so.id || so.soNumber} value={so.id || so.soNumber}>
                      {so.soNumber} - {so.customerName} ({so.quantityGrams}g)
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            
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
                <Label className="text-xs text-fg-soft">Ref No. SO / Faktur</Label>
                <Input
                  type="text"
                  placeholder="SO-LOKAL / INV-LOKAL"
                  value={form.soNumber}
                  onChange={(e) => setForm({ ...form, soNumber: e.target.value })}
                  className="form-input text-xs font-mono mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Pelanggan / Toko Emas *</Label>
                <Input
                  type="text"
                  placeholder="Nama Customer"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="form-input text-xs mt-1"
                  required
                />
              </div>
            </div>

            {/* Baris 2: Produk Emas, Vault Asal & Berat Fisik (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-fg-soft">Item Logam Mulia *</Label>
                <div className="mt-1">
                  <Combobox
                    options={masterItemsList.map(i => ({ value: i.code, label: i.name }))}
                    value={form.itemCode}
                    onChange={handleItemSelect}
                    placeholder="-- Pilih Produk Emas --"
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Brankas Vault Asal (Stok Berkurang) *</Label>
                <Select
                  value={form.sourceVault}
                  onChange={(e) => {
                    const v = e.target.value;
                    const vName = v === '1157' ? 'Vault Utama PT TAN (Akun 1157)' : v === '1160' ? 'Vault Perhiasan (Akun 1160)' : 'Vault Scrap (Akun 1152)';
                    setForm({ ...form, sourceVault: v, sourceVaultName: vName });
                  }}
                  className="form-input text-xs mt-1"
                >
                  <option value="1157">Vault Utama LM (1157 - Emas Murni)</option>
                  <option value="1160">Vault Perhiasan (1160 - Siap Ekspor/Lokal)</option>
                  <option value="1152">Vault Scrap (1152 - Leburan Teruji)</option>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Berat Bersih / Net Weight (Gram) *</Label>
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

            {/* Baris 3: Keamanan, Seri Bar & Logistik (4 Kolom) */}
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
                <Select
                  value={form.deliveryMethod}
                  onChange={(e) => setForm({ ...form, deliveryMethod: e.target.value })}
                  className="form-input text-xs mt-1"
                >
                  <option value="KURIR_INTERNAL">🚗 Kurir Internal PT TAN</option>
                  <option value="COUNTER">🏛️ Diambil Sendiri di Loket Vault</option>
                  <option value="EXPEDITION">🛡️ Ekspedisi Pengawalan Berasuransi</option>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Nama Kurir / Penerima Serah Terima</Label>
                <Input
                  type="text"
                  value={form.courierName}
                  onChange={(e) => setForm({ ...form, courierName: e.target.value })}
                  className="form-input text-xs mt-1"
                />
              </div>
            </div>

            {/* Baris 4: Otorisasi & Tombol Submit */}
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
                <TableHead className="text-center">Aksi Dokumen</TableHead>
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
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => exportLocalDeliveryOrderPdf(doItem)}
                          title="Cetak Surat Jalan PDF (4 TTD)"
                          className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" /> Cetak SJ
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDODetail(doItem)}
                          title="Lihat Detail Surat Jalan & Jurnal"
                          className="p-1.5 rounded-md hover:bg-surface-raised text-fg-soft transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
