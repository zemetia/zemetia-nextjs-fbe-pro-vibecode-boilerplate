'use client';

import { useId, useState, type ReactNode } from 'react';
import { AlertTriangle, Info, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type ConfirmTone = 'danger' | 'warning' | 'info';

const TONE = {
  danger: {
    icon: TriangleAlert,
    iconClass: 'bg-destructive-subtle text-destructive',
    confirmVariant: 'destructive',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'bg-warning-subtle text-warning',
    confirmVariant: 'primary',
  },
  info: {
    icon: Info,
    iconClass: 'bg-primary-subtle text-primary',
    confirmVariant: 'primary',
  },
} as const;

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  tone?: ConfirmTone;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isConfirming?: boolean;
  /** Blocks confirmation while the `children` the caller rendered are incomplete. */
  confirmDisabled?: boolean;
  /** When set, the confirm button stays disabled until the user types this exact value. */
  confirmationText?: string;
  /** Overrides the default "Ketik X untuk melanjutkan" prompt above the input. */
  confirmationLabel?: string;
  className?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  tone = 'danger',
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  onConfirm,
  isConfirming = false,
  confirmDisabled = false,
  confirmationText,
  confirmationLabel,
  className,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  const inputId = useId();
  const { icon: Icon, iconClass, confirmVariant } = TONE[tone];

  // Reset the typed confirmation whenever the dialog is opened or closed.
  if (wasOpen !== open) {
    setWasOpen(open);
    setTyped('');
  }

  const matches = !confirmationText || typed.trim() === confirmationText;

  function handleOpenChange(next: boolean) {
    if (!next && isConfirming) return;
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn('sm:max-w-md', className)} showCloseButton={!isConfirming}>
        <DialogHeader>
          <div className="flex items-start gap-3 text-left">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                iconClass,
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-2">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        {(children || confirmationText) && (
          <div className="space-y-4 py-1">
            {children}

            {confirmationText && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={inputId} className="text-sm text-foreground-muted">
                  {confirmationLabel ?? 'Ketik teks berikut untuk melanjutkan:'}{' '}
                  <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-xs text-foreground">
                    {confirmationText}
                  </code>
                </label>
                <Input
                  id={inputId}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  disabled={isConfirming}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={confirmationText}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={isConfirming}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            isLoading={isConfirming}
            disabled={!matches || confirmDisabled || isConfirming}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

ConfirmDialog.displayName = 'ConfirmDialog';
