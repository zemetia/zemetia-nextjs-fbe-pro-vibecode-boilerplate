'use client';

import { useQuery } from '@tanstack/react-query';

import { apiErrorMessage, supplyService } from '@/services';
import { Combobox } from '@/components/ui/Combobox';
import type { SupplyCategory, SupplyVO } from '@/types/value-objects';

const STALE_TIME = 30 * 60 * 1000;
const OPTION_LIMIT = 100;

export interface SupplyPickerProps {
  value: string;
  onChange: (supply: SupplyVO) => void;
  category?: SupplyCategory;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Picker barang non-logam (Supply) untuk baris form PR atau modul supplies.
 * Mengembalikan objek SupplyVO utuh agar form langsung mendapatkan satuan (unit)
 * dan referensi harga perkiraan terakhir (lastPriceIdr).
 */
export function SupplyPicker({
  value,
  onChange,
  category,
  label,
  error,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: SupplyPickerProps) {
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['supplies', 'options', { category }],
    queryFn: () => supplyService.list({ is_active: true, category, limit: OPTION_LIMIT }),
    staleTime: STALE_TIME,
  });

  const options = (data?.items ?? []).map((supply) => ({
    value: supply.id,
    label: supply.label,
  }));

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
            const supply = data?.items.find((candidate) => candidate.id === id);
            if (supply) onChange(supply);
          }}
          loading={isLoading}
          disabled={disabled}
          placeholder="Pilih barang non-logam…"
          searchPlaceholder="Cari kode atau nama supply…"
          emptyText="Belum ada barang non-logam aktif di master."
          aria-label={ariaLabel ?? label ?? 'Barang Non-Logam'}
        />

        {isError && (
          <p className="text-xs text-destructive">
            {apiErrorMessage(queryError, 'Daftar barang non-logam gagal dimuat.')}
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

SupplyPicker.displayName = 'SupplyPicker';
