import {
  BarChart3,
  BookOpen,
  BookText,
  Coins,
  CreditCard,
  FileText,
  Flame,
  FolderTree,
  Gem,
  Globe,
  Hammer,
  Handshake,
  KeyRound,
  Layers,
  Package,
  PackageCheck,
  Plane,
  Receipt,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Users,
  Vault,
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

/**
 * Sidebar navigation configuration.
 * Mengorganisir menu berdasarkan modul proses bisnis ERP PT TAN.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'administration',
    label: 'Administrasi',
    items: [
      { href: '/admin/users', label: 'Pengguna', icon: Users, permission: 'users:list' },
      { href: '/admin/roles', label: 'Role & Izin', icon: KeyRound, permission: 'roles:list' },
      {
        href: '/admin/accounts',
        label: 'Bagan Akun',
        icon: FolderTree,
        permission: 'accounts:list',
      },
    ],
  },
  {
    id: 'approvals',
    label: 'Persetujuan',
    items: [
      {
        href: '/admin/approvals',
        label: 'Konfirmasi Direktur',
        icon: ShieldCheck,
        permission: 'approvals:list',
      },
    ],
  },
  {
    id: 'purchasing',
    label: 'Pembelian',
    items: [
      {
        href: '/admin/purchases/requests' as Route,
        label: 'Purchase Request (PR)',
        icon: FileText,
        permission: 'purchase-requests:list',
      },
      {
        href: '/admin/purchases/local' as Route,
        label: 'PO Emas Lokal',
        icon: Coins,
        permission: 'purchase-requests:list',
      },
      {
        href: '/admin/purchases/import' as Route,
        label: 'PO Emas Impor',
        icon: Globe,
        permission: 'purchase-requests:list',
      },
      {
        href: '/admin/purchases/scrap' as Route,
        label: 'Beli Scrap & Lebur',
        icon: Flame,
        permission: 'purchase-requests:list',
      },
      {
        href: '/admin/purchases/goods-receipt' as Route,
        label: 'Penerimaan Barang (TTB)',
        icon: PackageCheck,
        permission: 'purchase-requests:list',
      },
      {
        href: '/admin/partners' as Route,
        label: 'Master Supplier',
        icon: Handshake,
        permission: 'partners:list',
      },
    ],
  },
  {
    id: 'vault',
    label: 'Gudang & Vault',
    items: [
      {
        href: '/admin/inventory' as Route,
        label: 'Posisi Logam',
        icon: Vault,
        permission: 'metal-lots:positions',
      },
      {
        href: '/admin/inventory/lots' as Route,
        label: 'Lot Logam',
        icon: Package,
        permission: 'metal-lots:list',
      },
      {
        href: '/admin/inventory/models' as Route,
        label: 'Model Perhiasan',
        icon: Gem,
        permission: 'partners:list',
      },
      {
        href: '/admin/supplies' as Route,
        label: 'Barang Non-Logam',
        icon: Layers,
        permission: 'supplies:list',
      },
      {
        href: '/admin/production' as Route,
        label: 'SPK Produksi',
        icon: Hammer,
        permission: 'production-orders:list',
      },
    ],
  },
  {
    id: 'sales',
    label: 'Penjualan',
    items: [
      {
        href: '/admin/sales/orders' as Route,
        label: 'Order Penjualan',
        icon: ShoppingCart,
        permission: 'partners:list',
      },
      {
        href: '/admin/sales/export' as Route,
        label: 'Penjualan Ekspor',
        icon: Plane,
        permission: 'partners:list',
      },
    ],
  },
  {
    id: 'accounting',
    label: 'Akuntansi & Keuangan',
    items: [
      {
        href: '/admin/finance/vouchers' as Route,
        label: 'Voucher Keuangan',
        icon: Receipt,
        permission: 'cash-vouchers:list',
      },
      {
        href: '/admin/finance/cheques' as Route,
        label: 'Master Buku Cek',
        icon: CreditCard,
        permission: 'cash-vouchers:list',
      },
      {
        href: '/admin/reports/accounting' as Route,
        label: 'Laporan Keuangan',
        icon: BarChart3,
        permission: 'ledger-reports:general-ledger',
      },
      {
        href: '/admin/accounting/journals' as Route,
        label: 'Jurnal Umum',
        icon: BookOpen,
        permission: 'journal-entries:list',
      },
      {
        href: '/admin/reports/accounting/ledger' as Route,
        label: 'Buku Besar',
        icon: BookText,
        permission: 'ledger-reports:general-ledger',
      },
      {
        href: '/admin/reports/accounting/trial-balance' as Route,
        label: 'Neraca Saldo',
        icon: Scale,
        permission: 'ledger-reports:trial-balance',
      },
    ],
  },
];
