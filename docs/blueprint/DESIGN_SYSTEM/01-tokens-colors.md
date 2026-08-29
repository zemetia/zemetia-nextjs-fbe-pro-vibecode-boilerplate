# Design System — 01: Core Rules & Color Tokens

← [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | [Blueprint INDEX](../INDEX.md) | [02 — Typography & utilities →](./02-typography-utilities.md)

Token source: [src/app/globals.css](../../../src/app/globals.css) `@theme {}` block.

---

## Core Rules

| Rule | Detail |
|---|---|
| Theme | **Light by default.** `@theme {}` holds the light values; a `.dark` block overrides them. `DEFAULT_THEME` in `src/lib/theme.ts` is `'light'`. |
| Color space | `oklch()` — wide-gamut, perceptually uniform. Never convert to hex. |
| Token location | `src/app/globals.css` — light in `@theme {}`, dark in `.dark {}` |
| Depth | Nothing is flat. Filled controls get `.bevel` + a `bg-linear-to-b` token gradient; raised surfaces get a `--shadow-*` token. |
| Tailwind version | v4 — `@theme {}` auto-generates utility classes, no `tailwind.config.*` |
| Important modifier | `!` suffix — e.g. `font-sans!` (NOT `!font-sans`) |
| Class merger | `cn()` from `src/lib/cn.ts` — handles `!` suffix correctly via tailwind-merge v3 |

**Never add raw color values in JSX.** Always use token class or `var(--color-*)`.

---

## Tailwind v4 @theme Mechanics

```css
/* src/app/globals.css */
@theme {
  --color-primary: oklch(0.623 0.214 259.8);
  /* ↑ auto-generates: bg-primary, text-primary, border-primary, fill-primary, ... */

  --radius-md: 0.5rem;
  /* ↑ auto-generates: rounded-md */

  --font-sans: var(--font-inter), ui-sans-serif;
  /* ↑ auto-generates: font-sans */
}
```

---

## Surface Tokens

| Utility class | CSS variable | Light value | Use |
|---|---|---|---|
| `bg-background` | `--color-background` | `oklch(0.975 0.004 264)` | Page canvas |
| `bg-surface` | `--color-surface` | `oklch(1 0 0)` | Cards, inputs — white |
| `bg-surface-raised` | `--color-surface-raised` | `oklch(0.968 0.005 264)` | Filled/muted fills: table headers, secondary chips |
| `bg-surface-overlay` | `--color-surface-overlay` | `oklch(1 0 0)` | Modals, sheets |
| `bg-surface-sunken` | `--color-surface-sunken` | `oklch(0.955 0.006 264)` | Wells, inset panels |

Elevation rule (light): height is carried by **shadow**, not by fill — a modal is
white on a tinted canvas, not a lighter gray. `--color-surface-raised` is a
*recessed/muted* fill, not an elevated one. In `.dark` the rule inverts and
surfaces genuinely lighten as they rise.

Shadow tokens — `shadow-xs` → `shadow-xl` — are cool-tinted and redefined per
theme. Never reach for Tailwind's stock gray shadows.

---

## Text Tokens

| Utility class | CSS variable | Use |
|---|---|---|
| `text-foreground` | `--color-foreground` | Primary text |
| `text-foreground-muted` | `--color-foreground-muted` | Secondary, descriptions |
| `text-foreground-subtle` | `--color-foreground-subtle` | Placeholder, disabled labels |

---

## Border Tokens

| Utility class | CSS variable | Use |
|---|---|---|
| `border-border` | `--color-border` | Default borders (auto-applied globally) |
| `border-border-strong` | `--color-border-strong` | Hover/focus border state |
| `border-input` | `--color-input` | Form field borders |

---

## Primary Color Tokens (Indigo)

| Utility class | CSS variable | Use |
|---|---|---|
| `bg-primary` | `--color-primary` | Primary actions |
| `bg-primary-hover` | `--color-primary-hover` | Hover state / bottom stop of the button gradient |
| `bg-primary-active` | `--color-primary-active` | Active/pressed state |
| `text-primary-foreground` | `--color-primary-foreground` | Text on primary bg |
| `bg-primary-subtle` | `--color-primary-subtle` | 10% tint — soft buttons, active nav, row hover |
| `bg-primary-muted` | `--color-primary-muted` | 18% tint — hover on a subtle surface, selection |
| `shadow-primary-glow` | `--color-primary-glow` | Glow effect |
| `ring-ring` | `--color-ring` | Focus ring (= primary) |

---

## Brand Accent Tokens (Gold)

The second brand hue — PT TAN sells jewelry, so gold is the counterweight to
indigo. Use it for identity, never for state: brand marks, gradient hairlines,
the odd highlight badge. Anything that means *warning* uses `warning`.

| Utility class | CSS variable | Use |
|---|---|---|
| `bg-brand` | `--color-brand` | Brand fills, gradient end stop |
| `bg-brand-hover` | `--color-brand-hover` | Hover state |
| `text-brand-foreground` | `--color-brand-foreground` | Text on brand bg (dark, not white) |
| `bg-brand-subtle` | `--color-brand-subtle` | 16% tint |

---

## Semantic Color Tokens

| Group | Fill | Hover | Foreground | Subtle (12% bg) |
|---|---|---|---|---|
| Destructive | `bg-destructive` | `bg-destructive-hover` | `text-destructive-foreground` | `bg-destructive-subtle` |
| Success | `bg-success` | `bg-success-hover` | `text-success-foreground` | `bg-success-subtle` |
| Warning | `bg-warning` | `bg-warning-hover` | `text-warning-foreground` | `bg-warning-subtle` |
| Info | `bg-info` | `bg-info-hover` | `text-info-foreground` | `bg-info-subtle` |

On a `*-subtle` background use the **fill** token as text (`bg-success-subtle
text-success`) — except `warning`, whose fill is too light to read on light
mode; pair it with `text-warning-foreground`.

---

## Card Tokens

| Utility class | Use |
|---|---|
| `bg-card` | Card background (= `bg-surface`) |
| `text-card-foreground` | Card text (= `text-foreground`) |

---

← [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | → [02 — Typography & utilities](./02-typography-utilities.md)
