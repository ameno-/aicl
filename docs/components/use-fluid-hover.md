# useFluidHover

One travelling highlight per list. The nearest-item rule is a pure function.

**Type.** `registry:hook` · **Package.** `@aicl/motion` · **Category.** hook

## Install

```bash
npx aicl add use-fluid-hover
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/use-fluid-hover.json
```

## npm import

```ts
import { useFluidHover, FluidHoverHighlight } from '@aicl/motion/react';
```

## Usage

```tsx
import { useFluidHover, FluidHoverHighlight } from '@aicl/motion/react';

const hover = useFluidHover();
<nav ref={hover.containerRef} {...hover.handlers}>
  <FluidHoverHighlight hover={hover} />
</nav>
```

## Files

- `packages/motion/src/react.tsx` → `lib/aicl/react.tsx`

## Registry dependencies

`motion`

## npm dependencies

`react`
