# SegmentedControl

One tab stop, arrow keys move and select.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** form

## Install

```bash
npx aicl add segmented-control
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/segmented-control.json
```

## npm import

```ts
import { SegmentedControl } from '@aicl/react';
```

## Usage

```tsx
import { SegmentedControl } from '@aicl/react';

<SegmentedControl ariaLabel="Density" value={density} onValueChange={setDensity} options={[{ value: 'cozy', label: 'Cozy' }]} />
```

## Slots

- `segmented`
- `segmented-item`
- `segmented-icon`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `selected` `unselected` |
| `data-size` | `sm` `md` |

## Files

- `packages/react/src/platform.tsx` → `components/aicl/platform.tsx`

## Registry dependencies

`use-readable`

## npm dependencies

`react`, `@aicl/core`
