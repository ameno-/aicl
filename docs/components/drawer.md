# Drawer

A sheet that slides in from an edge. Swipe to dismiss.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** overlay

## Install

```bash
npx aicl add drawer
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/drawer.json
```

## npm import

```ts
import { Drawer } from '@aicl/react';
```

## Usage

```tsx
import { Drawer } from '@aicl/react';

<Drawer open={open} onOpenChange={setOpen} side="end">…</Drawer>
```

## Slots

- `drawer`
- `drawer-layer`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-side` | `start` `end` |

## Files

- `packages/react/src/platform.tsx` → `components/aicl/platform.tsx`

## Registry dependencies

`icon-slots`, `use-readable`

## npm dependencies

`react`, `@aicl/core`
