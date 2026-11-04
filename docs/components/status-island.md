# StatusIsland

A compact status chip that morphs between idle, working and done.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add status-island
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/status-island.json
```

## npm import

```ts
import { StatusIsland } from '@aicl/fx';
```

## Usage

```tsx
import { StatusIsland } from '@aicl/fx';

<StatusIsland status="working" label="Indexing" />
```

## Files

- `packages/fx/src/components/stream/StatusIsland.tsx` → `components/aicl/fx/components/stream/StatusIsland.tsx`
- `packages/fx/src/vendor/spell-ui/bars-spinner.tsx` → `components/aicl/fx/vendor/spell-ui/bars-spinner.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
