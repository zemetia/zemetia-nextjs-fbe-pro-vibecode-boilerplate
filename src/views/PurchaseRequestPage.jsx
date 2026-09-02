import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  Printer,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Trash2,
  Layers,
  Tag,
  CheckSquare,
  Search,
  Filter,
  PlaneTakeoff,
  ShoppingCart,
  Flame,
  Package,
  Eye,
  Building2,
  DollarSign,
  UserCheck,
  FileText,
  Calendar,
  Sparkles,
  TrendingUp,
  X,
  MoreHorizontal
} from 'lucide-react';
import {
  getMasterItems,
  getSuppliers,
  createPurchaseOrder,
  getPurchaseRequests,
  createPurchaseRequest,
  approvePurchaseRequest,
  setPRConversionPrefill,
  markPRAsConverted
} from '../services/purchaseDb';
import { PurchaseRequestDTO } from '../dto';

import { exportPurchaseRequestPdf } from '../services/pdfService';
import { fetchBcaERateUSD, getStoredUsdRate } from '../services/currencyService';
import { UnitPicker } from '@/components/shared/UnitPicker';
import { computeAnchorEquivalent, findUnit } from '@/lib/unit-conversion';
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

export default function PurchaseRequestPage({ setActivePage }) {
  const { modalProps, showModal } = useModal();
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [masterItems, setMasterItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  // State for Detail Modal
  const [selectedPRDetail, setSelectedPRDetail] = useState(null);
  const [conversionExchangeRate, setConversionExchangeRate] = useState(getStoredUsdRate());

  // Form State
  const [form, setForm] = useState({
    prNumber: `PR-${Date.now().toString().slice(-6)}`,
    category: 'GOLD_IMPORT', // 'GOLD_IMPORT', 'GOLD_LOCAL', 'LAB_CHEMICALS', 'GENERAL_SUPPLIES'
    requestDate: new Date().toISOString().split('T')[0],
    requiredDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    department: 'Refinery & Lab QC',
    requesterName: 'Ahmad Fauzi (Head of Refinery)',
    priority: 'Normal', // 'Normal', 'Urgent'
    recommendedSupplier: 'YLG Bullion Singapore Pte Ltd',
    currency: 'USD',
    notes: 'Kebutuhan bahan baku emas impor LBMA untuk kontrak ekspor perhiasan 18K Dubai',
    items: [
      {
        itemId: 'LM-IMPORT-LBMA',
        itemCode: 'LM-IMPORT-LBMA',
        itemName: 'Emas Batangan 999.9 LBMA (Good Delivery Bar)',
        quantity: 1000,
        unit: 'gram',
        estUnitPrice: 1350000,
        notes: 'Standar kemurnian 99.99% terakreditasi LBMA'
      }
    ]
  });

  const [newItem, setNewItem] = useState({
    itemId: '',
    itemCode: '',
    itemName: '',
    quantity: 100,
    unit: 'gram',
    estUnitPrice: 1350000,
    notes: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    // 1. Master items & suppliers
    const items = await getMasterItems() || [];
    const supps = await getSuppliers() || [];
    setMasterItems(items);
    setSuppliers(supps);

    // 2. Fetch live rate for conversion reference
    const rateData = await fetchBcaERateUSD();
    if (rateData && rateData.rate) {
      setConversionExchangeRate(rateData.rate);
    }

    // 3. Purchase Requests
    setRequests(await getPurchaseRequests() || []);
  };

  // Helper Preset Kategori PR
  const handleCategoryPreset = (category) => {
    let dept = 'Refinery & Lab QC';
    let req = 'Ahmad Fauzi (Head of Refinery)';
    let supp = 'YLG Bullion Singapore Pte Ltd';
    let curr = 'USD';
    let notes = '';
    let initialItem = {
      itemId: 'LM-IMPORT-LBMA',
      itemCode: 'LM-IMPORT-LBMA',
      itemName: 'Emas Batangan 999.9 LBMA (Good Delivery Bar)',
      quantity: 1000,
      unit: 'gram',
      estUnitPrice: 1350000,
      notes: 'LBMA Bullion 99.99%'
    };

    if (category === 'GOLD_IMPORT') {
      dept = 'Trading & Ekspor Devisa';
      req = 'Ahmad Fauzi (Head of Refinery)';
      supp = 'YLG Bullion Singapore Pte Ltd';
      curr = 'USD';
      notes = 'Pengadaan Emas Murni Impor LBMA Valas USD untuk bahan baku ekspor perhiasan';
      initialItem = {
        itemId: 'LM-IMPORT-LBMA',
        itemCode: 'LM-IMPORT-LBMA',
        itemName: 'Emas Batangan 999.9 LBMA (YLG Singapore)',
        quantity: 1000,
        unit: 'gram',
        estUnitPrice: 1350000,
        notes: 'Standar kemurnian 99.99%'
      };
    } else if (category === 'GOLD_LOCAL') {
      dept = 'Gudang Brankas Vault';
      req = 'Budi Santoso (Vault Keeper)';
      supp = 'PT Pegadaian (Persero) Jakarta';
      curr = 'IDR';
      notes = 'Pengadaan Emas Batangan Lokal IDR (Antam / Pegadaian) untuk kebutuhan operasional';
      initialItem = {
        itemId: 'LM-PEGADAIAN-1KG',
        itemCode: 'LM-PEGADAIAN-1KG',
        itemName: 'Emas Batangan Pegadaian 1kg (999.9)',
        quantity: 1000,
        unit: 'gram',
        estUnitPrice: 1350000,
        notes: 'Sertifikat resmi'
      };
    } else if (category === 'LAB_CHEMICALS') {
      dept = 'Refinery & Lab QC';
      req = 'Rian (Assay Master)';
      supp = 'Mitra Kimia & Alat Laboratorium';
      curr = 'IDR';
      notes = 'Bahan kimia pemurnian (Asam Nitrat, Kowi, Boraks) & consumables refinery';
      initialItem = {
        itemId: 'CHEM-HNO3-68',
        itemCode: 'CHEM-HNO3-68',
        itemName: 'Asam Nitrat (HNO3 68% Technical Grade)',
        quantity: 5,
        unit: 'Jerigen (30kg)',
        estUnitPrice: 450000,
        notes: 'Untuk proses parting pemurnian'
      };
    } else {
      dept = 'General Affair & Safety';
      req = 'Hendra (GA & K3 Officer)';
      supp = 'Toko Perlengkapan Safety Industri';
      curr = 'IDR';
      notes = 'Perlengkapan K3 keselamatan kerja peleburan dan kemasan ekspor';
      initialItem = {
        itemId: 'SAFETY-GLOVE-500C',
        itemCode: 'SAFETY-GLOVE-500C',
        itemName: 'Sarung Tangan Kulit Tahan Panas 500°C',
        quantity: 10,
        unit: 'Pasang',
        estUnitPrice: 85000,
        notes: 'Operator peleburan'
      };
    }

    setForm(prev => ({
      ...prev,
      category,
      department: dept,
      requesterName: req,
      recommendedSupplier: supp,
      currency: curr,
      notes,
      items: [initialItem]
    }));
  };

  const handleAddItem = () => {
    if (!newItem.itemName || !newItem.quantity || Number(newItem.quantity) <= 0) {
      toast.warning('Nama barang dan jumlah kuantitas (> 0) wajib diisi.');
      return;
    }
    const eq = computeAnchorEquivalent(Number(newItem.quantity), newItem.unit);
    const itemToAdd = {
      ...newItem,
      quantity: Number(newItem.quantity),
      estUnitPrice: Number(newItem.estUnitPrice || 0),
      subtotal: Number(newItem.quantity) * Number(newItem.estUnitPrice || 0),
      anchorUnit: eq ? eq.anchorUnit.symbol : null,
      anchorQuantity: eq ? eq.anchorQuantity : Number(newItem.quantity),
      isAnchor: eq ? eq.isAnchor : true,
    };
    setForm(prev => ({
      ...prev,
      items: [...prev.items, itemToAdd]
    }));
    setNewItem({
      itemId: '',
      itemCode: '',
      itemName: '',
      quantity: 1,
      unit: form.category.includes('GOLD') ? 'g' : (form.category.includes('CHEM') ? 'L' : 'pcs'),
      estUnitPrice: form.category.includes('GOLD') ? 1350000 : 0,
      notes: ''
    });
  };

  const handleRemoveItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Pilih item dari katalog master barang
  const handleItemSelect = (itemCode) => {
    const found = masterItems.find(it => it.code === itemCode || it.id === itemCode);
    if (found) {
      setNewItem(prev => ({
        ...prev,
        itemId: found.id || found.code,
        itemCode: found.code || found.id,
        itemName: found.name,
        unit: found.unit || (form.category.includes('GOLD') ? 'g' : (form.category.includes('CHEM') ? 'L' : 'pcs')),
        estUnitPrice: found.price || 1350000
      }));
    }
  };

  // SUBMIT FORM PR (NON-POSTING SAK EMKM)
  async function handleCreatePR(e) {
    e.preventDefault();

    const totalEstAmount = form.items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.estUnitPrice || 0)), 0);
    const prSeq = form.prNumber || `PR-${Date.now().toString().slice(-6)}`;

    const validation = PurchaseRequestDTO.validateForm({
      ...form,
      prNumber: prSeq,
      totalEstimatedAmountIDR: totalEstAmount
    });

    if (!validation.success) {
      toast.warning(validation.errorMessages[0] || 'Validasi formulir Purchase Request gagal.');
      return;
    }

    const res = await createPurchaseRequest(form);
    if (!res.success) {
      toast.error(res.errors?.join('\n') || 'Gagal mengajukan Purchase Request.');
      return;
    }

    const savedPrNumber = res.pr?.prNumber || prSeq;

    toast.success(`Purchase Request (${savedPrNumber}) Berhasil Diajukan`, {
      description: `No. PR: ${savedPrNumber} • Dept: ${form.department} • Total: Rp ${totalEstAmount.toLocaleString()} • Status: PENDING APPROVAL`,
      duration: 5000,
      className: 'bg-emerald-950! border-emerald-500! text-emerald-50!',
      style: {
        backgroundColor: '#064e3b',
        borderColor: '#10b981',
        color: '#ecfdf5',
      },
    });

    loadInitialData();
    setShowForm(false);
  };

  // Otorisasi / Approval PR
  const handleApprovePR = (pr) => {
    showModal({
      variant: 'confirm',
      title: `Otorisasi Purchase Request ${pr.prNumber}`,
      message: `• No. PR: ${pr.prNumber}\n• Departemen: ${pr.department}\n• Pemohon: ${pr.requesterName}\n• Total Estimasi: Rp ${Number(pr.totalEstAmount || 0).toLocaleString()}\n\nApakah Anda menyetujui pengadaan barang ini untuk diproses menjadi Purchase Order (PO)?`,
      confirmLabel: 'Ya, Setujui (Approve)',
      onConfirm: () => approvePR(pr.id)
    });
  };

  const approvePR = async (prId) => {
    const res = await approvePurchaseRequest(prId);
    if (!res.success) {
      toast.error(res.errors?.join('\n') || 'Gagal menyetujui Purchase Request.');
      return;
    }
    toast.success('Purchase Request disetujui! Status PR kini APPROVED.');
    loadInitialData();
  };

  // KONVERSI PR KE PURCHASE ORDER DENGAN PREFILL FORM TANPA TANYA TIPE LAGI
  const handleConvertToPO = async (pr) => {
    // Hitung total gram menggunakan anchor conversion jika barangnya adalah kategori berat (Gram)
    const totalGrams = (pr.items || []).reduce((sum, i) => {
      const eq = computeAnchorEquivalent(Number(i.quantity) || 0, i.unit);
      if (eq && eq.anchorUnit.code === 'G') {
        return sum + eq.anchorQuantity;
      }
      return sum + (Number(i.quantity) || 0);
    }, 0);
    const totalIDREst = Number(pr.totalEstAmount || 0);

    if (pr.category === 'GOLD_IMPORT') {
      // 1. Arahkan langsung ke Form PO LM Import dengan prefill
      const effectiveRate = Number(conversionExchangeRate) || 16250;
      const totalAmountUSD = totalIDREst > 0 ? (totalIDREst / effectiveRate) : (totalGrams * 83.5);
      const firstItemUnit = findUnit(pr.items?.[0]?.unit);
      const isOz = firstItemUnit?.code === 'TROY_OZ';
      const unitMode = isOz ? 'oz' : 'gram';
      const quantityUnits = isOz ? (Number(pr.items?.[0]?.quantity) || Math.round((totalGrams / 31.1034768) * 10000) / 10000) : totalGrams;

      setPRConversionPrefill({
        sourcePRId: pr.id,
        sourcePRNumber: pr.prNumber,
        category: 'GOLD_IMPORT',
        department: pr.department,
        requesterName: pr.requesterName,
        supplierName: pr.recommendedSupplier || 'YLG Bullion Singapore Pte Ltd',
        quantityUnits,
        unitMode,
        baseAmountUSD: Math.round(totalAmountUSD * 100) / 100,
        invoiceNumber: `INV-${pr.prNumber}-EXT`,
        notes: `Diterbitkan dari ${pr.prNumber} (${pr.department} - Pemohon: ${pr.requesterName}) [Target Vault: 1158]`,
        items: pr.items
      });

      if (typeof setActivePage === 'function') {
        setActivePage('import-trading');
      } else {
        window.location.pathname = '/import-trading';
      }
    } else if (pr.category === 'GOLD_LOCAL') {
      // 2. Arahkan langsung ke Form PO LM Lokal dengan prefill
      const firstItem = pr.items?.[0] || {};
      setPRConversionPrefill({
        sourcePRId: pr.id,
        sourcePRNumber: pr.prNumber,
        category: 'GOLD_LOCAL',
        department: pr.department,
        requesterName: pr.requesterName,
        supplierName: pr.recommendedSupplier || 'PT Pegadaian (Persero) Jakarta',
        receiptNo: `KW-${pr.prNumber}`,
        itemCode: firstItem.itemCode || firstItem.itemId || 'LM-PEGADAIAN-1KG',
        itemName: firstItem.itemName || 'Emas Batangan Pegadaian 1kg (999.9)',
        quantityGrams: totalGrams,
        unitPriceIDR: Number(firstItem.estUnitPrice || 1350000),
        notes: `Diterbitkan dari ${pr.prNumber} (${pr.department} - Pemohon: ${pr.requesterName}) [Target Vault: 1157]`,
        items: pr.items
      });

      if (typeof setActivePage === 'function') {
        setActivePage('local-trading');
      } else {
        window.location.pathname = '/local-trading';
      }
    } else {
      // 3. Non-Gold PR (Bahan Kimia / Perlengkapan Operasional)
      showModal({
        variant: 'confirm',
        title: `Otorisasi Terbitkan PO Operasional (${pr.prNumber})`,
        message: `• No. PR: ${pr.prNumber}\n• Departemen: ${pr.department}\n• Pemohon: ${pr.requesterName}\n• Supplier: ${pr.recommendedSupplier || 'Mitra Kimia & Operasional'}\n• Total Estimasi: Rp ${totalIDREst.toLocaleString()}\n\nTerbitkan Purchase Order Operasional resmi untuk pengadaan ini?`,
        confirmLabel: 'Ya, Terbitkan PO',
        onConfirm: async () => {
          const poPayload = {
            supplier: 'SUPP-GENERAL-01',
            supplierName: pr.recommendedSupplier || 'Mitra Kimia & Alat Laboratorium',
            orderDate: new Date().toISOString().split('T')[0],
            currency: 'IDR',
            exchangeRate: 1,
            status: 'approved',
            reference: pr.prNumber,
            prId: pr.id,
            prNumber: pr.prNumber,
            notes: `Diterbitkan dari ${pr.prNumber} (${pr.department} - Pemohon: ${pr.requesterName})`,
            items: pr.items.map(item => ({
              itemId: item.itemId || item.itemCode || 'ITEM-GEN',
              itemCode: item.itemCode || 'ITEM-GEN',
              itemName: item.itemName,
              quantity: Number(item.quantity),
              unit: item.unit,
              unitPrice: Number(item.estUnitPrice || 0),
              unitPriceIDR: Number(item.estUnitPrice || 0)
            }))
          };

          const res = await createPurchaseOrder(poPayload);
          if (!res.success) {
            toast.error(JSON.stringify(res.errors, null, 2));
            return;
          }
          const poNo = res.order?.poNumber || 'PO-GEN';
          await markPRAsConverted(pr.id, {
            poNumber: poNo,
            poType: pr.category,
            supplier: pr.recommendedSupplier || 'Mitra Kimia & Alat Laboratorium'
          });

          loadInitialData();
          showModal({
            variant: 'success',
            title: '🚀 Purchase Order Operasional Berhasil Diterbitkan!',
            message: `• No. PO: ${poNo}\n• Ref PR: ${pr.prNumber} (${pr.department})\n• Supplier: ${pr.recommendedSupplier || 'Mitra'}\n• Total: Rp ${totalIDREst.toLocaleString()}\n• Status PO: APPROVED`
          });
        }
      });
    }
  };

  // Filter & Search Logic
  const filteredRequests = requests.filter(pr => {
    if (statusFilter !== 'ALL' && pr.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && pr.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchPr = pr.prNumber?.toLowerCase().includes(q);
      const matchDept = pr.department?.toLowerCase().includes(q);
      const matchReq = pr.requesterName?.toLowerCase().includes(q);
      const matchSupp = pr.recommendedSupplier?.toLowerCase().includes(q);
      const matchItem = (pr.items || []).some(i => i.itemName?.toLowerCase().includes(q) || i.itemCode?.toLowerCase().includes(q));
      return matchPr || matchDept || matchReq || matchSupp || matchItem;
    }
    return true;
  });

  // KPI Calculations
  const totalCount = requests.length;
  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const convertedCount = requests.filter(r => r.status === 'CONVERTED TO PO').length;
  const totalBudgetIDR = requests.reduce((sum, r) => sum + (Number(r.totalEstAmount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. HEADER & KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-surface/60 border-line">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-fg-soft font-medium uppercase tracking-wider">Total PR Diajukan</p>
              <h3 className="text-2xl font-bold text-fg mt-1 tabular-nums">{totalCount}</h3>
              <p className="text-[0.75rem] text-fg-muted mt-0.5">Semua pengadaan</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold">
              <ClipboardList size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/60 border-line">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gold-light font-medium uppercase tracking-wider">⏳ Pending Approval</p>
              <h3 className="text-2xl font-bold text-gold-light mt-1 tabular-nums">{pendingCount}</h3>
              <p className="text-[0.75rem] text-fg-muted mt-0.5">Menunggu otorisasi</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-gold-light">
              <Clock size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/60 border-line">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-light font-medium uppercase tracking-wider">🟢 Siap Terbit PO</p>
              <h3 className="text-2xl font-bold text-emerald-light mt-1 tabular-nums">{approvedCount}</h3>
              <p className="text-[0.75rem] text-fg-muted mt-0.5">Approved & ready</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald/15 flex items-center justify-center text-emerald-light">
              <CheckCircle size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/60 border-line">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-sky-light font-medium uppercase tracking-wider">🚀 Sudah Jadi PO</p>
              <h3 className="text-2xl font-bold text-sky-light mt-1 tabular-nums">{convertedCount}</h3>
              <p className="text-[0.75rem] text-fg-muted mt-0.5">Converted to order</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-sky/15 flex items-center justify-center text-sky-light">
              <ArrowRight size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/60 border-line">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gold-light font-medium uppercase tracking-wider">💰 Estimasi Anggaran</p>
              <h3 className="text-lg font-bold text-gold-light mt-1 tabular-nums">
                Rp {Math.round(totalBudgetIDR / 1000000).toLocaleString()} Jt
              </h3>
              <p className="text-[0.75rem] text-fg-muted mt-0.5">Non-Posting EMKM</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-gold-light">
              <DollarSign size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. MAIN CARD: ACTION BAR & FORM PR */}
      <Card>
        <CardHeader className="flex-row items-start justify-between flex-wrap gap-4 border-b border-line pb-5">
          <div>
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <ClipboardList className="text-gold" size={24} />
              Purchase Request (PR / Form PRF) & Pengadaan Kebutuhan Multi-Divisi
            </CardTitle>
            <CardDescription className="mt-1">
              Part 1 Alur Pembelian SAK EMKM: Verifikasi Pengadaan Non-Posting & Konversi 1-Klik ke PO Impor USD, PO Lokal, atau Bahan Operasional
            </CardDescription>
          </div>

          <div className="flex gap-2.5 flex-wrap">
            <Button
              variant={showForm ? 'secondary' : 'gold'}
              onClick={() => setShowForm(!showForm)}
              leftIcon={showForm ? <X size={16} /> : <Plus size={16} />}
            >
              {showForm ? 'Tutup Formulir PR' : '➕ Ajukan PR Baru'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* FORMULIR CREATE PR BARU (JIKA DIBUKA) */}
          {showForm && (
            <div className="bg-canvas/90 p-5 rounded-md border border-gold/40 shadow-glass space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3 pb-3 border-b border-line">
                <div>
                  <h4 className="text-gold-light font-heading font-bold text-base flex items-center gap-2">
                    <Sparkles size={18} /> Formulir Permintaan Pengadaan Barang (Purchase Request)
                  </h4>
                  <p className="text-xs text-fg-soft mt-0.5">
                    Pilih kategori pengadaan untuk mengisi template departemen dan item secara otomatis.
                  </p>
                </div>

                {/* Kategori Pengadaan Preset Buttons */}
                <div className="flex gap-1.5 flex-wrap bg-surface/80 p-1 rounded-sm border border-line">
                  <Button
                    type="button"
                    size="sm"
                    variant={form.category === 'GOLD_IMPORT' ? 'gold' : 'ghost'}
                    onClick={() => handleCategoryPreset('GOLD_IMPORT')}
                    leftIcon={<PlaneTakeoff size={14} />}
                  >
                    ✈️ Emas Impor USD
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.category === 'GOLD_LOCAL' ? 'emerald' : 'ghost'}
                    onClick={() => handleCategoryPreset('GOLD_LOCAL')}
                    leftIcon={<ShoppingCart size={14} />}
                  >
                    🛒 Emas Lokal IDR
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.category === 'LAB_CHEMICALS' ? 'sky' : 'ghost'}
                    onClick={() => handleCategoryPreset('LAB_CHEMICALS')}
                    leftIcon={<Flame size={14} />}
                  >
                    🧪 Kimia & Kowi Refineri
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.category === 'GENERAL_SUPPLIES' ? 'secondary' : 'ghost'}
                    onClick={() => handleCategoryPreset('GENERAL_SUPPLIES')}
                    leftIcon={<Package size={14} />}
                  >
                    📦 Safety & GA
                  </Button>
                </div>
              </div>

              <form onSubmit={handleCreatePR} className="space-y-6">
                {/* Form Input Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label required>Nomor PR (Auto)</Label>
                    <Input
                      readOnly
                      className="font-bold text-gold-light bg-surface/80"
                      value={form.prNumber}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label required>Departemen Pemohon</Label>
                    <Select
                      value={form.department}
                      onChange={e => setForm({ ...form, department: e.target.value })}
                    >
                      <option value="Refinery & Lab QC">Refinery & Lab QC (Peleburan & Pemurnian)</option>
                      <option value="Produksi Perhiasan">Produksi Perhiasan & Casting</option>
                      <option value="Gudang Brankas Vault">Gudang Brankas Vault</option>
                      <option value="Trading & Ekspor Devisa">Trading & Ekspor Devisa</option>
                      <option value="General Affair & Safety">General Affair & Keselamatan Kerja (K3)</option>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label required>Nama Pemohon (Requester)</Label>
                    <Input
                      className="font-bold text-fg"
                      value={form.requesterName}
                      onChange={e => setForm({ ...form, requesterName: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label required>Prioritas Kebutuhan</Label>
                    <Select
                      value={form.priority}
                      onChange={e => setForm({ ...form, priority: e.target.value })}
                    >
                      <option value="Normal">🟢 Normal (Sesuai Jadwal)</option>
                      <option value="Urgent">🔴 Urgent (Mendesak Produksi / Ekspor)</option>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label required>Tanggal Pengajuan</Label>
                    <Input
                      type="date"
                      value={form.requestDate}
                      onChange={e => setForm({ ...form, requestDate: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label required>Target Tgl Dibutuhkan</Label>
                    <Input
                      type="date"
                      value={form.requiredDate}
                      onChange={e => setForm({ ...form, requiredDate: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label>Rekomendasi Supplier / Vendor</Label>
                    <Input
                      value={form.recommendedSupplier}
                      onChange={e => setForm({ ...form, recommendedSupplier: e.target.value })}
                      placeholder="Nama supplier yang direkomendasikan..."
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-4">
                    <Label>Keperluan & Keterangan Pengadaan</Label>
                    <Input
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="Contoh: Kebutuhan bahan baku ekspor perhiasan DMCC Dubai..."
                    />
                  </div>
                </div>

                {/* Sub-Card Item Repeater Form */}
                <div className="bg-surface/50 p-4 rounded-sm border border-line space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <h5 className="text-sm font-bold text-sky-light flex items-center gap-1.5">
                      <Package size={16} /> Daftar Item Barang yang Diajukan:
                    </h5>
                    <span className="text-xs text-fg-soft">
                      Total Item: <strong className="text-fg">{form.items.length}</strong>
                    </span>
                  </div>

                  {/* Add Item Row Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end bg-canvas/60 p-3 rounded-sm border border-line/60">
                    <div className="flex flex-col gap-1 lg:col-span-2">
                      <Label className="text-xs">Pilih Dari Master Barang / Ketik Manual</Label>
                      <Combobox
                        value={newItem.itemCode}
                        onChange={handleItemSelect}
                        placeholder="Pilih item katalog..."
                        searchPlaceholder="Cari kode atau nama barang..."
                        emptyText="Barang tidak ditemukan."
                        options={masterItems.map(it => ({
                          value: it.code || it.id,
                          label: `[${it.code || it.id}] ${it.name}`
                        }))}
                      />
                    </div>

                    <div className="flex flex-col gap-1 lg:col-span-2">
                      <Label className="text-xs">Nama Barang / Spesifikasi</Label>
                      <Input
                        placeholder="Nama barang..."
                        value={newItem.itemName}
                        onChange={e => setNewItem({ ...newItem, itemName: e.target.value })}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Jumlah</Label>
                      <NumberInput
                        value={newItem.quantity}
                        onChange={quantity => setNewItem({ ...newItem, quantity })}
                      />
                    </div>

                    <div className="flex flex-col gap-1 lg:col-span-1">
                      <Label className="text-xs">Satuan</Label>
                      <UnitPicker
                        value={newItem.unit}
                        onChange={(unit) => setNewItem({ ...newItem, unit })}
                        prCategory={form.category}
                        quantity={Number(newItem.quantity) || 0}
                        showAnchorBadge={true}
                      />
                    </div>

                    <div className="flex flex-col gap-1 lg:col-span-2">
                      <Label className="text-xs">Est. Harga Satuan (Rp)</Label>
                      <NumberInput
                        value={newItem.estUnitPrice}
                        onChange={estUnitPrice => setNewItem({ ...newItem, estUnitPrice })}
                      />
                    </div>

                    <div className="flex flex-col gap-1 lg:col-span-3">
                      <Label className="text-xs">Catatan Spesifikasi</Label>
                      <Input
                        placeholder="Keterangan kadar / spek..."
                        value={newItem.notes}
                        onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
                      />
                    </div>

                    <div className="lg:col-span-1">
                      <Button
                        type="button"
                        variant="emerald"
                        className="w-full"
                        onClick={handleAddItem}
                        leftIcon={<Plus size={15} />}
                      >
                        Tambah
                      </Button>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Barang & Spesifikasi</TableHead>
                        <TableHead className="text-right">Kuantitas</TableHead>
                        <TableHead>Satuan & Anchor</TableHead>
                        <TableHead className="text-right">Est. Harga Satuan</TableHead>
                        <TableHead className="text-right">Subtotal Estimasi</TableHead>
                        <TableHead className="text-center w-16">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.items.length === 0 ? (
                        <TableEmpty colSpan={6} message="Belum ada item barang — gunakan form di atas untuk menambahkan." />
                      ) : (
                        form.items.map((it, idx) => {
                          const eq = computeAnchorEquivalent(Number(it.quantity) || 0, it.unit);
                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                <strong className="text-fg text-xs">{it.itemName}</strong>
                                {it.itemCode && <span className="text-[0.7rem] text-gold-light block">Kode: {it.itemCode}</span>}
                                {it.notes && <span className="text-[0.7rem] text-fg-muted block italic">({it.notes})</span>}
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">{it.quantity}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-xs text-fg">{it.unit}</span>
                                  {eq && (
                                    eq.isAnchor ? (
                                      <span className="text-[10px] text-emerald font-mono">⭐ Anchor</span>
                                    ) : (
                                      <span className="text-[10px] text-gold font-mono" title={eq.formatted}>
                                        ≈ {eq.anchorQuantity.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {eq.anchorUnit.symbol}
                                      </span>
                                    )
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                Rp {Number(it.estUnitPrice || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-bold text-emerald-light tabular-nums">
                                Rp {(Number(it.quantity) * Number(it.estUnitPrice || 0)).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleRemoveItem(idx)}
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Form Footer Buttons */}
                <div className="flex justify-between items-center flex-wrap gap-4 pt-2">
                  <div className="text-sm flex flex-col gap-0.5">
                    <div>
                      Total Estimasi Pengadaan: <strong className="text-gold-light text-base ml-1">
                        Rp {form.items.reduce((s, i) => s + (Number(i.quantity) * Number(i.estUnitPrice || 0)), 0).toLocaleString()}
                      </strong>
                    </div>
                    {(() => {
                      const totalAnchorGrams = form.items.reduce((sum, it) => {
                        const eq = computeAnchorEquivalent(Number(it.quantity) || 0, it.unit);
                        if (eq && eq.anchorUnit.code === 'G') return sum + eq.anchorQuantity;
                        return sum;
                      }, 0);
                      if (totalAnchorGrams > 0) {
                        return (
                          <div className="text-xs text-fg-muted flex items-center gap-1.5 font-mono">
                            <span>⭐ Total Berat Emas (Anchor):</span>
                            <strong className="text-gold">{totalAnchorGrams.toLocaleString('id-ID', { maximumFractionDigits: 4 })} Gram</strong>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                      Batal
                    </Button>
                    <Button type="submit" variant="gold" leftIcon={<CheckCircle size={16} />}>
                      Ajukan Purchase Request (PR)
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* FILTER & SEARCH CONTROLS */}
          <div className="flex justify-between items-center flex-wrap gap-3">
            {/* Filter Tabs Status */}
            <div className="flex gap-1.5 flex-wrap bg-surface/80 p-1 rounded-sm border border-line">
              <Button
                size="sm"
                variant={statusFilter === 'ALL' ? 'gold' : 'ghost'}
                onClick={() => setStatusFilter('ALL')}
              >
                Semua ({requests.length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'PENDING' ? 'gold' : 'ghost'}
                onClick={() => setStatusFilter('PENDING')}
              >
                ⏳ Pending ({pendingCount})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'APPROVED' ? 'emerald' : 'ghost'}
                onClick={() => setStatusFilter('APPROVED')}
              >
                🟢 Approved ({approvedCount})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'CONVERTED TO PO' ? 'sky' : 'ghost'}
                onClick={() => setStatusFilter('CONVERTED TO PO')}
              >
                🚀 Converted PO ({convertedCount})
              </Button>
            </div>

            {/* Filter Category & Search Bar */}
            <div className="flex gap-2.5 flex-wrap items-center flex-1 max-w-lg justify-end">
              <Select
                className="max-w-[180px]"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">Semua Kategori</option>
                <option value="GOLD_IMPORT">✈️ Emas Impor</option>
                <option value="GOLD_LOCAL">🛒 Emas Lokal</option>
                <option value="LAB_CHEMICALS">🧪 Kimia Refineri</option>
                <option value="GENERAL_SUPPLIES">📦 Safety & GA</option>
              </Select>

              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
                <Input
                  className="pl-9"
                  placeholder="Cari No PR, Departemen, Pemohon, Item..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 3. TABEL REGISTER PURCHASE REQUEST */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. PR & Tanggal</TableHead>
                  <TableHead>Kategori & Departemen</TableHead>
                  <TableHead>Pemohon & Prioritas</TableHead>
                  <TableHead>Rincian Item Kebutuhan</TableHead>
                  <TableHead className="text-right">Total Estimasi</TableHead>
                  <TableHead className="text-center">Status PR</TableHead>
                  <TableHead className="w-16 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableEmpty colSpan={7} message="Tidak ada data Purchase Request yang cocok dengan kriteria pencarian." />
                ) : (
                  filteredRequests.map(pr => {
                    const isImport = pr.category === 'GOLD_IMPORT';
                    const isLocal = pr.category === 'GOLD_LOCAL';
                    const isChem = pr.category === 'LAB_CHEMICALS';

                    return (
                      <TableRow key={pr.id || pr.prNumber}>
                        <TableCell>
                          <strong className="text-gold-light font-mono block text-sm">{pr.prNumber}</strong>
                          <span className="text-xs text-fg-soft flex items-center gap-1 mt-0.5">
                            <Calendar size={12} /> {pr.requestDate}
                          </span>
                          {pr.requiredDate && (
                            <span className="text-[0.7rem] text-fg-muted block">
                              Target: {pr.requiredDate}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 mb-1">
                            {isImport && <Badge variant="gold">✈️ Impor USD</Badge>}
                            {isLocal && <Badge variant="emerald">🛒 Emas Lokal</Badge>}
                            {isChem && <Badge variant="sky">🧪 Kimia Lab</Badge>}
                            {!isImport && !isLocal && !isChem && <Badge variant="secondary">📦 Safety/GA</Badge>}
                          </div>
                          <span className="text-xs font-semibold text-fg block">{pr.department}</span>
                          {pr.recommendedSupplier && (
                            <span className="text-[0.72rem] text-fg-muted block truncate max-w-[180px]">
                              Supp: {pr.recommendedSupplier}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <span className="text-xs font-medium text-fg block">{pr.requesterName}</span>
                          <div className="mt-1">
                            {pr.priority === 'Urgent' ? (
                              <Badge variant="rose">🔴 Urgent</Badge>
                            ) : (
                              <Badge variant="secondary">🟢 Normal</Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            {(pr.items || []).map((it, i) => {
                              const eq = computeAnchorEquivalent(Number(it.quantity) || 0, it.unit);
                              return (
                                <div key={i} className="text-xs flex items-center gap-1.5 text-fg-soft">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gold/50 flex-shrink-0" />
                                  <span className="font-medium text-fg">{it.itemName}</span>
                                  <span className="text-fg-muted font-mono">
                                    ({it.quantity} {it.unit}
                                    {eq && !eq.isAnchor ? ` ≈ ${eq.anchorQuantity.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ${eq.anchorUnit.symbol}` : ''})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {pr.notes && (
                            <p className="text-[0.72rem] text-fg-muted mt-1.5 italic line-clamp-1">
                              Note: {pr.notes}
                            </p>
                          )}
                        </TableCell>

                        <TableCell className="text-right tabular-nums">
                          <strong className="text-emerald-light text-sm block">
                            Rp {(pr.totalEstAmount || 0).toLocaleString()}
                          </strong>
                          {isImport && (
                            <span className="text-[0.72rem] text-fg-muted block">
                              ~ $ {Math.round((pr.totalEstAmount || 0) / 16250).toLocaleString()}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {pr.status === 'PENDING' && (
                            <Badge variant="gold" className="text-[0.72rem]">⏳ Pending Approval</Badge>
                          )}
                          {pr.status === 'APPROVED' && (
                            <Badge variant="emerald" className="text-[0.72rem]">🟢 Approved (Siap PO)</Badge>
                          )}
                          {pr.status === 'CONVERTED TO PO' && (
                            <div className="space-y-1">
                              <Badge variant="sky" className="text-[0.72rem]">🚀 PO Terbit</Badge>
                              <span className="text-[0.7rem] text-sky-light font-mono block">
                                {pr.convertedPoNumber}
                              </span>
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-8 w-8 p-0 text-fg-soft hover:text-fg hover:bg-surface-raised cursor-pointer mx-auto"
                                aria-label={`Aksi untuk ${pr.prNumber}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 z-[1100]">
                              {pr.status === 'PENDING' && (
                                <DropdownMenuItem
                                  onClick={() => handleApprovePR(pr)}
                                  className="flex items-center gap-2 text-emerald-light cursor-pointer hover:bg-emerald/10 focus:bg-emerald/10 focus:text-emerald-light font-medium"
                                >
                                  <CheckSquare className="h-4 w-4 text-emerald-light" />
                                  <span>Setujui Permintaan</span>
                                </DropdownMenuItem>
                              )}

                              {pr.status === 'APPROVED' && (
                                <DropdownMenuItem
                                  onClick={() => handleConvertToPO(pr)}
                                  className="flex items-center gap-2 text-gold cursor-pointer hover:bg-gold/10 focus:bg-gold/10 focus:text-gold-light font-medium"
                                >
                                  <ArrowRight className="h-4 w-4 text-gold" />
                                  <span>Terbitkan PO</span>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem
                                onClick={() => setSelectedPRDetail(pr)}
                                className="flex items-center gap-2 text-fg-soft cursor-pointer hover:text-fg"
                              >
                                <Eye className="h-4 w-4" />
                                <span>Lihat Rincian PR</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={async () => {
                                  await exportPurchaseRequestPdf(pr);
                                  toast.success(`Dokumen Formulir Purchase Request (${pr.prNumber}) siap dicetak.`);
                                }}
                                className="flex items-center gap-2 cursor-pointer text-fg-soft hover:text-fg"
                              >
                                <Printer className="h-4 w-4" />
                                <span>Cetak Dokumen (PRF)</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
        </CardContent>
      </Card>

      {/* 5. MODAL DETAIL INSPEKSI PR */}
      {selectedPRDetail && (
        <div className="fixed inset-0 z-1100 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-lg max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-line pb-4">
              <div>
                <h3 className="text-lg font-heading font-bold text-gold-light flex items-center gap-2">
                  <ClipboardList className="text-gold" size={20} />
                  Lembar Permintaan Pengadaan ({selectedPRDetail.prNumber})
                </h3>
                <p className="text-xs text-fg-soft mt-0.5">
                  Departemen: <strong className="text-fg">{selectedPRDetail.department}</strong> | Pemohon: <strong className="text-fg">{selectedPRDetail.requesterName}</strong>
                </p>
              </div>
              <button
                type="button"
                className="text-fg-muted hover:text-fg"
                onClick={() => setSelectedPRDetail(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-canvas/60 p-3.5 rounded-sm border border-line text-xs">
              <div>
                <span className="text-fg-muted block">Tanggal Pengajuan:</span>
                <strong className="text-fg">{selectedPRDetail.requestDate}</strong>
              </div>
              <div>
                <span className="text-fg-muted block">Target Dibutuhkan:</span>
                <strong className="text-fg">{selectedPRDetail.requiredDate || '-'}</strong>
              </div>
              <div>
                <span className="text-fg-muted block">Prioritas:</span>
                <strong className={selectedPRDetail.priority === 'Urgent' ? 'text-danger' : 'text-emerald-light'}>
                  {selectedPRDetail.priority}
                </strong>
              </div>
              <div>
                <span className="text-fg-muted block">Status Dokumen:</span>
                <strong className="text-gold-light">{selectedPRDetail.status}</strong>
              </div>
            </div>

            {/* Table Items */}
            <Table containerClassName="max-h-60 overflow-y-auto">
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead className="text-right">Est. Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedPRDetail.items || []).map((it, idx) => {
                  const eq = computeAnchorEquivalent(Number(it.quantity) || 0, it.unit);
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <strong className="text-fg text-xs">{it.itemName}</strong>
                        {it.notes && <span className="text-[0.7rem] text-fg-muted block">{it.notes}</span>}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{it.quantity}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-fg">{it.unit}</span>
                          {eq && (
                            eq.isAnchor ? (
                              <span className="text-[10px] text-emerald font-mono">⭐ Anchor</span>
                            ) : (
                              <span className="text-[10px] text-gold font-mono" title={eq.formatted}>
                                ≈ {eq.anchorQuantity.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {eq.anchorUnit.symbol}
                              </span>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        Rp {Number(it.estUnitPrice || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-emerald-light tabular-nums">
                        Rp {(Number(it.quantity) * Number(it.estUnitPrice || 0)).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-between items-center text-xs bg-canvas/40 p-3 rounded-sm border border-line">
              <span>Rekomendasi Supplier: <strong>{selectedPRDetail.recommendedSupplier || '-'}</strong></span>
              <span>Total Estimasi: <strong className="text-gold-light text-sm ml-1">Rp {Number(selectedPRDetail.totalEstAmount || 0).toLocaleString()}</strong></span>
            </div>

            {selectedPRDetail.convertedPoNumber && (
              <Alert variant="info" title="Purchase Order Telah Diterbitkan">
                Dokumen PR ini telah dikonversi menjadi PO dengan Nomor: <strong className="text-sky-light">{selectedPRDetail.convertedPoNumber}</strong> ({selectedPRDetail.convertedSupplier || selectedPRDetail.recommendedSupplier}).
              </Alert>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => setSelectedPRDetail(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTIFIKASI GLOBAL */}
      <Modal {...modalProps} />
    </div>
  );
}
