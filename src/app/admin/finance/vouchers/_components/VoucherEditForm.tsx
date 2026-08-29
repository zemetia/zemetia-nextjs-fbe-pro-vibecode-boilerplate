'use client';

import { useQuery } from '@tanstack/react-query';

import { apiErrorMessage, cashVoucherService } from '@/services';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { VoucherForm } from './VoucherForm';
import { toFormState } from './form-state';

export interface VoucherEditFormProps {
  voucherId: string;
  canCreatePartner: boolean;
}

/**
 * Loads the voucher through the domain service (not Prisma) so the edit form
 * sees exactly the shape the create form produces. A submitted voucher is
 * refused here as well as by the API — the user should be told why, not handed a
 * form whose Save will fail.
 */
export function VoucherEditForm({ voucherId, canCreatePartner }: VoucherEditFormProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cash-vouchers', 'detail', voucherId],
    queryFn: () => cashVoucherService.detail(voucherId),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (isError || !data) {
    return (
      <ErrorState
        message={apiErrorMessage(error, 'Data voucher gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data.isEditable) {
    return (
      <ErrorState
        message={`Voucher ${data.number} berstatus ${data.statusLabel.toLowerCase()}, jadi tidak bisa diubah. Minta verifikator mengembalikannya ke draft dulu.`}
      />
    );
  }

  return (
    <VoucherForm
      voucherId={voucherId}
      initialForm={toFormState(data)}
      canCreatePartner={canCreatePartner}
    />
  );
}

VoucherEditForm.displayName = 'VoucherEditForm';
