# SessionSearch

One incremental combobox for sessions.

**Type.** `registry:ui` · **Package.** `@aicl/react` · **Category.** navigation

## Install

```bash
npx aicl add session-search
```

The same item, in the shadcn registry format:

```bash
npx shadcn@latest add ./registry/r/session-search.json
```

## npm import

```ts
import { SessionSearch } from '@aicl/react';
```

## Usage

```tsx
import { SessionSearch } from '@aicl/react';

<SessionSearch items={sessions} onSelect={open} />
```

## Slots

- `session-search`
- `session-search-icon`
- `session-search-input`
- `session-search-results`
- `session-search-status`
- `session-search-empty`

## States

| Attribute | Values |
| --- | --- |
| `data-empty` | `true` |
| `data-count` | `true` |

## Files

- `packages/react/src/sessions.tsx` → `components/aicl/sessions.tsx`

## Registry dependencies

`icon-slots`, `use-readable`

## npm dependencies

`react`, `@aicl/core`
