/**
 * Every error thrown on purpose carries a message written for the person who
 * will read it — Bahasa Indonesia, no codes, no identifiers, no stack detail.
 * The message is required by the constructor so a throw site cannot forget it.
 *
 * See docs/blueprint/ERROR_HANDLING.md.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
}

export class UnauthorizedError extends AppError {
  readonly status = 401;
}

export class ForbiddenError extends AppError {
  readonly status = 403;
}

export class NotFoundError extends AppError {
  readonly status = 404;
}

export class ConflictError extends AppError {
  readonly status = 409;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Shown whenever an error is *not* an `AppError` — an unexpected throw whose
 * message may contain a stack, a driver code, or a SQL fragment. Those never
 * reach the browser; the real error goes to Sentry instead.
 */
export const UNEXPECTED_ERROR_MESSAGE =
  'Terjadi kesalahan di sistem. Silakan coba lagi beberapa saat lagi.';
