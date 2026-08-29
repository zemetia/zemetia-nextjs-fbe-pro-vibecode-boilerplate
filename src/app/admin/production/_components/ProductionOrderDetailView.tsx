'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { ArrowLeft, TriangleAlert } from 'lucide-react';

import { apiErrorMessage, productionOrderService } from '@/services';
import { formatNumber } from '@/lib/number';
import { PRODUCTION_ORDER_STATUS_DESCRIPTIONS } from '@/lib/production';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Typography } from '@/components/ui/Typography';
import type { ProductionOrderStatus } from '@/types/value-objects';
import { ProductionOrderRowMenu } from './ProductionOrderRowMenu';

const BASE_PATH = '/admin/production';

const STATUS_VARIANT: Record<
  ProductionOrderStatus,
  'secondary' | 'info' | 'success' | 'destructive'
> = {
  DRAFT: 'secondary',
  RELEASED: 'info',
  CLOSED: 'success',
  VOID: 'destructive',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-foreground-subtle">{label}</dt>
      <dd className="text-sm text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

export interface ProductionOrderDetailViewProps {
  orderId: string;
}

/**
 * Satu SPK dari dekat. Neraca bahannya dibaca dari buku mutasi, bukan dari
 * kolom sisa — karena itulah setiap baris mutasi ikut ditampilkan di bawahnya:
 * angka neraca harus bisa ditelusuri ke dokumen yang membentuknya.
 */
export function ProductionOrderDetailView({ orderId }: ProductionOrderDetailViewProps) {
  const { data: session } = useSession();

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['production-orders', 'detail', orderId],
    queryFn: () => productionOrderService.detail(orderId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        message={apiErrorMessage(error, 'SPK produksi gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  const { balance } = data;

  return (
    <div className="space-y-6">
      <Link
        href={BASE_PATH}
        className="inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke daftar SPK
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Typography variant="h2">{data.number}</Typography>
            <Badge variant={STATUS_VARIANT[data.status]} size="sm" dot>
              {data.statusLabel}
            </Badge>
          </div>
          <Typography variant="muted">
            {PRODUCTION_ORDER_STATUS_DESCRIPTIONS[data.status]} · dicatat oleh {data.createdByName}
          </Typography>
        </div>

        <ProductionOrderRowMenu
          order={data}
          canUpdate={can('production-orders:update')}
          canDelete={can('production-orders:delete')}
          canRelease={can('production-orders:release')}
          canClose={can('production-orders:close')}
          canVoid={can('production-orders:void')}
        />
      </div>

      {balance.isOverLossTolerance && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-subtle p-4 text-warning-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <Typography variant="small" className="font-medium">
              Susut melewati toleransi
            </Typography>
            <Typography variant="muted">
              {balance.lossFineGramLabel} hilang dari {balance.consumedFineGramLabel} yang diolah (
              {balance.lossPercentLabel}), sementara toleransinya{' '}
              {data.lossTolerancePercentLabel}. Penutupan SPK ini menuntut penjelasan tertulis.
            </Typography>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rencana</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Tanggal SPK" value={data.dateLabel} />
              <Field label="Target selesai" value={data.targetDateLabel} />
              <Field label="Model" value={data.modelName || '—'} />
              <Field label="Karat" value={`${data.karatLabel} (${data.purityPercentLabel})`} />
              <Field label="Berat kotor target" value={data.targetGrossWeightGramLabel} />
              <Field label="Jumlah keping" value={data.targetPieceCountLabel} />
              <Field label="Emas murni dibutuhkan" value={data.fineNeededGramLabel} />
              <Field label="Alloy dibutuhkan" value={data.alloyNeededGramLabel} />
              <Field label="Lokasi produksi" value={data.locationName || '—'} />
              <Field label="Toleransi susut" value={data.lossTolerancePercentLabel} />
            </dl>
            {data.notes !== '—' && (
              <p className="mt-4 text-sm text-foreground-muted">{data.notes}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neraca bahan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <Typography variant="small" className="text-foreground-muted">
                  Progres berat kotor
                </Typography>
                <span className="text-sm text-foreground tabular-nums">
                  {formatNumber(data.progressPercent, { decimalScale: 2 })}%
                </span>
              </div>
              <span
                className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-surface-raised"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${data.progressPercent}%` }}
                />
              </span>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Bahan keluar" value={balance.issuedFineGramLabel} />
              <Field label="Bahan kembali" value={balance.returnedFineGramLabel} />
              <Field label="Emas diolah" value={balance.consumedFineGramLabel} />
              <Field label="Emas jadi barang" value={balance.outputFineGramLabel} />
              <Field label="Berat kotor hasil" value={balance.outputGrossWeightGramLabel} />
              <Field label="Keping hasil" value={balance.outputPieceCountLabel} />
              <Field label="Susut" value={`${balance.lossFineGramLabel} (${balance.lossPercentLabel})`} />
              <Field label="Alloy terpakai" value={balance.alloyGramLabel} />
              <Field label="Rendemen" value={balance.yieldPercentLabel} />
              <Field label="Masih di produksi" value={balance.wipFineGramLabel} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

ProductionOrderDetailView.displayName = 'ProductionOrderDetailView';
