# ToastRegion

Transient status in a corner region. One live region, polite by default.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** overlay

## Install

```bash
npx aicl add toast-region
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/toast-region.json
```

## npm import

```ts
import { ToastRegion } from '@aicl/react';
```

## Usage

```tsx
import { ToastRegion } from '@aicl/react';

<ToastRegion queue={queue} />
```

## Slots

- `toast-region`

## States

| Attribute | Values |
| --- | --- |
| `data-placement` | `top-start` `top-center` `top-end` `bottom-start` `bottom-end` |

## Files

- `packages/react/src/platform.tsx` → `components/aicl/platform.tsx`

## Registry dependencies

`use-readable`

## npm dependencies

`react`, `@aicl/core`
