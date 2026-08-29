'use client';

import { useState } from 'react';

/** Field key → message, keyed by the API's own field names. */
export type FieldErrors = Partial<Record<string, string>>;

/** The one shape `zodFieldErrors` needs — any Zod schema satisfies it. */
export interface ValidationSchema {
  safeParse(input: unknown):
    | { success: true }
    | { success: false; error: { issues: readonly { path: PropertyKey[]; message: string }[] } };
}

const NO_ERRORS: FieldErrors = {};

/**
 * Zod issues → `{ field: message }`, first message per field.
 *
 * Issues raised without a path are cross-field rules ("pilih minimal satu
 * peran") that belong to no single input; they land under `fallbackKey` so the
 * form still has somewhere to render them instead of failing silently.
 */
export function zodFieldErrors(
  schema: ValidationSchema,
  input: unknown,
  fallbackKey = '_form',
): FieldErrors {
  const result = schema.safeParse(input);
  if (result.success) return NO_ERRORS;

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? fallbackKey);
    errors[field] ??= issue.message;
  }
  return errors;
}

export interface FormErrors {
  /** What to render — only fields that failed a submit *and* still fail. */
  errors: FieldErrors;
  /** Check now and report what fails. `true` when the form is clean. */
  validate: () => boolean;
  /**
   * Report a set of failures `check` did not produce — a wizard sending the user
   * back to an earlier step has to name that step's fields, not the current one's.
   */
  report: (found: FieldErrors) => void;
  /** Forget every reported field — for a reset, or a switch that voids the answers. */
  reset: () => void;
}

/**
 * Field errors that disappear the moment the field is fixed.
 *
 * Validation state here is a *set of field names*, not a set of messages: the
 * names are what a failed submit reports, and the messages are re-derived from
 * the live form on every render. So a message can only stay on screen while its
 * field is still wrong — a form that keeps "Kadar emas harus lebih besar dari
 * nol" under a field that now reads 99,99 is telling the user something the
 * screen itself contradicts, and there is no way for them to make it go away
 * except to submit again.
 *
 * Only fields that already failed are shown. Nothing new appears while typing:
 * `check` runs over the whole form, but a field the user has not submitted yet
 * is not in the reported set, so an empty required field stays quiet until they
 * ask for it to be checked.
 *
 * `check` runs during render and must be pure — a Zod parse or plain reads of
 * form state, never a mutation.
 */
export function useFormErrors(check: () => FieldErrors): FormErrors {
  const [reported, setReported] = useState<readonly string[]>([]);

  const live = reported.length > 0 ? check() : NO_ERRORS;

  const errors: FieldErrors = {};
  for (const field of reported) {
    const message = live[field];
    if (message !== undefined) errors[field] = message;
  }

  function report(found: FieldErrors): string[] {
    const failed = Object.keys(found).filter((field) => found[field] !== undefined);
    setReported(failed);
    return failed;
  }

  return {
    errors,
    validate: () => report(check()).length === 0,
    report: (found) => void report(found),
    reset: () => setReported([]),
  };
}
