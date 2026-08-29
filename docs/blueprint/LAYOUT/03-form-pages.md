# Layout — 03: Form Pages

← [02 — List pages](./02-list-pages.md) | [LAYOUT.md](../LAYOUT.md) | [Blueprint INDEX](../INDEX.md)

Every input form (create, edit, duplicate, import…) is decided in two passes, in this order:

1. **Surface** — modal, dedicated page, or wizard. Decided first; it constrains everything else.
2. **Density** — single-column vs sectioned. Only meaningful once the surface is chosen.

---

## Surface decision tree

```
Is the form simple/short — one concern, no dependent steps?
├── YES → Pop-up modal          (<FormModal />)
└── NO
    ├── Long but still one continuous flow, user fills top to bottom
    │                          → Dedicated page   (/<domain>/new, /<domain>/[id]/edit)
    └── Very complex — steps depend on each other, branch, or need
        partial save / review before commit
                               → Wizard           (stepped page, step in the URL)
```

### 1. Pop-up modal — simple & short

Use `<FormModal />` from `@/components/ui` — never assemble `Dialog*` primitives in the feature layer.

Qualifies when **all** hold:

- ≤ 6 fields, one concern
- No nested/repeatable rows (no line items, no dynamic tables)
- Submits as a single mutation, no intermediate step
- The user's place in the underlying list/detail page should be preserved — the modal opens over it and closes back to it

Rules:

- No route change and no URL state — modal open/close is local `useState` on the triggering client component.
- `size` picks the width (`sm`/`md`/`lg`/`xl`); it is not a licence to grow the field count — if it needs `xl` to breathe, it probably wants a page.
- Lock the surface while submitting (`isSubmitting` — `FormModal` already disables close/Esc/overlay).
- Form-level errors go to `FormModal`'s `error` prop; field errors stay on the fields.
- On success: close the modal + `invalidateQueries` on the list key + toast. Never navigate away.

Canonical examples: `src/app/admin/users/_components/CreateUserDialog.tsx`, `src/app/admin/roles/_components/RoleFormDialog.tsx`.

### 2. Dedicated page — long but linear

Use when **any** holds:

- 7+ fields, or ≥ 2 distinct concerns
- Contains a repeatable/nested collection (order lines, stock items, attachments)
- Needs to be deep-linkable, refresh-safe, or shareable (a URL someone can send)
- Needs meaningful vertical space — long textareas, media upload, side-by-side preview

Routes: `/<domain>/new` for create, `/<domain>/[id]/edit` for edit. Both render the same form component; only the default values and the mutation differ.

Rules:

- `PageHeader` with a back link to the list, then the form, then the action bar (see [Action bar](#action-bar)).
- Density inside the page follows the [density decision tree](#density-decision-tree).
- Warn on navigating away with unsaved changes (dirty-state guard) — a modal can be dismissed cheaply, a page's work cannot.
- On success: toast + `router.push()` back to the list or the new record's detail page.

### 3. Wizard — very complex, stepped flow

Use when **any** holds:

- Later steps depend on earlier answers (branching, or options fetched from a prior selection)
- 15+ fields spread over ≥ 3 concerns that a user genuinely fills in sequence
- The flow needs a review/confirm step before commit, or a resumable draft

Rules:

- The step lives in the URL as a search param (`/<domain>/new?step=2`) so back/forward and refresh behave. One page component owns the flow; each step is its own component under `_components/steps/`.
- One Zod schema per step, composed into the full entity schema; validate the current step on "Next" — never let the user reach step 3 with step 1 invalid.
- Accumulated answers live in one form state object owned by the wizard container, not in a global store — the flow is scoped to the page.
- Steps must be re-enterable: a completed step stays clickable in the stepper, entering it re-populates its saved values.
- Commit is a **single** mutation at the end unless the domain genuinely requires staged persistence (then persist a draft record and mark it, don't leave half-written entities).
- Final step is a read-only review of everything entered, with per-section "Edit" links jumping back to that step.
- Navigation controls: `Back` (`variant="outline"`, hidden on step 1) → `Next` / `Submit` (`variant="primary"`) in the sticky action bar; `Cancel` sits on the left with a dirty-state confirm.

> The shared surface is `<Wizard />` (+ its `<Stepper />`) in [src/components/ui/Wizard/](../../../src/components/ui/Wizard/) — never re-assemble a stepper in the feature layer. It is presentational: it owns the stepper, the step header and the sticky action bar, while the page owns the step index (in the URL), the accumulated answers and the per-step validation. Props: `steps`, `activeStep`, `reachedStep` (how far the user has been allowed to go — later steps stay disabled), `onStepSelect`, `onBack`/`onNext`/`onSubmit`/`onCancel`, `isSubmitting`, `error`.
>
> Canonical example: `src/app/admin/partners/_components/PartnerWizard.tsx` — steps in `_components/steps/`, form state + payload mapping in `_components/form-state.ts`, one exported Zod schema per step in `src/lib/validations/partner.ts`.

### Quick reference

| Signal | Modal | Page | Wizard |
|---|---|---|---|
| Field count | ≤ 6 | 7+ | 15+ across ≥3 concerns |
| Concerns | 1 | 1–3 | 3+, sequential |
| Nested/repeatable rows | No | Yes | Yes |
| Own URL | No | Yes | Yes (+ `?step=`) |
| Step dependency / branching | No | No | Yes |
| Review before commit | No | No | Yes |

When a form sits exactly on a boundary, pick the **lighter** surface — a modal that later outgrows itself is a cheaper migration than a page nobody needed.

---

## Density decision tree

Applies to the **page** and **wizard-step** surfaces. A modal is single-column by definition — if it needs sections, it failed the surface test.

```
Count top-level fields (repeatable groups count as one field each)
├── ≤ 6 fields  → Single-column stacked
├── 7–14 fields → Sectioned, single Card, 2-column grid inside
└── 15+ fields, OR fields fall into ≥2 distinct concerns
                → Sectioned, one Card per section, 2-column grid inside each
```

"Distinct concerns" = groups a user would describe with different names — e.g. "General Info" vs "Billing Address" vs "Permissions". If a 10-field form is all one concern, keep it in one Card even past the 7-field line; don't split for the sake of splitting.

### Single-column stacked (≤6 fields)

```
<PageHeader />
<form>
  <Input />
  <Select />
  <Textarea />
  ...
  <div className="flex justify-end gap-3">   — action bar, inline, not sticky
    <Button variant="outline">Cancel</Button>
    <Button type="submit">Save</Button>
  </div>
</form>
```

Max width `max-w-xl`/`max-w-2xl` — a stacked form that stretches full-width reads worse, not denser.

### Sectioned (7+ fields, or ≥2 concerns)

```
<PageHeader />
<form>
  <Card>
    <CardHeader><CardTitle>General Info</CardTitle></CardHeader>
    <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input />
      <Select />
      <Input className="md:col-span-2" />   — full-width field inside a 2-col grid
    </CardContent>
  </Card>
  <Card>
    <CardHeader><CardTitle>Billing Address</CardTitle></CardHeader>
    <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">...</CardContent>
  </Card>
  ...
</form>
<ActionBar />   — sticky bottom, see below
```

Max width `max-w-3xl`/`max-w-4xl`. Sections stack vertically in document order — reach for `Tabs` only when sections are genuinely optional/conditional (e.g. "Advanced Settings" a user may never open), never as a substitute for scrolling on a form everyone fills top to bottom.

---

## Action bar

| Surface / form size | Placement |
|---|---|
| Modal | `FormModal`'s own footer — don't render a second action row inside the form |
| Page, single-column (≤6 fields) | Inline, end of form, not sticky |
| Page, sectioned (7+ fields) | `<FormActionBar />`, so Save/Cancel stay reachable without scrolling past multiple Cards |
| Wizard step | Always `<FormActionBar />` — `Cancel` left, `Back` + `Next`/`Submit` right (`Wizard` renders it for you) |

**The bar is `<FormActionBar />` from `@/components/ui` — never hand-roll the sticky row.** It wears the **same surface as the Cards above it** (`rounded-lg border border-border bg-card shadow-md`, sticky at `bottom-4`), not a full-bleed strip: an edge-to-edge bar reads as app-shell chrome, while the form's own controls belong to the form. Its buttons are deliberately larger than the default control height (`h-11 min-w-32`, exported as `FORM_ACTION_BUTTON_CLASS` for any extra action placed in the bar) — the last click of a long form should not be the smallest target on the page.

```tsx
<FormActionBar
  onCancel={() => router.push('/admin/sales/orders')}
  submitLabel={isEdit ? 'Simpan Perubahan' : 'Simpan Draft'}
  isSubmitting={mutation.isPending}
/>
```

Contents, left to right: `children` (empty, or a save-status indicator like "Tersimpan 2 menit lalu") → `Cancel` (`variant="outline"`) → `actions` (extra buttons, e.g. the wizard's "Kembali") → primary submit. Omitting `onSubmit` leaves the submit button a plain `type="submit"` for the surrounding `<form>`; pass it only when there is no form element to submit (the wizard). `isSubmitting` locks both buttons and spins the submit; `submitDisabled` blocks only the submit.

---

## Validation & submission

Follows [SERVICES.md — Zod Validation](../SERVICES/02-services-zod-health.md#zod-validation-srclibvalidations):

- One Zod schema per entity in `src/lib/validations/<domain>.ts`, composed from `common.ts` primitives where possible.
- Field-level errors render through `Input`'s/`Textarea`'s built-in `error` prop — never a separate error-summary block above the form (that duplicates the per-field message and adds a second place to look).
- **Field errors are held by `useFormErrors()` from `@/hooks` — never by a `useState` of messages.** A message must disappear the moment its field is fixed; a form that keeps "Kadar emas harus lebih besar dari nol" under a field now reading 99,99 contradicts the screen next to it, and the user has no way to clear it except to submit again.

```tsx
const { errors, validate } = useFormErrors(() =>
  zodFieldErrors(createSalesOrderSchema, toPayload(form)),
);

function handleSubmit(event: FormEvent): void {
  event.preventDefault();
  if (!validate()) return;
  mutation.mutate();
}
```

How it behaves, and why:

| Aspect | Behaviour |
|---|---|
| What is stored | the *set of field names* a check failed on — not the messages |
| Messages | re-derived from live form state every render, so a fixed field goes quiet immediately |
| Before the first check | nothing is shown — an untouched required field does not turn red while the user is still typing elsewhere |
| `validate()` | checks now, reports what fails, returns `true` when clean |
| `report(errors)` | names failures the live check did not produce — a wizard sending the user back to an earlier step |
| `reset()` | forgets everything; for a form reset or a switch that voids the answers (`GoldPurchaseForm.changeType`) |

The check runs during render and must be pure — a Zod parse (`zodFieldErrors(schema, payload)`) or plain reads of form state (`AccountFormDialog`, `PartnerQuickAddDialog`), never a mutation. Zod issues raised without a path land under `_form` (override with the third argument, as the partner wizard does with `'role'`), so a cross-field rule always has somewhere to render.
- Submission is a mutation (`useMutation` from TanStack Query calling the domain service), not a raw `fetch`/Server Action call from the component — component owns layout and field state, the service owns the request.
- On success: toast (`useToast().success(...)`) + navigate back to the list or detail page via `useRouter()` from `next/navigation` — don't leave the user sitting on a just-submitted form.

---

## Number inputs

**Every numeric field uses `<NumberInput />` from `@/components/ui` — never `<Input type="number" />`.** The thousands separator is not optional and not a per-form decision: `100000` is shown as `100.000` the moment it is typed, in every form, on every screen.

```tsx
<NumberInput
  label="Harga jual"
  leftAddon={<span className="text-sm">Rp</span>}
  value={price}
  onChange={setPrice}
  error={errors.price}
  required
/>
```

Contract:

| Aspect | Behaviour |
|---|---|
| Display | id-ID grouping — `.` every three digits, `,` for decimals (`1.234.567,5`) |
| `value` | `number \| null \| undefined` — `undefined`/`null` renders an empty field, never `0` |
| `onChange` | receives the parsed `number`, or `undefined` when the field is emptied — the formatted string never leaves the component |
| `decimalScale` | `0` by default (integers). Set it explicitly for weights, rates, ratios |
| `allowNegative` | `false` by default. Enable only for genuine signed values (stock adjustment, selisih) |
| Keyboard | `inputMode="numeric"` (or `decimal`), so mobile gets the number pad |
| Caret | preserved across reformatting — typing in the middle of a value does not jump to the end |

Rules:

- Never store the formatted string in form state — state holds the `number`, the component owns the formatting.
- `type="number"` is banned: it leaks browser spinners, scroll-wheel edits, and locale-dependent parsing, and it cannot group thousands at all. `min`/`max`/`step` are therefore not props on `NumberInput` — range rules belong in the Zod schema (`z.number().min(1, 'Kuantitas minimal 1')`).
- Currency: pass `leftAddon={<span className="text-sm">Rp</span>}`. Units: pass `rightAddon` (`gram`, `pcs`). Don't bake the unit into the label.
- **Read-only display** of numbers (tables, detail pages, totals, badges) goes through `formatNumber()` / `formatCurrency()` from `@/lib/number` — a raw `{value}` in JSX is the same bug on the output side.

```ts
import { formatCurrency, formatNumber } from '@/lib/number';

formatNumber(1234567);                          // "1.234.567"
formatNumber(12.345, { decimalScale: 2 });      // "12,35"
formatCurrency(1250000);                        // "Rp 1.250.000"
```

---

## Date fields

**Every date field is `<DatePicker />` from `@/components/ui` — never `<Input type="date" />`.** It wears the same label/hint/error chrome as `Input`, so it lines up inside a 2-column section, and its popover calendar (react-day-picker, styled entirely against design tokens in `DatePicker/Calendar.tsx`) navigates by month/year dropdown — a purchase dated eight months back costs one click, not eight.

```tsx
<DatePicker
  label="Tanggal pembelian"
  required
  value={form.date}                 // Date | null | undefined — local midnight
  onChange={(date) => patch({ date })}
  maxDate={today()}                 // block the future
  error={errors.date}
/>
```

**A calendar day is not an instant** (hard constraint #20). Serialise with `@/lib/date`, never with `toISOString()`:

| Direction | Function | Result |
|---|---|---|
| Form state → API body | `toDateOnly(date)` | `"2026-08-10"` |
| API/VO → form state | `fromDateOnly(value)` | local midnight `Date` |
| API body → Prisma `@db.Date` | `toUtcDateOnly(value)` | `2026-08-10T00:00:00.000Z` |
| Prisma row → DTO | `fromUtcDateOnly(row.date)` | `"2026-08-10"` |
| Anywhere on screen | `formatDateLong` / `formatDateShort` | `"10 Agustus 2026"` / `"10 Agu 2026"` |

`toISOString()` on a `Date` at local midnight reports the **previous day** at any positive UTC offset — in UTC+7 a purchase dated 1 January is stored as 31 December, and nothing in the UI shows that it happened.

---

## Mode switches and free-text lists

- **`<Segmented />`** — one of a few mutually exclusive modes: the tab strip above a list, or the type switch at the top of a form. Radio-group semantics with arrow-key navigation. Reach for it over `Tabs` when there is no panel to associate, and over a `Combobox` when there are ≤ 4 options that deserve to be visible at once.
  - When a switch changes *which fields exist* (as on the LM purchase form), the form state holds a superset of all shapes and the payload builder narrows it — switching the mode must never discard what the user already typed into the fields both modes share.
- **`<TagInput />`** — a free-text list entered on one line and kept as chips (serial numbers, reference codes). Comma/Enter commits; pasting a comma-separated list splits it; blur commits a half-typed entry so it is never lost on submit. The value is always `string[]` — never store the raw comma string.

---

## Field layout inside a 2-column grid

- Two related fields side by side only when they're genuinely paired (first/last name, city/postal code) or independent and equally weighted — never split a single logical value across columns.
- A field that's conceptually full-width (address line, description, textarea) spans both columns (`md:col-span-2`) even inside a 2-column section — don't force-fit it into half width.

---

← [02 — List pages](./02-list-pages.md) | [LAYOUT.md](../LAYOUT.md)
