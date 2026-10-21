'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  CheckCircle,
  Eye,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react';

import type { PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PurchaseRequestVO } from '@/types/value-objects';
import {
  PurchaseRequestStatusDialog,
  type PurchaseRequestDialogAction,
} from './PurchaseRequestStatusDialog';
import { requestConvertHref, requestDetailHref, requestEditHref } from './routes';

export interface PurchaseRequestRowMenuProps {
  request: PurchaseRequestVO;
  can: (key: PermissionKey) => boolean;
}

export function PurchaseRequestRowMenu({ request, can }: PurchaseRequestRowMenuProps) {
  const [dialogAction, setDialogAction] = useState<PurchaseRequestDialogAction | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Aksi untuk ${request.number}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={requestDetailHref(request.id) as Route} className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>Lihat detail</span>
            </Link>
          </DropdownMenuItem>

          {request.isEditable && can('purchase-requests:update') && (
            <DropdownMenuItem asChild>
              <Link href={requestEditHref(request.id) as Route} className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                <span>Ubah draft</span>
              </Link>
            </DropdownMenuItem>
          )}

          {request.canConvert &&
            (can('local-purchases:create') || can('import-purchases:create')) && (
              <DropdownMenuItem asChild>
                <Link
                  href={
                    requestConvertHref(
                      request.id,
                      request.category as 'GOLD_IMPORT' | 'GOLD_LOCAL',
                    ) as Route
                  }
                  className="flex items-center gap-2"
                >
                  <PackagePlus className="h-4 w-4" />
                  <span>Konversi ke PO</span>
                </Link>
              </DropdownMenuItem>
            )}

          {request.canApprove && can('purchase-requests:approve') && (
            <DropdownMenuItem
              onClick={() => setDialogAction('approve')}
              className="flex items-center gap-2 text-emerald-500 focus:text-emerald-500"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Setujui</span>
            </DropdownMenuItem>
          )}

          {(request.canVoid || request.canDelete) && <DropdownMenuSeparator />}

          {request.canVoid && can('purchase-requests:void') && (
            <DropdownMenuItem
              onClick={() => setDialogAction('void')}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <XCircle className="h-4 w-4" />
              <span>Batalkan (Void)</span>
            </DropdownMenuItem>
          )}

          {request.canDelete && can('purchase-requests:delete') && (
            <DropdownMenuItem
              onClick={() => setDialogAction('delete')}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span>Hapus draft</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogAction && (
        <PurchaseRequestStatusDialog
          open={dialogAction !== null}
          onOpenChange={(open) => {
            if (!open) setDialogAction(null);
          }}
          request={request}
          action={dialogAction}
        />
      )}
    </>
  );
}

PurchaseRequestRowMenu.displayName = 'PurchaseRequestRowMenu';
