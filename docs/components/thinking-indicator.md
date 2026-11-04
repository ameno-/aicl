# ThinkingIndicator

Shimmer, dots or bars while the model thinks; collapses to "Thought for 24s".

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add thinking-indicator
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/thinking-indicator.json
```

## npm import

```ts
import { ThinkingIndicator } from '@aicl/fx';
```

## Usage

```tsx
import { ThinkingIndicator } from '@aicl/fx';

<ThinkingIndicator elapsedMs={2400} />
```

## Files

- `packages/fx/src/components/stream/ThinkingIndicator.tsx` → `components/aicl/fx/components/stream/ThinkingIndicator.tsx`
- `packages/fx/src/components/stream/format.ts` → `components/aicl/fx/components/stream/format.ts`
- `packages/fx/src/vendor/spell-ui/shimmer-text.tsx` → `components/aicl/fx/vendor/spell-ui/shimmer-text.tsx`
- `packages/fx/src/vendor/spell-ui/bars-spinner.tsx` → `components/aicl/fx/vendor/spell-ui/bars-spinner.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
