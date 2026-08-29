'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { apiErrorMessage, cashVoucherService } from '@/services';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
import { Typography } from '@/components/ui/Typography';
import type { VoucherStatus } from '@/types/value-objects';
import { VoucherRowMenu } from './VoucherRowMenu';

const STATUS_VARIANT: Record<VoucherStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  POSTED: 'success',
  VOID: 'destructive',
};

/** One label/value pair. `—` already comes from the VO, so blanks never leak. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground-subtle text-xs">{label}</span>
      <span className="text-foreground text-sm">{value}</span>
    </div>
  );
}

export interface VoucherDetailViewProps {
  voucherId: string;
}

/**
 * The read-only face of a voucher: what it says, what it moved, and who touched
 * it — in that order, because that is the order someone auditing it asks.
 *
 * The action menu is the same one the list row uses, so a voucher can never be
 * approvable from one screen and not the other.
 */
export function VoucherDetailView({ voucherId }: VoucherDetailViewProps) {
  const { data: session } = useSession();
  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Typography variant="h2">{data.number}</Typography>
            <Badge variant={STATUS_VARIANT[data.status]} size="sm" dot>
              {data.statusLabel}
            </Badge>
          </div>
          <Typography variant="muted">
            {data.kindLabel} · {data.dateLabel}
          </Typography>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-foreground-subtle block text-xs">Total</span>
            <span className="text-foreground text-xl font-medium tabular-nums">
              {data.totalAmountLabel}
            </span>
          </div>
          <VoucherRowMenu
            voucher={data}
            canUpdate={can('cash-vouchers:update')}
            canDelete={can('cash-vouchers:delete')}
            canSubmit={can('cash-vouchers:submit')}
            canApprove={can('cash-vouchers:approve')}
            canPost={can('cash-vouchers:post')}
            canVoid={can('cash-vouchers:void')}
          />
        </div>
      </div>

      {data.status === 'DRAFT' && data.reviewNote !== '—' && (
        <div className="border-warning bg-warning/10 rounded-lg border p-3">
          <p className="text-foreground text-sm font-medium">Dikembalikan oleh verifikator</p>
          <p className="text-foreground-muted text-sm">{data.reviewNote}</p>
        </div>
      )}

      {data.status === 'VOID' && (
        <div className="border-destructive bg-destructive/10 rounded-lg border p-3">
          <p className="text-foreground text-sm font-medium">Voucher dibatalkan</p>
          <p className="text-foreground-muted text-sm">{data.voidReason}</p>
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Voucher</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={data.counterpartyFieldLabel} value={data.counterpartyName} />
          <Field label="Mitra terdaftar" value={data.partnerName} />
          <Field label="Kategori" value={data.categoryLabel} />
          <Field label="Keperluan" value={data.purpose} />
          <Field label="Arah" value={data.directionLabel} />
          <Field label="Catatan" value={data.notes} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Pembayaran</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Metode" value={data.paymentMethodLabel} />
          <Field label="Jalur transfer" value={data.transferChannelLabel} />
          {/* Tiap rekening berdiri sendiri berikut nominalnya — voucher yang
              dibayar dari dua rekening tidak boleh terbaca seperti satu. */}
          {data.funds.map((fund, index) => (
            <Field
              key={fund.id}
              label={
                data.fund === 'MEMORIAL'
                  ? `Akun lawan${data.funds.length > 1 ? ` ${index + 1}` : ''}`
                  : `Akun ${data.fundLabel.toLowerCase()}${data.funds.length > 1 ? ` ${index + 1}` : ''}`
              }
              value={
                data.funds.length > 1
                  ? `${fund.accountLabel} · ${fund.amountLabel}`
                  : fund.accountLabel
              }
            />
          ))}
          <Field label="Bank" value={data.bankName} />
          <Field label="Nomor rekening" value={data.bankAccountNo} />
          <Field label="Nomor referensi" value={data.referenceNumber} />
          <Field label="Jatuh tempo" value={data.dueDateLabel} />
          <Field
            label="Posting otomatis"
            value={data.autoPostOnApproval ? 'Ya, saat disetujui' : 'Tidak, diposting manual'}
          />
          <Field label="Jurnal" value={data.journalNumber} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Rincian</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-border rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-foreground-subtle tabular-nums">
                      {line.lineNo}
                    </TableCell>
                    <TableCell className="text-foreground">{line.accountLabel}</TableCell>
                    <TableCell className="text-foreground-muted">{line.description}</TableCell>
                    <TableCell className="text-foreground text-right tabular-nums">
                      {line.amountLabel}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-foreground text-right font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-foreground text-right font-medium tabular-nums">
                    {data.totalAmountLabel}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Jejak</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dibuat oleh" value={data.createdByName} />
          <Field
            label="Diverifikasi oleh"
            value={data.reviewedAt ? `${data.reviewedByName} · ${data.reviewedAtLabel}` : '—'}
          />
          <Field
            label="Diposting oleh"
            value={data.postedAt ? `${data.postedByName} · ${data.postedAtLabel}` : '—'}
          />
          <Field
            label="Dibatalkan oleh"
            value={data.voidedAt ? `${data.voidedByName} · ${data.voidedAtLabel}` : '—'}
          />
        </CardContent>
      </Card>
    </div>
  );
}

VoucherDetailView.displayName = 'VoucherDetailView';
