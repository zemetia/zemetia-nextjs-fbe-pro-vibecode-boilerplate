// Registry halaman — satu-satunya tempat pendaftaran halaman.
// App.jsx membaca `component` + `title`; Sidebar.jsx membaca PAGE_GROUPS + `label` + `icon`.

import {
  LayoutDashboard, ShoppingCart, PlaneTakeoff, Flame,
  FileText, CreditCard, Warehouse, BookOpen, Package,
  Users, Truck, Hammer, BarChart3, Settings, Sparkles, ShoppingBag, PackageCheck
} from 'lucide-react';

import Dashboard from '../pages/Dashboard';
import LmImportTrading from '../pages/LmImportTrading';
import LmLocalTrading from '../pages/LmLocalTrading';
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
    label: 'Executive Dashboard',
    icon: LayoutDashboard,
    component: Dashboard
  },
  {
    id: 'import-trading',
    title: 'Pembelian LM Import & Landed Costing',
    label: 'PO LM Import & Landed Cost',
    icon: PlaneTakeoff,
    component: LmImportTrading
  },
  {
    id: 'local-trading',
    title: 'Pembelian & Trading LM Lokal IDR',
    label: 'PO LM Lokal IDR',
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
    label: 'Penerimaan Barang (TTB / GRN)',
    icon: PackageCheck,
    component: GoodsReceiptPage
  },
  {
    id: 'jewelry-production',
    title: 'Produksi Perhiasan & Alloy Karat Calculator',
    label: 'Produksi Perhiasan & Alloy',
    icon: Hammer,
    component: JewelryProduction
  },
  {
    id: 'export-so',
    title: 'Export Sales Order (SO Ekspor & Gold Price Fixing)',
    label: 'Export Sales Order (Price Fixing)',
    icon: ShoppingBag,
    component: ExportSalesOrderPage
  },
  {
    id: 'export-invoicing',
    title: 'Faktur Ekspor USD (PPN 0%)',
    label: 'Faktur Ekspor USD (PPN 0%)',
    icon: FileText,
    component: ExportInvoicing
  },
  {
    id: 'export-do',
    title: 'Surat Jalan Ekspor (Export Delivery Order & Packing List)',
    label: 'Surat Jalan Ekspor (Delivery Order)',
    icon: Truck,
    component: ExportDeliveryOrderPage
  },
  {
    id: 'warehouse-mgmt',
    title: 'Modul Gudang & Kartu Stok Brankas Vault',
    label: 'Posisi Vault & Kartu Stok',
    icon: Warehouse,
    component: WarehouseManagement
  },
  {
    id: 'voucher-mgmt',
    title: 'Manajemen Voucher Kas & Bank (BKK / BKM / BBK / BBM / BCK)',
    label: 'Voucher Kas/Bank & Cek BG',
    icon: CreditCard,
    component: VoucherManagement
  },
  {
    id: 'master-cheques',
    title: 'Master Buku Cek / Bilyet Giro & Kontrol Plafon Bank',
    label: 'Master Buku Cek & Limit Bank',
    icon: BookOpen,
    component: MasterChequePage
  },
  {
    id: 'master-finished-goods',
    title: 'Master Finished Goods (Katalog Perhiasan Emas Ekspor)',
    label: 'Master Finished Goods (Perhiasan)',
    icon: Sparkles,
    component: MasterFinishedGoods
  },
  {
    id: 'master-items',
    title: 'Master Emas & Bahan Baku',
    label: 'Master Emas & Bahan Baku',
    icon: Package,
    component: MasterItemPage
  },
  {
    id: 'master-customers',
    title: 'Master Customer & Buyer Ekspor',
    label: 'Master Buyer Ekspor',
    icon: Users,
    component: MasterCustomer
  },
  {
    id: 'master-suppliers',
    title: 'Master Supplier Emas (Impor & Lokal)',
    label: 'Master Supplier Emas',
    icon: Truck,
    component: MasterSupplier
  },
  {
    id: 'accounting-reports',
    title: 'Jurnal Mutasi & Laporan Keuangan SAK EMKM',
    label: 'Jurnal Mutasi & Laporan Keuangan',
    icon: BarChart3,
    component: AccountingReports
  },
  {
    id: 'coa-setting',
    title: 'Setting COA SAK EMKM',
    label: 'Setting COA SAK EMKM',
    icon: BookOpen,
    component: ChartOfAccounts
  },
  {
    id: 'system-settings',
    title: 'Setting Logo Perusahaan, Backup & Restore Database System',
    label: 'Setting Logo, Backup & Restore',
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
    title: '📦 MODUL PEMBELIAN',
    items: ['import-trading', 'local-trading', 'scrap-melting', 'goods-receipt', 'master-suppliers']
  },
  {
    id: 'sales',
    title: '🏷️ MODUL PENJUALAN',
    items: ['export-so', 'export-invoicing', 'export-do', 'master-customers']
  },
  {
    id: 'vault',
    title: '🏛️ GUDANG VAULT & OPERASIONAL',
    items: [
      'warehouse-mgmt',
      { id: 'goods-receipt', label: 'Penerimaan Barang (TTB)' },
      'jewelry-production',
      'master-finished-goods',
      'master-items'
    ]
  },
  {
    id: 'accounting',
    title: '💼 AKUNTANSI & KEUANGAN',
    items: ['accounting-reports', 'voucher-mgmt', 'master-cheques', 'coa-setting']
  },
  {
    id: 'system',
    title: '⚙️ SETTING & UTILITY',
    items: ['system-settings']
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
