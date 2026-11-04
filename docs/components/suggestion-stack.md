# SuggestionStack

Follow-up chips that fan into a stack. The cousin of Fluid's queued-stack.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add suggestion-stack
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/suggestion-stack.json
```

## npm import

```ts
import { SuggestionStack } from '@aicl/fx';
```

## Usage

```tsx
import { SuggestionStack } from '@aicl/fx';

<SuggestionStack suggestions={items} onPick={ask} />
```

## Files

- `packages/fx/src/components/input/SuggestionStack.tsx` → `components/aicl/fx/components/input/SuggestionStack.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
