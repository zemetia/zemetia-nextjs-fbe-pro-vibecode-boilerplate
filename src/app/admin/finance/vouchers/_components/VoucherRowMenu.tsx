'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';

import { cashVoucherService } from '@/services';
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
import type { CashVoucherVO } from '@/types/value-objects';

const BASE_PATH = '/admin/finance/vouchers';
const MIN_REASON = 5;

export interface VoucherRowMenuProps {
  voucher: CashVoucherVO;
  /** UI hints only — every endpoint re-checks with requirePermission(). */
  canUpdate: boolean;
  canDelete: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canPost: boolean;
  canVoid: boolean;
}

type OpenDialog = 'none' | 'submit' | 'approve' | 'return' | 'post' | 'void' | 'delete';

/**
 * Row actions follow the document's own lifecycle. Only what the voucher can
 * actually do right now is offered — a menu that lists "Setujui" on a draft
 * teaches the clerk that the app's rules are discovered by being refused.
 *
 * Both destructive transitions ask for a written reason, because that text is
 * the only record either one ever leaves.
 */
export function VoucherRowMenu({
  voucher,
  canUpdate,
  canDelete,
  canSubmit,
  canApprove,
  canPost,
  canVoid,
}: VoucherRowMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [dialog, setDialog] = useState<OpenDialog>('none');
  const [reason, setReason] = useState('');

  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: ['cash-vouchers'] });
    setDialog('none');
    setReason('');
  }

  const submitMutation = useMutation({
    mutationFn: () => cashVoucherService.submit(voucher.id),
    onSuccess: (updated) => {
      refresh();
      toast.success(`Voucher ${updated.number} diajukan untuk verifikasi.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal mengajukan voucher. Coba lagi.'),
  });

  const approveMutation = useMutation({
    mutationFn: () => cashVoucherService.approve(voucher.id),
    onSuccess: (updated) => {
      refresh();
      toast.success(
        updated.status === 'POSTED'
          ? `Voucher ${updated.number} disetujui dan jurnalnya diposting.`
          : `Voucher ${updated.number} disetujui. Tinggal diposting.`,
      );
    },
    onError: (error) => toast.apiError(error, 'Gagal menyetujui voucher. Coba lagi.'),
  });

  const returnMutation = useMutation({
    mutationFn: () => cashVoucherService.returnToDraft(voucher.id, reason.trim()),
    onSuccess: (updated) => {
      refresh();
      toast.success(`Voucher ${updated.number} dikembalikan ke draft.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal mengembalikan voucher. Coba lagi.'),
  });

  const postMutation = useMutation({
    mutationFn: () => cashVoucherService.post(voucher.id),
    onSuccess: (updated) => {
      refresh();
      toast.success(`Voucher ${updated.number} masuk buku besar.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal memposting voucher. Coba lagi.'),
  });

  const voidMutation = useMutation({
    mutationFn: () => cashVoucherService.void(voucher.id, reason.trim()),
    onSuccess: (updated) => {
      refresh();
      toast.success(`Voucher ${updated.number} dibatalkan beserta jurnalnya.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal membatalkan voucher. Coba lagi.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => cashVoucherService.remove(voucher.id),
    onSuccess: () => {
      refresh();
      toast.success(`Draft ${voucher.number} dihapus.`);
    },
    onError: (error) => toast.apiError(error, 'Gagal menghapus draft. Coba lagi.'),
  });

  const isBusy =
    submitMutation.isPending ||
    approveMutation.isPending ||
    returnMutation.isPending ||
    postMutation.isPending ||
    voidMutation.isPending ||
    deleteMutation.isPending;

  const hasAction =
    voucher.isEditable || voucher.isReviewable || voucher.isPostable || voucher.isVoidable;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            aria-label={`Aksi untuk ${voucher.number}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`${BASE_PATH}/${voucher.id}`)}>
            Lihat detail
          </DropdownMenuItem>

          {voucher.isEditable && (
            <>
              <DropdownMenuItem
                disabled={!canUpdate}
                onSelect={() => router.push(`${BASE_PATH}/${voucher.id}/edit`)}
              >
                Ubah draft
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canSubmit} onSelect={() => setDialog('submit')}>
                Ajukan verifikasi
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

          {voucher.isReviewable && (
            <>
              <DropdownMenuItem disabled={!canApprove} onSelect={() => setDialog('approve')}>
                Setujui
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canApprove} onSelect={() => setDialog('return')}>
                Kembalikan ke draft
              </DropdownMenuItem>
            </>
          )}

          {voucher.isPostable && (
            <DropdownMenuItem disabled={!canPost} onSelect={() => setDialog('post')}>
              Posting jurnal
            </DropdownMenuItem>
          )}

          {voucher.isVoidable && (
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
        open={dialog === 'submit'}
        onOpenChange={(open) => setDialog(open ? 'submit' : 'none')}
        onConfirm={() => submitMutation.mutate()}
        isConfirming={submitMutation.isPending}
        tone="info"
        title={`Ajukan ${voucher.number}?`}
        description={`Voucher senilai ${voucher.totalAmountLabel} dikirim ke verifikator dan terkunci dari perubahan sampai disetujui atau dikembalikan.`}
        confirmLabel="Ajukan"
      />

      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={(open) => setDialog(open ? 'approve' : 'none')}
        onConfirm={() => approveMutation.mutate()}
        isConfirming={approveMutation.isPending}
        tone="info"
        title={`Setujui ${voucher.number}?`}
        description={
          voucher.autoPostOnApproval
            ? `Voucher senilai ${voucher.totalAmountLabel} akan langsung masuk buku besar begitu disetujui.`
            : `Voucher senilai ${voucher.totalAmountLabel} akan disetujui, lalu menunggu diposting manual.`
        }
        confirmLabel="Setujui"
      />

      <ConfirmDialog
        open={dialog === 'post'}
        onOpenChange={(open) => setDialog(open ? 'post' : 'none')}
        onConfirm={() => postMutation.mutate()}
        isConfirming={postMutation.isPending}
        tone="info"
        title={`Posting ${voucher.number}?`}
        description={`Jurnal senilai ${voucher.totalAmountLabel} akan masuk buku besar. Setelah ini koreksinya lewat pembatalan, bukan penghapusan.`}
        confirmLabel="Posting"
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : 'none')}
        onConfirm={() => deleteMutation.mutate()}
        isConfirming={deleteMutation.isPending}
        tone="danger"
        title={`Hapus draft ${voucher.number}?`}
        description="Draft belum dianggap terjadi, jadi barisnya akan hilang seluruhnya."
        confirmLabel="Hapus"
      />

      <ConfirmDialog
        open={dialog === 'return'}
        onOpenChange={(open) => {
          setDialog(open ? 'return' : 'none');
          if (!open) setReason('');
        }}
        onConfirm={() => returnMutation.mutate()}
        isConfirming={returnMutation.isPending}
        confirmDisabled={reason.trim().length < MIN_REASON}
        tone="warning"
        title={`Kembalikan ${voucher.number} ke draft?`}
        description="Pembuatnya bisa memperbaiki dan mengajukannya lagi. Catatan di bawah adalah satu-satunya jejak penolakan ini."
        confirmLabel="Kembalikan"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-foreground text-sm font-medium">Catatan verifikasi</span>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={returnMutation.isPending}
            rows={3}
            placeholder="mis. akun beban salah, lampiran kwitansi belum ada"
          />
          <span className="text-foreground-subtle text-xs">Minimal {MIN_REASON} karakter.</span>
        </div>
      </ConfirmDialog>

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
        title={`Batalkan ${voucher.number}?`}
        description="Vouchernya tetap tersimpan sebagai riwayat, dan jurnalnya ikut dibatalkan supaya saldo kembali seperti sebelum voucher ini ada."
        confirmLabel="Batalkan"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-foreground text-sm font-medium">Alasan pembatalan</span>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={voidMutation.isPending}
            rows={3}
            placeholder="mis. pembayaran batal, salah akun kas"
          />
          <span className="text-foreground-subtle text-xs">Minimal {MIN_REASON} karakter.</span>
        </div>
      </ConfirmDialog>
    </>
  );
}

VoucherRowMenu.displayName = 'VoucherRowMenu';
