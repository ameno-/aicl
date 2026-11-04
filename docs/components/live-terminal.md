# LiveTerminal

Streaming shell output, stick-to-bottom, with a quiet chrome.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add live-terminal
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/live-terminal.json
```

## npm import

```ts
import { LiveTerminal } from '@aicl/fx';
```

## Usage

```tsx
import { LiveTerminal } from '@aicl/fx';

<LiveTerminal lines={lines} running />
```

## Files

- `packages/fx/src/components/stream/LiveTerminal.tsx` → `components/aicl/fx/components/stream/LiveTerminal.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
