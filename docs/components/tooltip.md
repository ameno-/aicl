# Tooltip

A short label on hover or focus. The delay is the fast motion tier.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** overlay

## Install

```bash
npx aicl add tooltip
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/tooltip.json
```

## npm import

```ts
import { Tooltip } from '@aicl/react';
```

## Usage

```tsx
import { Tooltip } from '@aicl/react';

<Tooltip content="Copy">
  <Button icon="copy" aria-label="Copy" />
</Tooltip>
```

## Slots

- `tooltip`
- `tooltip-trigger`
- `tooltip-content`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-side` | `top` `bottom` `start` `end` |

## Files

- `packages/react/src/Tooltip.tsx` → `components/aicl/Tooltip.tsx`
- `packages/react/src/controllable.ts` → `components/aicl/controllable.ts`

## Registry dependencies

_none_

## npm dependencies

`react`, `@aicl/core`
