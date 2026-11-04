# CodeBlock

A highlighted code block with a copy button. The animated sibling of the primitive.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx

## Install

```bash
npx aicl add fx-code-block
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/fx-code-block.json
```

## npm import

```ts
import { CodeBlock } from '@aicl/fx';
```

## Usage

```tsx
import { CodeBlock } from '@aicl/fx';

<CodeBlock code={source} language="ts" />
```

## Files

- `packages/fx/src/components/stream/CodeBlock.tsx` → `components/aicl/fx/components/stream/CodeBlock.tsx`
- `packages/fx/src/vendor/spell-ui/copy-button.tsx` → `components/aicl/fx/vendor/spell-ui/copy-button.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
