# Field

A label, a control, a description, an error and a save acknowledgement.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** form

## Install

```bash
npx aicl add field
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/field.json
```

## npm import

```ts
import { Field } from '@aicl/react';
```

## Usage

```tsx
import { Field } from '@aicl/react';

<Field label="API base URL" error={error} required>
  <input value={url} onChange={(e) => setUrl(e.target.value)} />
</Field>
```

## Slots

- `field`
- `field-label`
- `field-description`
- `field-error`
- `field-save-state`

## States

| Attribute | Values |
| --- | --- |
| `data-invalid` | `true` |
| `data-save-state` | `idle` `saving` `saved` `error` |

## Files

- `packages/react/src/platform.tsx` → `components/aicl/platform.tsx`

## Registry dependencies

`use-readable`

## npm dependencies

`react`, `@aicl/core`
