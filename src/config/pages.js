// Registry halaman — satu-satunya tempat pendaftaran halaman.
// App.jsx membaca `component` + `title`; Sidebar.jsx membaca PAGE_GROUPS + `label` + `icon`.

import {
  LayoutDashboard, ShoppingCart, PlaneTakeoff, Flame,
  FileText, CreditCard, Warehouse, BookOpen, Package,
  Users, Truck, Hammer, BarChart3, Settings, Sparkles, ShoppingBag, PackageCheck, ClipboardList
} from 'lucide-react';

import Dashboard from '../pages/Dashboard';
import LmImportTrading from '../pages/LmImportTrading';
import LmLocalTrading from '../pages/LmLocalTrading';
import PurchaseRequestPage from '../pages/PurchaseRequestPage';
import BuyingScrapMelting from '../pages/BuyingScrapMelting';
import GoodsReceiptPage from '../pages/GoodsReceiptPage';
import JewelryProduction from '../pages/JewelryProduction';
import ExportSalesOrderPage from '../pages/ExportSalesOrderPage';
import ExportInvoicing from '../pages/ExportInvoicing';
import ExportDeliveryOrderPage from '../pages/ExportDeliveryOrderPage';
import WarehouseManagement from '../pages/WarehouseManagement';
import VoucherManagement from '../pages/VoucherManagement';
import MasterChequePage from '../pages/MasterChequePage';
import MasterFinishedGoods from '../pages/MasterFinishedGoods';
import MasterItemPage from '../pages/MasterItemPage';
import MasterCustomer from '../pages/MasterCustomer';
import MasterSupplier from '../pages/MasterSupplier';
import AccountingReports from '../pages/AccountingReports';
import ChartOfAccounts from '../pages/ChartOfAccounts';
import SystemSettingsPage from '../pages/SystemSettingsPage';

export const DEFAULT_PAGE_ID = 'dashboard';
export const DEFAULT_PAGE_TITLE = 'PT TAN Enterprise ERP';

// title  = judul panjang di Navbar
// label  = label pendek di Sidebar
export const PAGES = [
  {
    id: 'dashboard',
    title: 'Executive Dashboard & Control Center',
    label: 'Dashboard',
    icon: LayoutDashboard,
    component: Dashboard
  },
  {
    id: 'purchase-request',
    title: 'Purchase Request (PR - Permintaan Pengadaan Barang & Bahan Operasional)',
    label: 'Purchase Request',
    icon: ClipboardList,
    component: PurchaseRequestPage
  },
  {
    id: 'import-trading',
    title: 'Pembelian LM Import & Landed Costing',
    label: 'PO Emas Impor',
    icon: PlaneTakeoff,
    component: LmImportTrading
  },
  {
    id: 'local-trading',
    title: 'Pembelian & Trading LM Lokal IDR',
    label: 'PO Emas Lokal',
    icon: ShoppingCart,
    component: LmLocalTrading
  },
  {
    id: 'scrap-melting',
    title: 'Pembelian Pecahan Scrap & SPK Lebur',
    label: 'Beli Scrap & Lebur',
    icon: Flame,
    component: BuyingScrapMelting
  },
  {
    id: 'goods-receipt',
    title: 'Penerimaan Barang Vault (Goods Receipt Note - TTB)',
    label: 'Penerimaan Barang (TTB)',
    icon: PackageCheck,
    component: GoodsReceiptPage
  },
  {
    id: 'warehouse-mgmt',
    title: 'Modul Gudang & Kartu Stok Brankas Vault',
    label: 'Stok & Kartu Vault',
    icon: Warehouse,
    component: WarehouseManagement
  },
  {
    id: 'jewelry-production',
    title: 'Produksi Perhiasan & Alloy Karat Calculator',
    label: 'Produksi Perhiasan',
    icon: Hammer,
    component: JewelryProduction
  },
  {
    id: 'export-so',
    title: 'Export Sales Order (SO Ekspor & Gold Price Fixing)',
    label: 'Sales Order Ekspor',
    icon: ShoppingBag,
    component: ExportSalesOrderPage
  },
  {
    id: 'export-invoicing',
    title: 'Faktur Ekspor USD (PPN 0%)',
    label: 'Faktur Ekspor',
    icon: FileText,
    component: ExportInvoicing
  },
  {
    id: 'export-do',
    title: 'Surat Jalan Ekspor (Export Delivery Order & Packing List)',
    label: 'Surat Jalan Ekspor',
    icon: Truck,
    component: ExportDeliveryOrderPage
  },
  {
    id: 'voucher-mgmt',
    title: 'Manajemen Voucher Kas & Bank (BKK / BKM / BBK / BBM / BCK)',
    label: 'Voucher Kas & Bank',
    icon: CreditCard,
    component: VoucherManagement
  },
  {
    id: 'master-cheques',
    title: 'Master Buku Cek / Bilyet Giro & Kontrol Plafon Bank',
    label: 'Master Buku Cek',
    icon: BookOpen,
    component: MasterChequePage
  },
  {
    id: 'accounting-reports',
    title: 'Jurnal Mutasi & Laporan Keuangan SAK EMKM',
    label: 'Laporan Keuangan',
    icon: BarChart3,
    component: AccountingReports
  },
  {
    id: 'coa-setting',
    title: 'Setting COA SAK EMKM',
    label: 'Bagan Akun (COA)',
    icon: BookOpen,
    component: ChartOfAccounts
  },
  {
    id: 'master-suppliers',
    title: 'Master Supplier Emas (Impor & Lokal)',
    label: 'Master Supplier',
    icon: Truck,
    component: MasterSupplier
  },
  {
    id: 'master-items',
    title: 'Master Emas & Bahan Baku',
    label: 'Master Bahan Baku',
    icon: Package,
    component: MasterItemPage
  },
  {
    id: 'master-finished-goods',
    title: 'Master Finished Goods (Katalog Perhiasan Emas Ekspor)',
    label: 'Master Perhiasan',
    icon: Sparkles,
    component: MasterFinishedGoods
  },
  {
    id: 'master-customers',
    title: 'Master Customer & Buyer Ekspor',
    label: 'Master Customer',
    icon: Users,
    component: MasterCustomer
  },
  {
    id: 'system-settings',
    title: 'Setting Logo Perusahaan, Backup & Restore Database System',
    label: 'Pengaturan Sistem',
    icon: Settings,
    component: SystemSettingsPage
  }
];

// Halaman yang dipasang di atas sidebar, di luar grup mana pun.
export const PINNED_PAGE_IDS = ['dashboard'];

// items: id halaman, atau { id, label } bila label sidebar-nya berbeda di grup ini.
export const PAGE_GROUPS = [
  {
    id: 'purchasing',
    title: '📦 PEMBELIAN',
    items: [
      'purchase-request',
      'import-trading',
      'local-trading',
      'scrap-melting',
      'goods-receipt',
      'master-suppliers'
    ]
  },
  {
    id: 'vault',
    title: '🏛️ GUDANG & VAULT',
    items: [
      { id: 'goods-receipt', label: 'Penerimaan Barang (TTB)' },
      'warehouse-mgmt',
      'jewelry-production',
      'master-items',
      'master-finished-goods'
    ]
  },
  {
    id: 'sales',
    title: '🏷️ PENJUALAN',
    items: [
      'export-so',
      'export-invoicing',
      'export-do',
      'master-customers'
    ]
  },
  {
    id: 'accounting',
    title: '💼 AKUNTANSI & KEUANGAN',
    items: [
      'voucher-mgmt',
      'master-cheques',
      'accounting-reports',
      'coa-setting'
    ]
  },
  {
    id: 'system',
    title: '⚙️ PENGATURAN',
    items: [
      'system-settings'
    ]
  }
];

const PAGE_BY_ID = new Map(PAGES.map(p => [p.id, p]));

export const getPage = (id) => PAGE_BY_ID.get(id) || null;

export const getPageTitle = (id) => PAGE_BY_ID.get(id)?.title || DEFAULT_PAGE_TITLE;

// Menyusun entri menu satu grup: { id, label, icon }. Id yang tidak terdaftar dibuang.
export const getMenuItems = (items) =>
  items
    .map(entry => (typeof entry === 'string' ? { id: entry } : entry))
    .map(ref => {
      const page = PAGE_BY_ID.get(ref.id);
      if (!page) return null;
      return { id: page.id, label: ref.label || page.label, icon: ref.icon || page.icon };
    })
    .filter(Boolean);
