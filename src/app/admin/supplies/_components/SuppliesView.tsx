'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { MoreHorizontal, Pencil, Plus, Power, Search } from 'lucide-react';

import { apiErrorMessage, supplyService } from '@/services';
import { useDebouncedValue, useToast } from '@/hooks';
import { formatNumber } from '@/lib/number';
import { SUPPLY_CATEGORY_OPTIONS } from '@/lib/supply';
import type { PermissionKey } from '@/lib/permissions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
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
import type { SupplyCategory, SupplyVO } from '@/types/value-objects';
import { SupplyFormDialog } from './SupplyFormDialog';

const PAGE_SIZE = 20;
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];
const COLUMN_COUNT = 7;
const ALL = 'all';

const CATEGORY_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua kategori' },
  ...SUPPLY_CATEGORY_OPTIONS,
];

const ACTIVE_FILTER_OPTIONS = [
  { value: ALL, label: 'Semua status' },
  { value: 'true', label: 'Hanya aktif' },
  { value: 'false', label: 'Hanya nonaktif' },
];

export function SuppliesView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [q, setQ] = useState('');
  const [category, setCategory] = useState(ALL);
  const [activeFilter, setActiveFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplyVO | undefined>(undefined);

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const debouncedQ = useDebouncedValue(q, 300);

  const filters = {
    q: debouncedQ,
    category: category === ALL ? undefined : (category as SupplyCategory),
    is_active: activeFilter === ALL ? undefined : activeFilter === 'true',
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['supplies', { ...filters, page }],
    queryFn: () => supplyService.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      supplyService.setStatus(id, isActive),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['supplies'] });
      toast.success(
        saved.isActive
          ? `Barang ${saved.code} diaktifkan kembali.`
          : `Barang ${saved.code} dinonaktifkan.`,
      );
    },
    onError: (mutationError) =>
      toast.apiError(mutationError, 'Status barang non-logam gagal diubah.'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
              aria-hidden="true"
            />
            <Input
              placeholder="Cari kode atau nama barang…"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              className="pl-9"
              aria-label="Cari supply"
            />
          </div>

          <div className="w-48">
            <Combobox
              options={CATEGORY_FILTER_OPTIONS}
              value={category}
              onValueChange={(val) => {
                setCategory(val);
                setPage(1);
              }}
              aria-label="Filter kategori"
            />
          </div>

          <div className="w-40">
            <Combobox
              options={ACTIVE_FILTER_OPTIONS}
              value={activeFilter}
              onValueChange={(val) => {
                setActiveFilter(val);
                setPage(1);
              }}
              aria-label="Filter status aktif"
            />
          </div>
        </div>

        {can('supplies:create') && (
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Tambah Barang
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Kode</TableHead>
              <TableHead>Nama Barang</TableHead>
              <TableHead className="w-36">Kategori</TableHead>
              <TableHead className="w-32">Satuan Beli</TableHead>
              <TableHead className="w-40 text-right">Harga Terakhir</TableHead>
              <TableHead className="w-28 text-center">Status</TableHead>
              <TableHead className="w-16 text-center">Aksi</TableHead>
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
                    message={apiErrorMessage(error, 'Daftar barang non-logam gagal dimuat.')}
                    onRetry={() => void refetch()}
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
                  Belum ada barang non-logam terdaftar.
                </TableCell>
              </TableRow>
            )}

            {data?.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs font-medium text-foreground">
                  {item.code}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-foreground">{item.name}</span>
                  {item.notes !== '—' && (
                    <span className="block text-xs text-foreground-subtle">{item.notes}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" size="sm">
                    {item.categoryLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-foreground-muted">{item.unit}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-foreground-muted">
                  {item.lastPriceIdrLabel}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={item.isActive ? 'success' : 'secondary'} size="sm" dot>
                    {item.statusLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="mx-auto h-8 w-8 cursor-pointer p-0 text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                        aria-label={`Aksi untuk ${item.code}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[1100] w-48">
                      {can('supplies:update') && (
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(item);
                            setFormOpen(true);
                          }}
                          className="flex cursor-pointer items-center gap-2 text-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                          <span>Ubah barang</span>
                        </DropdownMenuItem>
                      )}
                      {can('supplies:set-status') && (
                        <DropdownMenuItem
                          disabled={statusMutation.isPending}
                          onClick={() =>
                            statusMutation.mutate({ id: item.id, isActive: !item.isActive })
                          }
                          className="flex cursor-pointer items-center gap-2 text-foreground hover:text-foreground"
                        >
                          <Power className="h-4 w-4" />
                          <span>{item.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                        </DropdownMenuItem>
                      )}
                      {!can('supplies:update') && !can('supplies:set-status') && (
                        <DropdownMenuItem disabled>
                          <span className="text-xs text-foreground-subtle">Tidak ada aksi</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && !data.isEmpty && (
        <div className="flex items-center justify-between gap-3">
          <Typography variant="muted">
            Halaman {formatNumber(data.page)} dari {formatNumber(data.totalPages)} ·{' '}
            {formatNumber(data.total)} barang
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

      {formOpen && (
        <SupplyFormDialog
          key={editing?.id ?? 'new'}
          open={formOpen}
          onOpenChange={setFormOpen}
          supply={editing}
        />
      )}
    </div>
  );
}

SuppliesView.displayName = 'SuppliesView';
