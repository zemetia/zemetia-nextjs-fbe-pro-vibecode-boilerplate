# Design System — 02: shadcn Aliases, Typography, Radius, Utilities

← [01 — Color tokens](./01-tokens-colors.md) | [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | [Blueprint INDEX](../INDEX.md)

---

## shadcn/ui Alias Tokens

Defined in `src/app/globals.css` `@theme {}`. Allow shadcn-generated components to work without extra config.

| shadcn class | Maps to |
|---|---|
| `bg-popover` | `bg-surface` |
| `text-popover-foreground` | `text-foreground` |
| `bg-secondary` | `bg-surface-raised` |
| `text-secondary-foreground` | `text-foreground` |
| `bg-muted` | `bg-surface-raised` |
| `text-muted-foreground` | `text-foreground-muted` |
| `bg-accent` | `bg-primary-subtle` |
| `text-accent-foreground` | `text-primary-active` |
| `bg-sidebar` | `bg-surface` |
| `bg-sidebar-primary` | `bg-primary` |
| `bg-sidebar-accent` | `bg-primary-subtle` — the admin nav's active/hover tint |
| `text-sidebar-accent-foreground` | `text-primary-active` |
| `border-sidebar-border` | `border-border` |
| `ring-sidebar-ring` | `ring-ring` |

`accent` and `sidebar-accent` are deliberately a **primary tint**, not a gray:
that is what puts colour into the admin shell without touching any component.

---

## Typography

Fonts loaded via `next/font/google` in `src/app/layout.tsx`, injected as CSS vars:

| CSS variable | Font family | Weights | Utility |
|---|---|---|---|
| `--font-inter` | Inter | 400–700 | `font-sans` — all body + UI text |
| `--font-jetbrains-mono` | JetBrains Mono | 400–600 | `font-mono` — code, monospace data |

`@theme` mapping:
```css
--font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
--font-mono: var(--font-jetbrains-mono), ui-monospace, "Cascadia Code", monospace;
```

Inter is the UI face for this ERP — neutral, dense, and readable at 11–14px,
which is where an admin table lives. Two things are wired in `@layer base`:

- `font-feature-settings: "cv11", "ss01"` on `body` — single-storey `g` and the
  alternate digit set, both easier to scan at small sizes.
- `font-variant-numeric: tabular-nums` on `table` and `input` — digits share a
  width so amount columns line up. Pairs with the thousand-separator rule
  (`<NumberInput />`, `formatNumber()`); add `tabular-nums` by hand anywhere
  else numbers stack vertically.

### Typography component ([src/components/ui/Typography/](../../../src/components/ui/Typography/))

| Variant | Element | Classes |
|---|---|---|
| `h1` | `<h1>` | `text-4xl font-bold tracking-tighter lg:text-5xl` |
| `h2` | `<h2>` | `text-3xl font-semibold tracking-tight` |
| `h3` | `<h3>` | `text-2xl font-semibold tracking-tight` |
| `h4` | `<h4>` | `text-xl font-semibold` |
| `h5` | `<h5>` | `text-lg font-semibold` |
| `h6` | `<h6>` | `text-base font-semibold` |
| `p` | `<p>` | `leading-7` |
| `lead` | `<p>` | `text-xl leading-relaxed` |
| `large` | `<p>` | `text-lg` |
| `small` | `<p>` | `text-sm` |
| `muted` | `<p>` | `text-sm text-foreground-muted` |
| `code` | `<code>` | `bg-surface-raised px-1.5 font-mono text-sm` |

---

## Radius Tokens

| Utility class | CSS variable | Value |
|---|---|---|
| `rounded-xs` | `--radius-xs` | `0.25rem` |
| `rounded-sm` | `--radius-sm` | `0.375rem` |
| `rounded-md` | `--radius-md` | `0.5rem` |
| `rounded-lg` | `--radius-lg` | `0.75rem` |
| `rounded-xl` | `--radius-xl` | `1rem` |
| `rounded-2xl` | `--radius-2xl` | `1.5rem` |
| `rounded-full` | `--radius-full` | `9999px` |

---

## Custom Utilities

Defined in `@layer utilities {}` in `src/app/globals.css`:

| Class | Effect |
|---|---|
| `.container-page` | `max-width: 1280px`, centered, `1.5rem` horizontal padding |
| `.text-balance` | `text-wrap: balance` — even line breaks for headings |
| `.bg-app` | Page canvas + two fixed radial washes (primary top-right, gold bottom-left). Admin shell and sign-in. |
| `.accent-bar` | primary → cyan → gold 90° gradient. Use as a 2px hairline: top of the sidebar, `<Card accent>`, the active nav marker. |
| `.bevel` | 1px inset top highlight — the catch-light that keeps filled buttons from reading flat. Pair with `bg-linear-to-b from-X to-X-hover`. |
| `.glow-primary` | Soft primary glow |
| `.border-gradient` | Transparent border filled with primary→gold 135° gradient |

### Depth recipe

Flat is a bug. The three levers, in order of reach:

1. **Filled control** (primary/brand/destructive button, brand mark) —
   `bevel bg-linear-to-b from-X to-X-hover shadow-sm hover:shadow-md` plus
   `active:translate-y-px`.
2. **Surface** (card, sidebar, popover) — a `shadow-*` token. `Card` ships
   `shadow-sm`; `interactive` adds `hover:-translate-y-0.5 hover:shadow-md`.
3. **Canvas** — `.bg-app` behind it, so white surfaces have something to sit on.

---

## Focus Ring

Global in `@layer base` — `src/app/globals.css`:
```css
:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}
```

Components needing inline focus ring (to prevent outline overlap):
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
```

---

## Adding a New Color Token

1. Add to `@theme {}` in `src/app/globals.css`:
   ```css
   --color-info:            oklch(0.6 0.18 230);
   --color-info-foreground: oklch(0.98 0.004 230);
   --color-info-subtle:     oklch(0.6 0.18 230 / 0.12);
   ```
2. Tailwind auto-generates `bg-info`, `text-info`, `border-info`, etc.
3. Add shadcn alias in same block if any shadcn component references a semantic name.

Do NOT add to `tailwind.config.*` — there is no such file in Tailwind v4.

---

← [01 — Color tokens](./01-tokens-colors.md) | [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)
