'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';

import { approvalService } from '@/services';
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
import type { ApprovalDecision, ApprovalRequestVO } from '@/types/value-objects';

export interface ApprovalRowActionsProps {
  request: ApprovalRequestVO;
  /** Punya izin confirm milik modul dokumen ini. Petunjuk UI saja. */
  canDecide: boolean;
  /** Pemegang sesi adalah yang mengajukan — hanya ia yang bisa menarik kembali. */
  isRequester: boolean;
}

type OpenDialog = 'none' | 'approve' | 'reject' | 'cancel';

/**
 * Aksi baris mengikuti keadaan permintaannya: yang sudah diputuskan tidak
 * menawarkan apa pun selain catatannya, dan menyetujui hanya muncul untuk yang
 * izin confirm modulnya memang dipegang.
 *
 * Catatan **tidak wajib** di ketiga aksi — keputusan developer. Penolakan yang
 * cepat lebih berguna daripada penolakan yang menunggu paragraf, dan dokumennya
 * tetap duduk di layar pengajunya untuk diperbaiki.
 */
export function ApprovalRowActions({ request, canDecide, isRequester }: ApprovalRowActionsProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [dialog, setDialog] = useState<OpenDialog>('none');
  const [note, setNote] = useState('');

  const decide = useMutation({
    mutationFn: (decision: ApprovalDecision) =>
      approvalService.decide(request.id, decision, note.trim() || undefined),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      // Dokumennya baru saja berpindah status — daftar yang menampilkannya harus
      // ikut basi, kalau tidak layar sebelah masih menyebutnya draft.
      void queryClient.invalidateQueries({ queryKey: ['metal-purchases'] });
      void queryClient.invalidateQueries({ queryKey: ['metal-purchase-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['cash-vouchers'] });
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] });

      setDialog('none');
      setNote('');

      const subject = updated.subject?.number ?? updated.number;
      if (updated.status === 'APPROVED') toast.success(`${subject} disetujui.`);
      else if (updated.status === 'REJECTED') toast.success(`${subject} ditolak.`);
      else toast.success(`Pengajuan ${subject} ditarik kembali.`);
    },
    onError: (error) => toast.apiError(error, 'Keputusan gagal disimpan. Coba lagi.'),
  });

  const closeDialog = (next: OpenDialog) => (open: boolean) => {
    setDialog(open ? next : 'none');
    if (!open) setNote('');
  };

  if (!request.isPending) {
    return (
      <span className="text-foreground-subtle block text-xs">
        {request.decisionNote !== '—' ? request.decisionNote : request.decidedAtLabel}
      </span>
    );
  }

  const hasAction = canDecide || isRequester;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={decide.isPending}
            aria-label={`Aksi untuk ${request.subject?.number ?? request.number}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canDecide && (
            <>
              <DropdownMenuItem
                disabled={request.isSubjectMissing}
                onSelect={() => setDialog('approve')}
              >
                Setujui
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog('reject')}>
                Tolak
              </DropdownMenuItem>
            </>
          )}

          {isRequester && (
            <DropdownMenuItem onSelect={() => setDialog('cancel')}>Tarik kembali</DropdownMenuItem>
          )}

          {!hasAction && <DropdownMenuItem disabled>Menunggu keputusan direktur</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={closeDialog('approve')}
        onConfirm={() => decide.mutate('APPROVED')}
        isConfirming={decide.isPending}
        tone="info"
        title={`Setujui ${request.subject?.number ?? request.number}?`}
        // Kalimatnya datang dari `APPROVAL_KIND_EFFECTS`, sumber yang sama dengan
        // yang dijalankan `executeApproval()` — dialog tidak boleh menjanjikan
        // hal yang berbeda dari yang benar-benar terjadi.
        description={request.effectLabel}
        confirmLabel="Setujui"
      >
        <NoteField
          label="Catatan keputusan (opsional)"
          value={note}
          onChange={setNote}
          disabled={decide.isPending}
          placeholder="mis. sudah dicek dengan invoice supplier"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'reject'}
        onOpenChange={closeDialog('reject')}
        onConfirm={() => decide.mutate('REJECTED')}
        isConfirming={decide.isPending}
        tone="danger"
        title={`Tolak ${request.subject?.number ?? request.number}?`}
        description="Dokumennya tidak berubah dan tetap bisa diperbaiki pembuatnya, lalu diajukan lagi."
        confirmLabel="Tolak"
      >
        <NoteField
          label="Alasan penolakan (opsional)"
          value={note}
          onChange={setNote}
          disabled={decide.isPending}
          placeholder="mis. harga belum sesuai kesepakatan"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={closeDialog('cancel')}
        onConfirm={() => decide.mutate('CANCELLED')}
        isConfirming={decide.isPending}
        tone="warning"
        title={`Tarik kembali ${request.subject?.number ?? request.number}?`}
        description="Permintaannya hilang dari antrean direktur. Dokumennya tidak berubah dan bisa diajukan lagi kapan saja."
        confirmLabel="Tarik kembali"
      />
    </>
  );
}

ApprovalRowActions.displayName = 'ApprovalRowActions';

function NoteField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-foreground text-sm font-medium">{label}</span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={3}
        placeholder={placeholder}
      />
    </div>
  );
}
