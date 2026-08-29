'use client';

import { useQuery } from '@tanstack/react-query';

import { apiErrorMessage, journalEntryService } from '@/services';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { JournalForm } from './JournalForm';
import { formFromEntry } from './form-state';

export interface JournalEditFormProps {
  entryId: string;
}

/**
 * Memuat jurnalnya lewat service domain — bukan Prisma — supaya form ubah
 * melihat bentuk yang persis sama dengan yang dihasilkan form buat.
 *
 * Jurnal yang tidak boleh diubah ditolak di sini juga, bukan hanya di API. Dua
 * sebab yang berbeda dan keduanya disebutkan apa adanya: sudah masuk buku, atau
 * dibuat oleh dokumen lain. Menyodorkan form yang tombol simpannya pasti gagal
 * hanya memindahkan penjelasannya ke saat yang paling tidak berguna.
 */
export function JournalEditForm({ entryId }: JournalEditFormProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['journal-entries', 'detail', entryId],
    queryFn: () => journalEntryService.detail(entryId),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (isError || !data) {
    return (
      <ErrorState
        message={apiErrorMessage(error, 'Data jurnal gagal dimuat.')}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data.isEditable) {
    return (
      <ErrorState
        message={
          data.source === 'MANUAL'
            ? `Jurnal ${data.number} berstatus ${data.statusLabel.toLowerCase()}, jadi isinya tidak bisa diubah lagi. Batalkan jurnalnya lalu buat penggantinya.`
            : `Jurnal ${data.number} dibuat otomatis oleh ${data.sourceLabel.toLowerCase()}, jadi hanya bisa diubah lewat dokumen sumbernya.`
        }
      />
    );
  }

  return <JournalForm entryId={entryId} initialForm={formFromEntry(data)} />;
}

JournalEditForm.displayName = 'JournalEditForm';
