# WorkSummary

Devin-style "Worked for 11s" disclosure; animates open and closed.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add work-summary
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/work-summary.json
```

## npm import

```ts
import { WorkSummary } from '@aicl/fx';
```

## Usage

```tsx
import { WorkSummary } from '@aicl/fx';

<WorkSummary seconds={11} steps={<ol><li>Edited two files</li></ol>} />
```

## Files

- `packages/fx/src/components/stream/WorkSummary.tsx` → `components/aicl/fx/components/stream/WorkSummary.tsx`
- `packages/fx/src/components/stream/Collapse.tsx` → `components/aicl/fx/components/stream/Collapse.tsx`
- `packages/fx/src/vendor/spell-ui/shimmer-text.tsx` → `components/aicl/fx/vendor/spell-ui/shimmer-text.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
