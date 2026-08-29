'use client';

import { AlertTriangle, BadgeCheck, Clock, Shield, XCircle } from 'lucide-react';

import { PARTNER_VERIFICATION_STATE_LABELS } from '@/lib/partner';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import type { PartnerVerificationState } from '@/types/value-objects';

/**
 * Satu tempat yang menerjemahkan status verifikasi jadi warna dan ikon, dipakai
 * daftar maupun halaman detail. Kalau tiap layar memilih sendiri, mitra yang
 * sama bisa tampil hijau di satu tempat dan abu-abu di tempat lain — dan centang
 * inilah yang justru paling tidak boleh berbeda antar layar.
 */
const STATE_STYLES: Record<
  PartnerVerificationState,
  { variant: NonNullable<BadgeProps['variant']>; icon: typeof BadgeCheck }
> = {
  VERIFIED: { variant: 'success', icon: BadgeCheck },
  PENDING: { variant: 'info', icon: Clock },
  REJECTED: { variant: 'destructive', icon: XCircle },
  // Kedaluwarsa bukan kegagalan, tapi juga bukan centang: ia permintaan
  // pembaruan data, jadi warnanya peringatan.
  EXPIRED: { variant: 'warning', icon: AlertTriangle },
  UNVERIFIED: { variant: 'secondary', icon: Shield },
};

export interface PartnerVerificationBadgeProps {
  state: PartnerVerificationState;
  size?: BadgeProps['size'];
  /** Daftar cukup menampilkan ikonnya; halaman detail menyebut statusnya. */
  iconOnly?: boolean;
}

export function PartnerVerificationBadge({
  state,
  size = 'md',
  iconOnly = false,
}: PartnerVerificationBadgeProps) {
  const { variant, icon: Icon } = STATE_STYLES[state];
  const label = PARTNER_VERIFICATION_STATE_LABELS[state];

  if (iconOnly) {
    return (
      <Badge variant={variant} size="sm" className="px-1" title={label} aria-label={label}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </Badge>
    );
  }

  return (
    <Badge variant={variant} size={size} className="gap-1">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}

PartnerVerificationBadge.displayName = 'PartnerVerificationBadge';
