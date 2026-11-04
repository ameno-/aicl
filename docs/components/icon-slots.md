# Icon slots

Icons looked up by role, swappable through one provider. A primitive never imports an icon.

**Type.** `registry:lib` · **Package.** `@aicl/react` · **Category.** system

## Install

```bash
npx aicl add icon-slots
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/icon-slots.json
```

## npm import

```ts
import { Icon, IconProvider } from '@aicl/react';
```

## Usage

```tsx
import { Icon, IconProvider } from '@aicl/react';

<IconProvider icons={{ send: MySend }}>
  <Icon name="send" />
</IconProvider>
```

## Files

- `packages/react/src/icons.tsx` → `components/aicl/icons.tsx`

## Registry dependencies

_none_

## npm dependencies

`lucide-react`, `react`
