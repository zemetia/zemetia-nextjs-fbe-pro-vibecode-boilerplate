'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiErrorMessage, purchaseRequestService } from '@/services';
import { useToast } from '@/hooks';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormModal } from '@/components/ui/FormModal';
import { Textarea } from '@/components/ui/textarea';
import type { PurchaseRequestVO } from '@/types/value-objects';

export type PurchaseRequestDialogAction = 'approve' | 'void' | 'delete';

export interface PurchaseRequestStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PurchaseRequestVO;
  action: PurchaseRequestDialogAction;
  onSuccess?: () => void;
}

export function PurchaseRequestStatusDialog({
  open,
  onOpenChange,
  request,
  action,
  onSuccess,
}: PurchaseRequestStatusDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const approveMutation = useMutation({
    mutationFn: () => purchaseRequestService.approve(request.id),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      toast.success(`Permintaan ${saved.number} berhasil disetujui.`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => toast.apiError(err, 'Permintaan gagal disetujui.'),
  });

  const voidMutation = useMutation({
    mutationFn: () => purchaseRequestService.void(request.id, voidReason.trim()),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      toast.success(`Permintaan ${saved.number} berhasil dibatalkan.`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      setError(apiErrorMessage(err, 'Permintaan gagal dibatalkan.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => purchaseRequestService.remove(request.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      toast.success(`Permintaan ${request.number} berhasil dihapus.`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => toast.apiError(err, 'Permintaan gagal dihapus.'),
  });

  if (action === 'approve') {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Setujui Permintaan ${request.number}?`}
        description="Setelah disetujui, isi permintaan terkunci dan siap diterbitkan/dikonversi menjadi Purchase Order (PO)."
        confirmLabel="Setujui Permintaan"
        tone="info"
        isConfirming={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate()}
      />
    );
  }

  if (action === 'delete') {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Hapus Permintaan Draft ${request.number}?`}
        description="Draft permintaan akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Draft"
        tone="danger"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    );
  }

  function handleVoidSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!voidReason.trim()) {
      setError('Alasan pembatalan wajib diisi');
      return;
    }
    setError(undefined);
    voidMutation.mutate();
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Batalkan Permintaan ${request.number}`}
      description="Permintaan yang dibatalkan akan ditandai VOID dan tidak dapat dikonversi menjadi PO."
      submitLabel="Batalkan Permintaan"
      isSubmitting={voidMutation.isPending}
      error={error}
      onSubmit={handleVoidSubmit}
    >
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="void-reason" className="text-sm font-medium text-foreground">
          Alasan Pembatalan <span className="text-destructive">*</span>
        </label>
        <Textarea
          id="void-reason"
          value={voidReason}
          onChange={(event) => {
            setVoidReason(event.target.value);
            if (error) setError(undefined);
          }}
          placeholder="Tulis alasan mengapa permintaan ini dibatalkan…"
          rows={3}
          required
          autoFocus
        />
      </div>
    </FormModal>
  );
}

PurchaseRequestStatusDialog.displayName = 'PurchaseRequestStatusDialog';
