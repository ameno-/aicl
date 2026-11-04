# Badge

A status chip. Quiet colour, never a button.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** content

## Install

```bash
npx aicl add badge
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/badge.json
```

## npm import

```ts
import { Badge } from '@aicl/react';
```

## Usage

```tsx
import { Badge } from '@aicl/react';

<Badge variant="success">Done</Badge>
<Badge variant="danger">Failed</Badge>
```

## Slots

- `badge`

## States

| Attribute | Values |
| --- | --- |
| `data-variant` | `default` `secondary` `success` `warning` `danger` `outline` |

## Files

- `packages/react/src/Badge.tsx` → `components/aicl/Badge.tsx`

## Registry dependencies

_none_

## npm dependencies

`react`, `@aicl/core`
