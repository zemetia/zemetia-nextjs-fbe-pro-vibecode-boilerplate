'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Gem, Layers, Package, Recycle, Search } from 'lucide-react';

import { metalLotService } from '@/services';
import { useDebouncedValue } from '@/hooks';
import { formatNumber } from '@/lib/number';
import { METAL_LOT_FORM_DESCRIPTIONS, METAL_LOT_FORM_LABELS } from '@/lib/metal-lot';
import { METAL_LABELS, METALS } from '@/lib/product';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { Typography } from '@/components/ui/Typography';
import type { Metal, MetalLotForm } from '@/types/value-objects';
import { MetalLotsTable } from './MetalLotsTable';

const PAGE_SIZE = 20;

const METAL_TABS: SegmentedOption<Metal>[] = METALS.map((metal) => ({
  value: metal,
  label: METAL_LABELS[metal],
}));

const FORM_TABS: SegmentedOption<MetalLotForm>[] = [
  {
    value: 'BAR',
    label: METAL_LOT_FORM_LABELS.BAR,
    icon: <Package className="h-4 w-4" aria-hidden="true" />,
  },
  {
    value: 'JEWELRY',
    label: METAL_LOT_FORM_LABELS.JEWELRY,
    icon: <Gem className="h-4 w-4" aria-hidden="true" />,
  },
  {
    value: 'SCRAP',
    label: METAL_LOT_FORM_LABELS.SCRAP,
    icon: <Recycle className="h-4 w-4" aria-hidden="true" />,
  },
  {
    value: 'BAL',
    label: METAL_LOT_FORM_LABELS.BAL,
    icon: <Layers className="h-4 w-4" aria-hidden="true" />,
  },
];

export function MetalLotsView() {
  const [metal, setMetal] = useState<Metal>('GOLD');
  const [form, setForm] = useState<MetalLotForm>('BAR');
  const [q, setQ] = useState('');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [page, setPage] = useState(1);

  const debouncedQ = useDebouncedValue(q, 300);

  const filters = {
    metal,
    form,
    q: debouncedQ,
    in_stock: inStockOnly ? true : undefined,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['metal-lots', { ...filters, page }],
    queryFn: () => metalLotService.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  function resetPage(): void {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <Segmented
        options={METAL_TABS}
        value={metal}
        onValueChange={(next) => {
          setMetal(next);
          resetPage();
        }}
        aria-label="Logam"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          options={FORM_TABS}
          value={form}
          onValueChange={(next) => {
            setForm(next);
            resetPage();
          }}
          aria-label="Bentuk lot"
        />
        <Typography variant="muted" className="max-w-md text-xs">
          {METAL_LOT_FORM_DESCRIPTIONS[form]}
        </Typography>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          />
          <Input
            placeholder="Cari kode lot, nomor seri, atau model…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
            className="pl-9"
            aria-label="Cari lot"
          />
        </div>

        <Button
          variant={inStockOnly ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setInStockOnly((current) => !current);
            resetPage();
          }}
          aria-pressed={inStockOnly}
        >
          {inStockOnly ? 'Masih ada isinya' : 'Termasuk yang habis'}
        </Button>
      </div>

      <MetalLotsTable
        form={form}
        metalLabel={METAL_LABELS[metal]}
        lots={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isFiltered={q !== ''}
      />

      {data && !data.isEmpty && (
        <div className="flex items-center justify-between gap-3">
          <Typography variant="muted">
            Halaman {formatNumber(data.page)} dari {formatNumber(data.totalPages)} ·{' '}
            {formatNumber(data.total)} lot
          </Typography>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasPrevPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

MetalLotsView.displayName = 'MetalLotsView';
