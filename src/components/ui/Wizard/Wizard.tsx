'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { FORM_ACTION_BUTTON_CLASS, FormActionBar } from '@/components/ui/FormActionBar';
import { Typography } from '@/components/ui/Typography';

/**
 * Shared shell for stepped forms — the surface described in
 * docs/blueprint/LAYOUT/03-form-pages.md#3-wizard-very-complex-stepped-flow.
 *
 * Presentational on purpose: it owns the stepper, the layout and the action
 * bar, while the page keeps the step index (in the URL) and the accumulated
 * answers. A step is reachable only once it has been visited — `reachedStep`
 * comes from the page, so validation stays where the schema is.
 */

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
}

export interface WizardProps {
  steps: WizardStep[];
  /** Zero-based index of the visible step. */
  activeStep: number;
  /** Highest step the user has been allowed to reach; earlier ones stay clickable. */
  reachedStep?: number;
  onStepSelect?: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Blocks "Lanjut" while the step still needs something it doesn't have yet. */
  nextDisabled?: boolean;
  nextLabel?: string;
  backLabel?: string;
  submitLabel?: string;
  cancelLabel?: string;
  /** Form-level error for the current step — field errors stay on the fields. */
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Wizard({
  steps,
  activeStep,
  reachedStep,
  onStepSelect,
  onBack,
  onNext,
  onSubmit,
  onCancel,
  isSubmitting = false,
  nextDisabled = false,
  nextLabel = 'Lanjut',
  backLabel = 'Kembali',
  submitLabel = 'Simpan',
  cancelLabel = 'Batal',
  error,
  children,
  className,
}: WizardProps) {
  const isLastStep = activeStep === steps.length - 1;
  const current = steps[activeStep];

  return (
    <div className={cn('space-y-6', className)}>
      <Stepper
        steps={steps}
        activeStep={activeStep}
        reachedStep={reachedStep ?? activeStep}
        onStepSelect={isSubmitting ? undefined : onStepSelect}
      />

      {current && (
        <div>
          <Typography variant="h4">{current.title}</Typography>
          {current.description && (
            <Typography variant="muted">{current.description}</Typography>
          )}
        </div>
      )}

      <div className="space-y-4">{children}</div>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <FormActionBar
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        submitLabel={isLastStep ? submitLabel : nextLabel}
        onSubmit={isLastStep ? onSubmit : onNext}
        isSubmitting={isSubmitting}
        submitDisabled={!isLastStep && nextDisabled}
        actions={
          activeStep > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className={FORM_ACTION_BUTTON_CLASS}
              onClick={onBack}
              disabled={isSubmitting}
            >
              {backLabel}
            </Button>
          )
        }
      />
    </div>
  );
}

Wizard.displayName = 'Wizard';

export interface StepperProps {
  steps: WizardStep[];
  activeStep: number;
  reachedStep: number;
  onStepSelect?: (index: number) => void;
}

export function Stepper({ steps, activeStep, reachedStep, onStepSelect }: StepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {steps.map((step, index) => {
        const isDone = index < reachedStep;
        const isActive = index === activeStep;
        const isReachable = index <= reachedStep;

        return (
          <li key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={isReachable && onStepSelect ? () => onStepSelect(index) : undefined}
              disabled={!isReachable || !onStepSelect}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isReachable && onStepSelect
                  ? 'cursor-pointer hover:bg-surface-raised'
                  : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  isActive && 'border-primary bg-primary text-primary-foreground',
                  !isActive && isDone && 'border-primary bg-primary-subtle text-primary',
                  !isActive && !isDone && 'border-border text-foreground-subtle',
                )}
              >
                {isDone && !isActive ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'hidden truncate sm:inline',
                  isActive ? 'font-semibold text-foreground' : 'text-foreground-muted',
                )}
              >
                {step.title}
              </span>
            </button>

            {index < steps.length - 1 && (
              <span
                className={cn('h-px w-6', isDone ? 'bg-primary' : 'bg-border')}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

Stepper.displayName = 'Stepper';
