# Layout Philosophy

← [Blueprint INDEX](./INDEX.md)

Governs how **data-heavy pages** (list, detail, form) are structured inside the ERP app shell. Marketing/public pages (`/`, `/about`) keep the existing `Header` + `Footer` and are out of scope for this doc.

| Part | Coverage |
|---|---|
| [01 — Principles, app shell, shared conventions](./LAYOUT/01-principles-shell.md) | Core principles, Sidebar+Topbar shell, breakpoints, page header, async states |
| [02 — List pages](./LAYOUT/02-list-pages.md) | Full-page table + toolbar pattern, filters, pagination, row actions |
| [03 — Form pages](./LAYOUT/03-form-pages.md) | Surface decision tree (modal / page / wizard), density decision tree, section grouping, validation, action bar |

---

## Scope

| Route group | Shell | Status |
|---|---|---|
| `/`, `/about`, other public pages | `Header` + `Footer` | Existing, unchanged |
| Authenticated data/module routes | `AppShell` (Sidebar + Topbar) | Defined here — not yet built |

Recommended convention once the first app-shell page is built: split `src/app/` into Next.js route groups — `(marketing)` for public pages, `(app)` for the shell — so the two layouts never leak into each other. Not a retroactive migration; apply it the next time a page under either umbrella is added.

---

## Decisions this doc encodes

These were agreed with the developer before writing the doc — don't relitigate them without cause:

| Question | Decision |
|---|---|
| App shell | Sidebar (left, collapsible) + Topbar — not Header/Footer |
| Form surface | By complexity — simple → pop-up modal, long → dedicated page, very complex → stepped wizard. Tree in [03](./LAYOUT/03-form-pages.md#surface-decision-tree) |
| Form density | Mixed by complexity — threshold defined in [03](./LAYOUT/03-form-pages.md) |
| List interaction | Full-page table + toolbar — master-detail only as a documented exception |
