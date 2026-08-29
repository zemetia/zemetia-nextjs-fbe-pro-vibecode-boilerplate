'use client';

import { useEffect } from 'react';

import { captureError } from '@/lib/sentry';
import { ErrorState } from '@/components/ui/ErrorState';

/**
 * Every uncaught render/server error lands here. The user gets one sentence and
 * a retry — never `error.message`, `error.digest`, or a stack, because an
 * unexpected throw carries internals (SQL, file paths, driver codes). The real
 * error goes to Sentry. See docs/blueprint/ERROR_HANDLING.md.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-6">
      <ErrorState
        title="Halaman ini gagal dimuat"
        message="Terjadi kesalahan di sistem. Silakan coba lagi beberapa saat lagi."
        onRetry={reset}
        className="w-full"
      />
    </main>
  );
}

AppError.displayName = 'AppError';
