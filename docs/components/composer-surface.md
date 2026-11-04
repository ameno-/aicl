# ComposerSurface

The composer surface: trigger menus, suggestion chips, attachments.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** chat

## Install

```bash
npx aicl add composer-surface
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/composer-surface.json
```

## npm import

```ts
import { ComposerSurface } from '@aicl/react';
```

## Usage

```tsx
import { SuggestionChips } from '@aicl/react';

<SuggestionChips suggestions={[{ id: '1', label: 'Make it shorter' }]} onSelect={insert} />
```

## Slots

- `trigger-menu`
- `trigger-menu-empty`
- `suggestion-chips`
- `suggestion-chip`
- `attachment-chip`
- `attachment-dropzone`
- `attachment-error`
- `attachment-icon`
- `attachment-name`
- `attachment-preview`
- `attachment-progress`
- `attachment-remove`
- `attachment-retry`
- `attachment-size`

## States

| Attribute | Values |
| --- | --- |
| `data-state` | `uploading` `uploaded` `error` |
| `data-empty` | `true` |

## Files

- `packages/react/src/composer-surface.tsx` → `components/aicl/composer-surface.tsx`

## Registry dependencies

`icon-slots`, `use-readable`

## npm dependencies

`react`, `@aicl/core`
