'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { DollarSign, Globe, Menu, RefreshCw } from 'lucide-react';

import { NAV_SECTIONS, PINNED_NAV_ITEMS } from './nav.config';

export interface AdminTopbarProps {
  onOpenNav?: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Executive Dashboard & Control Center',
  '/admin/purchases/requests': 'Purchase Request (PR - Permintaan Pengadaan Barang & Bahan Operasional)',
  '/admin/purchases/import': 'Pembelian LM Import & Landed Costing',
  '/admin/purchases/local': 'Pembelian & Trading LM Lokal IDR',
  '/admin/purchases/scrap': 'Pembelian Pecahan Scrap & SPK Lebur',
  '/admin/purchases/goods-receipt': 'Penerimaan Barang Vault (Goods Receipt Note - TTB)',
  '/admin/inventory': 'Modul Gudang & Kartu Stok Brankas Vault',
  '/admin/inventory/silver-alloy': 'Penambahan Perak ke Emas Batangan (Alloy & Campuran)',
  '/admin/production': 'Produksi Perhiasan & Alloy Karat Calculator',
  '/admin/sales/local': 'Penjualan & Trading Logam Mulia Lokal IDR',
  '/admin/sales/delivery-order': 'Surat Jalan Pengeluaran Emas Lokal (Local Delivery Order & Serah Terima)',
  '/admin/sales/invoicing': 'Faktur Penjualan Emas Lokal IDR (Commercial Invoicing - PMK 48/2023)',
  '/admin/sales/orders': 'Export Sales Order (SO Ekspor & Gold Price Fixing)',
  '/admin/sales/export': 'Faktur Ekspor USD (PPN 0%)',
  '/admin/sales/export-delivery-order': 'Surat Jalan Ekspor (Export Delivery Order & Packing List)',
  '/admin/finance/vouchers': 'Manajemen Voucher Kas & Bank (BKK / BKM / BBK / BBM / BCK)',
  '/admin/finance/cheques': 'Master Buku Cek / Bilyet Giro & Kontrol Plafon Bank',
  '/admin/reports/accounting': 'Jurnal Mutasi & Laporan Keuangan SAK EMKM',
  '/admin/accounts': 'Setting COA SAK EMKM',
  '/admin/partners': 'Master Supplier Emas (Impor & Lokal)',
  '/admin/partners/customers': 'Master Customer & Buyer Ekspor',
  '/admin/supplies': 'Master Emas & Bahan Baku',
  '/admin/inventory/models': 'Master Finished Goods (Katalog Perhiasan Emas Ekspor)',
  '/admin/system/settings': 'Setting Logo Perusahaan, Backup & Restore Database System',
  '/admin/users': 'Manajemen Pengguna Sistem',
  '/admin/roles': 'Setting Role & Hak Akses Pengguna',
  '/admin/approvals': 'Persetujuan Otorisasi Direktur Utama',
};

function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdminTopbar({ onOpenNav }: AdminTopbarProps) {
  const pathname = usePathname() ?? '';
  const [rate, setRate] = useState<number>(16250);
  const [loading, setLoading] = useState<boolean>(false);

  const loadRate = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.IDR) {
          setRate(Math.round(data.rates.IDR));
        }
      }
    } catch {
      // Fallback ke benchmark Rp 16.250
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.rates?.IDR) {
          setRate(Math.round(data.rates.IDR));
        }
      })
      .catch(() => {
        // Fallback ke benchmark Rp 16.250
      });

    return () => {
      active = false;
    };
  }, []);

  const title =
    PAGE_TITLES[pathname] ||
    NAV_SECTIONS.flatMap((s) => s.items)
      .concat(PINNED_NAV_ITEMS)
      .find((item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`)))?.label ||
    'PT TAN Enterprise ERP';

  return (
    <header className="glass-panel mb-7 flex items-center justify-between rounded-md px-7 py-4">
      <div className="flex items-center gap-3">
        {onOpenNav && (
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="Buka navigasi"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-soft hover:bg-white/5 hover:text-fg md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <h1 className="font-heading text-[1.4rem] font-bold text-fg">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="badge badge-gold cursor-pointer"
          onClick={loadRate}
          title="Klik untuk Refresh Kurs BCA e-Rate Terbaru"
        >
          <DollarSign size={14} />
          <span>USD/IDR: {formatIDR(rate)}</span>
          <RefreshCw size={12} className={loading ? 'ml-1 animate-spin' : 'ml-1'} />
        </div>
        <div className="badge badge-emerald hidden sm:inline-flex">
          <Globe size={14} />
          <span>Market: EXPORT ONLY (PPN 0%)</span>
        </div>
      </div>
    </header>
  );
}

AdminTopbar.displayName = 'AdminTopbar';
