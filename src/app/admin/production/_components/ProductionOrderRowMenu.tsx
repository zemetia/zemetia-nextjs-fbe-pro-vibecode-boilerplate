'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';

import { productionOrderService } from '@/services';
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
import type { ProductionOrderVO } from '@/types/value-objects';

export interface ProductionOrderRowMenuProps {
  order: ProductionOrderVO;
  /** UI hints only — every endpoint re-checks with requirePermission(). */
  canUpdate: boolean;
  canDelete: boolean;
  canRelease: boolean;
  canClose: boolean;
  canVoid: boolean;
}

type OpenDialog = 'none' | 'release' | 'close' | 'void' | 'delete';

/**
 * Row actions follow the SPK's own lifecycle: a draft can be edited, released
 * or deleted; a released order can be closed once nothing is left on the floor,
 * and voiding asks for a reason because that reason is the audit trail.
 */
export function ProductionOrderRowMenu({
  order,
  canUpdate,
  canDelete,
  canRelease,
  canClose,
  canVoid,
}: ProductionOrderRowMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [dialog, setDialog] = useState<OpenDialog>('none');
  const [voidReason, setVoidReason] = useState('');
  const [closeNote, setCloseNote] = useState('');

  /** Susut di atas toleransi harus dijelaskan sebelum angkanya terkunci. */
  const needsCloseNote = order.balance.isOverLossTolerance;

  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    setDialog('none');
  }

  const releaseMutation = useMutation({
    mutationFn: () => productionOrderService.release(order.id),
    onSuccess: (updated) => {
      refresh();
      toast.success(`SPK ${updated.number} dirilis — bahan sudah boleh dikeluarkan.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal merilis SPK. Coba lagi.'),
  });

  const closeMutation = useMutation({
    mutationFn: () => productionOrderService.close(order.id, closeNote.trim() || undefined),
    onSuccess: (updated) => {
      refresh();
      setCloseNote('');
      toast.success(`SPK ${updated.number} ditutup.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal menutup SPK. Coba lagi.'),
  });

  const voidMutation = useMutation({
    mutationFn: () => productionOrderService.void(order.id, voidReason.trim()),
    onSuccess: (updated) => {
      refresh();
      setVoidReason('');
      toast.success(`SPK ${updated.number} dibatalkan.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal membatalkan SPK. Coba lagi.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => productionOrderService.remove(order.id),
    onSuccess: () => {
      refresh();
      toast.success(`Draft ${order.number} dihapus.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal menghapus draft. Coba lagi.'),
  });

  const isBusy =
    releaseMutation.isPending ||
    closeMutation.isPending ||
    voidMutation.isPending ||
    deleteMutation.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            aria-label={`Aksi untuk ${order.number}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {order.isEditable && (
            <>
              <DropdownMenuItem
                disabled={!canUpdate}
                onSelect={() => router.push(`/admin/production/${order.id}/edit`)}
              >
                Ubah draft
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canRelease} onSelect={() => setDialog('release')}>
                Rilis ke produksi
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={!canDelete}
                onSelect={() => setDialog('delete')}
              >
                Hapus draft
              </DropdownMenuItem>
            </>
          )}

          {order.canClose && (
            <DropdownMenuItem
              // Menutup SPK yang bahannya belum kembali akan ditolak server;
              // pilihannya dimatikan supaya penolakannya tidak jadi kejutan.
              disabled={!canClose || order.balance.hasMaterialOnFloor}
              onSelect={() => setDialog('close')}
            >
              Tutup SPK
            </DropdownMenuItem>
          )}

          {order.canVoid && (
            <DropdownMenuItem
              variant="destructive"
              disabled={!canVoid}
              onSelect={() => setDialog('void')}
            >
              Batalkan
            </DropdownMenuItem>
          )}

          {!order.isEditable && !order.canClose && !order.canVoid && (
            <DropdownMenuItem disabled>Tidak ada aksi</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === 'release'}
        onOpenChange={(open) => setDialog(open ? 'release' : 'none')}
        onConfirm={() => releaseMutation.mutate()}
        isConfirming={releaseMutation.isPending}
        tone="info"
        title={`Rilis ${order.number} ke produksi?`}
        description={`Rencananya terkunci: ${order.targetGrossWeightGramLabel} ${order.karatLabel} yang menuntut ${order.fineNeededGramLabel} emas murni. Setelah dirilis, bahan boleh keluar dan hasilnya boleh dicatat.`}
        confirmLabel="Rilis"
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : 'none')}
        onConfirm={() => deleteMutation.mutate()}
        isConfirming={deleteMutation.isPending}
        tone="danger"
        title={`Hapus draft ${order.number}?`}
        description="Draft belum menyentuh emas, jadi baris ini akan hilang seluruhnya."
        confirmLabel="Hapus"
      />

      <ConfirmDialog
        open={dialog === 'close'}
        onOpenChange={(open) => {
          setDialog(open ? 'close' : 'none');
          if (!open) setCloseNote('');
        }}
        onConfirm={() => closeMutation.mutate()}
        isConfirming={closeMutation.isPending}
        confirmDisabled={needsCloseNote && closeNote.trim().length < 5}
        tone={needsCloseNote ? 'danger' : 'info'}
        title={`Tutup ${order.number}?`}
        description={`Hasilnya ${order.balance.outputGrossWeightGramLabel} dari ${order.balance.consumedFineGramLabel} emas yang diolah, dengan susut ${order.balance.lossFineGramLabel} (${order.balance.lossPercentLabel}). Setelah ditutup, susutnya terkunci.`}
        confirmLabel="Tutup SPK"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Penjelasan susut{needsCloseNote ? '' : ' (opsional)'}
          </span>
          <Textarea
            value={closeNote}
            onChange={(event) => setCloseNote(event.target.value)}
            disabled={closeMutation.isPending}
            rows={3}
            placeholder="mis. sisa serbuk belum tersaring, ditimbang ulang bulan depan"
          />
          <span className="text-xs text-foreground-subtle">
            {needsCloseNote
              ? `Susutnya melewati toleransi ${order.lossTolerancePercentLabel} — penjelasan wajib, minimal 5 karakter.`
              : `Susutnya masih di dalam toleransi ${order.lossTolerancePercentLabel}.`}
          </span>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'void'}
        onOpenChange={(open) => {
          setDialog(open ? 'void' : 'none');
          if (!open) setVoidReason('');
        }}
        onConfirm={() => voidMutation.mutate()}
        isConfirming={voidMutation.isPending}
        confirmDisabled={voidReason.trim().length < 5}
        tone="danger"
        title={`Batalkan ${order.number}?`}
        description="SPK-nya tetap tersimpan sebagai riwayat, tapi ditandai batal dan tidak lagi dihitung."
        confirmLabel="Batalkan"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Alasan pembatalan</span>
          <Textarea
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            disabled={voidMutation.isPending}
            rows={3}
            placeholder="mis. model dibatalkan customer, salah input berat target"
          />
          <span className="text-xs text-foreground-subtle">Minimal 5 karakter.</span>
        </div>
      </ConfirmDialog>
    </>
  );
}

ProductionOrderRowMenu.displayName = 'ProductionOrderRowMenu';
