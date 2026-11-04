# Separator

A line between groups. Decorative by default.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** content

## Install

```bash
npx aicl add separator
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/separator.json
```

## npm import

```ts
import { Separator } from '@aicl/react';
```

## Usage

```tsx
import { Separator } from '@aicl/react';

<Separator />
<Separator orientation="vertical" />
```

## Slots

- `separator`

## States

| Attribute | Values |
| --- | --- |
| `data-orientation` | `horizontal` `vertical` |

## Files

- `packages/react/src/Separator.tsx` → `components/aicl/Separator.tsx`

## Registry dependencies

_none_

## npm dependencies

`react`, `@aicl/core`
