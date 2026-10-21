'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  PackagePlus,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react';

import { apiErrorMessage, purchaseRequestService } from '@/services';
import type { PermissionKey } from '@/lib/permissions';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
import type { PurchaseRequestStage } from '@/types/value-objects';
import {
  PurchaseRequestStatusDialog,
  type PurchaseRequestDialogAction,
} from './PurchaseRequestStatusDialog';
import { requestConvertHref, requestEditHref, requestListHref } from './routes';

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

export interface PurchaseRequestDetailViewProps {
  id: string;
}

export function PurchaseRequestDetailView({ id }: PurchaseRequestDetailViewProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [dialogAction, setDialogAction] = useState<PurchaseRequestDialogAction | null>(null);

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const { data: request, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['purchase-requests', id],
    queryFn: () => purchaseRequestService.detail(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div className="space-y-6">
        <Link href={requestListHref() as Route}>
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Kembali ke Daftar
          </Button>
        </Link>
        <ErrorState
          message={apiErrorMessage(error, 'Detail permintaan pembelian gagal dimuat.')}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={requestListHref() as Route}>
            <Button variant="ghost" size="icon" aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Typography variant="h2" className="font-mono">
                {request.number}
              </Typography>
              <Badge variant={stageBadgeVariant(request.stage)} dot>
                {request.stageLabel}
              </Badge>
              <Badge variant="outline">{request.categoryLabel}</Badge>
              {request.isUrgent && (
                <Badge variant="destructive" dot>
                  <AlertCircle className="mr-1 h-3 w-3 inline" />
                  Urgent
                </Badge>
              )}
            </div>
            <Typography variant="muted">
              Diajukan oleh {request.createdByName} untuk Divisi {request.department} pada{' '}
              {request.dateLabel}
            </Typography>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {request.isEditable && can('purchase-requests:update') && (
            <Link href={requestEditHref(request.id) as Route}>
              <Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />}>
                Ubah Draft
              </Button>
            </Link>
          )}

          {request.canConvert &&
            (can('local-purchases:create') || can('import-purchases:create')) && (
              <Link
                href={
                  requestConvertHref(
                    request.id,
                    request.category as 'GOLD_IMPORT' | 'GOLD_LOCAL',
                  ) as Route
                }
              >
                <Button variant="primary" leftIcon={<PackagePlus className="h-4 w-4" />}>
                  Konversi ke PO
                </Button>
              </Link>
            )}

          {request.canApprove && can('purchase-requests:approve') && (
            <Button
              onClick={() => setDialogAction('approve')}
              variant="primary"
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Setujui Permintaan
            </Button>
          )}

          {request.canVoid && can('purchase-requests:void') && (
            <Button
              onClick={() => setDialogAction('void')}
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              leftIcon={<XCircle className="h-4 w-4" />}
            >
              Batalkan
            </Button>
          )}

          {request.canDelete && can('purchase-requests:delete') && (
            <Button
              onClick={() => setDialogAction('delete')}
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Hapus
            </Button>
          )}
        </div>
      </div>

      {/* 2. Overview Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Document Metadata */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Informasi Permintaan</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-foreground-muted block">Tanggal Pengajuan</span>
              <span className="font-medium text-foreground">{request.dateLabel}</span>
            </div>

            <div>
              <span className="text-xs text-foreground-muted block">Batas Waktu Diperlukan</span>
              <span className="font-medium text-foreground">{request.requiredDateLabel}</span>
            </div>

            <div>
              <span className="text-xs text-foreground-muted block">Divisi Pemohon</span>
              <span className="font-medium text-foreground">{request.department}</span>
            </div>

            <div>
              <span className="text-xs text-foreground-muted block">Mata Uang Acuan</span>
              <span className="font-mono font-medium text-foreground">{request.currencyCode}</span>
            </div>

            <div className="sm:col-span-2">
              <span className="text-xs text-foreground-muted block">Usulan Rekanan / Supplier</span>
              <span className="font-medium text-foreground">{request.suggestedPartnerName}</span>
            </div>

            {request.notes !== '—' && (
              <div className="sm:col-span-2 pt-2 border-t border-border">
                <span className="text-xs text-foreground-muted block">Catatan Tambahan</span>
                <p className="text-sm text-foreground whitespace-pre-wrap mt-0.5">{request.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right 1 Col: Audit & Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Otorisasi & Anggaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-xs text-foreground-muted block">Dibuat Oleh</span>
              <span className="font-medium text-foreground">{request.createdByName}</span>
            </div>

            {request.approvedByName !== '—' && (
              <div>
                <span className="text-xs text-foreground-muted block">Disetujui Oleh</span>
                <span className="font-medium text-emerald-500">{request.approvedByName}</span>
              </div>
            )}

            {request.voidedByName !== '—' && (
              <div className="rounded-lg bg-destructive/10 p-2.5 border border-destructive/20 text-destructive text-xs">
                <span className="font-semibold block">Dibatalkan Oleh: {request.voidedByName}</span>
                <p className="mt-0.5">Alasan: {request.voidReason}</p>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <span className="text-xs text-foreground-muted block">Total Estimasi Anggaran</span>
              <p className="text-lg font-mono font-bold text-gold tabular-nums mt-0.5">
                {request.estTotalAmountLabel}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Items Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Rincian Barang</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Nama Barang / Produk</TableHead>
                <TableHead className="w-32">Kode</TableHead>
                <TableHead className="w-36 text-right">Kuantitas Diminta</TableHead>
                <TableHead className="w-36 text-right">Sudah Di-PO</TableHead>
                <TableHead className="w-36 text-right">Sisa</TableHead>
                <TableHead className="w-36 text-right">Est. Harga Satuan</TableHead>
                <TableHead className="w-40 text-right">Est. Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {request.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-center font-mono text-xs text-foreground-muted">
                    {item.lineNo}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-foreground">{item.itemLabel}</span>
                    {item.notes !== '—' && (
                      <span className="block text-xs text-foreground-subtle">{item.notes}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground-muted">
                    {item.itemCode}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground">
                    {item.quantityLabel}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground-muted">
                    {item.orderedQuantityLabel}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono tabular-nums ${
                      item.isFulfilled ? 'text-foreground-subtle' : 'text-foreground font-medium'
                    }`}
                  >
                    {item.outstandingQuantityLabel}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground-muted">
                    {item.estUnitPriceLabel}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium text-foreground">
                    {item.estAmountLabel}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Status Dialog for Approve / Void / Delete */}
      {dialogAction && (
        <PurchaseRequestStatusDialog
          open={dialogAction !== null}
          onOpenChange={(open) => {
            if (!open) setDialogAction(null);
          }}
          request={request}
          action={dialogAction}
          onSuccess={() => {
            if (dialogAction === 'delete') {
              router.push(requestListHref() as Route);
            } else {
              void refetch();
            }
          }}
        />
      )}
    </div>
  );
}

PurchaseRequestDetailView.displayName = 'PurchaseRequestDetailView';
