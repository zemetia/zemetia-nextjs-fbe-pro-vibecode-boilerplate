# Layout — 02: List Pages

← [01 — Principles, app shell](./01-principles-shell.md) | [LAYOUT.md](../LAYOUT.md) | [Blueprint INDEX](../INDEX.md) | [03 — Form pages →](./03-form-pages.md)

Default pattern for any page that shows many rows of one entity: **full-page table + toolbar**. Row click navigates to a separate detail/edit page — the list page never embeds a form.

---

## Shape

```
<PageHeader />                          — entity title + primary "New" action
<Toolbar>                               — search, filters, view options
  <Input />        search (debounced)
  <Combobox />/<Select />  filters (status, category, ...)
  <Button variant="outline" />          secondary actions (export, bulk)
</Toolbar>
<Table>                                 — the data
  ...rows, sortable headers where relevant
</Table>
<Pagination />                          — page controls, bottom
```

- `Toolbar` and `Pagination` are the two pieces of shared layout unique to list pages — build them once, reuse everywhere. Location: `src/components/shared/Toolbar/`, `src/components/shared/Pagination/` (four-file rule).
- Table itself uses `src/components/ui/table.tsx` (shadcn) — don't hand-roll `<table>` markup per page.

---

## Data fetching

List pages fetch through a domain service + TanStack Query, following [SERVICES.md](../SERVICES.md) and the DTO→VO pattern in [ARCHITECTURE/05-dto-vo.md](../ARCHITECTURE/05-dto-vo.md):

```ts
const { data, isLoading, isError } = useQuery({
  queryKey: ['invoices', { page, search, filters }],
  queryFn: () => invoiceService.list({ page, search, filters }),
});
```

- Server responses shape to `PaginatedResponse<T>` (`src/types/common.ts`) — `data`, `total`, `page`, `pageSize`, `totalPages`.
- Filter/search/page state lives in the URL (`useSearchParams` from `next/navigation`), not Zustand — list state should be shareable/bookmarkable and survive a refresh. Reach for Zustand only for state that must persist across *different* list pages (rare — most filter state is page-local).
- `paginationSchema` (`@/lib/validations`) validates `page`/`limit` query params before they hit a service call.

---

## Row actions

- ≤2 actions: inline icon buttons (`Button size="icon-sm" variant="ghost"`) at the row's trailing edge.
- 3+ actions: `DropdownMenu` triggered from a single trailing "more" icon button — don't let row actions push the table into horizontal scroll.
- Destructive actions (delete) always confirm via `Dialog`, never fire directly from the dropdown item.

---

## Master-detail — the documented exception

Reach for a split view (list left, detail/quick-edit right, same screen, no navigation) **only** when both are true:

1. The entity has high edit frequency relative to view time (e.g. daily transaction entry), and
2. Its form is simple enough to fit a narrower right pane without sectioning (see the density threshold in [03](./03-form-pages.md)).

Otherwise default to full-page table + separate detail/edit page. Don't introduce split views for browsing convenience alone — they cost more layout complexity than they save.

---

## Empty / loading / error

Reuses the states defined in [01](./01-principles-shell.md#async-states):

| State | List-page specifics |
|---|---|
| Loading | Skeleton rows matching the real column count/widths, same row height as populated rows |
| Empty (no data at all) | Centered inside the table area: short message + primary "New" action |
| Empty (filtered to zero) | Centered message ("No results for these filters") + "Clear filters" action — not the same copy as a true empty state |
| Error | `Alert variant="destructive"` in place of the table; Toolbar stays interactive so the user can retry via a filter change |

---

← [01 — Principles, app shell](./01-principles-shell.md) | → [03 — Form pages](./03-form-pages.md)
