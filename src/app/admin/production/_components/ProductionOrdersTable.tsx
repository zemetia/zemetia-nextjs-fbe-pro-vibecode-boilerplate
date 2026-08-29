'use client';

import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

import { apiErrorMessage } from '@/services';
import { formatNumber } from '@/lib/number';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProductionOrderStatus, ProductionOrderVO } from '@/types/value-objects';
import { ProductionOrderRowMenu } from './ProductionOrderRowMenu';

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];
const COLUMN_COUNT = 8;

/** Status drives the badge tone — a voided SPK must not read as neutral. */
const STATUS_VARIANT: Record<
  ProductionOrderStatus,
  'secondary' | 'info' | 'success' | 'destructive'
> = {
  DRAFT: 'secondary',
  RELEASED: 'info',
  CLOSED: 'success',
  VOID: 'destructive',
};

export interface ProductionOrdersTableProps {
  orders: ProductionOrderVO[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  isFiltered: boolean;
  permissions: {
    canUpdate: boolean;
    canDelete: boolean;
    canRelease: boolean;
    canClose: boolean;
    canVoid: boolean;
  };
}

export function ProductionOrdersTable({
  orders,
  isLoading,
  isError,
  error,
  onRetry,
  isFiltered,
  permissions,
}: ProductionOrdersTableProps) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Nomor</TableHead>
            <TableHead className="w-28">Tanggal</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead className="w-40">Progres</TableHead>
            <TableHead className="text-right">Bahan di produksi</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            SKELETON_ROWS.map((key) => (
              <TableRow key={key}>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {isError && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT}>
                <ErrorState
                  variant="inline"
                  message={apiErrorMessage(error, 'Daftar SPK produksi gagal dimuat.')}
                  onRetry={onRetry}
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center text-foreground-muted">
                {isFiltered
                  ? 'Tidak ada SPK yang cocok dengan filter ini.'
                  : 'Belum ada SPK produksi yang dicatat.'}
              </TableCell>
            </TableRow>
          )}

          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-xs text-foreground-muted">
                <Link
                  href={`/admin/production/${order.id}`}
                  className="block font-medium text-primary transition-colors hover:underline"
                >
                  {order.number}
                </Link>
                <span className="block text-foreground-subtle">{order.locationName}</span>
              </TableCell>
              <TableCell className="text-foreground-muted">
                <span className="block">{order.dateLabel}</span>
                <span className="block text-xs text-foreground-subtle">
                  target {order.targetDateLabel}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-medium text-foreground">{order.modelName || '—'}</span>
                <span className="block text-xs text-foreground-subtle">{order.karatLabel}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span className="block text-foreground-muted">
                  {order.targetGrossWeightGramLabel}
                </span>
                <span className="block text-xs text-foreground-subtle">
                  murni {order.fineNeededGramLabel}
                </span>
              </TableCell>
              <TableCell>
                {/* Berat kotor jadi terhadap target — angkanya di atas bar supaya
                    tetap terbaca saat barnya masih nol. */}
                <span className="block text-xs text-foreground-muted tabular-nums">
                  {formatNumber(order.progressPercent, { decimalScale: 2 })}% ·{' '}
                  {order.balance.outputGrossWeightGramLabel}
                </span>
                <span
                  className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${order.progressPercent}%` }}
                  />
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span className="block text-foreground">{order.balance.wipFineGramLabel}</span>
                {order.balance.isOverLossTolerance && (
                  <span className="mt-0.5 flex items-center justify-end gap-1 text-xs text-warning-foreground">
                    <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                    susut {order.balance.lossPercentLabel}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[order.status]} size="sm" dot>
                  {order.statusLabel}
                </Badge>
              </TableCell>
              <TableCell>
                <ProductionOrderRowMenu order={order} {...permissions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

ProductionOrdersTable.displayName = 'ProductionOrdersTable';
