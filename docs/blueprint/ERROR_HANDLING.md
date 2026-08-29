# Error Handling

← [Blueprint INDEX](./INDEX.md) | related: [SERVICES.md](./SERVICES.md) · [SERVICES/01 — ApiClient, ApiError](./SERVICES/01-apiclient-error-interceptors.md) · [LAYOUT/02 — List pages](./LAYOUT/02-list-pages.md)

---

## The two rules

| # | Rule |
|---|---|
| **E1** | **Every error carries a message.** A thrown error, an API response, a toast, an error state — all of them state, in Bahasa Indonesia, what went wrong and what the user can do next. There is no such thing as a silent failure or an untyped `throw new Error()`. |
| **E2** | **The screen shows the message, never the code.** No stack trace, no `error.digest`, no exception name, no HTTP status number, no Prisma/SQL/driver code, no internal identifier (permission key, cuid, field name, endpoint path). Those go to Sentry and the server log — not to the browser. |

Rule E1 is enforced by the type system: `AppError` subclasses take a **required** `message`.
Rule E2 is enforced by convention plus two chokepoints — `handleApiError()` on the server and `apiErrorMessage()` on the client. Nothing else may build user-facing error text.

---

## File map

| File | Export | Role |
|---|---|---|
| [src/lib/errors.ts](../../src/lib/errors.ts) | `AppError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `isAppError`, `UNEXPECTED_ERROR_MESSAGE` | Domain errors — status + required message |
| [src/lib/api-error.ts](../../src/lib/api-error.ts) | `handleApiError`, `ApiErrorBody` | The only place a Route Handler turns a throw into a response |
| [src/services/types.ts](../../src/services/types.ts) | `ApiError`, `apiErrorMessage`, `serverErrorMessage`, `statusErrorMessage`, `NETWORK_ERROR_MESSAGE` | The only place the client turns a throw into text |
| [src/hooks/useToast.ts](../../src/hooks/useToast.ts) | `toast.apiError(error, fallback)` | Error toast for a failed mutation |
| [src/components/ui/ErrorState/](../../src/components/ui/ErrorState/) | `ErrorState` | Error state for a failed query — panel or inline |
| [src/app/error.tsx](../../src/app/error.tsx) · [global-error.tsx](../../src/app/global-error.tsx) · [not-found.tsx](../../src/app/not-found.tsx) | route boundaries | Last resort — message + retry, never the error |

---

## Server: throwing

```ts
// src/lib/errors.ts — status is fixed per class, message is required
throw new NotFoundError('Role tidak ditemukan.');
throw new ConflictError('Email ini sudah dipakai pengguna lain.');
throw new ForbiddenError('Role sistem tidak bisa diubah.');
```

| Class | Status | Use for |
|---|---|---|
| `ValidationError` | 400 | Input that Zod cannot express (cross-field, DB-dependent) |
| `UnauthorizedError` | 401 | No session |
| `ForbiddenError` | 403 | Session without the permission |
| `NotFoundError` | 404 | Row does not exist |
| `ConflictError` | 409 | Would break an invariant (duplicate, last Super Admin) |

**Never** `throw new Error()` in a Route Handler or Server Action — it becomes a 500 and hides a real 400/404 (see [LEARN.md 2026-08-10](../knowledge/LEARN.md)).

Message rules:

- Bahasa Indonesia, one sentence, ends with a period.
- Says what happened **and** the way out: *"Pindahkan dulu pengguna yang memakai role ini sebelum menghapusnya."*
- Names business concepts (Role, Pengguna, Super Admin) — never internal ones (`roles:set-permissions`, `role_id`, `cuid`, table names).
- Never interpolates values the user did not type. `Unknown permission keys: ${keys}` is a rule-E2 violation; the keys belong in the log.

## Server: responding

Every Route Handler is `try { … } catch (error) { return handleApiError(error) }`. Nothing else builds an error response.

```ts
// Always this shape, `error` always present:
{ error: string, fieldErrors?: Record<string, string[]> }
```

| Thrown | Status | `error` |
|---|---|---|
| `AppError` subclass | its `status` | its `message` |
| `ZodError` | 400 | the **first issue's message** (+ `fieldErrors` for form binding) |
| anything else | 500 | `UNEXPECTED_ERROR_MESSAGE`, real error → Sentry |

Because the field path is dropped from the Zod message, **every schema rule must carry a message that names its own field** — `z.string('Role wajib dipilih')`, not a bare `z.string()` whose default reads "Invalid input". See [src/lib/validations/](../../src/lib/validations/).

## Client: reading

`apiClient` never surfaces `statusText` or a timeout string. `ApiError.message` is already user-safe: the API's `{ error }` when there was one, otherwise the status fallback; the technical detail stays in `body`/`cause` for Sentry.

```ts
apiErrorMessage(error, fallback)
//  1. the server's `{ error }` message   — most specific, prefer it
//  2. NETWORK_ERROR_MESSAGE if status 0  — offline / timeout
//  3. the caller's fallback              — contextual: "Gagal menyimpan role."
```

Every call site passes a fallback that names the action that failed. Never render `error.message` of an unknown throw, and never `String(error)`.

## Client: showing

| Failure | Surface |
|---|---|
| Mutation (save, delete, toggle) | `toast.apiError(error, 'Gagal menyimpan role. Coba lagi.')` |
| Query feeding a page or section | `<ErrorState title=… message={apiErrorMessage(error, …)} onRetry={refetch} />` |
| Query feeding a table | `<ErrorState variant="inline" …/>` in a full-width row — with `isError` excluded from the empty state, so "gagal dimuat" never reads as "tidak ada data" |
| Query feeding one field (combobox, options) | Message under the field, in `text-destructive` |
| Field validation | `error` prop of `Input` / a `text-destructive` line under the control |
| Uncaught render/server throw | `error.tsx` / `global-error.tsx` — fixed message + retry, error to Sentry |
| Unknown route | `not-found.tsx` |

An error state that offers no way forward is incomplete: give it `onRetry`, or say what to do ("Muat ulang halaman lalu simpan lagi.").

---

## Checklist — every new endpoint

- [ ] Handler body wrapped in `try/catch` returning `handleApiError(error)`
- [ ] Every failure path throws an `AppError` subclass with an Indonesian message — no bare `Error`
- [ ] Every Zod rule in the schema has a message that names its field
- [ ] No internal identifier, key list, or row id interpolated into any message

## Checklist — every new screen

- [ ] Every `useQuery` renders `isError` with `ErrorState` + `apiErrorMessage(error, fallback)`
- [ ] Every `useMutation` has `onError` with `toast.apiError(error, fallback)`
- [ ] The empty state is guarded by `!isError` so the two never collide
- [ ] Nothing renders `error.message`, `error.digest`, a status code, or a stack

---

← [Blueprint INDEX](./INDEX.md)
