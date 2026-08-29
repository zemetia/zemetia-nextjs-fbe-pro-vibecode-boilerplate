import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/cn';
import { companyIdentity, missingCompanyFields } from '@/config/company';
import { Typography } from '@/components/ui/Typography';
import { Logo } from './Logo';

/**
 * Selembar kertas A4 — kop surat, judul, isi, dan cap keadaan dokumennya.
 *
 * Dokumen cetak di aplikasi ini adalah **halaman biasa dengan aturan cetak**,
 * bukan file PDF yang dirakit di server: layoutnya memakai token dan komponen
 * yang sama dengan seluruh aplikasi, bisa dilihat sebelum dicetak, dan berubah
 * bersama tampilan lain alih-alih menua sendiri di generator terpisah. Yang
 * menjadikannya PDF adalah dialog cetak peramban ("Simpan sebagai PDF").
 *
 * Dua hal sengaja tidak ikut ke kertas: peringatan kop surat yang belum
 * lengkap, dan seluruh perkakas layar (sidebar, tab, tombol). Keduanya
 * `print:hidden`.
 */
export interface PrintSheetProps {
  /** Judul dokumen — dicetak besar dan huruf kapital di bawah kop. */
  title: string;
  /** Baris kecil di bawah judul, mis. nomor dokumen yang dirujuk. */
  subtitle?: string;
  /**
   * Cap miring di belakang isi — "DRAFT" atau "DIBATALKAN". Dokumen yang belum
   * dikonfirmasi tetap boleh dicetak (petugas memang perlu memeriksanya di
   * kertas), tapi tidak boleh **terlihat** seperti dokumen final.
   */
  watermark?: string;
  children: ReactNode;
}

export function PrintSheet({ title, subtitle, watermark, children }: PrintSheetProps) {
  const missing = missingCompanyFields();

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-brand bg-brand-subtle px-4 py-3 print:hidden">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-foreground" aria-hidden="true" />
          <Typography variant="small" className="text-brand-foreground">
            Kop surat belum lengkap: {missing.join(', ')}. Yang kosong tidak ikut dicetak —
            lengkapi di <code className="font-mono">src/config/company.ts</code> sebelum dokumen
            ini dipakai keluar.
          </Typography>
        </div>
      )}

      <article
        data-print-sheet=""
        className={cn(
          'relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border border-border bg-surface p-10 text-foreground shadow-md',
          // Di atas kertas, marginnya sudah diatur `@page` — kotak, bayangan,
          // dan lebar maksimum di sini justru membuat isinya menciut.
          'print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none',
        )}
      >
        {watermark && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="-rotate-[24deg] text-8xl font-black tracking-widest text-destructive/10">
              {watermark}
            </span>
          </span>
        )}

        <div className="relative">
          <Letterhead />

          <header className="mt-6 text-center">
            <h1 className="text-lg font-bold tracking-widest text-foreground uppercase">{title}</h1>
            {subtitle && (
              <p className="mt-1 font-mono text-sm text-foreground-muted">{subtitle}</p>
            )}
          </header>

          <div className="mt-6 space-y-5 text-sm leading-relaxed">{children}</div>
        </div>
      </article>
    </div>
  );
}

/** Kop surat. Baris yang datanya belum diisi dilewati, bukan diisi teks pengganti. */
function Letterhead() {
  const contact = [
    companyIdentity.phone && `Telp. ${companyIdentity.phone}`,
    companyIdentity.email,
  ].filter(Boolean);

  const registration = [
    companyIdentity.npwp && `NPWP ${companyIdentity.npwp}`,
    companyIdentity.nib && `NIB ${companyIdentity.nib}`,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-4 border-b-2 border-foreground pb-4">
      <Logo size={56} />

      <div className="min-w-0 flex-1">
        <p className="text-xl leading-tight font-bold tracking-wide text-foreground">
          {companyIdentity.legalName}
        </p>
        {companyIdentity.businessLine && (
          <p className="text-xs tracking-wide text-foreground-muted uppercase">
            {companyIdentity.businessLine}
          </p>
        )}

        <div className="mt-1.5 space-y-0.5 text-xs text-foreground-muted">
          {companyIdentity.addressLines
            .filter((line) => line.trim() !== '')
            .map((line) => (
              <p key={line}>{line}</p>
            ))}
          {contact.length > 0 && <p>{contact.join(' · ')}</p>}
          {registration.length > 0 && <p>{registration.join(' · ')}</p>}
        </div>
      </div>
    </div>
  );
}

PrintSheet.displayName = 'PrintSheet';

/**
 * Garis titik-titik untuk diisi tangan — dipakai setiap kali datanya memang
 * belum ada di sistem (nomor identitas kurir, nama pejabat mitra). Lebih jujur
 * daripada "—": tanda hubung berarti "tidak ada", garis isian berarti "diisi di
 * kertas".
 */
export function PrintFillLine({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block border-b border-dotted border-foreground-subtle align-baseline', className)}
    >
      &nbsp;
    </span>
  );
}

export interface PrintFieldItem {
  label: string;
  /** Kosong / `'—'` diganti garis isian: dokumen kertas tidak mengenal "belum diisi". */
  value: string;
  mono?: boolean;
}

/** Daftar keterangan dokumen — label kiri, nilai kanan, titik dua sejajar. */
export function PrintFieldList({
  items,
  className,
}: {
  items: PrintFieldItem[];
  className?: string;
}) {
  return (
    <dl className={cn('grid grid-cols-[9rem_1fr] gap-x-2 gap-y-1', className)}>
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-foreground-muted">{item.label}</dt>
          <dd className={cn('text-foreground', item.mono && 'font-mono')}>
            <span className="mr-1 text-foreground-muted">:</span>
            {isBlank(item.value) ? <PrintFillLine className="w-40" /> : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface PrintSignatureColumn {
  /** Peran penanda tangan, mis. "Penerima Kuasa". */
  role: string;
  /** Namanya bila sistem tahu; kalau tidak, garis isian yang muncul. */
  name?: string;
  /** Baris kecil di bawah nama — jabatan, atau "Materai Rp10.000". */
  note?: string;
}

/**
 * Blok tanda tangan. Tempat & tanggalnya berdiri sendiri di atas kolom paling
 * kanan karena itulah kolom yang mewakili tempat dokumen ini dibuat.
 */
export function PrintSignature({
  place,
  date,
  columns,
}: {
  place: string;
  date: string;
  columns: PrintSignatureColumn[];
}) {
  return (
    <div className="mt-6 break-inside-avoid">
      <p className="text-right text-sm text-foreground">
        {isBlank(place) ? <PrintFillLine className="w-24" /> : place}, {date}
      </p>

      <div
        className="mt-2 grid gap-6"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <div key={column.role} className="text-center text-sm">
            <p className="text-foreground-muted">{column.role}</p>
            {column.note && <p className="mt-1 text-xs text-foreground-subtle">{column.note}</p>}

            <div className="h-16" />

            <p className="border-t border-foreground pt-1 font-medium text-foreground">
              {isBlank(column.name) ? <>&nbsp;</> : column.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** VO memakai `'—'` untuk "belum ada" — di kertas itu sama dengan kosong. */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '' || value.trim() === '—';
}
