# Button

A button. Variant, size and loading, with the glyphs as icon slots.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** content

## Install

```bash
npx aicl add button
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/button.json
```

## npm import

```ts
import { Button } from '@aicl/react';
```

## Usage

```tsx
import { Button } from '@aicl/react';

<Button variant="secondary" icon="plus">New task</Button>
<Button loading>Working</Button>
```

## Slots

- `button`
- `button-label`
- `button-icon`

## States

| Attribute | Values |
| --- | --- |
| `data-variant` | `default` `secondary` `destructive` `ghost` `outline` `link` |
| `data-size` | `sm` `md` `lg` |
| `data-loading` | `true` |
| `data-icon` | `true` |

## Files

- `packages/react/src/Button.tsx` → `components/aicl/Button.tsx`

## Registry dependencies

`icon-slots`

## npm dependencies

`react`, `@aicl/core`
