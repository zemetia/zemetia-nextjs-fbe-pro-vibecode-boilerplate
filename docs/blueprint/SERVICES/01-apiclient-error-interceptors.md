# Services — 01: ApiClient, ApiError, Interceptors

← [SERVICES.md](../SERVICES.md) | [Blueprint INDEX](../INDEX.md) | [02 — Domain services, Zod →](./02-services-zod-health.md)

---

## File Map

| File | Export | Purpose |
|---|---|---|
| [src/services/types.ts](../../../src/services/types.ts) | `ApiError`, `RequestConfig`, interceptor types | All shared service types |
| [src/services/client.ts](../../../src/services/client.ts) | `apiClient` | Singleton `ApiClientInstance` |
| [src/services/health.service.ts](../../../src/services/health.service.ts) | `healthService` | Example domain service |
| [src/services/index.ts](../../../src/services/index.ts) | barrel | `apiClient`, `ApiError`, all services |

---

## ApiClient (src/services/client.ts)

```ts
export const apiClient = new ApiClientInstance({
  baseUrl: process.env['NEXT_PUBLIC_API_URL'] ?? '',
  timeout: 10_000,   // ms — per-request AbortController
});
```

### Methods

```ts
apiClient.get<T>(path: string, config?: RequestConfig): Promise<T>
apiClient.post<T>(path: string, body: unknown, config?: RequestConfig): Promise<T>
apiClient.put<T>(path: string, body: unknown, config?: RequestConfig): Promise<T>
apiClient.patch<T>(path: string, body: unknown, config?: RequestConfig): Promise<T>
apiClient.delete<T>(path: string, config?: RequestConfig): Promise<T>
```

All return `Promise<T>`. Throw `ApiError` on non-2xx responses.

### RequestConfig (src/services/types.ts)

```ts
interface RequestConfig {
  headers?:         Record<string, string>;
  cache?:           RequestCache;          // 'no-store' | 'force-cache' | etc.
  revalidate?:      number | false;        // Next.js ISR — seconds until revalidation
  tags?:            string[];              // Next.js cache tags for on-demand revalidation
  signal?:          AbortSignal;           // combined with internal timeout signal
  timeout?:         number;               // per-request ms override, 0 = disabled
  withCredentials?: boolean;
}
```

### Next.js cache usage (Server Components only)

```ts
const data = await apiClient.get<Product[]>('/products', { revalidate: 60 });
const data = await apiClient.get<Product[]>('/products', { tags: ['products'] });
const data = await apiClient.get<User>('/me', { cache: 'no-store' });
```

---

## ApiError (src/services/types.ts)

> Rendering rules live in [ERROR_HANDLING.md](../ERROR_HANDLING.md) — read that before writing any catch block.

```ts
class ApiError extends Error {
  status: number;    // HTTP status. 0 = network error (no response)
  message: string;   // Always user-safe: the API's `{ error }`, else the status fallback
  body?: unknown;    // Parsed response body if available — never rendered
  cause?: unknown;   // Technical detail for Sentry (timeout, DOMException) — never rendered

  isNotFound():      boolean  // status === 404
  isUnauthorized():  boolean  // status === 401
  isForbidden():     boolean  // status === 403
  isServerError():   boolean  // status >= 500
  isNetworkError():  boolean  // status === 0
}
```

### Error handling pattern

`apiErrorMessage(error, fallback)` is the only way to turn a throw into text: the server's own `{ error }` message first, then the network message, then the caller's fallback.

```ts
import { apiErrorMessage } from '@/services';
import { useToast } from '@/hooks';

const toast = useToast();

const mutation = useMutation({
  mutationFn: () => roleService.remove(role.id),
  // shorthand for toast.error(apiErrorMessage(error, fallback))
  onError: (error) => toast.apiError(error, 'Gagal menghapus role. Coba lagi.'),
});
```

```ts
// Query — render the message, never the error object
if (isError) return <ErrorState message={apiErrorMessage(error, 'Data gagal dimuat.')} onRetry={refetch} />;
```

The status helpers (`isUnauthorized()`, `isNetworkError()`, …) are for **branching behaviour** (redirect, retry, report), not for composing text.

---

## Interceptors (src/services/client.ts)

Register on the singleton. Best location: `src/services/interceptors.ts`, imported once in `src/app/layout.tsx`.

```ts
// src/services/interceptors.ts
import { apiClient } from '@/services';
import { getCookie } from '@/lib/cookies';
import { captureError } from '@/lib/sentry';

apiClient.interceptors.request.use((ctx) => {
  const token = getCookie('access_token');
  if (token) ctx.headers['Authorization'] = `Bearer ${token}`;
  return ctx;
});

apiClient.interceptors.response.use((data) => {
  return (data as { data: unknown }).data ?? data;
});

apiClient.interceptors.error.use((err) => {
  if (err.isServerError()) captureError(err);
  throw err;
});
```

```ts
// src/app/layout.tsx — side-effect import, registers once
import '@/services/interceptors';
```

### Interceptor type signatures

```ts
type RequestInterceptorFn  = (ctx: RequestContext) => RequestContext | Promise<RequestContext>;
type ResponseInterceptorFn = <T>(data: T, response: Response) => T | Promise<T>;
type ErrorInterceptorFn    = (error: ApiError) => never | Promise<never>;
```

---

← [SERVICES.md](../SERVICES.md) | → [02 — Domain services, Zod](./02-services-zod-health.md)
