# Collapsible

A disclosure. Height is not animated; opacity is.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** content

## Install

```bash
npx aicl add collapsible
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/collapsible.json
```

## npm import

```ts
import { Collapsible } from '@aicl/react';
```

## Usage

```tsx
import { Collapsible } from '@aicl/react';

<Collapsible>
  <Collapsible.Trigger>Reasoning</Collapsible.Trigger>
  <Collapsible.Content>The work.</Collapsible.Content>
</Collapsible>
```

## Slots

- `collapsible`
- `collapsible-trigger`
- `collapsible-icon`
- `collapsible-content`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |

## Files

- `packages/react/src/Collapsible.tsx` → `components/aicl/Collapsible.tsx`
- `packages/react/src/controllable.ts` → `components/aicl/controllable.ts`

## Registry dependencies

`icon-slots`

## npm dependencies

`react`, `@aicl/core`
