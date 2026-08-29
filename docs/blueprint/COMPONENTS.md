# Components

← [Blueprint INDEX](./INDEX.md)

| Part | Coverage |
|---|---|
| [01 — Layers, four-file rule, CVA pattern](./COMPONENTS/01-structure-cva.md) | Component layers, four-file rule, CVA full example |
| [02 — Existing UI components](./COMPONENTS/02-ui-components.md) | Simple components, Button, Input, Badge, Card, Typography, Sonner props |
| [03 — Storybook, tests, shadcn, accessibility](./COMPONENTS/03-storybook-tests-shadcn.md) | Story convention, test convention, shadcn config, a11y checklist |

---

## Feature-layer components: `_components/`

Components that carry domain data-fetching (TanStack Query against a specific feature's API routes) don't belong in `ui/` or `shared/` — they're feature-layer, co-located next to the page that uses them, using Next's `_components` private folder (excluded from routing). First example: `src/app/admin/roles/_components/`, `src/app/admin/roles/[id]/_components/`, `src/app/admin/users/_components/`.

The four-file rule (`.stories.tsx` / `.test.tsx` / barrel `index.ts`) is a `ui/` + `shared/`-only requirement — feature-layer components need only the implementation file.
