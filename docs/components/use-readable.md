# useReadable

Subscribe a React component to a core store without pulling the store into the tree.

**Type.** `registry:hook` · **Package.** `@aicl/react` · **Category.** hook

## Install

```bash
npx aicl add use-readable
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/use-readable.json
```

## npm import

```ts
import { useReadable } from '@aicl/react';
```

## Usage

```tsx
import { useReadable } from '@aicl/react';

const toasts = useReadable(queue.state);
```

## Files

- `packages/react/src/useReadable.ts` → `components/aicl/useReadable.ts`

## Registry dependencies

_none_

## npm dependencies

`react`, `@aicl/core`
