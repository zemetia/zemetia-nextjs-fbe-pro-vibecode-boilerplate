import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { captureError } from '@/lib/sentry';
import { isAppError, UNEXPECTED_ERROR_MESSAGE } from '@/lib/errors';

/**
 * The only error shape our API ever returns:
 * `{ error: string, fieldErrors?: Record<string, string[]> }`.
 *
 * `error` is always present and always readable by a human — the client renders
 * it verbatim, so it must never carry a stack, an exception name, a Prisma/SQL
 * code, or an internal identifier. Unexpected throws are swallowed into a
 * generic message and reported to Sentry instead.
 */
export interface ApiErrorBody {
  error: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * One sentence the user can act on. The field path is deliberately left out —
 * it is a raw API key (`role_id`) — so every schema message must name its own
 * field ("Role wajib dipilih"), see src/lib/validations.
 */
function zodMessage(error: ZodError): string {
  return error.issues[0]?.message ?? 'Data yang dikirim tidak valid.';
}

export function handleApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (isAppError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    const fieldErrors = error.flatten().fieldErrors as Record<string, string[]>;
    return NextResponse.json({ error: zodMessage(error), fieldErrors }, { status: 400 });
  }

  captureError(error);
  return NextResponse.json({ error: UNEXPECTED_ERROR_MESSAGE }, { status: 500 });
}
