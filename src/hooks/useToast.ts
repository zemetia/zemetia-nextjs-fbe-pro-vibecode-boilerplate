'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import type { ExternalToast } from 'sonner';

import { apiErrorMessage } from '@/services';

export interface ToastApi {
  toast: typeof toast;
  success: (message: string, options?: ExternalToast) => string | number;
  error: (message: string, options?: ExternalToast) => string | number;
  warning: (message: string, options?: ExternalToast) => string | number;
  info: (message: string, options?: ExternalToast) => string | number;
  loading: (message: string, options?: ExternalToast) => string | number;
  /**
   * Error toast for a failed service call — shows the `{ error }` message our
   * route handlers return (e.g. "Super Admin terakhir tidak bisa dinonaktifkan")
   * and falls back to `fallback` for network/unknown shapes.
   */
  apiError: (error: unknown, fallback: string, options?: ExternalToast) => string | number;
  promise: typeof toast.promise;
  dismiss: typeof toast.dismiss;
  custom: typeof toast.custom;
}

/**
 * Stable toast facade — the object identity never changes, so it is safe in
 * `useEffect`/`useCallback` dependency arrays.
 */
export function useToast(): ToastApi {
  return useMemo<ToastApi>(
    () => ({
      toast,
      success: (message, options) => toast.success(message, options),
      error: (message, options) => toast.error(message, options),
      warning: (message, options) => toast.warning(message, options),
      info: (message, options) => toast.info(message, options),
      loading: (message, options) => toast.loading(message, options),
      apiError: (error, fallback, options) => toast.error(apiErrorMessage(error, fallback), options),
      promise: toast.promise,
      dismiss: toast.dismiss,
      custom: toast.custom,
    }),
    [],
  );
}
