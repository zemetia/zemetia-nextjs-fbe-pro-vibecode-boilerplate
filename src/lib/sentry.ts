import * as Sentry from '@sentry/nextjs';

export { Sentry };

/**
 * Reports an error the user will never see the details of.
 *
 * Outside production it is also printed to the server console. The screen only
 * ever shows a message (hard constraint #18), so Sentry is the *only* place the
 * real cause goes — and with no DSN configured locally that meant a 500 in dev
 * left no trace at all: no stack, no console line, nothing to grep. The
 * generic "Terjadi kesalahan di sistem" was all anyone had to work with.
 *
 * This is a server/console channel, never a response body — nothing here
 * reaches the browser.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[captureError]', error, context ?? '');
  }

  Sentry.withScope((scope) => {
    if (context) scope.setContext('additional', context);
    Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
): void {
  Sentry.captureMessage(message, level);
}
