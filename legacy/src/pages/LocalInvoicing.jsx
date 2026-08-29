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
  TrendingUp
} from 'lucide-react';
import {
  getLocalSalesOrders,
  getLocalDeliveryOrders,
  getLocalInvoices,
  saveLocalInvoices,
  getJournalEntries,
  saveJournalEntries,
  getNextReferenceNumber,
  getMasterItems,
  getCustomers
} from '../services/storageService';
import { exportLocalSalesInvoicePdf } from '../services/pdfService';
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

  const [form, setForm] = useState({
    invoiceNo: '',
    soNumber: '',
    doNumber: '',
    customerPONumber: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    selectedCustomerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    itemCode: 'LM-ANTAM-1000G',
    itemName: 'Emas Batangan Antam 1kg (999.9)',
    quantityGrams: '',
    unitPriceIDR: '',
    downPaymentIDR: 0,
    taxFacility: 'BEBAS PPN PMK 48/2023',
    paymentSourceAccount: '1111-IDR',
    paymentSourceAccountName: 'Bank BCA IDR (Akun 1111-IDR)',
    paymentTerms: 'LUNAS (Transfer BCA)',
    barSerialNumbers: '',
    ownerApproved: true,
    ownerApprovedBy: 'Direktur Utama / Pemilik PT TAN',
    notes: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    setInvoices(getLocalInvoices() || []);
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
      { id: 'LM-ANTAM-1000G', code: 'LM-ANTAM-1000G', name: 'Emas Batangan Antam 1kg (999.9)' },
      { id: 'LM-ANTAM-100G', code: 'LM-ANTAM-100G', name: 'Emas Batangan Antam 100g (999.9)' },
      { id: 'JEWELRY-LOKAL-750', code: 'JEWELRY-LOKAL-750', name: 'Perhiasan Emas 18K (Karat 750)' },
      { id: 'GOLD-SCRAP-LEBUR', code: 'GOLD-SCRAP-LEBUR', name: 'Emas Scrap / Hasil Leburan Teruji' }
    ];
    const combinedItems = [...defaultItems];
    items.forEach(it => {
      if (!combinedItems.some(c => c.code === it.code || c.id === it.id)) {
        combinedItems.push(it);
      }
    });
    setMasterItemsList(combinedItems);
  };

  const handleCustomerSelect = (custId) => {
    const found = customersList.find(c => c.id === custId || c.code === custId);
    if (found) {
      setForm(prev => ({
        ...prev,
        selectedCustomerId: found.id || found.code,
        customerName: found.name,
        customerPhone: found.phone || '',
        customerAddress: found.address || ''
      }));
    }
  };

  // Handler Tarik Data dari Surat Jalan (DO)
  const handleDOSelect = (doNo) => {
    const foundDO = deliveryOrders.find(d => d.id === doNo || d.doNumber === doNo);
    if (foundDO) {
      setForm(prev => ({
        ...prev,
        doNumber: foundDO.doNumber || doNo,
        soNumber: foundDO.soNumber || prev.soNumber,
        customerPONumber: foundDO.customerPONumber || prev.customerPONumber || '',
        customerName: foundDO.customerName,
        customerPhone: foundDO.customerPhone || prev.customerPhone,
        customerAddress: foundDO.customerAddress || prev.customerAddress,
        itemCode: foundDO.itemCode || prev.itemCode,
        itemName: foundDO.itemName || prev.itemName,
        quantityGrams: foundDO.netWeightGram || foundDO.quantityGrams || 1000,
        barSerialNumbers: foundDO.barSerialNumbers || prev.barSerialNumbers
      }));
      showModal({
        variant: 'success',
        title: `✅ Data Ditarik Dari Surat Jalan ${foundDO.doNumber}`,
        message: `• Customer: ${foundDO.customerName}\n• Item: ${foundDO.itemName}\n• Berat Fisik: ${foundDO.netWeightGram || foundDO.quantityGrams} gram\n• Seri Bar: ${foundDO.barSerialNumbers || '-'}\nForm faktur penjualan telah terisi otomatis.`
      });
    }
  };

  // Kalkulasi Nilai Faktur
  const subtotal = (Number(form.quantityGrams) || 0) * (Number(form.unitPriceIDR) || 0);
  const dpDeduction = Number(form.downPaymentIDR || 0);
  const totalAmount = Math.max(0, subtotal - dpDeduction);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customerName || !form.quantityGrams || Number(form.quantityGrams) <= 0 || !form.unitPriceIDR || Number(form.unitPriceIDR) <= 0) {
      showModal({
        variant: 'warning',
        title: 'Data Belum Lengkap',
        message: 'Mohon lengkapi Nama Customer, Berat Emas (g), dan Harga Satuan per gram.'
      });
      return;
    }

    const finalInvoiceNo = (form.invoiceNo || '').trim() || (await getNextReferenceNumber('invoice')) || `INV-LOKAL-${Date.now().toString().slice(-6)}`;
    const isCash = paymentMode === 'cash';
    const isCredit = paymentMode === 'credit';
    const isDP = paymentMode === 'dp';

    const debitAccount = isCash
      ? (form.paymentSourceAccount || '1111-IDR')
      : isCredit
      ? '1130' // Piutang Usaha Lokal
      : '1111-IDR'; // Bank Masuk DP

    const creditAccount = isDP ? '2150' : '4111'; // 4111 Penjualan Gold Bar / 2150 Uang Muka

    const newInvoice = {
      id: finalInvoiceNo,
      invoiceNo: finalInvoiceNo,
      ...form,
      subtotalIDR: subtotal,
      totalAmountIDR: totalAmount,
      paidAmountIDR: isCash ? totalAmount : isDP ? dpDeduction : 0,
      remainingBalanceIDR: isCash ? 0 : totalAmount,
      paymentMode,
      paymentStatus: isCash ? 'PAID' : isCredit ? 'UNPAID' : 'PARTIAL',
      paymentSourceAccount: debitAccount,
      paymentTerms: isCash ? 'LUNAS (Transfer BCA)' : isCredit ? 'TEMPO (Piutang 30 Hari)' : 'UANG MUKA (DP)',
      createdAt: new Date().toISOString()
    };

    // 1. Simpan Faktur Penjualan Lokal
    const list = getLocalInvoices();
    list.unshift(newInvoice);
    await saveLocalInvoices(list);

    // 2. Auto Posting Jurnal SAK EMKM (Pengakuan Penjualan & Piutang / Bank)
    const journals = getJournalEntries();
    const entryNum = await getNextReferenceNumber('journal');
    const revAccountName = isDP ? 'Uang Muka Penjualan Emas Lokal' : 'Penjualan Logam Mulia Emas Batangan (Bebas PPN PMK 48/2023)';
    const debitAccountName = isCash ? 'Bank BCA IDR' : isCredit ? 'Piutang Usaha Lokal (1130)' : 'Bank BCA IDR (Uang Muka)';

    const journalLines = [
      { accountCode: debitAccount, accountName: debitAccountName, debit: totalAmount, credit: 0 }
    ];

    if (dpDeduction > 0) {
      journalLines.push({
        accountCode: '2150',
        accountName: 'Uang Muka Penjualan Emas Lokal (Pelunasan DP)',
        debit: dpDeduction,
        credit: 0
      });
    }

    journalLines.push({
      accountCode: creditAccount,
      accountName: revAccountName,
      debit: 0,
      credit: subtotal
    });

    journals.unshift({
      id: Date.now(),
      entryNumber: entryNum,
      date: form.date,
      description: `[FAKTUR-PENJUALAN-LOKAL] Faktur ${newInvoice.invoiceNo} - ${newInvoice.customerName} (${form.quantityGrams}g @ Rp ${Number(form.unitPriceIDR).toLocaleString()}) - ${newInvoice.paymentTerms}`,
      lines: journalLines,
      createdAt: new Date().toISOString()
    });
    await saveJournalEntries(journals);

    setInvoices(getLocalInvoices());
    showModal({
      variant: 'success',
      title: '✅ Faktur Penjualan Lokal Berhasil Diterbitkan',
      message: `• No. Faktur  : ${newInvoice.invoiceNo}\n• Customer    : ${newInvoice.customerName}\n• Total Nilai : Rp ${totalAmount.toLocaleString('id-ID')}\n• Auto-Jurnal : Debet ${debitAccount} vs Kredit ${creditAccount}\n• Fasilitas   : Bebas PPN (PMK 48/2023 Non-BKP Emas Batangan).`
    });

    // Reset Form for next input
    const nextInv = await getNextReferenceNumber('invoice');
    setForm(prev => ({
      ...prev,
      invoiceNo: nextInv,
      barSerialNumbers: ''
    }));
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

            {/* Quick DO Pull Dropdown & Payment Mode */}
            <div className="flex flex-wrap items-center gap-3">
              {deliveryOrders.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-fg-soft whitespace-nowrap">Tarik dari SJ:</span>
                  <Select
                    value={form.doNumber}
                    onChange={(e) => handleDOSelect(e.target.value)}
                    className="form-input text-xs w-52 font-mono"
                  >
                    <option value="">-- Pilih Surat Jalan (SJ) --</option>
                    {deliveryOrders.map(doItem => (
                      <option key={doItem.id || doItem.doNumber} value={doItem.doNumber || doItem.id}>
                        {doItem.doNumber} - {doItem.customerName}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

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
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            
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
                <Label className="text-xs text-fg-soft">Customer / Pembeli *</Label>
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

            {/* Baris 2: Item Emas, No Seri, Ref SJ/PO, Kontak (4 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <Label className="text-xs text-fg-soft">Ref No. Surat Jalan (DO)</Label>
                <Input
                  type="text"
                  placeholder="SJ-LOKAL-xxxx"
                  value={form.doNumber}
                  onChange={(e) => setForm({ ...form, doNumber: e.target.value })}
                  className="form-input text-xs font-mono mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-fg-soft">Kontak & Alamat Customer</Label>
                <Input
                  type="text"
                  value={`${form.customerPhone || ''} ${form.customerAddress ? `(${form.customerAddress})` : ''}`}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  className="form-input text-xs mt-1"
                />
              </div>
            </div>

            {/* Baris 3: Kalkulasi Nilai, DP & Total Faktur (5 Kolom) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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

              <div className="lg:col-span-2 p-3 bg-surface-raised rounded-lg border border-line flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-fg-soft">Total Tagihan Faktur (Bebas PPN):</p>
                  <p className="text-base font-bold text-gold tabular-nums">
                    Rp {totalAmount.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="emerald" className="text-[10px] px-1.5 py-0.5">
                    PMK 48/2023 NON-BKP
                  </Badge>
                </div>
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
                <TableHead className="text-center">Aksi Dokumen</TableHead>
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
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => exportLocalSalesInvoicePdf(inv)}
                          title="Cetak Faktur Penjualan PDF"
                          className="px-2.5 py-1 rounded bg-gold/10 hover:bg-gold/20 text-gold text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" /> Faktur
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceDetail(inv)}
                          title="Lihat Detail Faktur & Jurnal"
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
