import {
  BarChart3,
  BookMarked,
  BookOpen,
  ClipboardList,
  Coins,
  CreditCard,
  FileText,
  Flame,
  FolderTree,
  Hammer,
  KeyRound,
  LayoutDashboard,
  Package,
  PackageCheck,
  PlaneTakeoff,
  Scale,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';

import type { PermissionKey } from '@/lib/permissions';

export interface NavItem {
  readonly href: Route;
  readonly label: string;
  readonly icon: LucideIcon;
  /** UI-hint gate only — the page itself enforces requirePermission() server-side. */
  readonly permission: PermissionKey;
}

export interface NavSection {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

/** Pinned menu item (Dashboard) */
export const PINNED_NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/admin' as Route,
    label: 'Dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard:view',
  },
];

/**
 * Sidebar navigation configuration.
 * Mengorganisir menu berdasarkan 5 grup resmi PT TAN ERP.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'purchasing',
    label: '📦 PEMBELIAN',
    items: [
      {
        href: '/admin/purchases/requests' as Route,
        label: 'Purchase Request',
        icon: ClipboardList,
        permission: 'purchase-requests:list',
      },
      {
        href: '/admin/purchases/import' as Route,
        label: 'PO Emas Impor',
        icon: PlaneTakeoff,
        permission: 'import-purchases:list',
      },
      {
        href: '/admin/purchases/local' as Route,
        label: 'PO Emas Lokal',
        icon: ShoppingCart,
        permission: 'local-purchases:list',
      },
      {
        href: '/admin/purchases/scrap' as Route,
        label: 'Beli Scrap & Lebur',
        icon: Flame,
        permission: 'scrap-purchases:list',
      },
      {
        href: '/admin/purchases/goods-receipt' as Route,
        label: 'Penerimaan Barang (TTB)',
        icon: PackageCheck,
        permission: 'goods-receipts:list',
      },
      {
        href: '/admin/partners' as Route,
        label: 'Master Supplier',
        icon: Truck,
        permission: 'partners:list',
      },
    ],
  },
  {
    id: 'vault',
    label: '🏛️ GUDANG & VAULT',
    items: [
      {
        href: '/admin/purchases/goods-receipt' as Route,
        label: 'Penerimaan Barang (TTB)',
        icon: PackageCheck,
        permission: 'goods-receipts:list',
      },
      {
        href: '/admin/sales/delivery-order' as Route,
        label: 'Surat Jalan Pengeluaran (Lokal)',
        icon: Truck,
        permission: 'local-deliveries:list',
      },
      {
        href: '/admin/sales/export-delivery-order' as Route,
        label: 'Surat Jalan Pengeluaran (Ekspor)',
        icon: Truck,
        permission: 'export-deliveries:list',
      },
      {
        href: '/admin/inventory' as Route,
        label: 'Stok & Kartu Vault',
        icon: Warehouse,
        permission: 'metal-lots:positions',
      },
      {
        href: '/admin/inventory/silver-alloy' as Route,
        label: 'Tambah Perak (Alloy)',
        icon: Coins,
        permission: 'silver-alloy:list',
      },
      {
        href: '/admin/production' as Route,
        label: 'Produksi Perhiasan',
        icon: Hammer,
        permission: 'production-orders:list',
      },
      {
        href: '/admin/supplies' as Route,
        label: 'Master Bahan Baku',
        icon: Package,
        permission: 'supplies:list',
      },
      {
        href: '/admin/inventory/models' as Route,
        label: 'Master Perhiasan',
        icon: Sparkles,
        permission: 'finished-goods:list',
      },
      {
        href: '/admin/units' as Route,
        label: 'Master Satuan & Konversi',
        icon: Scale,
        permission: 'units:list',
      },
    ],
  },
  {
    id: 'sales',
    label: '🏷️ PENJUALAN',
    items: [
      {
        href: '/admin/sales/local' as Route,
        label: 'Penjualan Emas Lokal',
        icon: ShoppingBag,
        permission: 'local-sales:list',
      },
      {
        href: '/admin/sales/delivery-order' as Route,
        label: 'Surat Jalan Lokal',
        icon: Truck,
        permission: 'local-deliveries:list',
      },
      {
        href: '/admin/sales/invoicing' as Route,
        label: 'Faktur Penjualan Lokal',
        icon: FileText,
        permission: 'local-invoices:list',
      },
      {
        href: '/admin/sales/orders' as Route,
        label: 'Sales Order Ekspor',
        icon: ShoppingBag,
        permission: 'export-sales-orders:list',
      },
      {
        href: '/admin/sales/export' as Route,
        label: 'Faktur Ekspor (USD)',
        icon: FileText,
        permission: 'export-invoices:list',
      },
      {
        href: '/admin/sales/export-delivery-order' as Route,
        label: 'Surat Jalan Ekspor',
        icon: Truck,
        permission: 'export-deliveries:list',
      },
      {
        href: '/admin/partners/customers' as Route,
        label: 'Master Customer',
        icon: Users,
        permission: 'customers:list',
      },
    ],
  },
  {
    id: 'accounting',
    label: '💼 AKUNTANSI & KEUANGAN',
    items: [
      {
        href: '/admin/accounting/journals' as Route,
        label: 'Jurnal Umum',
        icon: BookMarked,
        permission: 'journal-entries:list',
      },
      {
        href: '/admin/finance/vouchers' as Route,
        label: 'Voucher Kas & Bank',
        icon: CreditCard,
        permission: 'cash-vouchers:list',
      },
      {
        href: '/admin/finance/cheques' as Route,
        label: 'Master Buku Cek',
        icon: BookOpen,
        permission: 'cheques:list',
      },
      {
        href: '/admin/reports/accounting' as Route,
        label: 'Laporan Keuangan',
        icon: BarChart3,
        permission: 'financial-reports:view',
      },
      {
        href: '/admin/accounts' as Route,
        label: 'Bagan Akun (COA)',
        icon: FolderTree,
        permission: 'accounts:list',
      },
    ],
  },
  {
    id: 'system',
    label: '⚙️ PENGATURAN',
    items: [
      {
        href: '/admin/system/settings' as Route,
        label: 'Pengaturan Sistem',
        icon: FolderTree,
        permission: 'system-settings:view',
      },
      {
        href: '/admin/users' as Route,
        label: 'Pengguna',
        icon: Users,
        permission: 'users:list',
      },
      {
        href: '/admin/roles' as Route,
        label: 'Role & Izin',
        icon: KeyRound,
        permission: 'roles:list',
      },
      {
        href: '/admin/approvals' as Route,
        label: 'Persetujuan Direktur',
        icon: ShieldCheck,
        permission: 'approvals:list',
      },
    ],
  },
];
