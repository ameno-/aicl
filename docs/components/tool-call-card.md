# ToolCallCard

A live tool-call card: pending, running, success, error, cancelled.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add tool-call-card
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/tool-call-card.json
```

## npm import

```ts
import { ToolCallCard } from '@aicl/fx';
```

## Usage

```tsx
import { ToolCallCard } from '@aicl/fx';

<ToolCallCard name="search" label="Search the repo" status="running" />
```

## Files

- `packages/fx/src/components/stream/ToolCallCard.tsx` → `components/aicl/fx/components/stream/ToolCallCard.tsx`
- `packages/fx/src/components/stream/Collapse.tsx` → `components/aicl/fx/components/stream/Collapse.tsx`
- `packages/fx/src/vendor/spell-ui/spinner.tsx` → `components/aicl/fx/vendor/spell-ui/spinner.tsx`

## Registry dependencies

`cn`, `fx-provider`, `border-beam`

## npm dependencies

`react`, `motion`, `lucide-react`
