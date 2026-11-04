# AlertDialog

A modal that asks before it acts. The scrim does not dismiss it.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** overlay

## Install

```bash
npx aicl add alert-dialog
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/alert-dialog.json
```

## npm import

```ts
import { AlertDialog } from '@aicl/react';
```

## Usage

```tsx
import { AlertDialog } from '@aicl/react';

<AlertDialog open={open} onOpenChange={setOpen} title="Delete?" consequence="This cannot be undone." onConfirm={remove} />
```

## Slots

- `alert-dialog`
- `alert-dialog-layer`
- `alert-dialog-actions`
- `alert-dialog-cancel`
- `alert-dialog-confirm`
- `alert-dialog-confirmation`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `open` `closed` |
| `data-busy` | `true` |

## Files

- `packages/react/src/platform.tsx` → `components/aicl/platform.tsx`

## Registry dependencies

`icon-slots`, `use-readable`

## npm dependencies

`react`, `@aicl/core`
