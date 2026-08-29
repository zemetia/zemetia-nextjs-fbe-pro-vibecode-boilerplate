'use client';

import { apiErrorMessage } from '@/services';
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
import type { CashVoucherVO, VoucherStatus } from '@/types/value-objects';
import { VoucherRowMenu } from './VoucherRowMenu';

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];
const COLUMN_COUNT = 7;

/** Status drives the badge tone — a voided document must not read as neutral. */
const STATUS_VARIANT: Record<VoucherStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  POSTED: 'success',
  VOID: 'destructive',
};

export interface VouchersTableProps {
  vouchers: CashVoucherVO[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  isFiltered: boolean;
  permissions: {
    canUpdate: boolean;
    canDelete: boolean;
    canSubmit: boolean;
    canApprove: boolean;
    canPost: boolean;
    canVoid: boolean;
  };
}

export function VouchersTable({
  vouchers,
  isLoading,
  isError,
  error,
  onRetry,
  isFiltered,
  permissions,
}: VouchersTableProps) {
  return (
    <div className="border-border rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Nomor</TableHead>
            <TableHead className="w-28">Tanggal</TableHead>
            <TableHead>Pihak</TableHead>
            <TableHead>Pembayaran</TableHead>
            <TableHead className="text-right">Nilai</TableHead>
            <TableHead className="w-40">Status</TableHead>
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
                  message={apiErrorMessage(error, 'Daftar voucher gagal dimuat.')}
                  onRetry={onRetry}
                />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && vouchers.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="text-foreground-muted py-10 text-center">
                {isFiltered
                  ? 'Tidak ada voucher yang cocok dengan filter ini.'
                  : 'Belum ada voucher yang dicatat.'}
              </TableCell>
            </TableRow>
          )}

          {vouchers.map((voucher) => (
            <TableRow key={voucher.id}>
              <TableCell className="text-foreground-muted font-mono text-xs">
                <span className="block">{voucher.number}</span>
                <span className="text-foreground-subtle block">{voucher.kindLabel}</span>
              </TableCell>
              <TableCell className="text-foreground-muted">
                <span className="block">{voucher.dateLabel}</span>
                {/* A cheque or giro is money that has not moved yet — the date it
                    clears belongs on the row, not two clicks away. */}
                {voucher.dueDate && (
                  <span className="text-foreground-subtle block text-xs">
                    cair {voucher.dueDateLabel}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-foreground font-medium">{voucher.counterpartyName}</span>
                <span className="text-foreground-subtle block text-xs">
                  {voucher.categoryLabel} · {voucher.purpose}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-foreground text-sm">{voucher.paymentMethodLabel}</span>
                <span className="text-foreground-subtle block text-xs">
                  {voucher.transferChannel
                    ? voucher.transferChannelLabel
                    : voucher.fundSummaryLabel}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span className="text-foreground block">{voucher.totalAmountLabel}</span>
                <span className="text-foreground-subtle block text-xs">
                  {voucher.directionLabel}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[voucher.status]} size="sm" dot>
                  {voucher.statusLabel}
                </Badge>
              </TableCell>
              <TableCell>
                <VoucherRowMenu voucher={voucher} {...permissions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

VouchersTable.displayName = 'VouchersTable';
