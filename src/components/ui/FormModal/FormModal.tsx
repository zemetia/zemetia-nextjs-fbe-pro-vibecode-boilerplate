'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type { FormEvent, ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const formModalVariants = cva('', {
  variants: {
    size: {
      sm: 'sm:max-w-sm',
      md: 'sm:max-w-lg',
      lg: 'sm:max-w-2xl',
      xl: 'sm:max-w-4xl',
    },
  },
  defaultVariants: { size: 'md' },
});

export type FormModalVariants = VariantProps<typeof formModalVariants>;

export interface FormModalProps extends FormModalVariants {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  error?: string;
  footer?: ReactNode;
  className?: string;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = 'Simpan',
  cancelLabel = 'Batal',
  isSubmitting = false,
  submitDisabled = false,
  error,
  footer,
  size,
  className,
}: FormModalProps) {
  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return;
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        // Tinggi dibatasi layar, bukan isi: form yang barisnya bisa bertambah
        // (keping, biaya, barang) akan tumbuh melewati viewport, dan modal yang
        // meluber membuat tombol Simpan-nya berada di tempat yang tidak bisa
        // digulir ke mana pun. `dvh`, bukan `vh` — di browser mobile bilah
        // alamat yang menyusut membuat `vh` lebih tinggi dari layar sebenarnya.
        className={cn(
          'max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0',
          formModalVariants({ size }),
          className,
        )}
        showCloseButton={!isSubmitting}
      >
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden"
        >
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          {/* Hanya isinya yang menggulir — judul dan tombolnya tetap di tempat,
              supaya "di mana Simpan-nya" tidak pernah jadi pertanyaan. */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">{children}</div>

          {error && (
            <p
              role="alert"
              className="mx-6 mb-4 shrink-0 rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            {footer ?? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() => onOpenChange(false)}
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  disabled={submitDisabled || isSubmitting}
                >
                  {submitLabel}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

FormModal.displayName = 'FormModal';
