# Layout — 01: Principles, App Shell, Shared Conventions

← [LAYOUT.md](../LAYOUT.md) | [Blueprint INDEX](../INDEX.md) | [02 — List pages →](./02-list-pages.md)

---

## Core Principles

| # | Principle | Meaning |
|---|---|---|
| 1 | Structure serves scanning, not decoration | Data pages optimize for finding, comparing, and editing — not visual flourish. Marketing pages can be expressive; app pages can't. |
| 2 | One page, one primary task | List pages list. Form pages capture. Detail pages present. Don't blend unless it's a deliberate, documented master-detail page. |
| 3 | Density scales with complexity, never the reverse | A 4-field form stays single-column. A 20-field entity earns sections. Don't add structure a page hasn't earned. |
| 4 | Every async state is designed | Loading (`Skeleton`), empty, error, and populated are all real layout states — not just the happy path with a spinner bolted on. |
| 5 | Consistency over novelty | Every list page has the same shape. Every form page has the same shape. Predictability beats cleverness in data entry. |
| 6 | Tokens only | Spacing, radius, elevation come from [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md). Layout components never invent a new surface color or one-off spacing value. |

---

## App Shell — Sidebar + Topbar

```
AppShell
├── Sidebar   (left, fixed width, collapsible to icon rail)
├── Topbar    (breadcrumb, page title slot, actions, user menu)
└── <main>    (page content — PageWrapper or full-bleed for tables)
```

Component location (four-file rule applies):

| Component | Path |
|---|---|
| `AppShell` | `src/components/layout/AppShell/` |
| `Sidebar` | `src/components/layout/Sidebar/` |
| `Topbar` | `src/components/layout/Topbar/` |

### State

`sidebarOpen` already exists in [src/stores/app.store.ts](../../../src/stores/app.store.ts):

```ts
const sidebarOpen = useAppStore((s) => s.sidebarOpen);
const { toggleSidebar, setSidebarOpen } = useAppStore.getState();
```

It is **not** persisted across reloads — `partialize` in the store only keeps `theme`. The sidebar resets to its default state on fresh load; that's the current intended behavior, not a bug. Revisit only if the developer asks for persisted collapse state.

### Responsive behavior

Use `useIsMobile()` from [src/hooks/useBreakpoint.ts](../../../src/hooks/useBreakpoint.ts):

| Breakpoint | Sidebar behavior |
|---|---|
| Below mobile threshold | Overlay (Dialog/Sheet-style), closed by default, triggered from Topbar |
| Above mobile threshold | Persistent column, collapsible to icon-only rail — never fully hidden |

### Sidebar nav

- One entry per domain/module — mirrors the domain boundaries under `src/services/` (a `frameworkService` implies a "Frameworks" nav entry, not the reverse — nav follows services, not the other way around).
- Links use `next/link` per the current non-negotiable (single-locale app, no i18n routing layer — see [CLAUDE.md](../../../CLAUDE.md)).
- Active state is derived from `usePathname()` (`next/navigation`), not stored in Zustand — it's route-derived, not app state.

### Topbar

- Left: breadcrumb (module → entity → current page).
- Center/left-of-actions: page title slot — set per-page, not hardcoded in `Topbar`.
- Right: page-level primary action (e.g. "New Invoice"), then user menu.
- Sticky (`sticky top-0`), same elevation as the current marketing `Header` (`bg-surface`, `border-b border-border`).

---

## Shared Conventions

### Breakpoints & containers

| Context | Rule |
|---|---|
| Marketing pages | `container-page` (max-width 1280px, centered) — unchanged |
| App shell content | Full-bleed within `<main>`, no `container-page` — the sidebar already bounds the reading width; list/table pages need the full remaining space |
| Form pages inside the shell | Content capped at a readable width (`max-w-3xl` / `max-w-4xl` depending on section count) even though the shell itself is full-bleed |

### Page header (every list/detail/form page)

```
[Breadcrumb — in Topbar, not repeated in page body]
<Typography variant="h3">{Entity plural or singular}</Typography>
<Typography variant="muted">{one-line description, optional}</Typography>
[primary action button — top right, same row as heading]
```

Implemented as a small shared layout piece, not copy-pasted per page — see `PageHeader` in [02](./02-list-pages.md#pageheader) / [03](./03-form-pages.md).

### Async states

| State | Component |
|---|---|
| Loading | `Skeleton` shaped like the real content (row skeletons for tables, field skeletons for forms) — never a centered spinner replacing the whole page |
| Empty | Centered message + primary action inside the same container the data would occupy (not a full-page takeover) |
| Error | `Alert` (`variant="destructive"`) inline, in place of the data — page chrome (Topbar, header, filters) stays interactive |
| Populated | The actual list/table/form |

Data fetching for all four states goes through TanStack Query (`useQuery`/`useMutation`) per [SERVICES.md](../SERVICES.md) — never manual `useState` + `useEffect` for server data (non-negotiable).

---

← [LAYOUT.md](../LAYOUT.md) | → [02 — List pages](./02-list-pages.md)
