'use client';

import { useQuery } from '@tanstack/react-query';

import { apiErrorMessage, productService } from '@/services';
import { Combobox } from '@/components/ui/Combobox';
import type { ProductVO } from '@/types/value-objects';

/** Master barang jarang berubah — sekali ambil cukup untuk satu sesi pengisian. */
const STALE_TIME = 30 * 60 * 1000;

/**
 * Boleh dipilih, tampil tapi terkunci, atau tidak ditampilkan sama sekali.
 * Pemanggil yang memutuskan — pickernya tidak tahu apa-apa soal rail dokumen.
 */
export type ProductAvailability = 'available' | 'unavailable' | 'hidden';

export interface ProductPickerProps {
  value: string;
  /** Menerima produknya, bukan hanya id: barisnya butuh aturan kadar & sertifikatnya. */
  onChange: (product: ProductVO) => void;
  /**
   * Menyaring daftarnya per barang. Barang `unavailable` tetap muncul dengan
   * keterangan agar petugas tahu tempatnya memang di situ — menyembunyikannya
   * membuat orang mencarinya di layar lain. Default: semuanya boleh dipilih.
   */
  availability?: (product: ProductVO) => ProductAvailability;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Field barang untuk baris dokumen.
 *
 * Mengembalikan produknya utuh karena pemanggil selalu butuh lebih dari id-nya:
 * kadar terkunci atau tidak, kepingnya wajib dirinci atau tidak, dan harga
 * dikalikan berat kotor atau berat murni. Membiarkan pemanggil mencari sendiri
 * di daftar berarti tiap form mengulang pencarian yang sama — dan sebagiannya
 * akan lupa.
 */
export function ProductPicker({
  value,
  onChange,
  availability,
  label,
  error,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: ProductPickerProps) {
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['products', 'options'],
    queryFn: () => productService.list(),
    staleTime: STALE_TIME,
  });

  // Barang yang sudah terlanjur dipilih tidak pernah ikut disembunyikan: dokumen
  // lama harus tetap bisa menyebut barangnya walau hari ini barang itu tidak
  // ditawarkan lagi di rail ini.
  const options = (data ?? [])
    .map((product) => ({
      product,
      state: product.id === value ? 'available' : (availability?.(product) ?? 'available'),
    }))
    .filter((entry) => entry.state !== 'hidden')
    .map((entry) => ({
      value: entry.product.id,
      label:
        entry.state === 'unavailable'
          ? `${entry.product.label} — belum tersedia`
          : entry.product.label,
      disabled: entry.state === 'unavailable',
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
            const product = data?.find((candidate) => candidate.id === id);
            if (product) onChange(product);
          }}
          loading={isLoading}
          disabled={disabled}
          placeholder="Pilih barang…"
          searchPlaceholder="Cari kode atau nama barang…"
          emptyText="Belum ada barang aktif di master."
          aria-label={ariaLabel ?? label ?? 'Barang'}
        />

        {isError && (
          <p className="text-xs text-destructive">
            {apiErrorMessage(queryError, 'Daftar barang gagal dimuat.')}
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

ProductPicker.displayName = 'ProductPicker';
