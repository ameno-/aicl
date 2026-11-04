# Select

A listbox trigger with typeahead.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** form

## Install

```bash
npx aicl add select
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/select.json
```

## npm import

```ts
import { Select } from '@aicl/react';
```

## Usage

```tsx
import { Select } from '@aicl/react';

<Select ariaLabel="Model" value={model} onValueChange={setModel} options={MODELS} />
```

## Slots

- `select`
- `select-trigger`
- `select-value`
- `select-listbox`
- `select-option-label`
- `select-option-description`
- `select-option-check`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-size` | `sm` `md` |
| `data-selected` | `true` |
| `data-disabled` | `true` |

## Files

- `packages/react/src/platform.tsx` → `components/aicl/platform.tsx`

## Registry dependencies

`icon-slots`, `use-readable`

## npm dependencies

`react`, `@aicl/core`
