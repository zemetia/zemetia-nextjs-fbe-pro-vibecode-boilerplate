# Components — 02: Existing UI Components

← [01 — Layers, CVA](./01-structure-cva.md) | [COMPONENTS.md](../COMPONENTS.md) | [03 — Storybook, tests, shadcn →](./03-storybook-tests-shadcn.md)

---

## Simple Components (no CVA)

For structural components with no variants:

```ts
// src/components/ui/Card/Card.tsx
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card text-card-foreground p-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}
Card.displayName = 'Card';
```

---

## Button — [src/components/ui/Button/](../../../src/components/ui/Button/)

| Prop | Type | Values |
|---|---|---|
| `variant` | CVA | `primary` \| `secondary` \| `outline` \| `ghost` \| `soft` \| `brand` \| `destructive` \| `link` |
| `size` | CVA | `xs` \| `sm` \| `md` \| `lg` \| `xl` \| `icon` \| `icon-sm` \| `icon-lg` |
| `isLoading` | boolean | disables + shows spinner |
| `leftIcon` | ReactNode | icon slot before label |
| `rightIcon` | ReactNode | icon slot after label |
| `fullWidth` | boolean | `w-full` |

---

## Input — [src/components/ui/Input/](../../../src/components/ui/Input/)

| Prop | Type | Notes |
|---|---|---|
| `size` | CVA | `sm` \| `md` \| `lg` |
| `inputState` | CVA | `default` \| `error` \| `success` |
| `label` | string | renders `<label>` with htmlFor wired |
| `hint` | string | helper text below |
| `error` | string | error text; sets `aria-invalid`, `aria-describedby` |
| `leftAddon` | ReactNode | prepended content |
| `rightAddon` | ReactNode | appended content |
| `required` | boolean | `aria-required` + visual indicator |

---

## Badge — [src/components/ui/Badge/](../../../src/components/ui/Badge/)

| Prop | Type | Values |
|---|---|---|
| `variant` | CVA | `default` (soft primary) \| `solid` \| `secondary` \| `outline` \| `brand` \| `info` \| `destructive` \| `success` \| `warning` |
| `size` | CVA | `sm` \| `md` \| `lg` |
| `dot` | boolean | prepends colored dot indicator |

---

## Card — [src/components/ui/Card/](../../../src/components/ui/Card/)

Sub-components: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

| Prop | Type | Notes |
|---|---|---|
| `noPadding` | boolean | on `Card` — removes default `p-6` |
| `accent` | boolean | 2px `.accent-bar` gradient hairline on the top edge — the lead card of a page, not every card. Adds `overflow-hidden`. |
| `interactive` | boolean | lifts on hover — only when the whole card is a link/button |

Every `Card` carries `shadow-sm` by default; there is no flat variant.

---

## Typography — [src/components/ui/Typography/](../../../src/components/ui/Typography/)

| Variant | HTML element | Class |
|---|---|---|
| `h1` | `<h1>` | `text-4xl font-bold tracking-tighter lg:text-5xl` |
| `h2` | `<h2>` | `text-3xl font-semibold tracking-tight` |
| `h3`–`h6` | `<h3>`–`<h6>` | proportionally smaller |
| `p` | `<p>` | `leading-7` |
| `lead` | `<p>` | `text-xl leading-relaxed` |
| `large` | `<p>` | `text-lg` |
| `small` | `<p>` | `text-sm` |
| `muted` | `<p>` | `text-sm text-foreground-muted` |
| `code` | `<code>` | `bg-surface-raised px-1.5 font-mono text-sm` |

Prop `as?: ElementType` overrides the rendered element.

---

## Sonner — [src/components/ui/Sonner/](../../../src/components/ui/Sonner/)

| Export | Notes |
|---|---|
| `Toaster` | Pre-configured Sonner. Mount ONCE in `src/app/layout.tsx` |

Config: `theme="light"`, `richColors`, `position="bottom-right"`, classNames use design-system tokens with `!` Tailwind v4 important suffix.

---

← [01 — Layers, CVA](./01-structure-cva.md) | [COMPONENTS.md](../COMPONENTS.md) | → [03 — Storybook, tests, shadcn](./03-storybook-tests-shadcn.md)
