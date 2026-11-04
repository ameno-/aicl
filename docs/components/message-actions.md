# MessageActions

The per-message action row. Hidden until the row is hovered or focused.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** chat

## Install

```bash
npx aicl add message-actions
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/message-actions.json
```

## npm import

```ts
import { MessageActions } from '@aicl/react';
```

## Usage

```tsx
import { MessageActions } from '@aicl/react';

<MessageActions message={message} onAction={handle} />
```

## Slots

- `message-actions`

## States

| Attribute | Values |
| --- | --- |
| `data-visibility` | `auto` `always` |
| `data-resolved` | `painted` |
| `data-feedback` | `up` `down` `none` |
| `data-role` | `user` `assistant` `system` |
| `data-copied` | `true` |

## Files

- `packages/react/src/MessageActions.tsx` → `components/aicl/MessageActions.tsx`

## Registry dependencies

`icon-slots`

## npm dependencies

`react`, `@aicl/core`
