# Toaster

The styled toast host. Call `toast()` from anywhere under it.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add toaster
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/toaster.json
```

## npm import

```ts
import { Toaster } from '@aicl/fx';
```

## Usage

```tsx
import { Toaster, toast } from '@aicl/fx';

<Toaster />
toast({ title: 'Saved', kind: 'success' });
```

## Files

- `packages/fx/src/components/input/Toaster.tsx` → `components/aicl/fx/components/input/Toaster.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
