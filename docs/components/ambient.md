# Ambient

A WebGPU mesh gradient for idle and working states. CSS fallback, no telemetry.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add ambient
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/ambient.json
```

## npm import

```ts
import { Ambient } from '@aicl/fx';
```

## Usage

```tsx
import { Ambient } from '@aicl/fx';

<Ambient mood="working" />
```

## Files

- `packages/fx/src/components/Ambient.tsx` → `components/aicl/fx/components/Ambient.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`, `shaders`
