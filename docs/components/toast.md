# Toast

One transient status message, with an optional action.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** overlay

## Install

```bash
npx aicl add toast
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/toast.json
```

## npm import

```ts
import { Toast } from '@aicl/react';
```

## Usage

```tsx
import { Toast } from '@aicl/react';

<Toast toast={toast} onDismiss={dismiss} />
```

## Slots

- `toast`
- `toast-icon`
- `toast-title`
- `toast-description`
- `toast-action`
- `toast-dismiss`

## States

| Attribute | Values |
| --- | --- |
| `data-variant` | `info` `success` `error` |

## Files

- `packages/react/src/platform.tsx` → `components/aicl/platform.tsx`

## Registry dependencies

`icon-slots`, `use-readable`

## npm dependencies

`react`, `@aicl/core`
