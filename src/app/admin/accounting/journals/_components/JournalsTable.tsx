'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, CheckCircle2, Layers, List, ArrowUpRight } from 'lucide-react';

import { apiErrorMessage } from '@/services';
import { JOURNAL_STATUS_BADGE } from '@/lib/journal-entry';
import { formatCurrency } from '@/lib/number';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
import type { JournalEntryVO } from '@/types/value-objects';
import { JournalRowMenu } from './JournalRowMenu';

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e'];

export interface JournalsTableProps {
  entries: JournalEntryVO[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  isFiltered: boolean;
  permissions: {
    canUpdate: boolean;
    canPost: boolean;
    canVoid: boolean;
    canDelete: boolean;
  };
}

function renderSafeText(val: unknown, fallback: string = '—'): string {
  if (typeof val === 'string' && val.trim() !== '') return val;
  if (typeof val === 'number' && !isNaN(val)) return String(val);
  return fallback;
}

interface EntryGroup {
  key: string;
  label: string;
  entries: JournalEntryVO[];
  totalDebit: number;
  totalCredit: number;
}

/**
 * Mengelompokkan entri per transaksi (TTB, BKK, BBK, Pembelian, dst) — bukan
 * daftar datar per baris jurnal. Urutan grup mengikuti urutan kemunculan
 * pertama di halaman ini, supaya konsisten dengan urutan tanggal terbaru dulu
 * yang sudah dipakai daftar (bukan diurutkan ulang secara alfabetis).
 */
function groupEntries(entries: JournalEntryVO[]): EntryGroup[] {
  const groups = new Map<string, EntryGroup>();

  for (const entry of entries) {
    const key = entry.groupKey;
    let group = groups.get(key);
    if (!group) {
      group = { key, label: entry.groupLabel, entries: [], totalDebit: 0, totalCredit: 0 };
      groups.set(key, group);
    }
    group.entries.push(entry);
    group.totalDebit += entry.totalDebit ?? entry.totalAmount;
    group.totalCredit += entry.totalCredit ?? entry.totalAmount;
  }

  return [...groups.values()];
}

/**
 * Tabel Jurnal Umum SAK EMKM PT TAN.
 *
 * Menampilkan transaksi jurnal dalam format Buku Jurnal Umum resmi:
 * Tiap transaksi memperlihatkan akun-akun (2-3 akun atau lebih) yang berubah,
 * kolom Debet dan Kredit berdampingan, serta status keseimbangan (Balanced).
 */
export function JournalsTable({
  entries,
  isLoading,
  isError,
  error,
  onRetry,
  isFiltered,
  permissions,
}: JournalsTableProps) {
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll(): void {
    setExpandedIds(new Set(entries.map((e) => e.id)));
  }

  function collapseAll(): void {
    setExpandedIds(new Set());
  }

  return (
    <div className="space-y-4">
      {/* Kontrol Mode Tampilan */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground-subtle text-xs font-medium">Mode Tampilan:</span>
          <div className="border-border bg-surface inline-flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'detailed'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Buku Jurnal (Rinci Akun)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'compact'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Daftar Ringkas</span>
            </button>
          </div>
        </div>

        {viewMode === 'compact' && entries.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">
              Buka Semua Rincian
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">
              Tutup Semua
            </Button>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {SKELETON_ROWS.map((key) => (
            <div key={key} className="border-border bg-surface/50 rounded-lg border p-4 space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="border-border rounded-lg border p-6">
          <ErrorState
            variant="inline"
            message={apiErrorMessage(error, 'Daftar jurnal gagal dimuat.')}
            onRetry={onRetry}
          />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && entries.length === 0 && (
        <div className="border-border bg-surface/30 rounded-lg border py-16 text-center">
          <p className="text-foreground-muted text-sm">
            {isFiltered
              ? 'Tidak ada jurnal yang cocok dengan filter pencarian.'
              : 'Belum ada jurnal transaksi yang dicatat.'}
          </p>
        </div>
      )}

      {/* MODE DETAILED: BUKU JURNAL UMUM (DEBIT & KREDIT PER AKUN), TERKELOMPOK PER TRANSAKSI */}
      {!isLoading && !isError && entries.length > 0 && viewMode === 'detailed' && (
        <div className="space-y-6">
          {groupEntries(entries).map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" size="sm">
                    {group.label}
                  </Badge>
                  <span className="text-foreground-subtle text-xs">
                    {group.entries.length} transaksi
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs tabular-nums">
                  <span className="text-foreground-subtle">
                    Debet <span className="text-emerald-400 font-semibold">{formatCurrency(group.totalDebit)}</span>
                  </span>
                  <span className="text-foreground-subtle">
                    Kredit <span className="text-sky-400 font-semibold">{formatCurrency(group.totalCredit)}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {group.entries.map((entry) => {
            const lines = entry.lines ?? [];
            const hasLines = lines.length > 0;
            const totalDebit = entry.totalDebitLabel ?? entry.totalAmountLabel;
            const totalCredit = entry.totalCreditLabel ?? entry.totalAmountLabel;

            return (
              <div
                key={entry.id}
                className="border-border bg-surface-raised/40 hover:border-primary/40 rounded-xl border transition-colors shadow-xs overflow-hidden"
              >
                {/* Header Transaksi Jurnal */}
                <div className="border-border bg-surface/80 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/admin/accounting/journals/${entry.id}`}
                      className="text-primary hover:underline font-mono text-sm font-bold flex items-center gap-1"
                    >
                      <span>{renderSafeText(entry.number, 'JRN')}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-60" aria-hidden="true" />
                    </Link>
                    <span className="text-foreground-subtle text-xs">·</span>
                    <span className="text-foreground-muted text-xs font-medium">
                      {renderSafeText(entry.dateLabel)}
                    </span>
                    <Badge variant="secondary" size="sm">
                      {renderSafeText(entry.sourceLabel)}
                    </Badge>
                    <Badge variant={JOURNAL_STATUS_BADGE[entry.status]} size="sm" dot>
                      {renderSafeText(entry.statusLabel)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-foreground font-semibold tabular-nums text-sm">
                        {renderSafeText(entry.totalAmountLabel)}
                      </span>
                      <span className="text-foreground-subtle block text-xs">
                        {renderSafeText(entry.lineCountLabel)}
                      </span>
                    </div>
                    <JournalRowMenu entry={entry} {...permissions} />
                  </div>
                </div>

                {/* Keterangan Transaksi */}
                <div className="bg-surface/30 px-4 py-2 text-xs">
                  <span className="text-foreground-subtle font-medium mr-1.5">Keterangan:</span>
                  <span className="text-foreground">{renderSafeText(entry.description)}</span>
                </div>

                {/* Rincian Akun-Akun (2-3 Akun atau Lebih) */}
                {hasLines ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60 bg-surface/50 text-[11px]">
                          <TableHead className="w-10 text-right">#</TableHead>
                          <TableHead className="min-w-[220px]">Akun Keuangan</TableHead>
                          <TableHead className="min-w-[160px]">Memo / Keterangan Baris</TableHead>
                          <TableHead className="w-40 text-right">Debet (IDR)</TableHead>
                          <TableHead className="w-40 text-right">Kredit (IDR)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line) => (
                          <TableRow key={line.id} className="border-border/40 hover:bg-surface/60 text-xs">
                            <TableCell className="text-foreground-subtle text-right tabular-nums">
                              {line.lineNo}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono text-xs font-semibold text-foreground">
                                  {renderSafeText(line.accountCode)}
                                </span>
                                <span className="text-foreground-muted">{renderSafeText(line.accountName)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-foreground-subtle text-xs">
                              {renderSafeText(line.memo)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {line.debit > 0 ? (
                                <span className="text-emerald-400 font-semibold">{renderSafeText(line.debitLabel)}</span>
                              ) : (
                                <span className="text-foreground-subtle/50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {line.creditValue > 0 ? (
                                <span className="text-sky-400 font-semibold">{renderSafeText(line.creditLabel)}</span>
                              ) : (
                                <span className="text-foreground-subtle/50">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-foreground-subtle">
                    Baris jurnal belum termuat.{' '}
                    <Link
                      href={`/admin/accounting/journals/${entry.id}`}
                      className="text-primary underline"
                    >
                      Buka detail jurnal
                    </Link>
                  </div>
                )}

                {/* Subtotal & Keseimbangan Jurnal */}
                <div className="border-border/60 bg-surface/80 flex flex-wrap items-center justify-between border-t px-4 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-medium">Total Debet & Kredit Seimbang (Balanced)</span>
                  </div>

                  <div className="flex items-center gap-6 tabular-nums">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground-subtle">Total Debet:</span>
                      <span className="font-bold text-emerald-400">{totalDebit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground-subtle">Total Kredit:</span>
                      <span className="font-bold text-sky-400">{totalCredit}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODE COMPACT: DAFTAR BARIS RINGKAS */}
      {!isLoading && !isError && entries.length > 0 && viewMode === 'compact' && (
        <div className="border-border overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-40">Nomor</TableHead>
                <TableHead className="w-28">Tanggal</TableHead>
                <TableHead>Keterangan & Akun Terlibat</TableHead>
                <TableHead className="text-right w-36">Nilai Jurnal</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupEntries(entries).flatMap((group) => [
                <TableRow key={`group-${group.key}`} className="bg-surface/70 hover:bg-surface/70">
                  <TableCell colSpan={7} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" size="sm">
                          {group.label}
                        </Badge>
                        <span className="text-foreground-subtle text-xs">
                          {group.entries.length} transaksi
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs tabular-nums">
                        <span className="text-foreground-subtle">
                          Debet{' '}
                          <span className="text-emerald-400 font-semibold">
                            {formatCurrency(group.totalDebit)}
                          </span>
                        </span>
                        <span className="text-foreground-subtle">
                          Kredit{' '}
                          <span className="text-sky-400 font-semibold">
                            {formatCurrency(group.totalCredit)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>,
                ...group.entries.map((entry) => {
                const isExpanded = expandedIds.has(entry.id);
                const lines = entry.lines ?? [];
                const hasLines = lines.length > 0;

                return (
                  <TableRow key={entry.id} className="hover:bg-surface/50">
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleExpand(entry.id)}
                        className="text-foreground-muted hover:text-foreground inline-flex p-1 cursor-pointer"
                        aria-label={isExpanded ? 'Tutup rincian akun' : 'Buka rincian akun'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/admin/accounting/journals/${entry.id}`}
                        className="text-primary hover:underline font-semibold block"
                      >
                        {renderSafeText(entry.number, 'JRN')}
                      </Link>
                      <span className="text-foreground-subtle block text-[11px]">
                        {renderSafeText(entry.sourceLabel)}
                      </span>
                    </TableCell>
                    <TableCell className="text-foreground-muted text-xs">
                      {renderSafeText(entry.dateLabel)}
                    </TableCell>
                    <TableCell>
                      <span className="text-foreground font-medium block">{renderSafeText(entry.description)}</span>
                      {hasLines && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {lines.map((line) => (
                            <span
                              key={line.id}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                                line.debit > 0
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              }`}
                            >
                              {renderSafeText(line.accountCode)} ({line.debit > 0 ? 'D' : 'K'})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Sub-baris Rincian Debit-Kredit saat dibuka */}
                      {isExpanded && hasLines && (
                        <div className="mt-2.5 rounded-md border border-border/60 bg-surface/70 p-2">
                          <Table className="bg-background/80 rounded border border-border/40">
                            <TableHeader>
                              <TableRow className="text-[10px]">
                                <TableHead className="w-8">#</TableHead>
                                <TableHead>Akun</TableHead>
                                <TableHead className="text-right">Debet (IDR)</TableHead>
                                <TableHead className="text-right">Kredit (IDR)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {lines.map((line) => (
                                <TableRow key={line.id} className="text-xs">
                                  <TableCell className="text-foreground-subtle text-right tabular-nums py-1">
                                    {line.lineNo}
                                  </TableCell>
                                  <TableCell className="py-1">
                                    <span className="font-mono font-semibold text-foreground mr-1.5">
                                      {renderSafeText(line.accountCode)}
                                    </span>
                                    <span className="text-foreground-muted text-[11px]">{renderSafeText(line.accountName)}</span>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums py-1">
                                    {line.debit > 0 ? (
                                      <span className="text-emerald-400 font-medium">{renderSafeText(line.debitLabel)}</span>
                                    ) : (
                                      '—'
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums py-1">
                                    {line.creditValue > 0 ? (
                                      <span className="text-sky-400 font-medium">{renderSafeText(line.creditLabel)}</span>
                                    ) : (
                                      '—'
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground text-right tabular-nums font-semibold">
                      {renderSafeText(entry.totalAmountLabel)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={JOURNAL_STATUS_BADGE[entry.status]} size="sm" dot>
                        {renderSafeText(entry.statusLabel)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <JournalRowMenu entry={entry} {...permissions} />
                    </TableCell>
                  </TableRow>
                );
                }),
              ])}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

JournalsTable.displayName = 'JournalsTable';
