# Dialog

A modal on the top layer, with a focus trap and a focus return.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** overlay

## Install

```bash
npx aicl add dialog
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/dialog.json
```

## npm import

```ts
import { Dialog } from '@aicl/react';
```

## Usage

```tsx
import { Dialog } from '@aicl/react';

<Dialog open={open} onOpenChange={setOpen}>
  <Dialog.Title>A sheet of the conversation</Dialog.Title>
  <Dialog.Description>Escape or the scrim puts it back.</Dialog.Description>
  <Dialog.Close />
</Dialog>
```

## Slots

- `dialog`
- `dialog-layer`
- `dialog-title`
- `dialog-description`
- `dialog-close`
- `scrim`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-size` | `sm` `md` `lg` |

## Files

- `packages/react/src/platform.tsx` → `components/aicl/platform.tsx`

## Registry dependencies

`icon-slots`, `use-readable`

## npm dependencies

`react`, `@aicl/core`
