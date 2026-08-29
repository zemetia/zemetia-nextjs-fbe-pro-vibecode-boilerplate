export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ─── Request config ──────────────────────────────────────────────────────────

export interface RequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  /** Fetch cache mode */
  cache?: RequestCache;
  /** Next.js ISR revalidation in seconds (`false` = no-store) */
  revalidate?: number | false;
  /** Next.js cache tags */
  tags?: string[];
  /** External AbortSignal — combined with the client timeout signal */
  signal?: AbortSignal;
  /** Per-request timeout override in ms. Set to 0 to disable. */
  timeout?: number;
  /** Include credentials (cookies) for cross-origin requests */
  withCredentials?: boolean;
}

export interface ApiClientConfig {
  baseUrl?: string;
  /** Default timeout in ms for all requests. Defaults to 10 000. */
  timeout?: number;
  /** Headers merged into every request */
  defaultHeaders?: Record<string, string>;
}

// ─── Interceptors ────────────────────────────────────────────────────────────

/** The mutable request context passed through request interceptors */
export interface RequestContext {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: unknown;
  config: RequestConfig;
}

export type RequestInterceptorFn = (
  ctx: RequestContext,
) => RequestContext | Promise<RequestContext>;

export type ResponseInterceptorFn = <T>(data: T, response: Response) => T | Promise<T>;

export type ErrorInterceptorFn = (error: ApiError) => never | Promise<never>;

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * `message` is always safe to render: it is the API's `{ error }` string when
 * the response had one, otherwise the status fallback below. The technical
 * detail (timeout text, DOMException, parsed body) lives in `cause`/`body` for
 * Sentry — never render those. See docs/blueprint/ERROR_HANDLING.md.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ApiError';
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isNetworkError(): boolean {
    return this.status === 0;
  }
}

export const NETWORK_ERROR_MESSAGE =
  'Tidak bisa terhubung ke server. Periksa koneksi Anda lalu coba lagi.';

/** Fallbacks for responses that arrived without a readable `{ error }` body. */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Data yang dikirim tidak valid.',
  401: 'Sesi Anda sudah berakhir. Silakan masuk kembali.',
  403: 'Anda tidak punya izin untuk melakukan tindakan ini.',
  404: 'Data yang diminta tidak ditemukan.',
  409: 'Data ini bentrok dengan data lain.',
  429: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
};

const SERVER_ERROR_MESSAGE = 'Terjadi kesalahan di sistem. Silakan coba lagi beberapa saat lagi.';

/** The `{ error }` string our route handlers return, if the body has one. */
export function serverErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const message = (body as { error?: unknown }).error;
  return typeof message === 'string' && message.length > 0 ? message : null;
}

/** User-facing message for a status code that came back without a body. */
export function statusErrorMessage(status: number): string {
  if (status === 0) return NETWORK_ERROR_MESSAGE;
  return STATUS_MESSAGES[status] ?? SERVER_ERROR_MESSAGE;
}

/**
 * The one way the UI turns a thrown error into text. Prefers the server's own
 * reason (e.g. "Super Admin aktif terakhir tidak bisa dinonaktifkan."), then
 * the caller's contextual fallback. Never returns a stack, a status code, or
 * an exception name — see docs/blueprint/ERROR_HANDLING.md.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  return serverErrorMessage(error.body) ?? (error.isNetworkError() ? NETWORK_ERROR_MESSAGE : fallback);
}

// ─── Service response shapes ─────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
}
