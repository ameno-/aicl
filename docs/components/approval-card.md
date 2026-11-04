# ApprovalCard

Allow, deny, or always-allow a pending tool call.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add approval-card
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/approval-card.json
```

## npm import

```ts
import { ApprovalCard } from '@aicl/fx';
```

## Usage

```tsx
import { ApprovalCard } from '@aicl/fx';

<ApprovalCard tool="bash" summary="List the directory" onApprove={allow} onDeny={deny} />
```

## Files

- `packages/fx/src/components/input/ApprovalCard.tsx` → `components/aicl/fx/components/input/ApprovalCard.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
