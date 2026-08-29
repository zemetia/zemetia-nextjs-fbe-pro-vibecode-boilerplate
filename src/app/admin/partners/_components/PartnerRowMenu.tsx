'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';

import { partnerService } from '@/services';
import { useToast } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PartnerVO } from '@/types/value-objects';

export interface PartnerRowMenuProps {
  partner: PartnerVO;
  /** UI hints only — every endpoint re-checks with requirePermission(). */
  canUpdate: boolean;
  canSetStatus: boolean;
  /** Omitted on the detail page itself, where the entry would go nowhere. */
  canViewDetail?: boolean;
}

export function PartnerRowMenu({
  partner,
  canUpdate,
  canSetStatus,
  canViewDetail = false,
}: PartnerRowMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (isActive: boolean) => partnerService.setActive(partner.id, isActive),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['partners'] });
      setConfirmOpen(false);
      toast.success(
        updated.isActive
          ? `${updated.name} diaktifkan kembali.`
          : `${updated.name} dinonaktifkan dan tidak bisa dipilih lagi.`,
      );
    },
    onError: (error) => toast.apiError(error, 'Gagal mengubah status partner. Coba lagi.'),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={mutation.isPending}
            aria-label={`Aksi untuk ${partner.name}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canViewDetail && (
            <DropdownMenuItem onSelect={() => router.push(`/admin/partners/${partner.id}`)}>
              Lihat detail
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={!canUpdate}
            onSelect={() => router.push(`/admin/partners/${partner.id}/edit`)}
          >
            Ubah data
          </DropdownMenuItem>
          {partner.isActive ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={!canSetStatus}
              onSelect={() => setConfirmOpen(true)}
            >
              Nonaktifkan
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={!canSetStatus} onSelect={() => mutation.mutate(true)}>
              Aktifkan
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => mutation.mutate(false)}
        isConfirming={mutation.isPending}
        tone="danger"
        title={`Nonaktifkan ${partner.name}?`}
        description="Partner tetap tersimpan beserta riwayat pembeliannya, tapi tidak bisa dipilih lagi di transaksi baru."
        confirmLabel="Nonaktifkan"
      />
    </>
  );
}

PartnerRowMenu.displayName = 'PartnerRowMenu';
