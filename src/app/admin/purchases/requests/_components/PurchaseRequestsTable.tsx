'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { AlertCircle } from 'lucide-react';

import { apiErrorMessage } from '@/services';
import type { PermissionKey } from '@/lib/permissions';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
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
import type {
  PurchaseRequestListVO,
  PurchaseRequestStage,
  PurchaseRequestVO,
} from '@/types/value-objects';
import { PurchaseRequestRowMenu } from './PurchaseRequestRowMenu';
import { requestDetailHref } from './routes';

const COLUMN_COUNT = 8;
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];

function stageBadgeVariant(stage: PurchaseRequestStage): BadgeProps['variant'] {
  switch (stage) {
    case 'DRAFT':
      return 'secondary';
    case 'APPROVED':
      return 'default';
    case 'CONVERTED':
      return 'success';
    case 'VOID':
      return 'destructive';
  }
}

export interface PurchaseRequestsTableProps {
  data: PurchaseRequestListVO | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  can: (key: PermissionKey) => boolean;
}

export function PurchaseRequestsTable({
  data,
  isLoading,
  isError,
  error,
  onRetry,
  can,
}: PurchaseRequestsTableProps) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Nomor PR</TableHead>
            <TableHead className="w-32">Tanggal</TableHead>
            <TableHead className="w-36">Divisi</TableHead>
            <TableHead className="w-36">Kategori</TableHead>
            <TableHead className="w-28 text-center">Prioritas</TableHead>
            <TableHead className="text-right">Estimasi Nilai</TableHead>
            <TableHead className="w-32 text-center">Status</TableHead>
            <TableHead className="w-16" />
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
                  message={apiErrorMessage(error, 'Daftar permintaan pembelian gagal dimuat.')}
                  onRetry={onRetry}
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && (data?.items.length ?? 0) === 0 && (
            <TableRow>
              <TableCell
                colSpan={COLUMN_COUNT}
                className="py-10 text-center text-foreground-muted"
              >
                Belum ada permintaan pembelian.
              </TableCell>
            </TableRow>
          )}

          {data?.items.map((request: PurchaseRequestVO) => (
            <TableRow key={request.id}>
              <TableCell>
                <Link
                  href={requestDetailHref(request.id) as Route}
                  className="font-mono text-xs font-medium text-gold hover:underline"
                >
                  {request.number}
                </Link>
                {request.suggestedPartnerName !== '—' && (
                  <span className="block text-xs text-foreground-subtle truncate max-w-[140px]">
                    Usulan: {request.suggestedPartnerName}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-foreground">{request.dateLabel}</span>
                {request.requiredDateLabel !== '—' && (
                  <span className="block text-xs text-foreground-subtle">
                    Tenggat: {request.requiredDateLabel}
                  </span>
                )}
              </TableCell>
              <TableCell className="font-medium text-foreground">{request.department}</TableCell>
              <TableCell>
                <Badge variant="outline" size="sm">
                  {request.categoryLabel}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                {request.isUrgent ? (
                  <Badge variant="destructive" size="sm" dot>
                    <AlertCircle className="mr-1 h-3 w-3 inline" />
                    Urgent
                  </Badge>
                ) : (
                  <span className="text-xs text-foreground-muted">Normal</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-foreground">
                {request.estTotalAmountLabel}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={stageBadgeVariant(request.stage)} size="sm" dot>
                  {request.stageLabel}
                </Badge>
              </TableCell>
              <TableCell>
                <PurchaseRequestRowMenu request={request} can={can} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

PurchaseRequestsTable.displayName = 'PurchaseRequestsTable';
