# PromptComposer

The styled composer: attachments, a model picker, send that morphs into stop.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add prompt-composer
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/prompt-composer.json
```

## npm import

```ts
import { PromptComposer } from '@aicl/fx';
```

## Usage

```tsx
import { PromptComposer } from '@aicl/fx';

<PromptComposer value={draft} onChange={setDraft} onSubmit={send} status="ready" />
```

## Files

- `packages/fx/src/components/input/PromptComposer.tsx` → `components/aicl/fx/components/input/PromptComposer.tsx`

## Registry dependencies

`cn`, `fx-provider`, `smooth-dropdown`

## npm dependencies

`react`, `motion`, `lucide-react`
