'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';

import { journalEntryService } from '@/services';
import { useToast } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import type { JournalEntryVO } from '@/types/value-objects';

const BASE_PATH = '/admin/accounting/journals';
const MIN_REASON = 5;

export interface JournalRowMenuProps {
  entry: JournalEntryVO;
  /** Sekadar petunjuk tampilan — setiap endpoint memeriksa ulang sendiri. */
  canUpdate: boolean;
  canPost: boolean;
  canVoid: boolean;
  canDelete: boolean;
}

type OpenDialog = 'none' | 'post' | 'void' | 'delete';

/**
 * Aksi baris mengikuti daur hidup jurnalnya sendiri, dan hanya yang benar-benar
 * bisa dilakukan sekarang yang ditawarkan.
 *
 * Jurnal bersumber modul lain tidak pernah menawarkan ubah maupun hapus, bahkan
 * saat masih draft: yang menentukan isinya adalah dokumen sumbernya, dan
 * mengubahnya dari sini membuat buku dan dokumen bercerita berbeda. Yang
 * ditawarkan untuk keduanya cuma posting dan pembatalan — dua tindakan yang
 * memang milik buku besar.
 */
export function JournalRowMenu({
  entry,
  canUpdate,
  canPost,
  canVoid,
  canDelete,
}: JournalRowMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [dialog, setDialog] = useState<OpenDialog>('none');
  const [reason, setReason] = useState('');

  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    setDialog('none');
    setReason('');
  }

  const postMutation = useMutation({
    mutationFn: () => journalEntryService.post(entry.id),
    onSuccess: (updated) => {
      refresh();
      toast.success(`Jurnal ${updated.number} masuk buku besar.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal memposting jurnal. Coba lagi.'),
  });

  const voidMutation = useMutation({
    mutationFn: () => journalEntryService.void(entry.id, reason.trim()),
    onSuccess: (updated) => {
      refresh();
      toast.success(`Jurnal ${updated.number} dibatalkan — barisnya tetap tersimpan.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal membatalkan jurnal. Coba lagi.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => journalEntryService.remove(entry.id),
    onSuccess: () => {
      refresh();
      toast.success(`Draft ${entry.number} dihapus.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal menghapus draft. Coba lagi.'),
  });

  const isBusy = postMutation.isPending || voidMutation.isPending || deleteMutation.isPending;
  const hasAction = entry.isEditable || entry.isPostable || entry.isVoidable;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            aria-label={`Aksi untuk ${entry.number}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`${BASE_PATH}/${entry.id}`)}>
            Lihat detail
          </DropdownMenuItem>

          {entry.isEditable && (
            <DropdownMenuItem
              disabled={!canUpdate}
              onSelect={() => router.push(`${BASE_PATH}/${entry.id}/edit`)}
            >
              Ubah draft
            </DropdownMenuItem>
          )}

          {entry.isPostable && (
            <DropdownMenuItem disabled={!canPost} onSelect={() => setDialog('post')}>
              Posting ke buku besar
            </DropdownMenuItem>
          )}

          {entry.isDeletable && (
            <DropdownMenuItem
              variant="destructive"
              disabled={!canDelete}
              onSelect={() => setDialog('delete')}
            >
              Hapus draft
            </DropdownMenuItem>
          )}

          {entry.isVoidable && (
            <DropdownMenuItem
              variant="destructive"
              disabled={!canVoid}
              onSelect={() => setDialog('void')}
            >
              Batalkan
            </DropdownMenuItem>
          )}

          {!hasAction && <DropdownMenuItem disabled>Tidak ada aksi lain</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === 'post'}
        onOpenChange={(open) => setDialog(open ? 'post' : 'none')}
        onConfirm={() => postMutation.mutate()}
        isConfirming={postMutation.isPending}
        tone="info"
        title={`Posting ${entry.number}?`}
        description={`Jurnal senilai ${entry.totalAmountLabel} akan ikut dihitung di buku besar dan neraca saldo. Setelah ini koreksinya lewat pembatalan, bukan pengubahan.`}
        confirmLabel="Posting"
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : 'none')}
        onConfirm={() => deleteMutation.mutate()}
        isConfirming={deleteMutation.isPending}
        tone="danger"
        title={`Hapus draft ${entry.number}?`}
        description="Draft belum pernah masuk buku besar, jadi barisnya akan hilang seluruhnya."
        confirmLabel="Hapus"
      />

      <ConfirmDialog
        open={dialog === 'void'}
        onOpenChange={(open) => {
          setDialog(open ? 'void' : 'none');
          if (!open) setReason('');
        }}
        onConfirm={() => voidMutation.mutate()}
        isConfirming={voidMutation.isPending}
        confirmDisabled={reason.trim().length < MIN_REASON}
        tone="danger"
        title={`Batalkan ${entry.number}?`}
        description="Barisnya tetap tersimpan dan tetap terbaca, tapi berhenti dihitung saldo — nomor jurnal yang hilang dari urutan adalah pertanyaan yang tidak punya jawaban saat audit."
        confirmLabel="Batalkan"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-foreground text-sm font-medium">Alasan pembatalan</span>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={voidMutation.isPending}
            rows={3}
            placeholder="mis. salah akun beban, nota sumbernya dibatalkan"
          />
          <span className="text-foreground-subtle text-xs">Minimal {MIN_REASON} karakter.</span>
        </div>
      </ConfirmDialog>
    </>
  );
}

JournalRowMenu.displayName = 'JournalRowMenu';
