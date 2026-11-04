# PlanChecklist

An ordered plan with a derived rollup. Render only.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** chat

## Install

```bash
npx aicl add plan-checklist
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/plan-checklist.json
```

## npm import

```ts
import { PlanChecklist } from '@aicl/react';
```

## Usage

```tsx
import { PlanChecklist } from '@aicl/react';

<PlanChecklist title="Ship" items={[{ id: '1', label: 'Write the test', status: 'done' }]} />
```

## Slots

- `plan-checklist`
- `plan-rollup`
- `plan-title`
- `plan-count`

## States

| Attribute | Values |
| --- | --- |
| `data-count` | `true` |
| `data-progress` | `true` |

## Files

- `packages/react/src/PlanChecklist.tsx` → `components/aicl/PlanChecklist.tsx`

## Registry dependencies

`icon-slots`

## npm dependencies

`react`, `@aicl/core`
