'use client';

import { useEffect } from 'react';

import { captureError } from '@/lib/sentry';
import { ErrorState } from '@/components/ui/ErrorState';

import './globals.css';

/**
 * Last resort — the root layout itself failed, so this renders its own
 * `<html>`. Same rule as `error.tsx`: a message, never the underlying error.
 */
export default function GlobalError({
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
    <html lang="id">
      <body>
        <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
          <ErrorState
            title="Aplikasi gagal dimuat"
            message="Terjadi kesalahan di sistem. Silakan muat ulang halaman ini."
            onRetry={reset}
            retryLabel="Muat ulang"
            className="w-full"
          />
        </main>
      </body>
    </html>
  );
}

GlobalError.displayName = 'GlobalError';
