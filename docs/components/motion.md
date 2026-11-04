# Motion system

Three spring tiers, their exits, fluid hover, and weight without reflow.

**Type.** `registry:lib` · **Package.** `@aicl/motion` · **Category.** system

## Install

```bash
npx aicl add motion
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/motion.json
```

## npm import

```ts
import '@aicl/motion/motion.css';
```

## Usage

```tsx
import '@aicl/motion/motion.css';
import { useFluidHover, FluidHoverHighlight, WeightText } from '@aicl/motion/react';
```

## Files

- `packages/motion/src/springs.ts` → `lib/aicl/springs.ts`
- `packages/motion/src/easing.ts` → `lib/aicl/easing.ts`
- `packages/motion/src/geometry.ts` → `lib/aicl/geometry.ts`
- `packages/motion/src/weight.ts` → `lib/aicl/weight.ts`
- `packages/motion/src/motion.css`

## Registry dependencies

`token-contract`

## npm dependencies

_none_
