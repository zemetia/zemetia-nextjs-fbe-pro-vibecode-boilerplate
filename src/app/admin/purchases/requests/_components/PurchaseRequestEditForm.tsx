'use client';

import { useQuery } from '@tanstack/react-query';

import { apiErrorMessage, purchaseRequestService } from '@/services';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { toFormState } from './form-state';
import { PurchaseRequestForm } from './PurchaseRequestForm';

export interface PurchaseRequestEditFormProps {
  id: string;
}

export function PurchaseRequestEditForm({ id }: PurchaseRequestEditFormProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['purchase-requests', 'detail', id],
    queryFn: () => purchaseRequestService.detail(id),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (isError || !data) {
    return (
      <ErrorState
        message={apiErrorMessage(error, 'Data permintaan pembelian gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data.isEditable) {
    return (
      <ErrorState
        message={`Permintaan ${data.number} berstatus ${data.stageLabel.toLowerCase()}, sehingga isinya tidak dapat diubah lagi. Batalkan terlebih dahulu jika ada koreksi.`}
      />
    );
  }

  return <PurchaseRequestForm requestId={id} initialForm={toFormState(data)} />;
}

PurchaseRequestEditForm.displayName = 'PurchaseRequestEditForm';
