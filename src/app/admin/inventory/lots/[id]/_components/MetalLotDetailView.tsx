'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TriangleAlert } from 'lucide-react';

import { apiErrorMessage, metalLotService } from '@/services';
import { formatNumber } from '@/lib/number';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Typography } from '@/components/ui/Typography';
import type { MetalLotDetailVO } from '@/types/value-objects';

const EMPTY = '—';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Typography variant="muted" className="text-xs">
        {label}
      </Typography>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function IdentityCard({ lot }: { lot: MetalLotDetailVO }) {
  return (
    <Card className="space-y-4">
      <CardHeader className="pb-0">
        <CardTitle>Identitas</CardTitle>
        <CardDescription>
          {lot.metalLabel} · {lot.formLabel}
        </CardDescription>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kode lot" value={lot.code} />
        <Field label="Logam" value={lot.metalLabel} />

        {lot.form === 'BAR' && (
          <>
            <Field label="Nomor seri" value={lot.serialNumber} />
            <Field label="Nomor sertifikat" value={lot.certificateNumber} />
            <Field label="Refinery" value={lot.refinerName} />
          </>
        )}

        {lot.karatLabel !== EMPTY && <Field label="Karat" value={lot.karatLabel} />}

        {lot.form === 'BAL' && <Field label="Tahap" value={lot.balStageLabel} />}

        <Field label="Kadar berlaku" value={lot.purityPercentLabel} />
        <Field label="Dicatat oleh" value={lot.createdByName} />
      </div>

      {lot.notes !== EMPTY && (
        <div className="rounded-md border border-border bg-surface-raised px-3 py-2">
          <Typography variant="muted" className="text-xs">
            Catatan
          </Typography>
          <p className="text-sm text-foreground">{lot.notes}</p>
        </div>
      )}
    </Card>
  );
}

export function MetalLotDetailView({ lotId }: { lotId: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['metal-lots', lotId],
    queryFn: () => metalLotService.detail(lotId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        variant="panel"
        message={apiErrorMessage(error, 'Detail lot gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/inventory/lots"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Kembali ke daftar lot
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h2">{data.identityLabel}</Typography>
          <Badge variant={data.isDepleted ? 'secondary' : 'success'} size="sm" dot>
            {data.isDepleted ? 'Habis' : 'Masih ada'}
          </Badge>
          <Badge variant="secondary" size="sm">
            {data.metalLabel}
          </Badge>
          <Badge variant="secondary" size="sm">
            {data.formLabel}
          </Badge>
        </div>
      </div>

      {data.isPurityEstimated && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-subtle px-3 py-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 text-warning" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">Kadarnya masih taksiran</p>
            <p className="text-xs text-foreground-muted">
              Setiap gram yang keluar dari lot ini mewarisi taksiran itu. Uji kadarnya saat bal
              disegel supaya posisi {data.metalLabel.toLowerCase()} murni tidak meleset diam-diam.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Typography variant="muted" className="text-xs uppercase tracking-wide">
            Sisa {data.metalLabel.toLowerCase()} murni
          </Typography>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {data.remainingFineWeightGramLabel}
          </p>
          <Typography variant="muted" className="mt-1 text-xs">
            dari {data.fineWeightGramLabel} saat lot lahir
          </Typography>
        </Card>
        <Card>
          <Typography variant="muted" className="text-xs uppercase tracking-wide">
            Sisa berat kotor
          </Typography>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {data.remainingGrossWeightGramLabel}
          </p>
          <Typography variant="muted" className="mt-1 text-xs">
            dari {data.grossWeightGramLabel} saat lot lahir
          </Typography>
        </Card>
        <Card>
          <Typography variant="muted" className="text-xs uppercase tracking-wide">
            Sisa keping
          </Typography>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {data.remainingPieceCount > 0 ? formatNumber(data.remainingPieceCount) : EMPTY}
          </p>
          <Typography variant="muted" className="mt-1 text-xs">
            {data.remainingPieceCount > 0 ? 'keping tersisa' : 'lot ini tidak dihitung per keping'}
          </Typography>
        </Card>
      </div>

      <IdentityCard lot={data} />
    </div>
  );
}

MetalLotDetailView.displayName = 'MetalLotDetailView';
