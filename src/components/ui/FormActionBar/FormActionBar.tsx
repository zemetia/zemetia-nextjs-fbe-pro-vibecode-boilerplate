import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

/**
 * The action bar at the foot of a form page — see
 * docs/blueprint/LAYOUT/03-form-pages.md#action-bar.
 *
 * It wears the same surface as the Cards it sits under (rounded, bordered,
 * elevated by shadow) instead of bleeding edge to edge: a full-bleed strip
 * reads as chrome belonging to the app shell, while the form's own controls
 * belong to the form.
 */

/**
 * Shared sizing so every form's Save/Cancel are the same target. Full width on
 * phones — three side-by-side 8rem buttons don't fit a 360px screen, and a
 * wrapped row of them reads as three unrelated controls.
 */
export const FORM_ACTION_BUTTON_CLASS = 'h-11 w-full px-6 text-sm sm:w-auto sm:min-w-32';

export interface FormActionBarProps {
  /** Left slot — a save-status line, a hint, or nothing. */
  children?: ReactNode;
  /** Extra actions rendered just before the submit button (e.g. wizard "Kembali"). */
  actions?: ReactNode;
  cancelLabel?: string;
  submitLabel?: string;
  onCancel: () => void;
  /** Omit to leave the button a plain `type="submit"` for the surrounding form. */
  onSubmit?: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  className?: string;
}

export function FormActionBar({
  children,
  actions,
  cancelLabel = 'Batal',
  submitLabel = 'Simpan',
  onCancel,
  onSubmit,
  isSubmitting = false,
  submitDisabled = false,
  className,
}: FormActionBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-4 z-10 flex flex-col items-stretch gap-3 rounded-lg border border-border',
        'sm:flex-row sm:flex-wrap sm:items-center',
        'bg-card px-4 py-4 shadow-md sm:px-5',
        children ? 'sm:justify-between' : 'sm:justify-end',
        className,
      )}
    >
      {children}

      {/* Reversed on phones so the primary action sits at the top of the stack,
          nearest the form it commits. */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className={FORM_ACTION_BUTTON_CLASS}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {cancelLabel}
        </Button>
        {actions}
        <Button
          type={onSubmit ? 'button' : 'submit'}
          size="lg"
          className={FORM_ACTION_BUTTON_CLASS}
          onClick={onSubmit}
          isLoading={isSubmitting}
          disabled={submitDisabled || isSubmitting}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

FormActionBar.displayName = 'FormActionBar';
