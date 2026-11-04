# StreamingText

Tokens arrive. Character, word, or instant reveal, with a caret that does not reflow.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add streaming-text
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/streaming-text.json
```

## npm import

```ts
import { StreamingText } from '@aicl/fx';
```

## Usage

```tsx
import { StreamingText } from '@aicl/fx';

<StreamingText text={text} streaming />
```

## Files

- `packages/fx/src/components/stream/StreamingText.tsx` → `components/aicl/fx/components/stream/StreamingText.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
