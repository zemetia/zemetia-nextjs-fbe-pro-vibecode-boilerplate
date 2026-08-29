'use client';

import { cn } from '@/lib/cn';
export type FulfillmentStatus = 'OPEN' | 'PARTIAL' | 'CLOSED';

const TRACK_BY_STATUS: Record<FulfillmentStatus, string> = {
  OPEN: 'bg-surface-raised',
  PARTIAL: 'bg-surface-raised',
  CLOSED: 'bg-surface-raised',
};

const FILL_BY_STATUS: Record<FulfillmentStatus, string> = {
  OPEN: 'bg-border',
  PARTIAL: 'bg-warning',
  CLOSED: 'bg-success',
};

export interface FulfillmentBarProps {
  percent: number;
  status: FulfillmentStatus;
  /** Dibaca screen reader — batangnya sendiri tidak menyampaikan apa pun. */
  label: string;
  className?: string;
}

/**
 * Nilainya dipotong di 100% **hanya untuk lebar batangnya** — angka aslinya tetap
 * ditampilkan pemanggil, karena kiriman yang melebihi pesanan justru yang perlu
 * dilihat orang.
 */
export function FulfillmentBar({ percent, status, label, className }: FulfillmentBarProps) {
  const width = Math.max(0, Math.min(100, percent));

  return (
    <div
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full', TRACK_BY_STATUS[status], className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width]', FILL_BY_STATUS[status])}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

FulfillmentBar.displayName = 'FulfillmentBar';
