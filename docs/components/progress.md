# Progress

A determined bar, or an indeterminate pulse. The fill uses scaleX.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** content

## Install

```bash
npx aicl add progress
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/progress.json
```

## npm import

```ts
import { Progress } from '@aicl/react';
```

## Usage

```tsx
import { Progress } from '@aicl/react';

<Progress value={40} max={100} />
<Progress indeterminate label="Indexing" />
```

## Slots

- `progress`
- `progress-fill`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `determinate` `indeterminate` |

## Files

- `packages/react/src/Progress.tsx` → `components/aicl/Progress.tsx`

## Registry dependencies

_none_

## npm dependencies

`react`, `@aicl/core`
