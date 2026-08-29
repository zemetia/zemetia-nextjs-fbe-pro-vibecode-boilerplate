import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { useFormErrors, zodFieldErrors, type FieldErrors } from './useFormErrors';

const schema = z.object({
  purity_percent: z.number().positive('Kadar emas harus lebih besar dari nol'),
  weight: z.number().positive('Berat harus lebih besar dari nol'),
});

/** Drives the hook over a mutable payload, the way a form drives it over state. */
function renderOverPayload(payload: { purity_percent: number; weight: number }) {
  return renderHook(() => useFormErrors(() => zodFieldErrors(schema, payload)));
}

describe('zodFieldErrors', () => {
  it('keeps the first message per field', () => {
    const errors = zodFieldErrors(schema, { purity_percent: 0, weight: 0 });

    expect(errors).toEqual({
      purity_percent: 'Kadar emas harus lebih besar dari nol',
      weight: 'Berat harus lebih besar dari nol',
    });
  });

  it('files a pathless rule under the fallback key', () => {
    const roles = z.object({}).refine(() => false, 'Pilih minimal satu peran');

    expect(zodFieldErrors(roles, {}, 'role')).toEqual({ role: 'Pilih minimal satu peran' });
  });
});

describe('useFormErrors', () => {
  it('says nothing until the form is checked', () => {
    const { result } = renderOverPayload({ purity_percent: 0, weight: 0 });

    expect(result.current.errors).toEqual({});
  });

  it('reports what fails, and blocks the submit', () => {
    const { result } = renderOverPayload({ purity_percent: 0, weight: 0 });

    act(() => {
      expect(result.current.validate()).toBe(false);
    });

    expect(result.current.errors.purity_percent).toBe('Kadar emas harus lebih besar dari nol');
  });

  it('drops a message as soon as its field is fixed — without another submit', () => {
    const payload = { purity_percent: 0, weight: 0 };
    const { result, rerender } = renderOverPayload(payload);

    act(() => {
      result.current.validate();
    });

    payload.purity_percent = 99.99;
    rerender();

    expect(result.current.errors.purity_percent).toBeUndefined();
    // The field that is still wrong keeps its message.
    expect(result.current.errors.weight).toBe('Berat harus lebih besar dari nol');
  });

  it('never raises a message for a field that has not been checked yet', () => {
    const payload = { purity_percent: 0, weight: 5 };
    const { result, rerender } = renderOverPayload(payload);

    act(() => {
      result.current.validate();
    });

    payload.weight = 0;
    rerender();

    expect(result.current.errors.weight).toBeUndefined();
  });

  it('reports fields from a step that is not the one being checked yet', () => {
    // The wizard case: submitting on step 2 names step 1's fields, and the
    // messages appear once the user lands back on the step that owns them.
    const STEP_ERRORS: Record<number, FieldErrors> = {
      0: { name: 'Nama mitra wajib diisi' },
      1: {},
    };
    let step = 1;
    const { result, rerender } = renderHook(() => useFormErrors(() => STEP_ERRORS[step] ?? {}));

    act(() => {
      result.current.report(STEP_ERRORS[0] ?? {});
    });
    expect(result.current.errors).toEqual({});

    step = 0;
    rerender();

    expect(result.current.errors.name).toBe('Nama mitra wajib diisi');
  });

  it('forgets everything on reset', () => {
    const { result } = renderOverPayload({ purity_percent: 0, weight: 0 });

    act(() => {
      result.current.validate();
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.errors).toEqual({});
  });
});
