import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Package,
  PlaneTakeoff,
  Flame,
  Hammer,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Building2,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  PackageCheck,
  ClipboardList,
  DollarSign,
  FileText,
  Truck,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Warehouse,
  BarChart3,
  RefreshCw,
  Eye
} from 'lucide-react';
import {
  calculateVaultStockPosition,
  getPurchaseRequests,
  getPurchaseOrders,
  getLocalPurchases,
  getScrapPurchases,
  getGoodsReceipts,
  getAllPurchaseOrdersForReceipt,
  resolveGoodsReceiptPO,
  getProductionSPK,
  getProductionSettlements,
  getExportSalesOrders,
  getExportInvoices,
  getExportDeliveryOrders,
  getJournalEntries,
  getCOA,
  getVouchers,
  getCompanyProfile
} from '../services/storageService';
import { fetchBcaERateUSD, getStoredUsdRate } from '../services/currencyService';
import { formatIDR, formatGram, formatUSD } from '../utils/format';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from '../components/ui';

export default function Dashboard({ setActivePage }) {
  const [loading, setLoading] = useState(true);
  const [refreshingRate, setRefreshingRate] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(getStoredUsdRate());
  const [activityFilter, setActivityFilter] = useState('ALL'); // 'ALL', 'PURCHASING', 'VAULT', 'EXPORT', 'FINANCE'

  // Data states
  const [vaultData, setVaultData] = useState(null);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [importPOs, setImportPOs] = useState([]);
  const [localPurchases, setLocalPurchases] = useState([]);
  const [scrapPurchases, setScrapPurchases] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [spkList, setSpkList] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [exportSOs, setExportSOs] = useState([]);
  const [exportInvoices, setExportInvoices] = useState([]);
  const [exportDOs, setExportDOs] = useState([]);
  const [journals, setJournals] = useState([]);
  const [coaList, setCoaList] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);

  const loadAllDashboardData = () => {
    try {
      const vData = calculateVaultStockPosition();
      setVaultData(vData);
      setPurchaseRequests(getPurchaseRequests() || []);
      setImportPOs(getPurchaseOrders() || []);
      setLocalPurchases(getLocalPurchases() || []);
      setScrapPurchases(getScrapPurchases() || []);
      setGoodsReceipts(getGoodsReceipts() || []);
      setSpkList(getProductionSPK() || []);
      setSettlements(getProductionSettlements() || []);
      setExportSOs(getExportSalesOrders() || []);
      setExportInvoices(getExportInvoices() || []);
      setExportDOs(getExportDeliveryOrders() || []);
      setJournals(getJournalEntries() || []);
      setCoaList(getCOA() || []);
      setVouchers(getVouchers() || []);
      setCompanyProfile(getCompanyProfile() || null);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllDashboardData();
  }, []);

  const handleRefreshRate = async () => {
    setRefreshingRate(true);
    try {
      const rate = await fetchBcaERateUSD();
      if (rate) setExchangeRate(rate);
    } catch (err) {
      console.error('Failed to refresh USD rate:', err);
    } finally {
      setRefreshingRate(false);
    }
  };

  // ==========================================
  // FINANCIAL CALCULATIONS (SAK EMKM GL Engine)
  // ==========================================
  const financialSummary = useMemo(() => {
    const balances = {};
    coaList.forEach((acc) => {
      balances[acc.code] = {
        code: acc.code,
        name: acc.name,
        category: acc.category,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0
      };
    });

    journals.forEach((j) => {
      j.lines?.forEach((line) => {
        const code = line.accountCode;
        if (!balances[code]) {
          balances[code] = {
            code,
            name: line.accountName || code,
            category: code.startsWith('1')
              ? 'aset'
              : code.startsWith('2')
              ? 'kewajiban'
              : code.startsWith('3')
              ? 'ekuitas'
              : code.startsWith('4')
              ? 'pendapatan'
              : 'beban',
            totalDebit: 0,
            totalCredit: 0,
            balance: 0
          };
        }
        balances[code].totalDebit += Number(line.debit || 0);
        balances[code].totalCredit += Number(line.credit || 0);
      });
    });

    Object.values(balances).forEach((acc) => {
      const isDebitNormal =
        acc.category === 'aset' ||
        acc.category === 'beban' ||
        acc.code.startsWith('1') ||
        acc.code.startsWith('5') ||
        acc.code.startsWith('6');
      if (isDebitNormal) {
        acc.balance = acc.totalDebit - acc.totalCredit;
      } else {
        acc.balance = acc.totalCredit - acc.totalDebit;
      }
    });

    // 1. Kas & Bank
    const kasTunai = balances['1110']?.balance || 0;
    const bankBcaIDR = balances['1111-IDR']?.balance || 0;
    const bankBcaUSD = balances['1111-USD']?.balance || 0;
    const bankBcaSGD = balances['1111-SGD']?.balance || 0;
    const totalLiquidCashBankIDR = kasTunai + bankBcaIDR + bankBcaUSD + bankBcaSGD;

    // 2. Piutang & Hutang
    const piutangEksporUSD = balances['1132']?.balance || 0;
    const piutangLain = balances['1131']?.balance || 0;
    const totalPiutang = piutangEksporUSD + piutangLain;

    const hutangDagang2111 = balances['2111']?.balance || 0;
    const totalHutang = hutangDagang2111;

    // 3. Laba Rugi
    const rev = Object.values(balances)
      .filter((a) => a.code.startsWith('4') || a.category === 'pendapatan')
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0);
    const hpp = Object.values(balances)
      .filter((a) => a.code.startsWith('5') || a.category === 'hpp')
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0);
    const opex = Object.values(balances)
      .filter((a) => (a.code.startsWith('6') || a.category === 'beban') && !a.code.startsWith('5'))
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0);
    const netProfit = rev - hpp - opex;

    return {
      kasTunai,
      bankBcaIDR,
      bankBcaUSD,
      bankBcaSGD,
      totalLiquidCashBankIDR,
      totalPiutang,
      piutangEksporUSD,
      totalHutang,
      hutangDagang2111,
      revenue: rev,
      hpp,
      opex,
      netProfit
    };
  }, [coaList, journals]);

  // ==========================================
  // PIPELINE OPERATIONAL METRICS
  // ==========================================
  const pipelineMetrics = useMemo(() => {
    // 1. Pengadaan
    const pendingPR = purchaseRequests.filter((p) => p.status === 'PENDING').length;
    const approvedPR = purchaseRequests.filter((p) => p.status === 'APPROVED').length;
    const activeImportPOs = importPOs.filter((po) => po.status !== 'CANCELLED' && po.paymentStatus !== 'PAID');
    const totalImportUSD = importPOs.reduce((sum, po) => sum + Number(po.totalAmountUSD || 0), 0);
    const activeLocalPOs = localPurchases.filter((po) => po.paymentStatus !== 'PAID');
    const totalLocalGrams = localPurchases.reduce((sum, po) => sum + Number(po.weightGram || po.goldWeight || 0), 0);

    // 2. Penerimaan Vault & TTB
    const totalGRN = goodsReceipts.length;
    const totalReceivedWeight = goodsReceipts.reduce((sum, g) => sum + Number(g.receivedWeightGram || 0), 0);

    // 3. Produksi
    const activeSPK = spkList.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'IN WIP' || s.status === 'DRAFT');
    const completedSPK = spkList.filter((s) => s.status === 'COMPLETED');
    const activeWipWeight = activeSPK.reduce((sum, s) => sum + Number(s.pureGoldRequiredGram || s.pureGoldGrams || 0), 0);

    // 4. Ekspor
    const totalSalesOrders = exportSOs.length;
    const activeSOs = exportSOs.filter((s) => s.status !== 'SHIPPED' && s.status !== 'CANCELLED');
    const totalExportInvoicesUSD = exportInvoices.reduce((sum, inv) => sum + Number(inv.totalAmountUSD || 0), 0);
    const totalShippedGrams = exportDOs.reduce((sum, d) => sum + Number(d.netWeightGram || d.totalNetWeightGram || 0), 0);

    // 5. Keuangan
    const totalVouchersCount = vouchers.length;

    return {
      pendingPR,
      approvedPR,
      activeImportPOsCount: activeImportPOs.length,
      totalImportUSD,
      activeLocalPOsCount: activeLocalPOs.length,
      totalLocalGrams,
      totalGRN,
      totalReceivedWeight,
      activeSPKCount: activeSPK.length,
      completedSPKCount: completedSPK.length,
      activeWipWeight,
      totalSalesOrders,
      activeSOsCount: activeSOs.length,
      totalExportInvoicesUSD,
      totalShippedGrams,
      totalVouchersCount
    };
  }, [purchaseRequests, importPOs, localPurchases, goodsReceipts, spkList, exportSOs, exportInvoices, exportDOs, vouchers]);

  // ==========================================
  // COMBINED RECENT ACTIVITIES STREAM
  // ==========================================
  const recentActivities = useMemo(() => {
    const list = [];

    // PO Impor
    importPOs.forEach((po) => {
      list.push({
        id: `PO-IMP-${po.id || po.poNumber}`,
        category: 'PURCHASING',
        docType: 'PO Emas Impor',
        docNo: po.poNumber || `PO-IMP-${po.id}`,
        date: po.orderDate || po.date || '2026-08-20',
        entity: po.supplierName || 'Supplier Impor LBMA',
        value: `${formatUSD(po.totalAmountUSD || 0)} (${formatGram(po.items?.[0]?.quantityOz ? po.items[0].quantityOz * 31.1035 : 1000)})`,
        status: po.status || 'ACTIVE',
        statusColor: po.status === 'CANCELLED' ? 'danger' : po.paymentStatus === 'PAID' ? 'emerald' : 'sky',
        targetPage: 'import-trading'
      });
    });

    // PO Lokal
    localPurchases.forEach((po) => {
      list.push({
        id: `PO-LOK-${po.id || po.receiptNo}`,
        category: 'PURCHASING',
        docType: 'PO Emas Lokal',
        docNo: po.receiptNo || po.poNumber || `PO-LOK-${po.id}`,
        date: po.date || '2026-08-20',
        entity: po.supplierName || 'Supplier Lokal LM',
        value: `${formatIDR(po.totalAmount || 0)} (${formatGram(po.weightGram || 0)})`,
        status: po.status || 'TERKIRIM KE VAULT',
        statusColor: po.status === 'BATAL' ? 'danger' : 'emerald',
        targetPage: 'local-trading'
      });
    });

    // Goods Receipt / TTB — nama supplier diturunkan dari PO acuan
    const receiptPOs = getAllPurchaseOrdersForReceipt() || [];
    goodsReceipts.forEach((grn) => {
      list.push({
        id: `GRN-${grn.id || grn.grnNumber}`,
        category: 'VAULT',
        docType: 'Penerimaan TTB',
        docNo: grn.grnNumber || `GRN-${grn.id}`,
        date: grn.date || '2026-08-20',
        entity: resolveGoodsReceiptPO(grn, receiptPOs).supplierName || 'Serah Terima Vault',
        value: formatGram(grn.receivedWeightGram || 0),
        status: 'MASUK VAULT',
        statusColor: 'emerald',
        targetPage: 'goods-receipt'
      });
    });

    // SPK Produksi
    spkList.forEach((spk) => {
      list.push({
        id: `SPK-${spk.id || spk.spkNumber}`,
        category: 'VAULT',
        docType: 'SPK Produksi',
        docNo: spk.spkNumber || `SPK-${spk.id}`,
        date: spk.orderDate || spk.date || '2026-08-20',
        entity: spk.customerName || spk.workshopName || 'Workshop Pengrajin',
        value: `${formatGram(spk.pureGoldRequiredGram || 0)} (${spk.karat || '750'})`,
        status: spk.status || 'IN WIP',
        statusColor: spk.status === 'COMPLETED' ? 'emerald' : 'orange',
        targetPage: 'jewelry-production'
      });
    });

    // Faktur Ekspor
    exportInvoices.forEach((inv) => {
      list.push({
        id: `INV-${inv.id || inv.invoiceNumber}`,
        category: 'EXPORT',
        docType: 'Faktur Ekspor USD',
        docNo: inv.invoiceNumber || `INV-${inv.id}`,
        date: inv.invoiceDate || inv.date || '2026-08-20',
        entity: inv.buyerName || 'Buyer Ekspor',
        value: `${formatUSD(inv.totalAmountUSD || 0)} (PPN 0%)`,
        status: inv.paymentStatus || 'TERBIT',
        statusColor: inv.paymentStatus === 'PAID' ? 'emerald' : 'gold',
        targetPage: 'export-invoicing'
      });
    });

    // Surat Jalan Ekspor DO
    exportDOs.forEach((doItem) => {
      list.push({
        id: `DO-${doItem.id || doItem.doNumber}`,
        category: 'EXPORT',
        docType: 'Surat Jalan Ekspor',
        docNo: doItem.doNumber || `DO-${doItem.id}`,
        date: doItem.date || '2026-08-20',
        entity: doItem.buyerName || 'Kargo Pengawal',
        value: `${formatGram(doItem.netWeightGram || 0)} (Karat ${doItem.karat || '750'})`,
        status: doItem.status || 'SHIPPED',
        statusColor: 'sky',
        targetPage: 'export-do'
      });
    });

    // Voucher Kas & Bank
    vouchers.forEach((vch) => {
      list.push({
        id: `VCH-${vch.id || vch.voucherNumber}`,
        category: 'FINANCE',
        docType: `Voucher ${vch.voucherType || 'BBK'}`,
        docNo: vch.voucherNumber || `VCH-${vch.id}`,
        date: vch.date || '2026-08-20',
        entity: vch.payee || vch.recipient || 'Penerima / Bank',
        value: formatIDR(vch.amount || 0),
        status: vch.status || 'POSTED',
        statusColor: 'emerald',
        targetPage: 'voucher-mgmt'
      });
    });

    // Sort descending by date
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    return list;
  }, [importPOs, localPurchases, goodsReceipts, spkList, exportInvoices, exportDOs, vouchers]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'ALL') return recentActivities.slice(0, 7);
    return recentActivities.filter((a) => a.category === activityFilter).slice(0, 7);
  }, [recentActivities, activityFilter]);

  const vaultSummary = vaultData?.summary || {
    totalLMGrams: 0,
    lmMainGrams: 0,
    lmImportGrams: 0,
    wipGrams: 0,
    exportGrams: 0,
    scrapGrams: 0,
    totalVaultGrams: 0,
    grandTotalValueIDR: 0
  };

  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6">
      {/* ========================================== */}
      {/* 1. EXECUTIVE BANNER & LIVE CONTROL BAR     */}
      {/* ========================================== */}
      <div className="glass-panel p-5 relative overflow-hidden rounded-xl border border-line bg-gradient-to-r from-surface/90 via-surface/60 to-canvas/80">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-gold/10 to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold/15 text-gold border border-gold/30">
                <Sparkles size={12} /> Executive Control Center
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald/10 text-emerald-light border border-emerald/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" /> SAK EMKM Terintegrasi
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky/10 text-sky border border-sky/20">
                <ShieldCheck size={12} /> PPN 0% Ekspor
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-white">
              {companyProfile?.companyName || 'PT. TRILIUN ANUGRAH NUSANTARA'}
            </h1>
            <p className="text-xs text-fg-soft flex items-center gap-2 mt-1">
              <Calendar size={13} className="text-gold" /> {currentDateFormatted} • Logam Mulia & Perhiasan Emas Ekspor
            </p>
          </div>

          {/* Quick Rate & Refresh */}
          <div className="flex items-center gap-3 bg-surface/80 p-2.5 rounded-lg border border-line">
            <div className="text-right">
              <div className="text-[11px] text-fg-muted uppercase tracking-wider font-semibold">BCA e-Rate USD/IDR</div>
              <div className="text-base font-bold text-gold tabular-nums">
                Rp {Number(exchangeRate || 16250).toLocaleString('id-ID')}
              </div>
            </div>
            <button
              onClick={handleRefreshRate}
              disabled={refreshingRate}
              title="Perbarui Kurs Live"
              className="p-2 rounded-md hover:bg-gold/15 text-gold hover:text-white transition border border-gold/20 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshingRate ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. TOP 4 REAL-TIME KPI METRICS             */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Persediaan Vault Emas */}
        <Card
          className="cursor-pointer hover:border-gold/40 transition duration-200"
          onClick={() => setActivePage('warehouse-mgmt')}
        >
          <CardContent className="p-4 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Persediaan Brankas Vault</span>
              <div className="text-2xl font-bold bg-linear-135 from-[#fef08a] via-gold to-gold-dark bg-clip-text text-transparent tabular-nums">
                {formatGram(vaultSummary.totalVaultGrams)}
              </div>
              <p className="text-xs text-emerald-light tabular-nums font-medium">
                ≈ {formatIDR(vaultSummary.grandTotalValueIDR || vaultSummary.totalVaultGrams * 1350000)}
              </p>
              <div className="text-[11px] text-fg-soft pt-1">
                LM: {formatGram(vaultSummary.totalLMGrams, 0)} • WIP: {formatGram(vaultSummary.wipGrams, 0)}
              </div>
            </div>
            <div className="p-2.5 bg-gold/10 rounded-xl text-gold border border-gold/20">
              <Warehouse size={22} />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Likuiditas Kas & Devisa Bank */}
        <Card
          className="cursor-pointer hover:border-emerald/40 transition duration-200"
          onClick={() => setActivePage('voucher-mgmt')}
        >
          <CardContent className="p-4 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Likuiditas Kas & Bank</span>
              <div className="text-2xl font-bold text-white tabular-nums">
                {formatIDR(financialSummary.totalLiquidCashBankIDR)}
              </div>
              <p className="text-xs text-fg-soft">Rek. Operasional IDR & Devisa</p>
              <div className="text-[11px] text-emerald-light pt-1 font-medium">
                Kas: {formatIDR(financialSummary.kasTunai)} • Bank: {formatIDR(financialSummary.bankBcaIDR)}
              </div>
            </div>
            <div className="p-2.5 bg-emerald/10 rounded-xl text-emerald border border-emerald/20">
              <CreditCard size={22} />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Pengadaan Emas Aktif */}
        <Card
          className="cursor-pointer hover:border-sky/40 transition duration-200"
          onClick={() => setActivePage('purchase-request')}
        >
          <CardContent className="p-4 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Pengadaan & PO Aktif</span>
              <div className="text-2xl font-bold text-sky tabular-nums">
                {pipelineMetrics.activeImportPOsCount + pipelineMetrics.activeLocalPOsCount} PO
              </div>
              <p className="text-xs text-fg-soft">
                {pipelineMetrics.pendingPR} PR Pending • {pipelineMetrics.approvedPR} Approved
              </p>
              <div className="text-[11px] text-sky pt-1 font-medium">
                Impor: {formatUSD(pipelineMetrics.totalImportUSD)} • Lokal: {formatGram(pipelineMetrics.totalLocalGrams, 0)}
              </div>
            </div>
            <div className="p-2.5 bg-sky/10 rounded-xl text-sky border border-sky/20">
              <PlaneTakeoff size={22} />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Produksi & Ekspor */}
        <Card
          className="cursor-pointer hover:border-orange/40 transition duration-200"
          onClick={() => setActivePage('jewelry-production')}
        >
          <CardContent className="p-4 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Produksi WIP & Ekspor</span>
              <div className="text-2xl font-bold text-orange tabular-nums">
                {pipelineMetrics.activeSPKCount} SPK WIP
              </div>
              <p className="text-xs text-fg-soft">
                Alloy Karat 750 (18K) & 700
              </p>
              <div className="text-[11px] text-orange pt-1 font-medium">
                Faktur Ekspor: {formatUSD(pipelineMetrics.totalExportInvoicesUSD)} (0% PPN)
              </div>
            </div>
            <div className="p-2.5 bg-orange/10 rounded-xl text-orange border border-orange/20">
              <Hammer size={22} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================== */}
      {/* 3. BUSINESS PIPELINE TRACKER (5 TAHAP)     */}
      {/* ========================================== */}
      <Card>
        <CardHeader className="pb-3 border-b border-line">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span className="text-gold">⚡</span> Rantai Bisnis PT TAN: Dari Pengadaan hingga Ekspor
              </CardTitle>
              <CardDescription>
                Alur pergerakan fisik emas, pabean, manufaktur workshop, dan pengakuan jurnal akuntansi SAK EMKM
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-gold/30 text-gold text-xs">
              End-to-End Pipeline
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Stage 1: Pengadaan */}
            <div
              onClick={() => setActivePage('purchase-request')}
              className="p-3 rounded-lg border border-line bg-surface/50 hover:bg-surface hover:border-gold/40 cursor-pointer transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-fg-muted mb-2">
                  <span className="font-bold text-gold">TAHAP 1</span>
                  <ClipboardList size={14} className="text-gold" />
                </div>
                <div className="font-semibold text-sm text-white mb-1">Pengadaan & PO</div>
                <p className="text-[11px] text-fg-soft mb-3 leading-relaxed">
                  Permintaan PR, PO LM Impor (USD) & PO Emas Lokal (IDR).
                </p>
              </div>
              <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
                <span className="text-sky font-semibold">{pipelineMetrics.pendingPR + pipelineMetrics.approvedPR} Dokumen</span>
                <ArrowRight size={13} className="text-fg-muted" />
              </div>
            </div>

            {/* Stage 2: Penerimaan Vault */}
            <div
              onClick={() => setActivePage('goods-receipt')}
              className="p-3 rounded-lg border border-line bg-surface/50 hover:bg-surface hover:border-emerald/40 cursor-pointer transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-fg-muted mb-2">
                  <span className="font-bold text-emerald">TAHAP 2</span>
                  <PackageCheck size={14} className="text-emerald" />
                </div>
                <div className="font-semibold text-sm text-white mb-1">Penerimaan Vault</div>
                <p className="text-[11px] text-fg-soft mb-3 leading-relaxed">
                  TTB, cek assay kadar, pabean PIB/SPPB, & serah terima brankas.
                </p>
              </div>
              <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
                <span className="text-emerald font-semibold">{pipelineMetrics.totalGRN} TTB Masuk</span>
                <ArrowRight size={13} className="text-fg-muted" />
              </div>
            </div>

            {/* Stage 3: Produksi & Workshop */}
            <div
              onClick={() => setActivePage('jewelry-production')}
              className="p-3 rounded-lg border border-line bg-surface/50 hover:bg-surface hover:border-orange/40 cursor-pointer transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-fg-muted mb-2">
                  <span className="font-bold text-orange">TAHAP 3</span>
                  <Hammer size={14} className="text-orange" />
                </div>
                <div className="font-semibold text-sm text-white mb-1">Produksi Perhiasan</div>
                <p className="text-[11px] text-fg-soft mb-3 leading-relaxed">
                  Alloy karat, SPK lebur, WIP 11502, dan settlement hasil jadi.
                </p>
              </div>
              <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
                <span className="text-orange font-semibold">{pipelineMetrics.activeSPKCount} SPK Aktif</span>
                <ArrowRight size={13} className="text-fg-muted" />
              </div>
            </div>

            {/* Stage 4: Penjualan & Ekspor */}
            <div
              onClick={() => setActivePage('export-invoicing')}
              className="p-3 rounded-lg border border-line bg-surface/50 hover:bg-surface hover:border-sky/40 cursor-pointer transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-fg-muted mb-2">
                  <span className="font-bold text-sky">TAHAP 4</span>
                  <PlaneTakeoff size={14} className="text-sky" />
                </div>
                <div className="font-semibold text-sm text-white mb-1">Faktur Ekspor & DO</div>
                <p className="text-[11px] text-fg-soft mb-3 leading-relaxed">
                  Faktur USD (PPN 0%), Surat Jalan DO, PEB, dan kargo Brinks.
                </p>
              </div>
              <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
                <span className="text-sky font-semibold">{formatUSD(pipelineMetrics.totalExportInvoicesUSD)}</span>
                <ArrowRight size={13} className="text-fg-muted" />
              </div>
            </div>

            {/* Stage 5: Keuangan & Kasir */}
            <div
              onClick={() => setActivePage('accounting-reports')}
              className="p-3 rounded-lg border border-line bg-surface/50 hover:bg-surface hover:border-gold/40 cursor-pointer transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-fg-muted mb-2">
                  <span className="font-bold text-gold">TAHAP 5</span>
                  <BarChart3 size={14} className="text-gold" />
                </div>
                <div className="font-semibold text-sm text-white mb-1">Akuntansi & GL</div>
                <p className="text-[11px] text-fg-soft mb-3 leading-relaxed">
                  Voucher Kas/Bank, rekonsiliasi GL, & Laporan Keuangan EMKM.
                </p>
              </div>
              <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
                <span className="text-gold font-semibold">{journals.length} Jurnal Riil</span>
                <ArrowRight size={13} className="text-fg-muted" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================== */}
      {/* 4. VAULT BALANCES & FINANCIAL HIGHLIGHTS   */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Vault Physical Stocks Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-line">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Warehouse size={18} className="text-gold" /> Posisi Stok Fisik Brankas Vault
                  </CardTitle>
                  <CardDescription>
                    Komposisi saldo fisik emas per akun persediaan brankas (SAK EMKM)
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActivePage('warehouse-mgmt')}
                  className="text-xs"
                >
                  Buka Kartu Stok <ArrowRight size={13} className="ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Vault 1157: LM Utama / Lokal */}
                <div className="p-3.5 rounded-lg border border-line bg-surface/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gold" /> Brankas LM Lokal (1157)
                    </span>
                    <Badge variant="outline" className="border-gold/30 text-gold text-[10px]">
                      999.9 Fine Gold
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-white tabular-nums">
                    {formatGram(vaultSummary.lmMainGrams)}
                  </div>
                  <div className="text-xs text-fg-soft mt-1">
                    Antam / UBS / Pasar Lokal
                  </div>
                </div>

                {/* Vault 1158: LM Impor */}
                <div className="p-3.5 rounded-lg border border-line bg-surface/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky" /> Brankas LM Impor LBMA (1158)
                    </span>
                    <Badge variant="outline" className="border-sky/30 text-sky text-[10px]">
                      LBMA Good Delivery
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-white tabular-nums">
                    {formatGram(vaultSummary.lmImportGrams)}
                  </div>
                  <div className="text-xs text-fg-soft mt-1">
                    YLG Singapore / Valcambi
                  </div>
                </div>

                {/* Vault 11502: WIP Produksi */}
                <div className="p-3.5 rounded-lg border border-line bg-surface/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange" /> Brankas WIP Produksi (11502)
                    </span>
                    <Badge variant="outline" className="border-orange/30 text-orange text-[10px]">
                      Workshop WIP
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-white tabular-nums">
                    {formatGram(vaultSummary.wipGrams)}
                  </div>
                  <div className="text-xs text-fg-soft mt-1">
                    Alloy Karat 750 (18K) Dalam Proses
                  </div>
                </div>

                {/* Vault 1160: Perhiasan Siap Ekspor */}
                <div className="p-3.5 rounded-lg border border-line bg-surface/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald" /> Brankas Siap Ekspor (1160)
                    </span>
                    <Badge variant="outline" className="border-emerald/30 text-emerald text-[10px]">
                      Finished Goods
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-white tabular-nums">
                    {formatGram(vaultSummary.exportGrams)}
                  </div>
                  <div className="text-xs text-fg-soft mt-1">
                    Katalog Perhiasan Ekspor Terpacking
                  </div>
                </div>
              </div>

              {/* Composition Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-fg-muted font-medium">
                  <span>Distribusi Total Persediaan ({formatGram(vaultSummary.totalVaultGrams)})</span>
                  <span className="text-gold">100% Terkonservasi</span>
                </div>
                <div className="h-3 w-full bg-field rounded-full overflow-hidden flex border border-line">
                  {vaultSummary.totalVaultGrams > 0 ? (
                    <>
                      <div
                        style={{ width: `${(vaultSummary.lmMainGrams / vaultSummary.totalVaultGrams) * 100}%` }}
                        className="bg-gold h-full"
                        title={`LM Lokal: ${formatGram(vaultSummary.lmMainGrams)}`}
                      />
                      <div
                        style={{ width: `${(vaultSummary.lmImportGrams / vaultSummary.totalVaultGrams) * 100}%` }}
                        className="bg-sky h-full"
                        title={`LM Impor: ${formatGram(vaultSummary.lmImportGrams)}`}
                      />
                      <div
                        style={{ width: `${(vaultSummary.wipGrams / vaultSummary.totalVaultGrams) * 100}%` }}
                        className="bg-orange h-full"
                        title={`WIP Produksi: ${formatGram(vaultSummary.wipGrams)}`}
                      />
                      <div
                        style={{ width: `${(vaultSummary.exportGrams / vaultSummary.totalVaultGrams) * 100}%` }}
                        className="bg-emerald h-full"
                        title={`Siap Ekspor: ${formatGram(vaultSummary.exportGrams)}`}
                      />
                      <div
                        style={{ width: `${(vaultSummary.scrapGrams / vaultSummary.totalVaultGrams) * 100}%` }}
                        className="bg-rose-500 h-full"
                        title={`Scrap: ${formatGram(vaultSummary.scrapGrams)}`}
                      />
                    </>
                  ) : (
                    <div className="w-full bg-field" />
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-[11px] text-fg-soft pt-1">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gold" /> LM Lokal ({formatGram(vaultSummary.lmMainGrams, 0)})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky" /> LM Impor ({formatGram(vaultSummary.lmImportGrams, 0)})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange" /> WIP 11502 ({formatGram(vaultSummary.wipGrams, 0)})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald" /> Siap Ekspor 1160 ({formatGram(vaultSummary.exportGrams, 0)})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Scrap 1152 ({formatGram(vaultSummary.scrapGrams, 0)})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Financial Snapshot (SAK EMKM) */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-line">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BarChart3 size={18} className="text-emerald" /> Ringkasan Keuangan SAK EMKM
                  </CardTitle>
                  <CardDescription>
                    Posisi neraca & laba rugi riil dari buku besar
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActivePage('accounting-reports')}
                  className="text-xs text-gold hover:text-white"
                >
                  Laporan <ArrowRight size={13} className="ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/50 border border-line">
                <div>
                  <div className="text-xs text-fg-soft">Hutang Usaha Dagang (2111)</div>
                  <div className="text-sm font-bold text-danger tabular-nums">
                    {formatIDR(financialSummary.hutangDagang2111)}
                  </div>
                </div>
                <Badge variant="outline" className="border-danger/30 text-danger text-[10px]">
                  AP Supplier
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/50 border border-line">
                <div>
                  <div className="text-xs text-fg-soft">Piutang Usaha Ekspor (1132)</div>
                  <div className="text-sm font-bold text-sky tabular-nums">
                    {formatIDR(financialSummary.piutangEksporUSD)}
                  </div>
                </div>
                <Badge variant="outline" className="border-sky/30 text-sky text-[10px]">
                  AR Buyer Ekspor
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/50 border border-line">
                <div>
                  <div className="text-xs text-fg-soft">Pendapatan Ekspor PPN 0% (4120)</div>
                  <div className="text-sm font-bold text-emerald-light tabular-nums">
                    {formatIDR(financialSummary.revenue)}
                  </div>
                </div>
                <Badge variant="outline" className="border-emerald/30 text-emerald text-[10px]">
                  Omset
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface/50 border border-line">
                <div>
                  <div className="text-xs text-fg-soft">Laba / (Rugi) Bersih Berjalan</div>
                  <div className={`text-sm font-bold tabular-nums ${financialSummary.netProfit >= 0 ? 'text-emerald-light' : 'text-danger'}`}>
                    {formatIDR(financialSummary.netProfit)}
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] ${financialSummary.netProfit >= 0 ? 'border-emerald/30 text-emerald' : 'border-danger/30 text-danger'}`}>
                  Net Income
                </Badge>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full justify-center text-xs"
                  onClick={() => setActivePage('accounting-reports')}
                >
                  Lihat 8 Tab Laporan Keuangan SAK EMKM <ArrowRight size={13} className="ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================== */}
      {/* 5. RECENT ACTIVITIES & QUICK ACTION HUB    */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Documents & Live Audit Stream */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b border-line">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText size={18} className="text-gold" /> Aktivitas & Dokumen Transaksi Terkini
                  </CardTitle>
                  <CardDescription>
                    Log dokumen riil lintas divisi pengadaan, brankas, ekspor, dan kasir
                  </CardDescription>
                </div>
                {/* Filter tabs */}
                <div className="flex items-center gap-1 bg-field p-1 rounded-lg border border-line text-xs">
                  <button
                    onClick={() => setActivityFilter('ALL')}
                    className={`px-2.5 py-1 rounded font-medium transition ${activityFilter === 'ALL' ? 'bg-gold text-canvas font-bold' : 'text-fg-soft hover:text-white'}`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setActivityFilter('PURCHASING')}
                    className={`px-2 py-1 rounded font-medium transition ${activityFilter === 'PURCHASING' ? 'bg-gold text-canvas font-bold' : 'text-fg-soft hover:text-white'}`}
                  >
                    PO
                  </button>
                  <button
                    onClick={() => setActivityFilter('VAULT')}
                    className={`px-2 py-1 rounded font-medium transition ${activityFilter === 'VAULT' ? 'bg-gold text-canvas font-bold' : 'text-fg-soft hover:text-white'}`}
                  >
                    Vault/SPK
                  </button>
                  <button
                    onClick={() => setActivityFilter('EXPORT')}
                    className={`px-2 py-1 rounded font-medium transition ${activityFilter === 'EXPORT' ? 'bg-gold text-canvas font-bold' : 'text-fg-soft hover:text-white'}`}
                  >
                    Ekspor
                  </button>
                  <button
                    onClick={() => setActivityFilter('FINANCE')}
                    className={`px-2 py-1 rounded font-medium transition ${activityFilter === 'FINANCE' ? 'bg-gold text-canvas font-bold' : 'text-fg-soft hover:text-white'}`}
                  >
                    Kas/Bank
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipe & No. Dokumen</TableHead>
                    <TableHead>Pihak / Keterangan</TableHead>
                    <TableHead className="text-right">Nilai / Kuantitas</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center w-16">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivities.length === 0 ? (
                    <TableEmpty colSpan={5} message="Belum ada aktivitas transaksi pada kategori ini" />
                  ) : (
                    filteredActivities.map((act) => (
                      <TableRow key={act.id} className="hover:bg-gold/[0.04]">
                        <TableCell>
                          <div className="font-semibold text-white text-xs">{act.docNo}</div>
                          <div className="text-[11px] text-fg-muted flex items-center gap-1 mt-0.5">
                            <Clock size={11} /> {act.date} • {act.docType}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-white line-clamp-1">{act.entity}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs tabular-nums text-gold">
                          {act.value}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              act.statusColor === 'emerald'
                                ? 'emerald'
                                : act.statusColor === 'sky'
                                ? 'sky'
                                : act.statusColor === 'orange'
                                ? 'orange'
                                : act.statusColor === 'danger'
                                ? 'destructive'
                                : 'gold'
                            }
                            className="text-[10px] px-2 py-0.5"
                          >
                            {act.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => setActivePage(act.targetPage)}
                            className="p-1.5 rounded hover:bg-gold/15 text-fg-muted hover:text-gold transition inline-flex items-center justify-center"
                            title="Buka Modul Terkait"
                          >
                            <ArrowRight size={14} />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Quick Action Hub */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b border-line">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span className="text-gold">🚀</span> Akses Cepat Modul ERP
              </CardTitle>
              <CardDescription>
                Pintasan navigasi langsung ke modul operasional utama
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {/* Group 1: Pengadaan */}
              <div>
                <div className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Package size={12} className="text-gold" /> Pengadaan & Pembelian
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('purchase-request')}
                  >
                    <ClipboardList size={14} className="mr-1.5 text-gold" /> Form PR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('import-trading')}
                  >
                    <PlaneTakeoff size={14} className="mr-1.5 text-sky" /> PO Impor USD
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('local-trading')}
                  >
                    <ShoppingBag size={14} className="mr-1.5 text-gold" /> PO Emas Lokal
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('scrap-melting')}
                  >
                    <Flame size={14} className="mr-1.5 text-orange" /> Beli Scrap
                  </Button>
                </div>
              </div>

              {/* Group 2: Vault & Produksi */}
              <div className="pt-2 border-t border-line/60">
                <div className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Warehouse size={12} className="text-emerald" /> Vault & Produksi
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('goods-receipt')}
                  >
                    <PackageCheck size={14} className="mr-1.5 text-emerald" /> TTB Penerimaan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('jewelry-production')}
                  >
                    <Hammer size={14} className="mr-1.5 text-orange" /> SPK Produksi
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60 col-span-2"
                    onClick={() => setActivePage('warehouse-mgmt')}
                  >
                    <Warehouse size={14} className="mr-1.5 text-gold" /> Kartu Stok & Mutasi Brankas
                  </Button>
                </div>
              </div>

              {/* Group 3: Penjualan & Keuangan */}
              <div className="pt-2 border-t border-line/60">
                <div className="text-[11px] font-bold text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                  <BarChart3 size={12} className="text-sky" /> Penjualan Ekspor & Keuangan
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('export-invoicing')}
                  >
                    <FileText size={14} className="mr-1.5 text-sky" /> Faktur Ekspor
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('export-do')}
                  >
                    <Truck size={14} className="mr-1.5 text-emerald" /> Surat Jalan DO
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('voucher-mgmt')}
                  >
                    <CreditCard size={14} className="mr-1.5 text-gold" /> Voucher Kas/Bank
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs h-9 bg-surface/60"
                    onClick={() => setActivePage('accounting-reports')}
                  >
                    <BarChart3 size={14} className="mr-1.5 text-emerald-light" /> Lap. Keuangan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

