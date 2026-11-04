# RollingNumber

A number that rolls to its next value. Jumps under reduced motion.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add rolling-number
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/rolling-number.json
```

## npm import

```ts
import { RollingNumber } from '@aicl/fx';
```

## Usage

```tsx
import { RollingNumber } from '@aicl/fx';

<RollingNumber value={42} />
```

## Files

- `packages/fx/src/components/stream/RollingNumber.tsx` → `components/aicl/fx/components/stream/RollingNumber.tsx`
- `packages/fx/src/vendor/cult-ui/rolling-number.tsx` → `components/aicl/fx/vendor/cult-ui/rolling-number.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
