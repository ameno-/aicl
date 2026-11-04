# AnimatedPlan

A plan whose steps tick through pending, running and done.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add animated-plan
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/animated-plan.json
```

## npm import

```ts
import { AnimatedPlan } from '@aicl/fx';
```

## Usage

```tsx
import { AnimatedPlan } from '@aicl/fx';

<AnimatedPlan steps={steps} />
```

## Files

- `packages/fx/src/components/stream/AnimatedPlan.tsx` → `components/aicl/fx/components/stream/AnimatedPlan.tsx`
- `packages/fx/src/vendor/spell-ui/animated-checkbox.tsx` → `components/aicl/fx/vendor/spell-ui/animated-checkbox.tsx`
- `packages/fx/src/vendor/spell-ui/shimmer-text.tsx` → `components/aicl/fx/vendor/spell-ui/shimmer-text.tsx`
- `packages/fx/src/vendor/spell-ui/spinner.tsx` → `components/aicl/fx/vendor/spell-ui/spinner.tsx`

## Registry dependencies

`cn`, `fx-provider`, `rolling-number`

## npm dependencies

`react`, `motion`, `lucide-react`
