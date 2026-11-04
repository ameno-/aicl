# SidePanel

A sliding side sheet for the work the agent is doing.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add side-panel
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/side-panel.json
```

## npm import

```ts
import { SidePanel } from '@aicl/fx';
```

## Usage

```tsx
import { SidePanel } from '@aicl/fx';

<SidePanel open={open} onClose={() => setOpen(false)}>…</SidePanel>
```

## Files

- `packages/fx/src/components/input/SidePanel.tsx` → `components/aicl/fx/components/input/SidePanel.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
