# SegmentedTabs

A sliding pill, or discrete tabs that widen to show the label.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add segmented-tabs
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/segmented-tabs.json
```

## npm import

```ts
import { SegmentedTabs } from '@aicl/fx';
```

## Usage

```tsx
import { SegmentedTabs } from '@aicl/fx';

<SegmentedTabs tabs={tabs} value={id} onChange={setId} />
```

## Files

- `packages/fx/src/components/input/SegmentedTabs.tsx` → `components/aicl/fx/components/input/SegmentedTabs.tsx`
- `packages/fx/src/vendor/uselayouts/discrete-tabs.tsx` → `components/aicl/fx/vendor/uselayouts/discrete-tabs.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
