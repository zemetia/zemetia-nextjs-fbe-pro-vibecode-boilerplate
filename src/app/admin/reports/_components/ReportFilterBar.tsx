'use client';

import { CalendarRange } from 'lucide-react';

import { toDateOnly, today } from '@/lib/date';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Typography } from '@/components/ui/Typography';

/**
 * Periode laporan — dua tanggal dan beberapa pintasan.
 *
 * Periodenya **tidak punya nilai awal yang menyembunyikan data**: laporan yang
 * terbuka dengan filter "bulan ini" akan membuat orang yang mencari transaksi
 * Juli menyimpulkan datanya hilang. Pintasan disediakan; memilihnya keputusan
 * pembacanya.
 *
 * Tanggalnya milik pemanggil (`from`/`to`), bukan state di dalam sini — halaman
 * yang menaruhnya di URL atau menyimpannya suatu hari tidak perlu membongkar
 * komponen ini.
 */
export interface ReportPeriod {
  from: Date | undefined;
  to: Date | undefined;
}

export interface ReportFilterBarProps {
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  disabled?: boolean;
  /** Filter tambahan milik laporannya sendiri — rail, logam, status, ember. */
  children?: React.ReactNode;
}

/** Awal bulan berjalan, di kalender yang sedang dilihat penggunanya. */
function startOfMonth(): Date {
  const now = today();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfYear(): Date {
  const now = today();
  return new Date(now.getFullYear(), 0, 1);
}

export function ReportFilterBar({
  period,
  onPeriodChange,
  disabled = false,
  children,
}: ReportFilterBarProps) {
  const presets: { label: string; period: ReportPeriod }[] = [
    { label: 'Bulan ini', period: { from: startOfMonth(), to: today() } },
    { label: 'Tahun ini', period: { from: startOfYear(), to: today() } },
    { label: 'Semua', period: { from: undefined, to: undefined } },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <DatePicker
          label="Dari tanggal"
          value={period.from}
          onChange={(from) => onPeriodChange({ ...period, from })}
          maxDate={period.to}
          disabled={disabled}
          placeholder="Awal periode"
          className="w-full sm:w-52"
        />

        <DatePicker
          label="Sampai tanggal"
          value={period.to}
          onChange={(to) => onPeriodChange({ ...period, to })}
          minDate={period.from}
          disabled={disabled}
          placeholder="Akhir periode"
          className="w-full sm:w-52"
        />

        {children}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="h-4 w-4 text-foreground-subtle" aria-hidden="true" />
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onPeriodChange(preset.period)}
          >
            {preset.label}
          </Button>
        ))}
        <Typography variant="muted" className="text-xs">
          Periode disaring dari tanggal dokumen, bukan tanggal barang datang.
        </Typography>
      </div>
    </div>
  );
}

ReportFilterBar.displayName = 'ReportFilterBar';

/** Periode → parameter API. Kosong berarti tidak menyaring, bukan "hari ini". */
export function toPeriodParams(period: ReportPeriod): { date_from?: string; date_to?: string } {
  return {
    ...(period.from ? { date_from: toDateOnly(period.from) } : {}),
    ...(period.to ? { date_to: toDateOnly(period.to) } : {}),
  };
}
