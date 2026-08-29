# Blueprint Index

Cross-linked reference for AI agents. Every path is a backlink. Read this file first; navigate to specific docs via the table below.

---

## Document Map

| File | Coverage | Use When |
|---|---|---|
| [STRUCTURE.md](./STRUCTURE.md) | Every file/folder, env vars, barrel exports | Finding where something lives |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Request lifecycle, provider tree, proxy, integration wiring | Debugging system-level issues, adding integrations |
| [COMPONENTS.md](./COMPONENTS.md) | CVA pattern, four-file rule, shadcn, Storybook, tests | Building or modifying UI |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | `@theme {}` tokens, oklch palette, typography, radius | Applying styles, adding tokens |
| [LAYOUT.md](./LAYOUT.md) | App shell (Sidebar+Topbar), list-page and form-page structure | Building any data list, detail, or form page |
| [BEST_PRACTICE.md](./BEST_PRACTICE.md) | TypeScript constraints, ESLint rules, naming, anti-patterns | All code changes |
| [SERVICES.md](./SERVICES.md) | ApiClient, interceptors, domain services, Zod schemas | API calls, validation |
| [ERROR_HANDLING.md](./ERROR_HANDLING.md) | Error classes, `handleApiError`, `apiErrorMessage`, `ErrorState`, route boundaries | Any throw, any catch, any failure the user can see |
| [STATE.md](./STATE.md) | Zustand stores, cookie persistence, storage decision tree | Global state, persistence |
| [SEO_GEO_LLM.md](./SEO_GEO_LLM.md) | SEO metadata, GEO structured data, sitemap, robots, LLMs.txt | Any public page — read before writing metadata or content |
| [DATABASE.md](./DATABASE.md) | Prisma modular schema, NextAuth v5, JWT sessions, `db:*` scripts | Any DB model, auth, or password work |
| [ACCOUNTING.md](./ACCOUNTING.md) | COA SAK EMKM PT TAN, alur 2 tahap `1159`→`1157`, aturan jurnal | Any transaction touching money or gold |
| [KNOWLEDGE.md](./KNOWLEDGE.md) | Rules for THIS.md + LEARN.md — the learning system | Before every task; after every correction or new insight |

---

## Stack Reference

| Package | Version | Config / Entry |
|---|---|---|
| next | 16.2.7 | [next.config.ts](../../next.config.ts) |
| react | 19.2.7 | Server Components default |
| typescript | 6.0.3 | [tsconfig.json](../../tsconfig.json) |
| tailwindcss | v4 | [src/app/globals.css](../../src/app/globals.css) `@theme {}` |
| zustand | 5.0.14 | [src/stores/](../../src/stores/) |
| sonner | 2.0.7 | [src/components/ui/Sonner/](../../src/components/ui/Sonner/) |
| @shadcn/ui | CLI only | [components.json](../../components.json) |
| zod | 4.4.3 | [src/lib/validations/](../../src/lib/validations/) |
| @sentry/nextjs | 10.56.0 | [sentry.client.config.ts](../../sentry.client.config.ts) |
| posthog-js | 1.381.0 | [src/providers/PostHogProvider.tsx](../../src/providers/PostHogProvider.tsx) |
| lucide-react | 1.17.0 | paired with shadcn |
| storybook | 10.4.2 | [.storybook/](../../.storybook/) |
| vitest | 4.1.8 | [vitest.config.ts](../../vitest.config.ts) |
| eslint | 9.39.4 | [eslint.config.mjs](../../eslint.config.mjs) |
| class-variance-authority | latest | component variants |
| tailwind-merge | 3.6.0 | [src/lib/cn.ts](../../src/lib/cn.ts) |
| clsx | latest | [src/lib/cn.ts](../../src/lib/cn.ts) |
| prisma | 7.x | [prisma/schema/](../../prisma/schema/) — modular `.prisma` files |
| @prisma/client | 7.x | generated; singleton at [src/lib/prisma.ts](../../src/lib/prisma.ts) |
| next-auth | 5 beta | [src/auth.ts](../../src/auth.ts) — JWT sessions + Credentials |
| @auth/prisma-adapter | 2.x | wired in [src/auth.ts](../../src/auth.ts) |
| bcryptjs | 3.x | password hashing — used in [src/auth.ts](../../src/auth.ts) |

---

## Canonical Import Paths

```ts
// Utilities
import { cn }                          from '@/lib/cn';
import { formatDate, truncate, assertNever } from '@/lib/utils';
import { formatNumber, formatCurrency, parseNumber } from '@/lib/number';
import { toDateOnly, fromDateOnly, toUtcDateOnly, fromUtcDateOnly, formatDateLong, formatDateShort, today } from '@/lib/date';
import { captureError, captureMessage } from '@/lib/sentry';
import { getCookie, setCookie }         from '@/lib/cookies';

// Validation (Zod v4)
import { emailSchema, passwordSchema, paginationSchema } from '@/lib/validations';

// State
import { useAppStore }                 from '@/stores';
import { createCookieStorage }         from '@/stores';

// Hooks
import { useToast, useBreakpoint, useIsMobile, useLocalStorage } from '@/hooks';
import { toast }                       from '@/hooks';   // direct sonner fn

// Services
import { apiClient, ApiError }         from '@/services';
import { healthService }               from '@/services';

// Types — DTOs (service layer only) + VOs (services + pages)
import type { AdminDTO, AdminListDTO } from '@/types/dtos';
import type { AdminVO, AdminListVO }   from '@/types/value-objects';

// Navigation
import Link                            from 'next/link';
import { useRouter, usePathname, redirect } from 'next/navigation';

// UI Components
import { Button, Input, NumberInput, Badge, Card, Typography, Toaster } from '@/components/ui';
import { Combobox, FormModal, ConfirmDialog, Wizard, Stepper } from '@/components/ui';
import { Segmented, DatePicker, Calendar, TagInput, FormActionBar } from '@/components/ui';
import { Header, Footer, PageWrapper } from '@/components/layout';
import { PartnerPicker, PartnerQuickAddDialog, ThemeSwitch } from '@/components/shared';

// Providers
import { PostHogProvider, SessionProvider } from '@/providers';

// Database
import { prisma }                      from '@/lib/prisma';

// Auth — server-side only
import { auth, signIn, signOut }       from '@/auth';
import { getSession, requireAuth }     from '@/lib/auth';

// RBAC — server-side only, always DB-fresh, never trusts the JWT
import { requirePermission, hasPermission, getUserPermissions, ROLE_SLUGS } from '@/lib/rbac';
import { roleService, permissionService, userService } from '@/services';

// Domain services — partners (mitra: supplier and/or customer) and documents
import { partnerService, goldPurchaseService, exportSaleService } from '@/services';

// Errors — server side. Message is required; map to HTTP status via handleApiError()
import { AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, isAppError } from '@/lib/errors';
import { handleApiError }              from '@/lib/api-error';

// Errors — client side. The only two ways to turn a throw into text on screen
import { apiErrorMessage }             from '@/services';
import { ErrorState }                  from '@/components/ui/ErrorState';
import { useToast }                    from '@/hooks';   // toast.apiError(error, fallback)

// Validation — auth schemas
import { loginSchema, registerSchema, changePasswordSchema } from '@/lib/validations';
```

---

## Hard Constraints

| # | Rule | Violation |
|---|---|---|
| 1 | `'use client'` only when hook/event/browser-API required | Unnecessary client bundle |
| 2 | Navigation via `next/link` + `next/navigation` | Single-locale app — no i18n routing layer |
| 3 | `npm run lint` must exit 0 (zero warnings) | ESLint `--max-warnings 0` |
| 4 | No `setState` inside `useEffect` | Use `useSyncExternalStore` |
| 5 | All colors via design tokens | No raw hex/oklch/Tailwind color utilities |
| 6 | `import type` for type-only imports | `@typescript-eslint/consistent-type-imports` |
| 7 | `array[n]` returns `T \| undefined` | `noUncheckedIndexedAccess` — guard with `?.` |
| 8 | One `<Toaster />` mount only | [src/app/layout.tsx](../../src/app/layout.tsx) |
| 9 | `displayName` on every component | Required for Sentry + DevTools |
| 10 | Sentry/PostHog are no-ops without env vars | Safe to omit in dev |
| 11 | Use `src/middleware.ts` — never root `proxy.ts` | Next.js 16's `proxy.ts` has confirmed production/Windows bugs — see [ARCHITECTURE/04-proxy.md](./ARCHITECTURE/04-proxy.md) |
| 12 | Proxy logic lives in `src/proxy/` — compose in `middleware.ts` | No inline logic in middleware.ts beyond orchestration |
| 13 | `import { prisma } from '@/lib/prisma'` — never `new PrismaClient()` elsewhere | Multiple instances exhaust DB connections |
| 16 | Prisma 7: no `url` in `datasource` block — connection string is in `prisma.config.ts` + adapter | `P1012` schema validation error |
| 14 | All auth config lives in `src/auth.ts` only | Split config causes session/token mismatch |
| 15 | `requireAuth()` / `requirePermission()` at the top of every protected Server Action/Route Handler | Auth bypass |
| 17 | Every error carries a message — `AppError` subclass with a required Indonesian message, never bare `throw new Error()` | 400/404 disguised as 500; unreadable failure — see [ERROR_HANDLING.md](./ERROR_HANDLING.md) |
| 18 | The screen shows the message, never the code — no stack, `digest`, status number, exception name, or internal key/id | Leaks internals and tells the user nothing — build text only via `apiErrorMessage()` / `handleApiError()` |
| 19 | Every numeric field is `<NumberInput />`, never `<Input type="number" />`; every number on screen goes through `formatNumber()`/`formatCurrency()` | Thousands separator is mandatory (`100000` → `100.000`) — see [LAYOUT/03-form-pages.md](./LAYOUT/03-form-pages.md#number-inputs) |
| 20 | A calendar day is `YYYY-MM-DD` via `@/lib/date` — never `toISOString()` on a picked date, never `new Date(value)` on a bare day string | In UTC+7 local midnight serialises to the *previous* day, so the document silently changes date |
| 21 | Berat **selalu disimpan gram**, di setiap kolom dan setiap tabel. Satuan yang dipilih petugas (`weightUnit`) hanya menentukan cara mengetik dan membaca; konversinya cuma ada di `@/lib/weight` (`toGram`/`fromGram`/`displayWeight`) dan dipanggil **sekali**, di batas tulis | Membandingkan dokumen dengan stok tidak boleh menuntut konversi di dalam query, dan konstanta 31,1034768 yang ditulis ulang per tempat adalah cara dua laporan berselisih |
| 21a | Satuan itu milik **baris**, bukan dokumen (`MetalPurchaseItem.weightUnit`), dan tersedia di kedua rail. Setiap angka di layar mengambil satuan dari baris tempat ia berdiri; agregat lintas baris dijumlah **dalam gram** lalu dibacakan dalam satuan bersama barisnya — `GRAM` bila barisnya tidak sepakat | Satu invoice bisa memuat batangan yang dikutip per troy ounce bersama scrap yang ditimbang per gram; satu satuan untuk seluruh dokumen memaksa salah satunya dibagi 31,1034768 di kepala, dan satu ringkasan bersatuan tunggal akan menjumlahkan 400 (oz) dengan 250 (g) jadi 650 |
| 21b | Menukar satuan sebuah baris **memindahkan angkanya**, tidak mengubah artinya: `convertWeight()` dan `convertPricePerUnit()` selalu dipanggil **berpasangan**, lalu nilainya dihitung ulang | Menukar berat tanpa menukar harga melipatkan nilai baris 31×; menukar satuan tanpa menukar angka mengubah pesanan 1 kg jadi 31 kg tanpa satu karakter pun di layar berubah |
| 22 | Berat murni hanya lahir dari `fineWeight()` (`@/lib/metal-lot`), dan `pure` **wajib dijawab** tiap pemanggilan — `true` untuk logam murni (batangan & granul / lot `BAR` & `GRANULE`), yang berarti berat murni = berat kotor, tanpa dikali kadar | Emas 99,99% dan perak 99,90% diperdagangkan sebesar berat kepingnya; mengalikannya melahirkan angka yang tidak ada di sertifikat mana pun dan 0,1 g "hilang" per kilo yang tidak bisa direkonsiliasi. Kadarnya tetap disimpan sebagai keterangan, bukan sebagai pengali |

---

## File Creation Checklists

### New UI Component

- [ ] [src/components/ui/ComponentName/ComponentName.tsx](../../src/components/ui/) — impl + `displayName`
- [ ] [src/components/ui/ComponentName/ComponentName.stories.tsx](../../src/components/ui/) — `satisfies Meta<typeof C>`
- [ ] [src/components/ui/ComponentName/ComponentName.test.tsx](../../src/components/ui/) — RTL behavior tests
- [ ] [src/components/ui/ComponentName/index.ts](../../src/components/ui/) — barrel only
- [ ] Add `export * from './ComponentName'` to [src/components/ui/index.ts](../../src/components/ui/index.ts)

### New Route Handler / Server Action

- [ ] `requireAuth()` / `requirePermission()` first, whole body in `try { … } catch (error) { return handleApiError(error) }`
- [ ] Every failure path throws an `AppError` subclass with an Indonesian message — never bare `throw new Error()`
- [ ] No internal identifier (permission key, cuid, field name, table) interpolated into a message
- [ ] See [ERROR_HANDLING.md](./ERROR_HANDLING.md) for the message rules and the response shape

### New Domain Service

- [ ] [src/types/dtos/\<domain\>.dto.ts](../../src/types/dtos/) — raw API shape (snake_case, ISO strings)
- [ ] [src/types/value-objects/\<domain\>.vo.ts](../../src/types/value-objects/) — client-ready shape (camelCase, formatted, derived)
- [ ] Add both to their respective barrel `index.ts`
- [ ] [src/services/\<domain\>.service.ts](../../src/services/) — plain object; fetches DTO, returns VO
- [ ] Add to [src/services/index.ts](../../src/services/index.ts)
- [ ] See [ARCHITECTURE/05-dto-vo.md](./ARCHITECTURE/05-dto-vo.md) for the full transformation pattern

### New Zustand Store

- [ ] [src/stores/<domain>.store.ts](../../src/stores/) — `devtools` + optional `persist`
- [ ] Add to [src/stores/index.ts](../../src/stores/index.ts)

### New Page

- [ ] [src/app/<path>/page.tsx](../../src/app/) — Server Component by default
- [ ] `generateStaticParams` if dynamic segments
- [ ] Add entry to `siteConfig.pages` in [src/config/site.ts](../../src/config/site.ts) — title + description as marketing copy
- [ ] `export async function generateMetadata()` calling `buildMetadata()` from `@/lib/seo`
- [ ] `<StructuredData id="webpage" schema={webPageSchema(...)} />` from `@/lib/structured-data`
- [ ] `<StructuredData id="breadcrumb" schema={breadcrumbSchema(...)} />` (all pages except home)

### New List Page (app shell)

- [ ] Density/shape per [LAYOUT/02-list-pages.md](./LAYOUT/02-list-pages.md) — `PageHeader` + `Toolbar` + `Table` + `Pagination`
- [ ] Data via `useQuery` + domain service, `queryKey` includes page/search/filters
- [ ] Filter/search/page state in the URL, not Zustand
- [ ] Loading/empty/error states all implemented — not just the populated table
- [ ] Error state = `<ErrorState message={apiErrorMessage(error, fallback)} onRetry={refetch} />`, and the empty state guarded by `!isError` — see [ERROR_HANDLING.md](./ERROR_HANDLING.md)

### New Input Form (create / edit — app shell)

- [ ] Surface decided **first** via the tree in [LAYOUT/03-form-pages.md](./LAYOUT/03-form-pages.md#surface-decision-tree): simple → `<FormModal />`, long → dedicated page (`/<domain>/new`, `/<domain>/[id]/edit`), very complex → wizard (`?step=`)
- [ ] Density decided via the threshold in [LAYOUT/03-form-pages.md](./LAYOUT/03-form-pages.md) — don't default to sectioned or single-column without counting fields
- [ ] Every numeric field is `<NumberInput />` (thousands separated as typed) — `<Input type="number" />` is banned; see [LAYOUT/03-form-pages.md](./LAYOUT/03-form-pages.md#number-inputs)
- [ ] Zod schema in `src/lib/validations/<domain>.ts` — every rule has a message that names its own field
- [ ] Submission via `useMutation` + domain service — component never calls `apiClient`/`fetch` directly
- [ ] `onError: (error) => toast.apiError(error, 'Gagal … Coba lagi.')` — see [ERROR_HANDLING.md](./ERROR_HANDLING.md)
- [ ] Action bar placement matches density (inline vs sticky bottom)

### New Gated/Admin Page (e.g. under `/admin`)

- [ ] Server Component page — `requirePermission()` (or the layout's session check) at the top, `redirect()` on `UnauthorizedError`/`ForbiddenError`
- [ ] Co-locate client data-fetching/interactive pieces in a private `_components/` folder next to the page (excluded from routing) — see the `src/app/admin/` tree for the pattern
- [ ] `generateMetadata()` returns `{ robots: { index: false, follow: false } }` only — **no** `buildMetadata()`, `<StructuredData>`, or `siteConfig.pages` entry (see [SEO_GEO_LLM.md](./SEO_GEO_LLM.md) gated-route exemption)
- [ ] New permissions needed by the feature go in `PERMISSIONS` in [`prisma/seed.ts`](../../prisma/seed.ts)
