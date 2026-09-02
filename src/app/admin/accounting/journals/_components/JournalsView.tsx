'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  Plus,
  Search,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { journalEntryService, apiErrorMessage, type JournalEntryWritePayload } from '@/services';
import { exportJournalEntriesPdf } from '@/services/pdfService';
import { useDebouncedValue, type FieldErrors } from '@/hooks';
import { formatCurrency, formatNumber } from '@/lib/number';
import { toDateOnly, today } from '@/lib/date';
import { JOURNAL_SOURCE_OPTIONS, JOURNAL_STATUS_OPTIONS } from '@/lib/journal-entry';
import type { PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { Typography } from '@/components/ui/Typography';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AccountPicker } from '@/components/shared';
import type { JournalSource, JournalStatus } from '@/types/value-objects';
import { JournalsTable } from './JournalsTable';
import { JournalLinesEditor } from './JournalLinesEditor';
import { emptyForm, toPayload, fieldErrors, type JournalFormState } from './form-state';

const PAGE_SIZE = 20;
const ALL = 'all';

const STATUS_FILTER_OPTIONS = [{ value: ALL, label: 'Semua status' }, ...JOURNAL_STATUS_OPTIONS];
const SOURCE_FILTER_OPTIONS = [{ value: ALL, label: 'Semua sumber' }, ...JOURNAL_SOURCE_OPTIONS];

/**
 * Mutasi Buku Jurnal Umum PT TAN (SAK EMKM).
 *
 * Menampilkan seluruh transaksi jurnal dari semua modul (pembelian, kasir/voucher,
 * penjualan, produksi, dan memorial manual) dengan rincian multi-akun (2-3 akun atau lebih),
 * kolom Debet dan Kredit berpasangan, status keseimbangan live, serta ekspor PDF resmi.
 */
export function JournalsView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // Filter State
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Quick Add Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<JournalFormState>(emptyForm());
  const [formErrorsState, setFormErrorsState] = useState<FieldErrors>({});
  const [isExporting, setIsExporting] = useState(false);

  const permissions = new Set(session?.user.permissions ?? []);
  const can = (key: PermissionKey) => permissions.has(key);

  const debouncedQ = useDebouncedValue(q, 300);

  const filters = {
    q: debouncedQ,
    status: status === ALL ? undefined : (status as JournalStatus),
    source: source === ALL ? undefined : (source as JournalSource),
    ...(accountId === '' ? {} : { account_id: accountId }),
    ...(dateFrom === '' ? {} : { date_from: dateFrom }),
    ...(dateTo === '' ? {} : { date_to: dateTo }),
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['journal-entries', { ...filters, page }],
    queryFn: () => journalEntryService.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const isFiltered =
    q !== '' ||
    status !== ALL ||
    source !== ALL ||
    accountId !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  function resetPage(): void {
    setPage(1);
  }

  function handleResetFilters(): void {
    setQ('');
    setStatus(ALL);
    setSource(ALL);
    setAccountId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  // Quick Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload: JournalEntryWritePayload) => journalEntryService.create(payload),
    onSuccess: (newEntry) => {
      toast.success(`Jurnal ${newEntry.number} berhasil dicatat.`);
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      setIsCreateOpen(false);
      setCreateForm(emptyForm());
      setFormErrorsState({});
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Gagal mencatat jurnal manual.'));
    },
  });

  function handleSaveQuickJournal(e: React.FormEvent): void {
    e.preventDefault();
    const errors = fieldErrors(createForm);
    if (Object.keys(errors).length > 0) {
      setFormErrorsState(errors);
      return;
    }

    const payload = toPayload(createForm);
    createMutation.mutate(payload);
  }

  // PDF Export
  async function handleExportPdf(): Promise<void> {
    const items = data?.items ?? [];
    if (items.length === 0) {
      toast.error('Tidak ada data jurnal untuk dicetak pada filter saat ini.');
      return;
    }

    setIsExporting(true);
    try {
      const pdfItems = items.map((item) => ({
        date: item.date,
        number: item.number,
        reference: item.number,
        description: item.description,
        totalDebit: item.totalDebit ?? item.totalAmount,
        totalCredit: item.totalCredit ?? item.totalAmount,
        lines: (item.lines ?? []).map((l) => ({
          accountCode: l.accountCode,
          accountName: l.accountName,
          description: l.memo === '—' ? '' : l.memo,
          debit: l.debit,
          credit: l.creditValue,
        })),
      }));

      const config = {
        companyName: 'PT. TRILIUN ANUGRAH NUSANTARA',
        address: 'Kawasan Industri & Perdagangan Emas Jakarta',
        phone: '+62 21 555-8899',
      };

      const success = await exportJournalEntriesPdf(
        pdfItems,
        dateFrom || null,
        dateTo || null,
        config,
      );

      if (success) {
        toast.success('Daftar Jurnal Umum berhasil diekspor ke PDF.');
      } else {
        window.print();
      }
    } catch {
      toast.error('Gagal mencetak dokumen PDF jurnal.');
    } finally {
      setIsExporting(false);
    }
  }

  // KPI Statistics Calculation
  const stats = useMemo(() => {
    const items = data?.items ?? [];
    let totalDebit = 0;
    let totalCredit = 0;
    let postedCount = 0;
    let draftCount = 0;
    let voidCount = 0;

    for (const item of items) {
      if (item.status === 'POSTED') postedCount += 1;
      else if (item.status === 'DRAFT') draftCount += 1;
      else if (item.status === 'VOID') voidCount += 1;

      if (item.lines && item.lines.length > 0) {
        for (const line of item.lines) {
          totalDebit += line.debit;
          totalCredit += line.creditValue;
        }
      } else {
        totalDebit += item.totalAmount;
        totalCredit += item.totalAmount;
      }
    }

    const difference = Math.abs(totalDebit - totalCredit);
    const isBalanced = difference === 0;

    return {
      totalCount: data?.total ?? items.length,
      totalDebit,
      totalCredit,
      isBalanced,
      difference,
      postedCount,
      draftCount,
      voidCount,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      {/* 1. RINGKASAN STATISTIK & KPI KESEIMBANGAN BUKU BESAR */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Transaksi */}
        <Card className="p-4 bg-surface-raised/50 border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-foreground-subtle text-xs font-medium uppercase tracking-wider">
              Total Jurnal
            </span>
            <FileText className="h-4 w-4 text-primary opacity-80" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-bold text-foreground">
              {formatNumber(stats.totalCount)}
            </span>
            <span className="text-foreground-subtle block text-xs mt-0.5">
              {stats.postedCount} Diposting · {stats.draftCount} Draft
            </span>
          </div>
        </Card>

        {/* Total Mutasi Debet */}
        <Card className="p-4 bg-surface-raised/50 border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-foreground-subtle text-xs font-medium uppercase tracking-wider">
              Total Mutasi Debet
            </span>
            <Layers className="h-4 w-4 text-emerald-400 opacity-80" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-xl font-bold text-emerald-400 tabular-nums">
              {formatCurrency(stats.totalDebit)}
            </span>
            <span className="text-foreground-subtle block text-xs mt-0.5">
              Sisi Aktiva & Beban Operasional
            </span>
          </div>
        </Card>

        {/* Total Mutasi Kredit */}
        <Card className="p-4 bg-surface-raised/50 border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-foreground-subtle text-xs font-medium uppercase tracking-wider">
              Total Mutasi Kredit
            </span>
            <Layers className="h-4 w-4 text-sky-400 opacity-80" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-xl font-bold text-sky-400 tabular-nums">
              {formatCurrency(stats.totalCredit)}
            </span>
            <span className="text-foreground-subtle block text-xs mt-0.5">
              Sisi Pasiva, Modal & Pendapatan
            </span>
          </div>
        </Card>

        {/* Keseimbangan Buku Besar */}
        <Card className="p-4 bg-surface-raised/50 border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-foreground-subtle text-xs font-medium uppercase tracking-wider">
              Keseimbangan Jurnal
            </span>
            {stats.isBalanced ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 text-danger" aria-hidden="true" />
            )}
          </div>
          <div className="mt-2">
            {stats.isBalanced ? (
              <div className="flex items-center gap-1.5">
                <Badge variant="success" size="sm" dot>
                  SEIMBANG (Balanced)
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Badge variant="destructive" size="sm">
                  SELISIH: {formatCurrency(stats.difference)}
                </Badge>
              </div>
            )}
            <span className="text-foreground-subtle block text-xs mt-1">
              {stats.isBalanced
                ? 'Σ Debet = Σ Kredit berimbang sempurna'
                : 'Peringatan: terdapat selisih pembukuan'}
            </span>
          </div>
        </Card>
      </div>

      {/* 2. FILTER & PENCARIAN MUTASI JURNAL */}
      <div className="border-border bg-surface-raised/30 rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Pencarian Teks */}
          <div className="relative min-w-[220px] flex-1">
            <Search
              className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              placeholder="Cari nomor jurnal, akun, atau narasi transaksi…"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                resetPage();
              }}
              className="pl-9 text-xs"
              aria-label="Cari jurnal"
            />
          </div>

          {/* Filter Status */}
          <Combobox
            options={STATUS_FILTER_OPTIONS}
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              resetPage();
            }}
            className="w-full sm:w-40 text-xs"
            placeholder="Semua status"
            searchPlaceholder="Cari status…"
            emptyText="Status tidak ditemukan."
            aria-label="Filter status jurnal"
          />

          {/* Filter Sumber */}
          <Combobox
            options={SOURCE_FILTER_OPTIONS}
            value={source}
            onValueChange={(value) => {
              setSource(value);
              resetPage();
            }}
            className="w-full sm:w-44 text-xs"
            placeholder="Semua sumber"
            searchPlaceholder="Cari sumber…"
            emptyText="Sumber tidak ditemukan."
            aria-label="Filter sumber jurnal"
          />

          {/* Filter Akun COA */}
          <AccountPicker
            value={accountId}
            onChange={(value) => {
              setAccountId(value);
              resetPage();
            }}
            placeholder="Semua akun"
            className="flex w-full flex-col gap-1 sm:w-56"
            aria-label="Filter akun"
          />
        </div>

        {/* Baris Kedua: Periode Tanggal & Tombol Aksi */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-foreground-subtle font-medium">Periode:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                resetPage();
              }}
              className="w-36 text-xs h-8"
              aria-label="Tanggal Dari"
            />
            <span className="text-foreground-subtle">s/d</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                resetPage();
              }}
              className="w-36 text-xs h-8"
              aria-label="Tanggal Sampai"
            />

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs text-foreground-subtle hover:text-foreground"
                leftIcon={<RotateCcw className="h-3 w-3" />}
              >
                Reset Filter
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Tombol Cetak PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExportPdf()}
              isLoading={isExporting}
              leftIcon={<Printer className="h-4 w-4" aria-hidden="true" />}
              className="h-8 text-xs"
            >
              Cetak Buku Jurnal (PDF)
            </Button>

            {/* Tombol Input Jurnal Baru */}
            {can('journal-entries:create') && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateForm(emptyForm());
                    setFormErrorsState({});
                    setIsCreateOpen(true);
                  }}
                  leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                  className="h-8 text-xs font-semibold shadow-xs"
                >
                  ➕ Jurnal Cepat
                </Button>
                <Link
                  href="/admin/accounting/journals/new"
                  className="border-border hover:bg-surface text-foreground-muted hover:text-foreground inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors"
                  title="Buka form jurnal layar penuh"
                >
                  <span>Form Penuh</span>
                  <ArrowUpRight className="h-3 w-3 opacity-60" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. TABEL DAFTAR BUKU JURNAL UMUM (DEBIT-KREDIT MULTI-AKUN) */}
      <JournalsTable
        entries={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isFiltered={isFiltered}
        permissions={{
          canUpdate: can('journal-entries:update'),
          canPost: can('journal-entries:post'),
          canVoid: can('journal-entries:void'),
          canDelete: can('journal-entries:delete'),
        }}
      />

      {/* 4. PAGINASI */}
      {data && !data.isEmpty && (
        <div className="flex items-center justify-between gap-3 px-1">
          <Typography variant="muted" className="text-xs">
            Halaman {formatNumber(data.page)} dari {formatNumber(data.totalPages)} · Total{' '}
            {formatNumber(data.total)} transaksi jurnal
          </Typography>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasPrevPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="text-xs h-8"
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
              className="text-xs h-8"
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}

      {/* 5. MODAL DIALOG INPUT JURNAL UMUM CEPAT (COMPOUND 2-3 AKUN ATAU LEBIH) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Catat Jurnal Umum Baru (Compound)</DialogTitle>
            <DialogDescription>
              Buat ayat jurnal akuntansi berpasangan. Sistem mendukung compound entry (1 Debet vs 2
              Kredit, 2 Debet vs 1 Kredit, dsb). Total Debet dan Kredit wajib seimbang.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveQuickJournal} className="space-y-4 pt-2">
            {/* Header Form */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-foreground text-xs font-semibold block mb-1">
                  Tanggal Jurnal <span className="text-danger">*</span>
                </label>
                <Input
                  type="date"
                  value={createForm.date ? toDateOnly(createForm.date) : toDateOnly(today())}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCreateForm((prev) => ({
                      ...prev,
                      date: val ? new Date(val) : today(),
                    }));
                  }}
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-foreground text-xs font-semibold block mb-1">
                  Keterangan / Narasi Transaksi <span className="text-danger">*</span>
                </label>
                <Input
                  placeholder="Contoh: Pengadaan bahan baku emas murni 100g via Kasir..."
                  value={createForm.description}
                  onChange={(e) => {
                    setCreateForm((prev) => ({ ...prev, description: e.target.value }));
                    if (formErrorsState.description) {
                      setFormErrorsState((prev) => {
                        const next = { ...prev };
                        delete next.description;
                        return next;
                      });
                    }
                  }}
                  className="text-xs h-9"
                  required
                />
                {formErrorsState.description && (
                  <span className="text-danger text-[11px] block mt-1">
                    {formErrorsState.description}
                  </span>
                )}
              </div>
            </div>

            {/* Editor Baris Multi-Akun */}
            <div className="border-border/60 bg-surface/40 rounded-lg border p-3">
              <span className="text-foreground text-xs font-bold block mb-2">
                Rincian Akun-Akun (Minimal 2 Baris, Debet = Kredit):
              </span>
              <JournalLinesEditor
                lines={createForm.lines}
                onChange={(lines) => {
                  setCreateForm((prev) => ({ ...prev, lines }));
                  if (formErrorsState.lines) {
                    setFormErrorsState((prev) => {
                      const next = { ...prev };
                      delete next.lines;
                      return next;
                    });
                  }
                }}
                error={formErrorsState.lines}
              />
            </div>

            <DialogFooter className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Link
                href="/admin/accounting/journals/new"
                className="text-xs text-primary hover:underline"
              >
                Ingin formulir layar penuh? Buka di sini ↗
              </Link>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={createMutation.isPending}
                  className="font-semibold shadow-xs"
                >
                  Simpan & Posting Jurnal
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

JournalsView.displayName = 'JournalsView';
