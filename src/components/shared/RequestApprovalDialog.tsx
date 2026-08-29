'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { SendHorizontal } from 'lucide-react';

import { approvalService } from '@/services';
import { useToast } from '@/hooks';
import { APPROVAL_KIND_EFFECTS, APPROVAL_KIND_REQUEST_PERMISSION } from '@/lib/approval';
import type { PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/textarea';
import type { ApprovalKind } from '@/types/value-objects';

/**
 * "Ajukan ke Direktur" — satu implementasi untuk keempat modul.
 *
 * Dialognya **terkontrol** dan tidak membawa triggernya sendiri, karena di
 * sebagian besar tempat pemicunya adalah `DropdownMenuItem`: menaruh dialog di
 * dalam `DropdownMenuContent` membuatnya ikut ter-unmount begitu menunya
 * tertutup, jadi state-nya harus dipegang halaman dan dialognya dirender sebagai
 * saudara menunya — pola yang sudah dipakai seluruh row menu di repo ini.
 * `RequestApprovalButton` di bawah adalah pembungkus tipis untuk tempat yang
 * memang butuh tombol sendiri.
 */

export interface RequestApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ApprovalKind;
  /** Id dokumen yang dimintakan keputusannya. */
  subjectId: string;
  /** Nomor dokumen — yang dibaca orang, bukan idnya. */
  subjectNumber: string;
  /** Query key daftar yang ikut basi setelah pengajuan (voucher berpindah status). */
  invalidateKeys?: readonly string[];
}

export function RequestApprovalDialog({
  open,
  onOpenChange,
  kind,
  subjectId,
  subjectNumber,
  invalidateKeys = [],
}: RequestApprovalDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [note, setNote] = useState('');

  const request = useMutation({
    mutationFn: () =>
      approvalService.request({ kind, subject_id: subjectId, note: note.trim() || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      for (const key of invalidateKeys) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      onOpenChange(false);
      setNote('');
      toast.success(`${subjectNumber} dikirim ke direktur untuk dikonfirmasi.`);
    },
    onError: (error) => toast.apiError(error, 'Pengajuan gagal dikirim. Coba lagi.'),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setNote('');
      }}
      onConfirm={() => request.mutate()}
      isConfirming={request.isPending}
      tone="info"
      title={`Ajukan ${subjectNumber} ke direktur?`}
      // Janjinya datang dari peta yang sama dengan yang dijalankan
      // `executeApproval()` — layar tidak boleh menjanjikan hal yang berbeda.
      description={`Kalau disetujui: ${APPROVAL_KIND_EFFECTS[kind]}`}
      confirmLabel="Ajukan"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-foreground text-sm font-medium">Catatan (opsional)</span>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={request.isPending}
          rows={3}
          placeholder="mis. dokumen pendukung sudah lengkap"
        />
      </div>
    </ConfirmDialog>
  );
}

RequestApprovalDialog.displayName = 'RequestApprovalDialog';

/**
 * Boleh-tidaknya mengajukan berdiri di **dua** izin, sama persis dengan gerbang
 * endpointnya (`POST /api/approvals`) — jadi menu yang tampil tidak pernah
 * berarti tindakan yang akan ditolak. Petunjuk UI saja; servernya memeriksa ulang.
 */
export function canRequestApproval(permissions: Set<string>, kind: ApprovalKind): boolean {
  return (
    permissions.has('approvals:request' satisfies PermissionKey) &&
    permissions.has(APPROVAL_KIND_REQUEST_PERMISSION[kind])
  );
}

export interface RequestApprovalButtonProps
  extends Omit<RequestApprovalDialogProps, 'open' | 'onOpenChange'> {
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

/** Untuk permukaan yang memang butuh tombolnya sendiri (header halaman detail). */
export function RequestApprovalButton({ size, ...props }: RequestApprovalButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const permissions = new Set(session?.user.permissions ?? []);
  if (!canRequestApproval(permissions, props.kind)) return null;

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        leftIcon={<SendHorizontal className="h-4 w-4" aria-hidden="true" />}
      >
        Ajukan ke Direktur
      </Button>
      <RequestApprovalDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}

RequestApprovalButton.displayName = 'RequestApprovalButton';
