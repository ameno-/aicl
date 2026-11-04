# Switch

A toggle. The label is a real label, not a placeholder for one.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** form

## Install

```bash
npx aicl add switch
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/switch.json
```

## npm import

```ts
import { Switch } from '@aicl/react';
```

## Usage

```tsx
import { Switch } from '@aicl/react';

<Switch checked={on} onCheckedChange={setOn} label="Stream reasoning" />
```

## Slots

- `switch`
- `switch-root`
- `switch-label`
- `switch-thumb`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `checked` `unchecked` |
| `data-disabled` | `true` |
| `data-busy` | `true` |
| `data-error` | `true` |

## Files

- `packages/react/src/platform.tsx` → `components/aicl/platform.tsx`

## Registry dependencies

`use-readable`

## npm dependencies

`react`, `@aicl/core`
