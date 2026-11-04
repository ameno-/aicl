# CommandMenu

A fuzzy-filtered command palette. Move this to the library is Wave 2 C5.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add command-menu
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/command-menu.json
```

## npm import

```ts
import { CommandMenu } from '@aicl/fx';
```

## Usage

```tsx
import { CommandMenu } from '@aicl/fx';

<CommandMenu open={open} onOpenChange={setOpen} items={items} onSelect={run} />
```

## Files

- `packages/fx/src/components/input/CommandMenu.tsx` → `components/aicl/fx/components/input/CommandMenu.tsx`

## Registry dependencies

`cn`, `fx-provider`, `fx-kbd`

## npm dependencies

`react`, `motion`, `lucide-react`
