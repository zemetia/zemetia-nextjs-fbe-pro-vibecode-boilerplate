'use client';

import { useQuery } from '@tanstack/react-query';

import { apiErrorMessage, unitService } from '@/services';
import { Combobox } from '@/components/ui/Combobox';
import type { UnitVO } from '@/types/value-objects';

const STALE_TIME = 30 * 60 * 1000;

export interface MeasurementUnitPickerProps {
  value: string;
  onChange: (unit: UnitVO) => void;
  /** Batasi ke satu kategori (mis. `WEIGHT` untuk baris logam). Kosongkan untuk semua kategori. */
  categoryCode?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Picker satuan (`Unit` master, `unit.prisma`) untuk baris Purchase Request.
 * Mengembalikan `UnitVO` utuh agar form langsung punya `conversionFactor` dan
 * `categoryCode` untuk pratinjau konversi — server tetap menjadi sumber
 * kebenaran saat menyimpan.
 */
export function MeasurementUnitPicker({
  value,
  onChange,
  categoryCode,
  label,
  error,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: MeasurementUnitPickerProps) {
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['units', 'options', { categoryCode }],
    queryFn: () => unitService.listUnits(categoryCode),
    staleTime: STALE_TIME,
  });

  const options = (data ?? [])
    .filter((unit) => unit.isActive)
    .map((unit) => ({ value: unit.id, label: unit.label }));

  return (
    <div className={className}>
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <span className="text-sm font-medium text-foreground">
            {label}
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          </span>
        )}

        <Combobox
          options={options}
          value={value}
          onValueChange={(id) => {
            const unit = data?.find((candidate) => candidate.id === id);
            if (unit) onChange(unit);
          }}
          loading={isLoading}
          disabled={disabled}
          placeholder="Pilih satuan…"
          searchPlaceholder="Cari satuan…"
          emptyText="Belum ada satuan aktif di master."
          aria-label={ariaLabel ?? label ?? 'Satuan'}
        />

        {isError && (
          <p className="text-xs text-destructive">
            {apiErrorMessage(queryError, 'Daftar satuan gagal dimuat.')}
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

MeasurementUnitPicker.displayName = 'MeasurementUnitPicker';
