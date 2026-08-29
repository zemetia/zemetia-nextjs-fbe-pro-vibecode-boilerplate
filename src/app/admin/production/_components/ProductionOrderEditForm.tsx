'use client';

import { useQuery } from '@tanstack/react-query';

import { apiErrorMessage, productionOrderService } from '@/services';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductionOrderForm, type ProductionOrderFormState } from './ProductionOrderForm';
import type { ProductionOrderDetailVO } from '@/types/value-objects';

export interface ProductionOrderEditFormProps {
  orderId: string;
}

function toFormState(order: ProductionOrderDetailVO): ProductionOrderFormState {
  return {
    date: order.date,
    targetDate: order.targetDate,
    modelName: order.modelName === '—' ? '' : order.modelName,
    karat: String(order.karat),
    targetGrossWeightGram: order.targetGrossWeightGram,
    targetPieceCount: order.targetPieceCount,
    locationName: order.locationName === '—' ? '' : order.locationName,
    lossTolerancePercent: order.lossTolerancePercent,
    notes: order.notes === '—' ? '' : order.notes,
  };
}

/**
 * Loads the SPK through the domain service (not Prisma) so the edit form sees
 * exactly the shape the create form produces. A released order is refused here
 * as well as by the API — the user should be told why, not handed a form whose
 * Save will fail.
 */
export function ProductionOrderEditForm({ orderId }: ProductionOrderEditFormProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['production-orders', 'detail', orderId],
    queryFn: () => productionOrderService.detail(orderId),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (isError || !data) {
    return (
      <ErrorState
        message={apiErrorMessage(error, 'Data SPK gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data.isEditable) {
    return (
      <ErrorState
        message={`SPK ${data.number} sudah ${data.statusLabel.toLowerCase()}, jadi rencananya tidak bisa diubah lagi. Batalkan dulu jika ada koreksi.`}
      />
    );
  }

  return (
    <ProductionOrderForm
      orderId={orderId}
      orderNumber={data.number}
      initialForm={toFormState(data)}
    />
  );
}

ProductionOrderEditForm.displayName = 'ProductionOrderEditForm';
