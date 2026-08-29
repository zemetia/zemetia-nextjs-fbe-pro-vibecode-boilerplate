'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, TriangleAlert } from 'lucide-react';

import { apiErrorMessage, metalStockService } from '@/services';
import { formatNumber } from '@/lib/number';
import { METAL_LABELS, METALS } from '@/lib/product';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Typography } from '@/components/ui/Typography';
import type { Metal, MetalLotForm } from '@/types/value-objects';

const SKELETON_CARDS = ['a', 'b', 'c'];

/** Same order the shelves are walked in — bars, finished goods, then raw material. */
const FORM_ORDER: Record<MetalLotForm, number> = {
  BAR: 0,
  GRANULE: 1,
  JEWELRY: 2,
  SCRAP: 3,
  BAL: 4,
};

const METAL_TABS: SegmentedOption<Metal>[] = METALS.map((metal) => ({
  value: metal,
  label: METAL_LABELS[metal],
}));

/**
 * The landing page of the storage module. Every figure comes from
 * `/api/metal-stock/positions`, which aggregates posted movement lines — adding
 * up the rows currently on screen would only ever be right for one page.
 *
 * **Satu logam per layar.** Emas dan perak sama-sama diukur dalam gram, jadi
 * menampilkannya berdampingan di satu total hanya melahirkan angka yang terlihat
 * wajar tanpa berarti apa-apa. Tabnya berganti sumber angka, bukan sekadar
 * menyaring baris.
 */
export function StockPositionView() {
  const [metal, setMetal] = useState<Metal>('GOLD');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['metal-stock', 'positions'],
    queryFn: () => metalStockService.positions(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_CARDS.map((key) => (
            <Skeleton key={key} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        variant="panel"
        message={apiErrorMessage(error, 'Posisi stok gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data) return null;

  const position = data.byMetal.find((entry) => entry.metal === metal) ?? data.byMetal[0];
  if (!position) return null;

  const forms = [...position.byForm].sort((a, b) => FORM_ORDER[a.form] - FORM_ORDER[b.form]);

  return (
    <div className="space-y-6">
      <Segmented
        options={METAL_TABS}
        value={position.metal}
        onValueChange={setMetal}
        aria-label="Logam"
      />

      <Card accent className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Typography variant="muted" className="text-xs uppercase tracking-wide">
            Total {position.fineLabel}
          </Typography>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
            {position.totalFineGramLabel}
          </p>
          <Typography variant="muted" className="mt-1">
            dari {position.totalGrossWeightGramLabel} berat kotor · {position.lotCountLabel} masih
            ada isinya
          </Typography>
        </div>

        {position.openBalCount > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-subtle px-3 py-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {position.openBalCountLabel} masih terbuka
              </p>
              <p className="text-xs text-foreground-muted">
                Kadarnya masih taksiran sampai bal disegel dan diuji.
              </p>
            </div>
          </div>
        )}
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
            <Typography variant="h4">Per bentuk</Typography>
          </div>
          <Link
            href="/admin/inventory/lots"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Lihat semua lot
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {forms.length === 0 ? (
          <Card>
            <Typography variant="muted">
              Belum ada {position.metalLabel.toLowerCase()} tercatat. Stok lahir saat dokumen
              pembelian dikonfirmasi.
            </Typography>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {forms.map((entry) => (
              <Card key={entry.form} className="space-y-3">
                <CardHeader className="pb-0">
                  <CardTitle>{entry.formLabel}</CardTitle>
                  <CardDescription>
                    {entry.lotCountLabel}
                    {entry.pieceCount > 0 ? ` · ${entry.pieceCountLabel}` : ''}
                  </CardDescription>
                </CardHeader>

                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {entry.fineWeightGramLabel}
                </p>

                <div className="space-y-1.5">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-surface-raised"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${entry.sharePercent}%` }}
                    />
                  </div>
                  <Typography variant="muted" className="text-xs">
                    {formatNumber(entry.sharePercent, { decimalScale: 1 })}% dari total ·{' '}
                    {entry.grossWeightGramLabel} kotor
                  </Typography>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

StockPositionView.displayName = 'StockPositionView';
