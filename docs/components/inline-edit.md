# InlineEdit

Click-to-edit text. Enter commits, Escape reverts.

**Type.** `registry:ui` · **Package.** `@aicl/fx` · **Category.** fx-input

## Install

```bash
npx aicl add inline-edit
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/inline-edit.json
```

## npm import

```ts
import { InlineEdit } from '@aicl/fx';
```

## Usage

```tsx
import { InlineEdit } from '@aicl/fx';

<InlineEdit value={title} onSubmit={rename} />
```

## Files

- `packages/fx/src/vendor/uselayouts/inline-edit.tsx` → `components/aicl/fx/vendor/uselayouts/inline-edit.tsx`

## Registry dependencies

`cn`, `fx-provider`

## npm dependencies

`react`, `motion`, `lucide-react`
